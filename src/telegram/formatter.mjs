/**
 * Formatter for Telegram & Antigravity messages.
 * Implements the user's exact clean card layout:
 *
 * Option 1  ➡️ £1,800 🗓️ Jan 3 to Jan 8 (2027)
 * ✈️ £300 positioning + £1,500 Biz  🛏️
 *
 * LHR to LIS with BA A320neo (9:05am to 12:05pm)
 * [Photo Link]
 *
 * - 4 hours 40 minutes buffer -
 *
 * Jan 3 @ 4:45pm
 * LIS to BKK @ 4:45pm (10 hours flight), arriving @ Jan 4 @ 7:00am with Airline Aircraft (Seat Type)
 * [Photo Link]
 *
 * - Number of nights at BKK = 4 -
 *
 * Jan 8 @ 8:30am
 * BKK to LIS (11 hours flight), arriving @ Jan 8 @ 4:00pm with Airline Aircraft (Seat Type)
 * [Photo Link]
 *
 * - 3 hours 20 minutes buffer -
 *
 * LIS to LHR with BA A321neo (6:20am to 8:20am)
 * [Photo Link]
 *
 * 🔗 Live Booking:
 * • Business Class (LIS ⇄ BKK): [Google Flights]
 * • London Positioning (LHR ⇄ LIS): [Google Flights]
 */

import { getDestinationDisplay } from '../data/destinations_db.mjs';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function toUkDate(isoDate) {
  if (!isoDate) return '';
  const parts = String(isoDate).trim().split('-');
  if (parts.length < 3) return isoDate;
  const [yyyy, mm, dd] = parts;
  return `${dd}/${mm}/${yyyy}`;
}

export function toShortDate(isoDate) {
  if (!isoDate) return '';
  const parts = String(isoDate).trim().split('-');
  if (parts.length < 3) return isoDate;
  const mm = parseInt(parts[1], 10);
  const dd = parseInt(parts[2], 10);
  return `${MONTH_SHORT[mm - 1] || parts[1]} ${dd}`;
}

export function getYear(isoDate) {
  if (!isoDate) return new Date().getFullYear();
  return String(isoDate).trim().split('-')[0];
}

export function toAmPmLower(timeStr) {
  if (!timeStr) return '';
  const clean = String(timeStr).trim();
  const parts = clean.split(':');
  if (parts.length < 2) return clean;
  let h = parseInt(parts[0], 10);
  const m = parts[1].slice(0, 2);
  if (isNaN(h)) return clean;
  const period = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m}${period}`;
}

export function toAmPm(timeStr) {
  return toAmPmLower(timeStr);
}

export function formatHoursMinutes(mins) {
  if (!mins && mins !== 0) return '0 minutes';
  const total = Math.abs(Math.round(mins));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hPart = h > 0 ? `${h} hour${h > 1 ? 's' : ''}` : '';
  const mPart = m > 0 ? `${m} minute${m > 1 ? 's' : ''}` : '';
  if (hPart && mPart) return `${hPart} ${mPart}`;
  return hPart || mPart || '0 minutes';
}

export function buildGoogleImagesUrl(carrier, aircraft, isPositioning = false) {
  const suffix = isPositioning ? '' : ' Business class';
  const query = `${carrier || ''} ${aircraft || ''}${suffix}`.trim().replace(/\s+/g, ' ');
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
}

export function formatFlightDealHtml(match, index = 1) {
  const originHub = match.originHub || {};
  const hubIata = originHub.iata || (match.route ? match.route.split(' ')[0] : 'HUB');
  const destination = match.destination || 'DEST';

  // Primary Biz Airline & Aircraft
  const outboundLeg = match.outbound?.qualifyingLongLegs?.[0] || match.outbound?.shortFeederLegs?.[0] || {};
  const inboundLeg = match.inbound?.qualifyingLongLegs?.[0] || match.inbound?.shortFeederLegs?.[0] || {};

  const bizAirline =
    outboundLeg.carrier ||
    (Array.isArray(match.primaryCarriers) ? match.primaryCarriers[0] : '') ||
    match.airline ||
    'Business Class';
  const bizAircraft = outboundLeg.aircraft || match.aircraft || 'Lie-Flat Widebody';

  const returnBizAirline = inboundLeg.carrier || bizAirline;
  const returnBizAircraft = inboundLeg.aircraft || bizAircraft;

  // Pricing
  const bizPriceVal =
    match.totalRoundTripPriceGbp ??
    match.pricing?.businessRoundTripGbp ??
    0;

  // Positioning details (handles LHR, LGW, LTN, STN)
  const posOptions = Array.isArray(match.lhrPositioning?.options)
    ? match.lhrPositioning.options
    : match.lhrPositioning?.recommendedPair
    ? [match.lhrPositioning.recommendedPair]
    : [];

  const bestPos = posOptions[0] || null;
  const posPriceVal =
    bestPos?.separateTicketRoundTripPriceGbp ??
    bestPos?.combinedPriceGbp ??
    match.pricing?.positioningReturnGbp ??
    0;

  const isLondonDirect =
    ['LHR', 'LGW', 'LCY', 'STN', 'LTN', 'LON'].includes(hubIata) ||
    match.lhrPositioning?.positioningNeeded === false;

  const totalCostVal = isLondonDirect
    ? bizPriceVal
    : (match.combinedTotalWithRecommendedLhrPositioningGbp ?? (bizPriceVal + posPriceVal));

  const totalCostStr = `£${totalCostVal.toLocaleString('en-GB')}`;
  const posCostStr = `£${posPriceVal.toLocaleString('en-GB')}`;
  const bizCostStr = `£${bizPriceVal.toLocaleString('en-GB')}`;

  const lhrOut = bestPos?.outboundEconomyPositioning || bestPos?.outboundFlight || {};
  const lhrIn = bestPos?.inboundEconomyPositioning || bestPos?.returnFlight || {};

  const posOrigin = lhrOut.origin || 'LHR';
  const posDest = lhrIn.destination || 'LHR';

  const lhrOutAirline =
    (Array.isArray(lhrOut.airlines) ? lhrOut.airlines[0] : lhrOut.carrier || lhrOut.airline) || 'British Airways';
  const lhrOutAircraft = lhrOut.aircraft || 'Airbus A320';
  const lhrOutDepTime = toAmPmLower(lhrOut.departureTime || lhrOut.departs || '09:05');
  const lhrOutArrTime = toAmPmLower(lhrOut.arrivalTime || lhrOut.arrives || '12:05');

  const lhrInAirline =
    (Array.isArray(lhrIn.airlines) ? lhrIn.airlines[0] : lhrIn.carrier || lhrIn.airline) || lhrOutAirline;
  const lhrInAircraft = lhrIn.aircraft || lhrOutAircraft;
  const lhrInDepTime = toAmPmLower(lhrIn.departureTime || lhrIn.departs || '06:20');
  const lhrInArrTime = toAmPmLower(lhrIn.arrivalTime || lhrIn.arrives || '08:20');

  // Buffers
  const outBufferMins = lhrOut.transferBufferMins ?? 160;
  const inBufferMins = lhrIn.transferBufferMins ?? 250;
  const outBufferText = `- ${formatHoursMinutes(outBufferMins)} buffer -`;
  const inBufferText = `- ${formatHoursMinutes(inBufferMins)} buffer -`;

  // Dates
  const outBizDateIso = match.outbound?.departureDate;
  const inBizDateIso = match.inbound?.departureDate || match.inbound?.arrivalDate;
  const outDateShort = toShortDate(lhrOut.departureDate || outBizDateIso);
  const inDateShort = toShortDate(lhrIn.arrivalDate || inBizDateIso);
  const yearStr = getYear(outBizDateIso || lhrOut.departureDate);

  const nightsNum = match.nightsAtDestination || match.dates?.nights || 4;
  const destMeta = getDestinationDisplay(destination, match);
  const destStr = destMeta.label ? ` ${destMeta.label}` : '';

  // Build the Header
  let card = `<b>Option ${index}${destStr} ➡️ ${totalCostStr} 🗓️ ${escapeHtml(outDateShort)} to ${escapeHtml(inDateShort)} (${yearStr})</b>\n`;
  if (isLondonDirect) {
    card += `✈️ <b>Direct flight from London (No positioning required)  🛏️</b>\n\n`;
  } else {
    card += `✈️ <b>${posCostStr} positioning + ${bizCostStr} Biz  🛏️</b>\n\n`;
    card += `${escapeHtml(posOrigin)} to ${escapeHtml(hubIata)} with ${escapeHtml(lhrOutAirline)} ${escapeHtml(lhrOutAircraft)} (${escapeHtml(lhrOutDepTime)} to ${escapeHtml(lhrOutArrTime)})\n`;
    card += `<a href="${escapeHtml(buildGoogleImagesUrl(lhrOutAirline, lhrOutAircraft, true))}">[Photo Link]</a>\n\n`;
    card += `<i>${escapeHtml(outBufferText)}</i>\n\n`;
  }

  // Outbound Business Flight Legs
  const outLegs =
    match.outbound?.legs && match.outbound.legs.length > 0
      ? match.outbound.legs
      : [
          {
            from: hubIata,
            to: destination,
            departureDate: match.outbound?.departureDate,
            departureTime: match.outbound?.departureTime,
            arrivalDate: match.outbound?.arrivalDate || match.outbound?.departureDate,
            arrivalTime: match.outbound?.arrivalTime,
            durationMins: match.outbound?.totalDurationMins || (outboundLeg.durationMins ?? 720),
            carrier: bizAirline,
            aircraft: bizAircraft,
            seatType: outboundLeg.seatType || 'True 180° Lie-Flat Seat',
          },
        ];
  const outLayovers = match.outbound?.layovers || [];

  outLegs.forEach((leg, idx) => {
    const legDateShort = toShortDate(leg.departureDate);
    const legDepTime = toAmPmLower(leg.departureTime || '14:00');
    const legArrDateShort = toShortDate(leg.arrivalDate || leg.departureDate);
    const legArrTime = toAmPmLower(leg.arrivalTime || '07:00');
    const legDuration = formatHoursMinutes(leg.durationMins);
    const legSeatType = leg.seatType ? ` (${escapeHtml(leg.seatType)})` : '';
    const photoUrl = buildGoogleImagesUrl(leg.carrier, leg.aircraft);

    card += `${escapeHtml(legDateShort)} @ ${escapeHtml(legDepTime)}\n`;
    card += `${escapeHtml(leg.from)} to ${escapeHtml(leg.to)} (${escapeHtml(legDuration)} flight), arriving @ ${escapeHtml(legArrDateShort)} @ ${escapeHtml(legArrTime)} with ${escapeHtml(leg.carrier)} ${escapeHtml(leg.aircraft)}${legSeatType}\n`;
    card += `<a href="${escapeHtml(photoUrl)}">[Photo Link]</a>\n\n`;

    if (idx < outLegs.length - 1) {
      const lay = outLayovers[idx];
      const layDuration = formatHoursMinutes(lay?.durationMins);
      const layCity = lay?.city || lay?.airport || leg.to;
      card += `<i>- ${escapeHtml(layDuration)} stopover in ${escapeHtml(layCity)} -</i>\n\n`;
    }
  });

  card += `<b>- Number of nights at ${escapeHtml(destination)} = ${escapeHtml(nightsNum)} -</b>\n\n`;

  // Inbound Business Flight Legs
  const inLegs =
    match.inbound?.legs && match.inbound.legs.length > 0
      ? match.inbound.legs
      : [
          {
            from: destination,
            to: hubIata,
            departureDate: match.inbound?.departureDate,
            departureTime: match.inbound?.departureTime,
            arrivalDate: match.inbound?.arrivalDate || match.inbound?.departureDate,
            arrivalTime: match.inbound?.arrivalTime,
            durationMins: match.inbound?.totalDurationMins || (inboundLeg.durationMins ?? 720),
            carrier: returnBizAirline,
            aircraft: returnBizAircraft,
            seatType: inboundLeg.seatType || 'True 180° Lie-Flat Seat',
          },
        ];
  const inLayovers = match.inbound?.layovers || [];

  inLegs.forEach((leg, idx) => {
    const legDateShort = toShortDate(leg.departureDate);
    const legDepTime = toAmPmLower(leg.departureTime || '14:00');
    const legArrDateShort = toShortDate(leg.arrivalDate || leg.departureDate);
    const legArrTime = toAmPmLower(leg.arrivalTime || '06:00');
    const legDuration = formatHoursMinutes(leg.durationMins);
    const legSeatType = leg.seatType ? ` (${escapeHtml(leg.seatType)})` : '';
    const photoUrl = buildGoogleImagesUrl(leg.carrier, leg.aircraft);

    card += `${escapeHtml(legDateShort)} @ ${escapeHtml(legDepTime)}\n`;
    card += `${escapeHtml(leg.from)} to ${escapeHtml(leg.to)} (${escapeHtml(legDuration)} flight), arriving @ ${escapeHtml(legArrDateShort)} @ ${escapeHtml(legArrTime)} with ${escapeHtml(leg.carrier)} ${escapeHtml(leg.aircraft)}${legSeatType}\n`;
    card += `<a href="${escapeHtml(photoUrl)}">[Photo Link]</a>\n\n`;

    if (idx < inLegs.length - 1) {
      const lay = inLayovers[idx];
      const layDuration = formatHoursMinutes(lay?.durationMins);
      const layCity = lay?.city || lay?.airport || leg.to;
      card += `<i>- ${escapeHtml(layDuration)} stopover in ${escapeHtml(layCity)} -</i>\n\n`;
    }
  });

  if (!isLondonDirect && bestPos) {
    card += `<i>${escapeHtml(inBufferText)}</i>\n\n`;
    card += `${escapeHtml(hubIata)} to ${escapeHtml(posDest)} with ${escapeHtml(lhrInAirline)} ${escapeHtml(lhrInAircraft)} (${escapeHtml(lhrInDepTime)} to ${escapeHtml(lhrInArrTime)})\n`;
    card += `<a href="${escapeHtml(buildGoogleImagesUrl(lhrInAirline, lhrInAircraft, true))}">[Photo Link]</a>\n\n`;
  }

  // Live Booking Link - Google Flights Only
  card += `🔗 <b>Live Booking:</b>\n`;
  if (match.bookingLinks?.googleFlights) {
    const bizLabel = isLondonDirect ? `Business Class (${destination})` : `Business Class (${hubIata} ⇄ ${destination})`;
    card += `• <b>${escapeHtml(bizLabel)}:</b> <a href="${escapeHtml(match.bookingLinks.googleFlights)}">[Google Flights]</a>\n`;
  }
  if (!isLondonDirect && bestPos?.bookingLinks?.googleFlights) {
    card += `• <b>London Positioning (${escapeHtml(posOrigin)} ⇄ ${escapeHtml(hubIata)}):</b> <a href="${escapeHtml(bestPos.bookingLinks.googleFlights)}">[Google Flights]</a>\n`;
  }

  return card;
}

export function formatFlightDealMarkdown(match, index = 1) {
  const originHub = match.originHub || {};
  const hubIata = originHub.iata || (match.route ? match.route.split(' ')[0] : 'HUB');
  const destination = match.destination || 'DEST';

  // Primary Biz Airline & Aircraft
  const outboundLeg = match.outbound?.qualifyingLongLegs?.[0] || match.outbound?.shortFeederLegs?.[0] || {};
  const inboundLeg = match.inbound?.qualifyingLongLegs?.[0] || match.inbound?.shortFeederLegs?.[0] || {};

  const bizAirline =
    outboundLeg.carrier ||
    (Array.isArray(match.primaryCarriers) ? match.primaryCarriers[0] : '') ||
    match.airline ||
    'Business Class';
  const bizAircraft = outboundLeg.aircraft || match.aircraft || 'Lie-Flat Widebody';

  const returnBizAirline = inboundLeg.carrier || bizAirline;
  const returnBizAircraft = inboundLeg.aircraft || bizAircraft;

  // Pricing
  const bizPriceVal =
    match.totalRoundTripPriceGbp ??
    match.pricing?.businessRoundTripGbp ??
    0;

  const posOptions = Array.isArray(match.lhrPositioning?.options)
    ? match.lhrPositioning.options
    : match.lhrPositioning?.recommendedPair
    ? [match.lhrPositioning.recommendedPair]
    : [];

  const bestPos = posOptions[0] || null;
  const posPriceVal =
    bestPos?.separateTicketRoundTripPriceGbp ??
    bestPos?.combinedPriceGbp ??
    match.pricing?.positioningReturnGbp ??
    0;

  const isLondonDirect =
    ['LHR', 'LGW', 'LCY', 'STN', 'LTN', 'LON'].includes(hubIata) ||
    match.lhrPositioning?.positioningNeeded === false;

  const totalCostVal = isLondonDirect
    ? bizPriceVal
    : (match.combinedTotalWithRecommendedLhrPositioningGbp ?? (bizPriceVal + posPriceVal));

  const totalCostStr = `£${totalCostVal.toLocaleString('en-GB')}`;
  const posCostStr = `£${posPriceVal.toLocaleString('en-GB')}`;
  const bizCostStr = `£${bizPriceVal.toLocaleString('en-GB')}`;

  const lhrOut = bestPos?.outboundEconomyPositioning || bestPos?.outboundFlight || {};
  const lhrIn = bestPos?.inboundEconomyPositioning || bestPos?.returnFlight || {};

  const posOrigin = lhrOut.origin || 'LHR';
  const posDest = lhrIn.destination || 'LHR';

  const lhrOutAirline =
    (Array.isArray(lhrOut.airlines) ? lhrOut.airlines[0] : lhrOut.carrier || lhrOut.airline) || 'British Airways';
  const lhrOutAircraft = lhrOut.aircraft || 'Airbus A320';
  const lhrOutDepTime = toAmPmLower(lhrOut.departureTime || lhrOut.departs || '09:05');
  const lhrOutArrTime = toAmPmLower(lhrOut.arrivalTime || lhrOut.arrives || '12:05');

  const lhrInAirline =
    (Array.isArray(lhrIn.airlines) ? lhrIn.airlines[0] : lhrIn.carrier || lhrIn.airline) || lhrOutAirline;
  const lhrInAircraft = lhrIn.aircraft || lhrOutAircraft;
  const lhrInDepTime = toAmPmLower(lhrIn.departureTime || lhrIn.departs || '06:20');
  const lhrInArrTime = toAmPmLower(lhrIn.arrivalTime || lhrIn.arrives || '08:20');

  // Buffers
  const outBufferMins = lhrOut.transferBufferMins ?? 160;
  const inBufferMins = lhrIn.transferBufferMins ?? 250;
  const outBufferText = `- ${formatHoursMinutes(outBufferMins)} buffer -`;
  const inBufferText = `- ${formatHoursMinutes(inBufferMins)} buffer -`;

  // Dates
  const outBizDateIso = match.outbound?.departureDate;
  const inBizDateIso = match.inbound?.departureDate || match.inbound?.arrivalDate;
  const outDateShort = toShortDate(lhrOut.departureDate || outBizDateIso);
  const inDateShort = toShortDate(lhrIn.arrivalDate || inBizDateIso);
  const yearStr = getYear(outBizDateIso || lhrOut.departureDate);

  const nightsNum = match.nightsAtDestination || match.dates?.nights || 4;
  const destMeta = getDestinationDisplay(destination, match);
  const destStr = destMeta.label ? ` ${destMeta.label}` : '';

  let card = `Option ${index}${destStr} ➡️ ${totalCostStr} 🗓️ ${outDateShort} to ${inDateShort} (${yearStr})\n`;
  if (isLondonDirect) {
    card += `✈️ Direct flight from London (No positioning required)  🛏️\n\n`;
  } else {
    card += `✈️ ${posCostStr} positioning + ${bizCostStr} Biz  🛏️\n\n`;
    card += `${posOrigin} to ${hubIata} with ${lhrOutAirline} ${lhrOutAircraft} (${lhrOutDepTime} to ${lhrOutArrTime})\n`;
    card += `[Photo Link](${buildGoogleImagesUrl(lhrOutAirline, lhrOutAircraft, true)})\n\n`;
    card += `*${outBufferText}*\n\n`;
  }

  // Outbound Business Flight Legs
  const outLegs =
    match.outbound?.legs && match.outbound.legs.length > 0
      ? match.outbound.legs
      : [
          {
            from: hubIata,
            to: destination,
            departureDate: match.outbound?.departureDate,
            departureTime: match.outbound?.departureTime,
            arrivalDate: match.outbound?.arrivalDate || match.outbound?.departureDate,
            arrivalTime: match.outbound?.arrivalTime,
            durationMins: match.outbound?.totalDurationMins || (outboundLeg.durationMins ?? 720),
            carrier: bizAirline,
            aircraft: bizAircraft,
            seatType: outboundLeg.seatType || 'True 180° Lie-Flat Seat',
          },
        ];
  const outLayovers = match.outbound?.layovers || [];

  outLegs.forEach((leg, idx) => {
    const legDateShort = toShortDate(leg.departureDate);
    const legDepTime = toAmPmLower(leg.departureTime || '14:00');
    const legArrDateShort = toShortDate(leg.arrivalDate || leg.departureDate);
    const legArrTime = toAmPmLower(leg.arrivalTime || '07:00');
    const legDuration = formatHoursMinutes(leg.durationMins);
    const legSeatType = leg.seatType ? ` (${leg.seatType})` : '';
    const photoUrl = buildGoogleImagesUrl(leg.carrier, leg.aircraft);

    card += `${legDateShort} @ ${legDepTime}\n`;
    card += `${leg.from} to ${leg.to} (${legDuration} flight), arriving @ ${legArrDateShort} @ ${legArrTime} with ${leg.carrier} ${leg.aircraft}${legSeatType}\n`;
    card += `[Photo Link](${photoUrl})\n\n`;

    if (idx < outLegs.length - 1) {
      const lay = outLayovers[idx];
      const layDuration = formatHoursMinutes(lay?.durationMins);
      const layCity = lay?.city || lay?.airport || leg.to;
      card += `*- ${layDuration} stopover in ${layCity} -*\n\n`;
    }
  });

  card += `**- Number of nights at ${destination} = ${nightsNum} -**\n\n`;

  // Inbound Business Flight Legs
  const inLegs =
    match.inbound?.legs && match.inbound.legs.length > 0
      ? match.inbound.legs
      : [
          {
            from: destination,
            to: hubIata,
            departureDate: match.inbound?.departureDate,
            departureTime: match.inbound?.departureTime,
            arrivalDate: match.inbound?.arrivalDate || match.inbound?.departureDate,
            arrivalTime: match.inbound?.arrivalTime,
            durationMins: match.inbound?.totalDurationMins || (inboundLeg.durationMins ?? 720),
            carrier: returnBizAirline,
            aircraft: returnBizAircraft,
            seatType: inboundLeg.seatType || 'True 180° Lie-Flat Seat',
          },
        ];
  const inLayovers = match.inbound?.layovers || [];

  inLegs.forEach((leg, idx) => {
    const legDateShort = toShortDate(leg.departureDate);
    const legDepTime = toAmPmLower(leg.departureTime || '14:00');
    const legArrDateShort = toShortDate(leg.arrivalDate || leg.departureDate);
    const legArrTime = toAmPmLower(leg.arrivalTime || '06:00');
    const legDuration = formatHoursMinutes(leg.durationMins);
    const legSeatType = leg.seatType ? ` (${leg.seatType})` : '';
    const photoUrl = buildGoogleImagesUrl(leg.carrier, leg.aircraft);

    card += `${legDateShort} @ ${legDepTime}\n`;
    card += `${leg.from} to ${leg.to} (${legDuration} flight), arriving @ ${legArrDateShort} @ ${legArrTime} with ${leg.carrier} ${leg.aircraft}${legSeatType}\n`;
    card += `[Photo Link](${photoUrl})\n\n`;

    if (idx < inLegs.length - 1) {
      const lay = inLayovers[idx];
      const layDuration = formatHoursMinutes(lay?.durationMins);
      const layCity = lay?.city || lay?.airport || leg.to;
      card += `*- ${layDuration} stopover in ${layCity} -*\n\n`;
    }
  });

  if (!isLondonDirect && bestPos) {
    card += `*${inBufferText}*\n\n`;
    card += `${hubIata} to ${posDest} with ${lhrInAirline} ${lhrInAircraft} (${lhrInDepTime} to ${lhrInArrTime})\n`;
    card += `[Photo Link](${buildGoogleImagesUrl(lhrInAirline, lhrInAircraft, true)})\n\n`;
  }

  // Live Booking Deep Links - Google Flights Only
  card += `🔗 **Live Booking:**\n`;
  if (match.bookingLinks?.googleFlights) {
    const bizLabel = isLondonDirect ? `Business Class (${destination})` : `Business Class (${hubIata} ⇄ ${destination})`;
    card += `• **${bizLabel}:** [Google Flights](${match.bookingLinks.googleFlights})\n`;
  }
  if (!isLondonDirect && bestPos?.bookingLinks?.googleFlights) {
    card += `• **London Positioning (${posOrigin} ⇄ ${hubIata}):** [Google Flights](${bestPos.bookingLinks.googleFlights})\n`;
  }

  return card;
}

export function formatSearchSummaryHtml(summary) {
  let text = `🎯 <b>Lie-Flat Flight Search Results</b>\n\n`;
  text += `• Scanned Hubs: <code>${(summary.originsScanned || []).join(', ')}</code>\n`;
  text += `• Destination: <code>${(summary.destinationsScanned || []).join(', ')}</code>\n`;
  text += `• Budget Ceiling: <b>£${summary.maxPriceGbp} GBP</b>\n`;
  text += `• Verified Lie-Flat Deals Found: <b>${summary.verifiedMatchesCount}</b>\n`;
  text += `• Safety Filter: <i>Air India, IndiGo, Icelandair, EgyptAir strictly excluded</i>\n`;
  return text;
}
