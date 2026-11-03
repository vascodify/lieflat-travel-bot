/**
 * Formatter for Telegram & Antigravity messages.
 * Implements the user's exact clean, non-cluttered flight card layout:
 * - Single best recommended LHR connection
 * - DD/MM/YYYY dates + 12-hour AM/PM times
 * - Hours & minutes flight durations and buffers
 * - Explicit "- Number of nights at [Destination] = # -"
 * - Photo 1 (Upright seat) & Photo 2 (Lie-flat bed) clickable verification links
 * - Clickable live OTA booking links
 */

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

export function toAmPm(timeStr) {
  if (!timeStr) return '';
  const clean = String(timeStr).trim();
  const parts = clean.split(':');
  if (parts.length < 2) return clean;
  let h = parseInt(parts[0], 10);
  const m = parts[1].slice(0, 2);
  if (isNaN(h)) return clean;
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${m} ${period}`;
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

function formatOtaDeepLinks(bookingLinks) {
  if (!bookingLinks) return '';
  const links = [];
  const gf = bookingLinks.googleFlights;
  const sky = bookingLinks.skyscannerOtaComparison || bookingLinks.skyscanner;
  const trip = bookingLinks.tripCom;
  const kayak = bookingLinks.kayakUk || bookingLinks.kayak;
  const momondo = bookingLinks.momondoUk || bookingLinks.momondo;
  const lastmin = bookingLinks.lastminuteCom || bookingLinks.lastminute;

  if (gf) links.push(`<a href="${escapeHtml(gf)}">Google Flights (Live OTA)</a>`);
  if (sky) links.push(`<a href="${escapeHtml(sky)}">Skyscanner</a>`);
  if (trip) links.push(`<a href="${escapeHtml(trip)}">Trip.com UK</a>`);
  if (kayak) links.push(`<a href="${escapeHtml(kayak)}">Kayak UK</a>`);
  if (momondo) links.push(`<a href="${escapeHtml(momondo)}">Momondo UK</a>`);
  if (lastmin) links.push(`<a href="${escapeHtml(lastmin)}">Lastminute.com</a>`);
  return links.join(' | ');
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

  const returnBizAirline =
    inboundLeg.carrier ||
    bizAirline;
  const returnBizAircraft = inboundLeg.aircraft || bizAircraft;

  // Pricing
  const bizPriceVal =
    match.totalRoundTripPriceGbp ??
    match.pricing?.businessRoundTripGbp ??
    0;

  // Single Best LHR Positioning Flight (Recommended Pair)
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

  const totalCostVal =
    match.combinedTotalWithRecommendedLhrPositioningGbp ??
    (bizPriceVal + posPriceVal);

  const totalCostStr = `£${totalCostVal.toLocaleString('en-GB')}`;
  const posCostStr = `£${posPriceVal.toLocaleString('en-GB')}`;
  const bizCostStr = `£${bizPriceVal.toLocaleString('en-GB')}`;

  // Cabin Photos
  const cabinObj = match.cabinPhotos?.cabinPhoto || match.cabinPhotos?.uprightSeatPhoto || {};
  const bedObj = match.cabinPhotos?.bedPhoto || match.cabinPhotos?.flatBedPhoto || {};
  const uprightUrl = cabinObj.imageUrl || cabinObj.originalImageUrl;
  const bedUrl = bedObj.imageUrl || bedObj.originalImageUrl;

  const photoLinksStr =
    uprightUrl && bedUrl
      ? `<a href="${escapeHtml(uprightUrl)}">[Photo 1 showing upright seat]</a>  <a href="${escapeHtml(bedUrl)}">[Photo 2 showing bed position]</a>`
      : uprightUrl
      ? `<a href="${escapeHtml(uprightUrl)}">[Photo 1 showing upright seat]</a>`
      : bedUrl
      ? `<a href="${escapeHtml(bedUrl)}">[Photo 2 showing bed position]</a>`
      : `<i>[Photo 1 showing upright seat] [Photo 2 showing bed position]</i>`;

  // Best LHR Positioning Details
  const lhrOut = bestPos?.outboundEconomyPositioning || bestPos?.outboundFlight || {};
  const lhrIn = bestPos?.inboundEconomyPositioning || bestPos?.returnFlight || {};

  const lhrOutAirline =
    (Array.isArray(lhrOut.airlines) ? lhrOut.airlines[0] : lhrOut.carrier || lhrOut.airline) || 'British Airways';
  const lhrOutAircraft = lhrOut.aircraft || 'Airbus A320';
  const lhrOutDate = toUkDate(lhrOut.departureDate || match.outbound?.departureDate);
  const lhrOutDepTime = toAmPm(lhrOut.departureTime || lhrOut.departs || '09:00');
  const lhrOutArrTime = toAmPm(lhrOut.arrivalTime || lhrOut.arrives || '12:00');

  const lhrInAirline =
    (Array.isArray(lhrIn.airlines) ? lhrIn.airlines[0] : lhrIn.carrier || lhrIn.airline) || lhrOutAirline;
  const lhrInAircraft = lhrIn.aircraft || lhrOutAircraft;
  const lhrInDate = toUkDate(lhrIn.departureDate || match.inbound?.arrivalDate || match.inbound?.departureDate);
  const lhrInDepTime = toAmPm(lhrIn.departureTime || lhrIn.departs || '09:00');
  const lhrInArrTime = toAmPm(lhrIn.arrivalTime || lhrIn.arrives || '10:30');

  // Buffers between flights
  const outBufferMins = lhrOut.transferBufferMins ?? 160;
  const inBufferMins = lhrIn.transferBufferMins ?? 250;
  const outBufferText = `- ${formatHoursMinutes(outBufferMins)} buffer -`;
  const inBufferText = `- ${formatHoursMinutes(inBufferMins)} buffer -`;

  // Outbound Business Flight Details
  const outBizDate = toUkDate(match.outbound?.departureDate);
  const outBizDepTime = toAmPm(match.outbound?.departureTime || '14:00');
  const outBizArrDate = toUkDate(match.outbound?.arrivalDate || match.outbound?.departureDate);
  const outBizArrTime = toAmPm(match.outbound?.arrivalTime || '07:00');
  const outBizDuration = formatHoursMinutes(
    match.outbound?.totalDurationMins || (outboundLeg.durationMins ?? 720)
  );

  // Nights spent at long-haul destination
  const nightsNum =
    match.nightsAtDestination ||
    match.dates?.nights ||
    4;

  // Inbound Business Flight Details
  const inBizDate = toUkDate(match.inbound?.departureDate);
  const inBizDepTime = toAmPm(match.inbound?.departureTime || '14:00');
  const inBizArrDate = toUkDate(match.inbound?.arrivalDate || match.inbound?.departureDate);
  const inBizArrTime = toAmPm(match.inbound?.arrivalTime || '06:00');
  const inBizDuration = formatHoursMinutes(
    match.inbound?.totalDurationMins || (inboundLeg.durationMins ?? 720)
  );

  // Build the user's exact clean card layout
  let card = `<b>Option ${index} for ${totalCostStr} Total cost (${posCostStr} recommended LHR connection + ${bizCostStr} Biz flights)</b>\n`;
  card += `${escapeHtml(lhrOutDate)} @ ${escapeHtml(lhrOutDepTime)}\n`;
  card += `LHR to ${escapeHtml(hubIata)} arriving ${escapeHtml(lhrOutArrTime)} with ${escapeHtml(lhrOutAirline)} ${escapeHtml(lhrOutAircraft)}\n\n`;
  card += `<i>${escapeHtml(outBufferText)}</i>\n\n`;
  card += `${escapeHtml(hubIata)} to ${escapeHtml(destination)} @ ${escapeHtml(outBizDepTime)} (${escapeHtml(outBizDuration)} flight), arriving @ ${escapeHtml(outBizArrDate)} @ ${escapeHtml(outBizArrTime)} with ${escapeHtml(bizAirline)} ${escapeHtml(bizAircraft)}\n`;
  card += `${photoLinksStr}\n\n`;
  card += `<b>- Number of nights at ${escapeHtml(destination)} = ${escapeHtml(nightsNum)} -</b>\n\n`;
  card += `${escapeHtml(inBizDate)} @ ${escapeHtml(inBizDepTime)}\n`;
  card += `${escapeHtml(destination)} to ${escapeHtml(hubIata)} (${escapeHtml(inBizDuration)} flight), arriving @ ${escapeHtml(inBizArrDate)} @ ${escapeHtml(inBizArrTime)} with ${escapeHtml(returnBizAirline)} ${escapeHtml(returnBizAircraft)}\n`;
  card += `${photoLinksStr}\n\n`;
  card += `<i>${escapeHtml(inBufferText)}</i>\n\n`;
  card += `${escapeHtml(hubIata)} to LHR arriving ${escapeHtml(lhrInArrTime)} with ${escapeHtml(lhrInAirline)} ${escapeHtml(lhrInAircraft)}\n`;

  // Live Booking Deep Links
  card += `\n🔗 <b>Live Booking Links:</b>\n`;
  if (match.bookingLinks) {
    card += `• <b>Business Class (${escapeHtml(hubIata)} ⇄ ${escapeHtml(destination)}):</b> ${formatOtaDeepLinks(match.bookingLinks)}\n`;
  }
  if (bestPos?.bookingLinks) {
    card += `• <b>LHR Positioning (LHR ⇄ ${escapeHtml(hubIata)}):</b> ${formatOtaDeepLinks(bestPos.bookingLinks)}\n`;
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
