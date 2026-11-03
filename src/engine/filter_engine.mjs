import {
  classifySegmentEquipment,
  normalizeRequestedAircraftFamilies,
} from '../data/aircraft_db.mjs';
import { checkAirlineBlocked } from '../data/airlines_db.mjs';

/**
 * Evaluates a single direction (outbound or inbound) itinerary against all strict criteria:
 * 1. Unconditional + custom airline blocklist on every segment (both marketing & operating carrier)
 * 2. Long-haul duration rule:
 *    - Direct (0 stops): single flight duration >= minDirectHours (default 8h / 480 mins)
 *    - Connecting (1+ stops): at least one leg >= minConnectingLongLegHours (default 7h / 420 mins)
 * 3. Equipment & Lie-Flat rule:
 *    - Every qualifying long leg (>= 7h connecting or >= 8h direct) MUST be on a verified Widebody
 *      with true 180° lie-flat seats OR an approved True Lie-Flat Narrowbody Exception (e.g. JetBlue Mint A321neo, TAP A321LR).
 *    - Short connecting feeder legs (< 7h) CAN be on narrowbody aircraft.
 */
export function evaluateDirectionItinerary(
  itinerary,
  {
    maxPriceGbp = 1700,
    checkPrice = true,
    minDirectHours = 8,
    minConnectingLongLegHours = 7,
    maxLayoverHours = 8,
    allowLieFlatNarrowbodyExceptions = true,
    allowedAircraftFamilies = null,
    customBlockedAirlines = [],
  } = {}
) {
  const reasons = [];

  if (!itinerary || !Array.isArray(itinerary.segments) || itinerary.segments.length === 0) {
    return { passed: false, reasons: ['Empty or invalid itinerary segments'] };
  }

  // 1. Price check (when evaluating outbound or paired return with round-trip price)
  if (checkPrice && maxPriceGbp !== null && maxPriceGbp !== undefined) {
    if (itinerary.price === null || itinerary.price === undefined) {
      reasons.push('Missing fare price');
      return { passed: false, reasons };
    }
    if (itinerary.price > maxPriceGbp) {
      reasons.push(`Price £${itinerary.price} exceeds max budget £${maxPriceGbp}`);
      return { passed: false, reasons };
    }
  }

  // 1b. Layover sanity check (rejects phantom teaser fares that require 12h-29h layovers)
  if (maxLayoverHours !== null && maxLayoverHours !== undefined && Array.isArray(itinerary.layovers)) {
    const maxLayoverMins = Math.round(Number(maxLayoverHours) * 60);
    for (const lay of itinerary.layovers) {
      if (lay.durationMins > maxLayoverMins) {
        reasons.push(
          `Layover at ${lay.airport || lay.city} is ${lay.durationHuman} (${lay.durationMins}m), exceeding the ${maxLayoverHours}h max layover limit.`
        );
        return { passed: false, reasons };
      }
    }
  }

  const normalizedFamilies = allowedAircraftFamilies
    ? normalizeRequestedAircraftFamilies(allowedAircraftFamilies).families
    : null;

  // 2. Check every segment for blocked airlines (marketing + operating) and classify equipment
  const enrichedSegments = [];
  for (const seg of itinerary.segments) {
    const blockCheck = checkAirlineBlocked({
      carrierCode: seg.carrierCode,
      carrierName: seg.carrierName,
      operatingCarrierName: seg.operatingCarrierName,
      itineraryAirlines: itinerary.airlines,
      customBlockedList: customBlockedAirlines,
    });

    if (blockCheck.isBlocked) {
      reasons.push(
        `Leg ${seg.from}->${seg.to} (${seg.flightNumber}) uses blocked airline ${blockCheck.matchedAirline}: ${blockCheck.reason}`
      );
      return { passed: false, reasons };
    }

    const eqClass = classifySegmentEquipment({
      aircraftName: seg.aircraft,
      carrierCode: seg.carrierCode,
      carrierName: seg.carrierName,
      operatingCarrierName: seg.operatingCarrierName,
      seatTypeCode: seg.seatTypeCode,
      durationMins: seg.durationMins,
      allowLieFlatNarrowbodyExceptions,
      allowedWidebodyFamilies: normalizedFamilies,
    });

    enrichedSegments.push({
      ...seg,
      equipmentClassification: eqClass,
    });
  }

  // 3. Enforce Long-Haul Duration + Equipment Rule
  const isDirect = enrichedSegments.length === 1;
  const minDirectMins = Math.round(Number(minDirectHours) * 60);
  const minConnectLongLegMins = Math.round(Number(minConnectingLongLegHours) * 60);

  if (isDirect) {
    const seg = enrichedSegments[0];
    if (seg.durationMins < minDirectMins) {
      reasons.push(
        `Direct flight ${seg.from}->${seg.to} is ${seg.durationHuman} (${seg.durationMins}m), below the ${minDirectHours}h (${minDirectMins}m) direct long-haul threshold.`
      );
      return { passed: false, reasons };
    }

    if (!seg.equipmentClassification.isQualifyingLongHaulEquipment) {
      reasons.push(
        `Direct long-haul leg ${seg.from}->${seg.to} (${seg.durationHuman}) failed equipment/lie-flat check: ${seg.equipmentClassification.rejectionReason}`
      );
      return { passed: false, reasons };
    }
  } else {
    // Connecting itinerary (1+ stops):
    // Rule: AT LEAST one leg must be >= minConnectingLongLegHours (default 7h / 420m)
    const longLegs = enrichedSegments.filter((s) => s.durationMins >= minConnectLongLegMins);
    if (longLegs.length === 0) {
      const longest = Math.max(...enrichedSegments.map((s) => s.durationMins));
      reasons.push(
        `Connecting itinerary has no leg >= ${minConnectingLongLegHours}h (longest leg is ${(longest / 60).toFixed(1)}h).`
      );
      return { passed: false, reasons };
    }

    // Every leg >= 7h MUST be a true lie-flat widebody (or approved lie-flat narrowbody exception)
    for (const longLeg of longLegs) {
      if (!longLeg.equipmentClassification.isQualifyingLongHaulEquipment) {
        reasons.push(
          `Long leg ${longLeg.from}->${longLeg.to} (${longLeg.durationHuman} on ${longLeg.aircraft}) failed widebody/lie-flat check: ${longLeg.equipmentClassification.rejectionReason}`
        );
        return { passed: false, reasons };
      }
    }
  }

  // Determine summary badges for the passed direction
  const qualifyingLongLegs = enrichedSegments.filter((s) =>
    isDirect ? s.durationMins >= minDirectMins : s.durationMins >= minConnectLongLegMins
  );
  const shortFeederLegs = enrichedSegments.filter((s) => !qualifyingLongLegs.includes(s));
  const usesNarrowbodyException = qualifyingLongLegs.some(
    (s) => s.equipmentClassification.isLieFlatNarrowbodyException
  );

  return {
    passed: true,
    reasons: [],
    isDirect,
    usesNarrowbodyException,
    qualifyingLongLegs: qualifyingLongLegs.map((s) => ({
      route: `${s.from}->${s.to}`,
      flightNumber: s.flightNumber,
      carrier: s.carrierName,
      operatedBy: s.operatingCarrierName,
      durationHuman: s.durationHuman,
      aircraft: s.aircraft,
      family: s.equipmentClassification.family,
      seatType: s.equipmentClassification.seatLabel,
      isNarrowbodyLieFlatException: s.equipmentClassification.isLieFlatNarrowbodyException,
    })),
    shortFeederLegs: shortFeederLegs.map((s) => ({
      route: `${s.from}->${s.to}`,
      flightNumber: s.flightNumber,
      carrier: s.carrierName,
      durationHuman: s.durationHuman,
      aircraft: s.aircraft,
      seatType: s.equipmentClassification.seatLabel,
    })),
    enrichedSegments,
  };
}
