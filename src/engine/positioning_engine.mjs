import { fetchGoogleFlightsRoute } from '../scraper/google_flights.mjs';
import { generateAggregatorDeepLinks } from '../scraper/deep_links.mjs';

const LONDON_AIRPORTS = new Set(['LHR', 'LGW', 'LCY', 'STN', 'LTN', 'SEN']);

function parseTimeToMins(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const parts = hhmm.split(':').map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

function formatMinsToDuration(mins) {
  if (mins === null || mins === undefined || Number.isNaN(mins)) return 'N/A';
  const sign = mins < 0 ? '-' : '';
  const abs = Math.abs(Math.round(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h ${String(m).padStart(2, '0')}m`;
}

function addDaysToIsoDate(isoDate, daysToAdd) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + daysToAdd);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function diffDaysBetweenIsoDates(dateA, dateB) {
  const a = new Date(`${dateA}T00:00:00Z`);
  const b = new Date(`${dateB}T00:00:00Z`);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Computes the transfer buffer in minutes between two events:
 * Event 1 at (date1, time1) and Event 2 at (date2, time2).
 */
export function computeBufferMinutes(date1, time1, date2, time2) {
  const m1 = parseTimeToMins(time1);
  const m2 = parseTimeToMins(time2);
  if (m1 === null || m2 === null || !date1 || !date2) return null;
  const dayDiff = diffDaysBetweenIsoDates(date1, date2);
  return dayDiff * 1440 + (m2 - m1);
}

/**
 * Scores a positioning leg's buffer and timing convenience.
 * - Hard minimum: >= minBufferMins (default 150 mins = 2.5 hours)
 * - Sweet spot: 150 mins (2.5h) to 270 mins (4.5h)
 * - Penalizes excessive waiting (>4.5h) and anti-social early morning departures (<06:30)
 */
function scoreLegConvenience({
  bufferMins,
  minBufferMins = 150,
  maxBufferMins = 330, // 5.5 hours maximum buffer
  stops = 0,
  depTimeStr = '09:00',
  arrTimeStr = '12:00',
  isOvernightPositioning = false,
  allowOvernightPositioning = false,
}) {
  if (bufferMins === null || bufferMins < minBufferMins) {
    return { valid: false, score: -9999 };
  }
  // Hard maximum buffer to prevent excessive waiting or forced airport overnight stays
  if (bufferMins > maxBufferMins) {
    return { valid: false, score: -9999 };
  }
  // Strictly disallow overnight positioning stays requiring a hotel unless explicitly allowed
  if (!allowOvernightPositioning && isOvernightPositioning) {
    return { valid: false, score: -9999 };
  }

  let score = 100;

  // Prefer nonstop positioning flights strongly
  if (stops === 0) {
    score += 50;
  } else {
    score -= stops * 45;
  }

  // Sweet spot buffer: 2.5h (150m) to 4.5h (270m)
  if (bufferMins >= 150 && bufferMins <= 270) {
    score += 40;
    // Slight preference for ~3h - 3.5h (180m - 210m) ideal separate-ticket buffer
    score -= Math.abs(bufferMins - 195) * 0.1;
  } else if (bufferMins > 270 && bufferMins <= 420) {
    // 4.5h to 7h wait
    score += 10 - (bufferMins - 270) * 0.2;
  } else {
    // >7h or overnight wait
    score -= (bufferMins - 270) * 0.22;
  }

  if (isOvernightPositioning) {
    score -= 35;
  }

  // Departure time convenience (e.g. avoid 5am arrivals/departures when a 10am-1pm option exists)
  const depMins = parseTimeToMins(depTimeStr) ?? 540;
  const arrMins = parseTimeToMins(arrTimeStr) ?? 720;
  if (depMins >= 450 && depMins <= 1140) {
    // 07:30 to 19:00 departure
    score += 20;
  } else if (depMins >= 390 && depMins < 450) {
    // 06:30 to 07:29 departure
    score += 5;
  } else {
    // Very early morning (<06:30) or very late night
    score -= 20;
  }

  if (arrMins < 420) {
    // Arriving before 07:00 AM
    score -= 25;
  }

  return { valid: true, score: Number(score.toFixed(1)) };
}

function summarizePositioningLeg(itin, bufferMins, bufferDirectionLabel) {
  const firstSeg = itin.segments[0] || {};
  const lastSeg = itin.segments[itin.segments.length - 1] || {};
  return {
    airlines: itin.airlines,
    primaryCarrierCode: itin.primaryAirlineCode,
    flightNumbers: itin.segments.map((s) => s.flightNumber).join(' + '),
    origin: itin.origin || firstSeg.from,
    destination: itin.destination || lastSeg.to,
    departureDate: itin.departureDate || firstSeg.departureDate,
    departureTime: itin.departureTime,
    arrivalDate: itin.arrivalDate || lastSeg.arrivalDate,
    arrivalTime: itin.arrivalTime,
    durationHuman: itin.totalDurationHuman,
    stops: itin.stops,
    aircraft: itin.segments.map((s) => s.aircraft).join(', '),
    transferBufferMins: bufferMins,
    transferBufferHuman: formatMinsToDuration(bufferMins),
    transferAlignmentNote: `${formatMinsToDuration(bufferMins)} ${bufferDirectionLabel}`,
  };
}

/**
 * Finds the best 2-3 separate-booking Return Economy flights from `homeAirport` (default `LHR`)
 * to the European departure hub (`hubIata`), ensuring:
 * 1. Outbound Economy flight (`LHR -> HUB`) arrives >= 2.5 hours (150 mins) BEFORE the Business Class outbound flight departs.
 * 2. Inbound Economy flight (`HUB -> LHR`) departs >= 2.5 hours (150 mins) AFTER the Business Class return flight lands at the hub
 *    (automatically accounting for overnight long-haul return flights that land +1 or +2 days later).
 * 3. Prioritizes convenient timings (2.5h - 4.5h sweet-spot transfer window) alongside price, returning 2-3 curated options.
 */
export async function findLhrPositioningFlights({
  homeAirport = 'LHR',
  hubIata,
  businessOutboundDate, // YYYY-MM-DD
  businessOutboundDepTime, // HH:MM
  businessReturnHubArrivalDate, // YYYY-MM-DD (actual date the return long-haul lands back at the European hub!)
  businessReturnHubArrivalTime, // HH:MM (actual time the return long-haul lands back at the European hub!)
  minBufferHours = 2.5,
  maxBufferHours = 5.5,
  allowOvernightPositioning = false,
  currency = 'GBP',
} = {}) {
  const home = String(homeAirport || 'LHR').trim().toUpperCase();
  const hub = String(hubIata || '').trim().toUpperCase();

  if (!hub || LONDON_AIRPORTS.has(hub) || home === hub) {
    return {
      positioningNeeded: false,
      reason: `Business Class flight already departs from London (${hub}).`,
      options: [],
    };
  }

  const minBufferMins = Math.round(Number(minBufferHours) * 60); // default 150 mins (2.5h)
  const maxBufferMins = Math.round(Number(maxBufferHours) * 60); // default 330 mins (5.5h)

  // Determine candidate outbound date(s) for LHR -> HUB:
  const bizOutMins = parseTimeToMins(businessOutboundDepTime) ?? 720;
  const checkSameDayOut = bizOutMins - minBufferMins >= 450;
  const checkPrevDayOut = allowOvernightPositioning && bizOutMins - minBufferMins < 660;

  // Determine candidate inbound date(s) for HUB -> LHR:
  const retArrivalDate = businessReturnHubArrivalDate || businessOutboundDate;
  const bizRetArrMins = parseTimeToMins(businessReturnHubArrivalTime) ?? 540;
  const primaryRetDate =
    bizRetArrMins + minBufferMins <= 1305 || !allowOvernightPositioning
      ? retArrivalDate
      : addDaysToIsoDate(retArrivalDate, 1);

  const outboundDatesToQuery = [];
  if (checkSameDayOut || !allowOvernightPositioning) outboundDatesToQuery.push(businessOutboundDate);
  if (checkPrevDayOut) outboundDatesToQuery.push(addDaysToIsoDate(businessOutboundDate, -1));
  if (outboundDatesToQuery.length === 0) outboundDatesToQuery.push(businessOutboundDate);

  const inboundDatesToQuery = [primaryRetDate];
  if (allowOvernightPositioning && primaryRetDate === retArrivalDate && bizRetArrMins + minBufferMins >= 1080) {
    inboundDatesToQuery.push(addDaysToIsoDate(retArrivalDate, 1));
  }

  // Fetch Economy Round-Trip (LHR -> HUB) and Economy Return schedules (HUB -> LHR) concurrently
  const outFetches = outboundDatesToQuery.map(async (outDate) => {
    const resp = await fetchGoogleFlightsRoute({
      origin: home,
      destination: hub,
      outboundDate: outDate,
      returnDate: primaryRetDate,
      cabin: 'ECONOMY',
      currency,
    });
    return { outDate, itineraries: resp.itineraries || [] };
  });

  const inFetches = inboundDatesToQuery.map(async (inDate) => {
    const resp = await fetchGoogleFlightsRoute({
      origin: hub,
      destination: home,
      outboundDate: inDate,
      returnDate: null,
      cabin: 'ECONOMY',
      currency,
    });
    return { inDate, itineraries: resp.itineraries || [] };
  });

  const [outResults, inResults] = await Promise.all([
    Promise.all(outFetches),
    Promise.all(inFetches),
  ]);

  // Evaluate qualifying Outbound (LHR -> HUB) Economy flights
  const validOutbounds = [];
  for (const { outDate, itineraries } of outResults) {
    const isPrevDay = outDate !== businessOutboundDate;
    for (const itin of itineraries) {
      const arrDate = itin.arrivalDate || outDate;
      const bufferMins = computeBufferMinutes(
        arrDate,
        itin.arrivalTime,
        businessOutboundDate,
        businessOutboundDepTime
      );
      const conv = scoreLegConvenience({
        bufferMins,
        minBufferMins,
        maxBufferMins,
        stops: itin.stops,
        depTimeStr: itin.departureTime,
        arrTimeStr: itin.arrivalTime,
        isOvernightPositioning: isPrevDay,
        allowOvernightPositioning,
      });
      if (!conv.valid) continue;

      validOutbounds.push({
        itin,
        outDate,
        isPrevDay,
        bufferMins,
        convenienceScore: conv.score,
      });
    }
  }

  // Evaluate qualifying Inbound (HUB -> LHR) Economy flights
  const validInbounds = [];
  for (const { inDate, itineraries } of inResults) {
    const isNextDay = inDate !== retArrivalDate;
    for (const itin of itineraries) {
      const depDate = itin.departureDate || inDate;
      const bufferMins = computeBufferMinutes(
        retArrivalDate,
        businessReturnHubArrivalTime,
        depDate,
        itin.departureTime
      );
      const conv = scoreLegConvenience({
        bufferMins,
        minBufferMins,
        maxBufferMins,
        stops: itin.stops,
        depTimeStr: itin.departureTime,
        arrTimeStr: itin.arrivalTime,
        isOvernightPositioning: isNextDay,
        allowOvernightPositioning,
      });
      if (!conv.valid) continue;

      validInbounds.push({
        itin,
        inDate,
        isNextDay,
        bufferMins,
        convenienceScore: conv.score,
      });
    }
  }

  if (validOutbounds.length === 0 || validInbounds.length === 0) {
    return {
      positioningNeeded: true,
      homeAirport: home,
      hubAirport: hub,
      minBufferHoursEnforced: minBufferHours,
      businessScheduleReference: {
        outboundHubDeparture: `${businessOutboundDate} ${businessOutboundDepTime} (from ${hub})`,
        inboundHubArrival: `${retArrivalDate} ${businessReturnHubArrivalTime} (at ${hub})`,
      },
      options: [],
      note: 'No qualifying positioning flights found meeting the >= 2.5h buffer window.',
    };
  }

  // Pair Outbound + Inbound into complete Return Economy tickets
  const pairedCandidates = [];
  for (const outCand of validOutbounds) {
    for (const inCand of validInbounds) {
      const sameCarrier =
        outCand.itin.primaryAirlineCode &&
        outCand.itin.primaryAirlineCode === inCand.itin.primaryAirlineCode;

      // Estimate round-trip Economy price:
      // Outbound query was a round-trip query so `outCand.itin.price` is already a round-trip Economy fare when paired with the same carrier or lowest return!
      const outRtPrice = outCand.itin.price || 120;
      const inOwPrice = inCand.itin.price || 60;
      const estimatedRoundTripEconomyGbp = sameCarrier
        ? outRtPrice
        : Math.max(outRtPrice, Math.round(outRtPrice * 0.55 + inOwPrice));

      // Combined convenience + price score (prioritizing convenience per user requirement!)
      const totalConvenienceScore =
        outCand.convenienceScore +
        inCand.convenienceScore +
        (sameCarrier ? 20 : 0) -
        estimatedRoundTripEconomyGbp * 0.12;

      pairedCandidates.push({
        outCand,
        inCand,
        sameCarrier,
        estimatedRoundTripEconomyGbp,
        totalConvenienceScore: Number(totalConvenienceScore.toFixed(1)),
      });
    }
  }

  // Sort primarily by totalConvenienceScore descending
  pairedCandidates.sort((a, b) => b.totalConvenienceScore - a.totalConvenienceScore);

  // Pick 2-3 distinct, high-value options:
  // 1. Most Convenient / Sweet-Spot Timed Option
  // 2. Second Best Timed / Balanced Convenience & Price Option (distinct flight combination)
  // 3. Cheapest Qualifying Safe-Buffer Option (or Extra Buffer Margin Option)
  const selectedPairs = [];
  const usedSignatures = new Set();

  const addCandidateIfDistinct = (cand, badge) => {
    if (!cand) return;
    const sig = `${cand.outCand.itin.departureTime}-${cand.inCand.itin.departureTime}-${cand.outCand.outDate}`;
    if (usedSignatures.has(sig)) return;
    usedSignatures.add(sig);
    selectedPairs.push({ ...cand, badge });
  };

  // Option 1: Best Convenience / Sweet-Spot Alignment
  addCandidateIfDistinct(
    pairedCandidates[0],
    'Option 1 — Best Timed & Most Convenient Alignment (Recommended)'
  );

  // Option 2: Distinct outbound or inbound flight with strong convenience
  const secondConvenient = pairedCandidates.find(
    (c) =>
      c.outCand.itin.departureTime !== pairedCandidates[0]?.outCand.itin.departureTime ||
      c.inCand.itin.departureTime !== pairedCandidates[0]?.inCand.itin.departureTime
  );
  addCandidateIfDistinct(
    secondConvenient,
    'Option 2 — Alternative Convenient Schedule / Extra Buffer'
  );

  // Option 3: Lowest Price among nonstop >=2.5h buffer options (or next best distinct flight)
  const cheapestValid = [...pairedCandidates]
    .filter((c) => c.outCand.itin.stops === 0 && c.inCand.itin.stops === 0)
    .sort((a, b) => a.estimatedRoundTripEconomyGbp - b.estimatedRoundTripEconomyGbp)[0];
  addCandidateIfDistinct(
    cheapestValid || pairedCandidates[2],
    'Option 3 — Lowest-Priced Qualifying Return Economy (≥2.5h Buffer)'
  );

  // Ensure we have up to 3 options if more exist
  for (const cand of pairedCandidates) {
    if (selectedPairs.length >= 3) break;
    addCandidateIfDistinct(cand, `Option ${selectedPairs.length + 1} — Qualifying Positioning Flight`);
  }

  const formattedOptions = selectedPairs.slice(0, 3).map((item, idx) => {
    const outDate = item.outCand.outDate;
    const inDate = item.inCand.inDate;
    const links = generateAggregatorDeepLinks({
      origin: home,
      destination: hub,
      outboundDate: outDate,
      returnDate: inDate,
      cabin: 'ECONOMY',
      currency,
      airlineCode: item.sameCarrier ? item.outCand.itin.primaryAirlineCode : null,
    });

    return {
      optionRank: idx + 1,
      badge: item.badge,
      separateTicketRoundTripPriceGbp: item.estimatedRoundTripEconomyGbp,
      currency,
      convenienceScore: item.totalConvenienceScore,
      outboundEconomyPositioning: summarizePositioningLeg(
        item.outCand.itin,
        item.outCand.bufferMins,
        `before ${hub} Business Class departure (${businessOutboundDate} ${businessOutboundDepTime})`
      ),
      inboundEconomyPositioning: summarizePositioningLeg(
        item.inCand.itin,
        item.inCand.bufferMins,
        `after ${hub} Business Class lands (${retArrivalDate} ${businessReturnHubArrivalTime})`
      ),
      bookingLinks: links,
    };
  });

  return {
    positioningNeeded: true,
    homeAirport: home,
    hubAirport: hub,
    minBufferHoursEnforced: minBufferHours,
    businessScheduleReference: {
      outboundHubDeparture: `${businessOutboundDate} at ${businessOutboundDepTime} (from ${hub})`,
      inboundHubArrival: `${retArrivalDate} at ${businessReturnHubArrivalTime} (lands at ${hub})`,
    },
    options: formattedOptions,
  };
}
