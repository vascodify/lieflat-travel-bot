import {
  EUROPEAN_HUB_TIERS,
  resolveDestinations,
  resolveOriginHubs,
} from '../data/hubs_and_routes.mjs';
import { normalizeRequestedAircraftFamilies } from '../data/aircraft_db.mjs';
import { expandDatePairs } from './date_expander.mjs';
import { evaluateDirectionItinerary } from './filter_engine.mjs';
import { fetchGoogleFlightsRoute } from '../scraper/google_flights.mjs';
import { generateAggregatorDeepLinks } from '../scraper/deep_links.mjs';
import { fetchCabinAndBedPhotos } from '../scraper/cabin_photos.mjs';
import { findLhrPositioningFlights } from './positioning_engine.mjs';

async function runWithConcurrency(tasks, concurrency = 6) {
  const results = new Array(tasks.length);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const current = idx++;
      results[current] = await tasks[current]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function getHubTaxMetadata(iata) {
  const code = String(iata).toUpperCase();
  for (const [tierName, hubs] of Object.entries(EUROPEAN_HUB_TIERS)) {
    const found = hubs.find((h) => h.iata === code);
    if (found) {
      return { tier: tierName, ...found };
    }
  }
  return {
    tier: 'custom',
    iata: code,
    city: code,
    apdTaxEstimateGbp: null,
    taxNotes: 'Custom origin airport',
  };
}

/**
 * Orchestrates multi-hub, multi-destination, and flexible-date searches with strict leg-by-leg
 * widebody, lie-flat, duration, budget, and airline blacklist verification.
 */
export async function orchestrateLieFlatSearch({
  origins = null,
  preferLowApd = true,
  maxOriginHubs = 5,
  destinations = null,
  regions = null,
  maxDestinations = 6,
  outboundDate = null,
  returnDate = null,
  departureDayOfWeek = 'Friday',
  returnDayOfWeek = 'Tuesday',
  nights = 4,
  monthsAhead = 2,
  targetMonth = null,
  maxDatePairs = 2,
  maxPriceGbp = 1700,
  currency = 'GBP',
  minDirectHours = 8,
  minConnectingLongLegHours = 7,
  maxLayoverHours = 8,
  allowLieFlatNarrowbodyExceptions = true,
  allowedAircraftFamilies = null,
  customBlockedAirlines = [],
  verifyReturnLeg = true,
  includeCabinPhotos = true,
  photoDownloadDir = null,
  includeLhrPositioning = true,
  homeAirport = 'LHR',
  minPositioningBufferHours = 2.5,
  concurrency = 6,
  maxResults = 15,
} = {}) {
  const selectedOrigins = resolveOriginHubs({
    origins,
    preferLowApd,
    maxHubs: maxOriginHubs,
  });

  const selectedDestinations = resolveDestinations({
    destinations,
    regions,
    maxDestinations,
  });

  const datePairs = expandDatePairs({
    outboundDate,
    returnDate,
    departureDayOfWeek,
    returnDayOfWeek,
    nights,
    monthsAhead,
    targetMonth,
    maxDatePairs,
  });

  const aircraftNormalization = normalizeRequestedAircraftFamilies(allowedAircraftFamilies);

  // Build search tasks across (Origin x Destination x DatePair)
  const searchTasks = [];
  for (const datePair of datePairs) {
    for (const orig of selectedOrigins) {
      for (const dest of selectedDestinations) {
        if (orig === dest) continue;
        searchTasks.push(async () => {
          const resp = await fetchGoogleFlightsRoute({
            origin: orig,
            destination: dest,
            outboundDate: datePair.outboundDate,
            returnDate: datePair.returnDate,
            cabin: 'BUSINESS',
            currency,
          });
          return {
            origin: orig,
            destination: dest,
            datePair,
            resp,
          };
        });
      }
    }
  }

  const rawSweepResults = await runWithConcurrency(searchTasks, concurrency);

  const outboundCandidates = [];
  const rejectionStats = {
    totalItinerariesScanned: 0,
    networkErrors: 0,
    rejectedOverBudget: 0,
    rejectedBlockedAirline: 0,
    rejectedShortDuration: 0,
    rejectedEquipmentOrNonLieFlat: 0,
    sampleRejections: [],
  };

  for (const item of rawSweepResults) {
    const { origin, destination, datePair, resp } = item;
    if (!resp.ok) {
      rejectionStats.networkErrors++;
      continue;
    }
    if (!Array.isArray(resp.itineraries)) continue;

    for (const itin of resp.itineraries) {
      rejectionStats.totalItinerariesScanned++;

      const evalOut = evaluateDirectionItinerary(itin, {
        maxPriceGbp,
        checkPrice: true,
        minDirectHours,
        minConnectingLongLegHours,
        maxLayoverHours,
        allowLieFlatNarrowbodyExceptions,
        allowedAircraftFamilies,
        customBlockedAirlines,
      });

      if (!evalOut.passed) {
        const reasonStr = evalOut.reasons.join('; ');
        if (reasonStr.includes('exceeds max budget') || reasonStr.includes('Missing fare')) {
          rejectionStats.rejectedOverBudget++;
        } else if (reasonStr.includes('blocked airline')) {
          rejectionStats.rejectedBlockedAirline++;
        } else if (reasonStr.includes('threshold') || reasonStr.includes('no leg >=')) {
          rejectionStats.rejectedShortDuration++;
        } else {
          rejectionStats.rejectedEquipmentOrNonLieFlat++;
        }
        if (
          rejectionStats.sampleRejections.length < 10 &&
          !reasonStr.includes('exceeds max budget') &&
          !reasonStr.includes('Missing fare')
        ) {
          rejectionStats.sampleRejections.push({
            route: `${origin}->${destination} (${datePair.outboundDate})`,
            price: itin.price ? `£${itin.price}` : 'N/A',
            airlines: itin.airlines.join(', '),
            reason: reasonStr,
          });
        }
        continue;
      }

      outboundCandidates.push({
        origin,
        destination,
        datePair,
        outboundItinerary: itin,
        outboundEvaluation: evalOut,
      });
    }
  }

  // Sort outbound candidates by price ascending before verifying return legs
  outboundCandidates.sort((a, b) => (a.outboundItinerary.price || 99999) - (b.outboundItinerary.price || 99999));

  // Deduplicate by (origin, destination, outboundDate, returnDate, primaryAirlineCode, price)
  const uniqueCandidates = [];
  const seenKeys = new Set();
  for (const cand of outboundCandidates) {
    const key = `${cand.origin}-${cand.destination}-${cand.datePair.outboundDate}-${cand.datePair.returnDate}-${cand.outboundItinerary.primaryAirlineCode}-${cand.outboundItinerary.price}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueCandidates.push(cand);
    }
  }

  const topToVerify = uniqueCandidates.slice(0, Math.max(maxResults * 2, 20));

  // Verify Return Leg schedules AND exact paired round-trip pricing (Step 2 of Google Flights)
  const returnCache = new Map();
  if (verifyReturnLeg && topToVerify.length > 0) {
    const uniqueReturnQueries = [];
    for (const cand of topToVerify) {
      const segSig = cand.outboundItinerary.segments.map((s) => s.flightNumber).join('+');
      const rKey = `${cand.origin}->${cand.destination}@${cand.datePair.outboundDate}/${cand.datePair.returnDate}#${segSig}`;
      if (!returnCache.has(rKey)) {
        returnCache.set(rKey, null);
        uniqueReturnQueries.push({
          origin: cand.origin,
          destination: cand.destination,
          outboundDate: cand.datePair.outboundDate,
          returnDate: cand.datePair.returnDate,
          selectedOutboundSegments: cand.outboundItinerary.segments,
          rKey,
        });
      }
    }

    const returnTasks = uniqueReturnQueries.map((rq) => async () => {
      // Query Google Flights Step 2 ("Returning flights") with the selected outbound segments locked in!
      // This returns the exact combined round-trip price for every return option paired with that outbound.
      const resp = await fetchGoogleFlightsRoute({
        origin: rq.origin,
        destination: rq.destination,
        outboundDate: rq.outboundDate,
        returnDate: rq.returnDate,
        selectedOutboundSegments: rq.selectedOutboundSegments,
        cabin: 'BUSINESS',
        currency,
      });
      return { rKey: rq.rKey, itineraries: resp.itineraries || [] };
    });

    const returnResponses = await runWithConcurrency(returnTasks, concurrency);
    for (const r of returnResponses) {
      returnCache.set(r.rKey, r.itineraries);
    }
  }

  const verifiedMatches = [];
  const positioningCache = new Map();

  for (const cand of topToVerify) {
    const { origin, destination, datePair, outboundItinerary, outboundEvaluation } = cand;
    let bestReturnMatch = null;

    if (verifyReturnLeg) {
      const segSig = outboundItinerary.segments.map((s) => s.flightNumber).join('+');
      const rKey = `${origin}->${destination}@${datePair.outboundDate}/${datePair.returnDate}#${segSig}`;
      const returnItins = returnCache.get(rKey) || [];

      // Evaluate each paired return itinerary against:
      // 1. Exact paired round-trip budget (`rItin.price <= maxPriceGbp`)
      // 2. Max layover sanity check (`maxLayoverHours`) so 29h phantom layovers are rejected
      // 3. Widebody / True Lie-Flat / Duration / Airline Blocklist rules
      const passingReturns = [];
      for (const rItin of returnItins) {
        const evalRet = evaluateDirectionItinerary(rItin, {
          maxPriceGbp,
          checkPrice: rItin.price !== null && rItin.price !== undefined,
          minDirectHours,
          minConnectingLongLegHours,
          maxLayoverHours,
          allowLieFlatNarrowbodyExceptions,
          allowedAircraftFamilies,
          customBlockedAirlines,
        });
        if (evalRet.passed) {
          passingReturns.push({ itinerary: rItin, evaluation: evalRet });
        }
      }

      if (passingReturns.length === 0) {
        // No return flight paired with this outbound met the true round-trip budget + layover + widebody rules
        continue;
      }

      // Sort passing returns by true paired round-trip price ascending, then by total duration ascending
      passingReturns.sort((a, b) => {
        const pa = a.itinerary.price ?? outboundItinerary.price ?? 99999;
        const pb = b.itinerary.price ?? outboundItinerary.price ?? 99999;
        if (pa !== pb) return pa - pb;
        return (a.itinerary.totalDurationMins || 9999) - (b.itinerary.totalDurationMins || 9999);
      });

      bestReturnMatch = passingReturns[0];
    }

    const verifiedRoundTripPriceGbp =
      bestReturnMatch?.itinerary?.price ?? outboundItinerary.price;

    const hubTax = getHubTaxMetadata(origin);
    const deepLinks = generateAggregatorDeepLinks({
      origin,
      destination,
      outboundDate: datePair.outboundDate,
      returnDate: datePair.returnDate,
      cabin: 'BUSINESS',
      currency,
      airlineCode: outboundItinerary.primaryAirlineCode,
      selectedOutboundSegments: outboundItinerary.segments,
      selectedReturnSegments: bestReturnMatch?.itinerary?.segments || null,
    });

    const primaryLongLeg = outboundEvaluation.qualifyingLongLegs[0] || {};
    const photoAirline =
      primaryLongLeg.operatedBy ||
      primaryLongLeg.carrier ||
      outboundItinerary.airlines[0] ||
      outboundItinerary.primaryAirlineCode;
    const photoAircraft = primaryLongLeg.aircraft || 'Widebody';

    const cabinPhotos = includeCabinPhotos
      ? await fetchCabinAndBedPhotos({
          airlineName: photoAirline,
          aircraftName: photoAircraft,
          downloadDir: photoDownloadDir,
        })
      : null;

    const inboundHubArrivalDate =
      bestReturnMatch?.itinerary?.arrivalDate || datePair.returnDate;
    const inboundHubArrivalTime =
      bestReturnMatch?.itinerary?.arrivalTime || '12:00';

    let lhrPositioning = null;
    if (includeLhrPositioning) {
      const posKey = `${homeAirport}-${origin}-${datePair.outboundDate}-${outboundItinerary.departureTime}-${inboundHubArrivalDate}-${inboundHubArrivalTime}`;
      if (!positioningCache.has(posKey)) {
        const posRes = await findLhrPositioningFlights({
          homeAirport,
          hubIata: origin,
          businessOutboundDate: datePair.outboundDate,
          businessOutboundDepTime: outboundItinerary.departureTime,
          businessReturnHubArrivalDate: inboundHubArrivalDate,
          businessReturnHubArrivalTime: inboundHubArrivalTime,
          minBufferHours: minPositioningBufferHours,
          currency,
        });
        positioningCache.set(posKey, posRes);
      }
      lhrPositioning = positioningCache.get(posKey);
    }

    const bestPositioningFareGbp =
      lhrPositioning?.options?.[0]?.separateTicketRoundTripPriceGbp || 0;

    verifiedMatches.push({
      rank: verifiedMatches.length + 1,
      route: `${origin} ⇄ ${destination}`,
      originHub: hubTax,
      destination,
      dates: {
        outboundDate: datePair.outboundDate,
        outboundDayOfWeek: datePair.outboundDow,
        returnDate: datePair.returnDate,
        returnDayOfWeek: datePair.returnDow,
        nights: datePair.nights,
      },
      totalRoundTripPriceGbp: verifiedRoundTripPriceGbp,
      combinedTotalWithRecommendedLhrPositioningGbp:
        verifiedRoundTripPriceGbp && bestPositioningFareGbp
          ? verifiedRoundTripPriceGbp + bestPositioningFareGbp
          : verifiedRoundTripPriceGbp,
      currency,
      primaryCarriers: outboundItinerary.airlines,
      usesNarrowbodyLieFlatException:
        outboundEvaluation.usesNarrowbodyException ||
        Boolean(bestReturnMatch?.evaluation?.usesNarrowbodyException),
      outbound: {
        departureDate: outboundItinerary.departureDate || datePair.outboundDate,
        departureTime: outboundItinerary.departureTime,
        arrivalDate: outboundItinerary.arrivalDate,
        arrivalTime: outboundItinerary.arrivalTime,
        totalDuration: outboundItinerary.totalDurationHuman,
        stops: outboundItinerary.stops,
        qualifyingLongLegs: outboundEvaluation.qualifyingLongLegs,
        shortFeederLegs: outboundEvaluation.shortFeederLegs,
        layovers: outboundItinerary.layovers,
      },
      inbound: bestReturnMatch
        ? {
            departureDate: bestReturnMatch.itinerary.departureDate || datePair.returnDate,
            departureTime: bestReturnMatch.itinerary.departureTime,
            arrivalDate: inboundHubArrivalDate,
            arrivalTime: bestReturnMatch.itinerary.arrivalTime,
            totalDuration: bestReturnMatch.itinerary.totalDurationHuman,
            stops: bestReturnMatch.itinerary.stops,
            qualifyingLongLegs: bestReturnMatch.evaluation.qualifyingLongLegs,
            shortFeederLegs: bestReturnMatch.evaluation.shortFeederLegs,
            layovers: bestReturnMatch.itinerary.layovers,
          }
        : null,
      cabinPhotos,
      lhrPositioning,
      bookingLinks: deepLinks,
    });

    if (verifiedMatches.length >= maxResults) break;
  }

  return {
    searchSummary: {
      originsScanned: selectedOrigins,
      destinationsScanned: selectedDestinations,
      datePairsScanned: datePairs,
      maxPriceGbp,
      durationRules: {
        directFlightMinHours: minDirectHours,
        connectingLongLegMinHours: minConnectingLongLegHours,
      },
      allowLieFlatNarrowbodyExceptions,
      aircraftFilterNotes: aircraftNormalization.notes,
      blockedAirlinesEnforced: [
        'Air India (AI)',
        'IndiGo (6E)',
        'Icelandair (FI)',
        'EgyptAir (MS)',
        ...customBlockedAirlines,
      ],
      stats: rejectionStats,
      verifiedMatchesCount: verifiedMatches.length,
    },
    matches: verifiedMatches,
  };
}
