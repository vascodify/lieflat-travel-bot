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

export function formatLegPhotosHtml(photos) {
  const cabinObj = photos?.cabinPhoto || photos?.uprightSeatPhoto || {};
  const bedObj = photos?.bedPhoto || photos?.flatBedPhoto || {};
  const uprightUrl = cabinObj.imageUrl || cabinObj.originalImageUrl;
  const bedUrl = bedObj.imageUrl || bedObj.originalImageUrl;

  if (uprightUrl && bedUrl) {
    return `<a href="${escapeHtml(uprightUrl)}">[Photo 1 showing upright seat]</a>  <a href="${escapeHtml(bedUrl)}">[Photo 2 showing bed position]</a>`;
  }
  if (uprightUrl) {
    return `<a href="${escapeHtml(uprightUrl)}">[Photo 1 showing upright seat]</a>`;
  }
  if (bedUrl) {
    return `<a href="${escapeHtml(bedUrl)}">[Photo 2 showing bed position]</a>`;
  }
  return `<i>[Photo 1 showing upright seat] [Photo 2 showing bed position]</i>`;
}

export function formatLegPhotosMarkdown(photos) {
  const cabinObj = photos?.cabinPhoto || photos?.uprightSeatPhoto || {};
  const bedObj = photos?.bedPhoto || photos?.flatBedPhoto || {};
  const uprightUrl = cabinObj.imageUrl || cabinObj.originalImageUrl;
  const bedUrl = bedObj.imageUrl || bedObj.originalImageUrl;

  if (uprightUrl && bedUrl) {
    return `[Photo 1 showing upright seat](${uprightUrl}) [Photo 2 showing bed position](${bedUrl})`;
  }
  if (uprightUrl) {
    return `[Photo 1 showing upright seat](${uprightUrl})`;
  }
  if (bedUrl) {
    return `[Photo 2 showing bed position](${bedUrl})`;
  }
  return `*[Photo 1 showing upright seat] [Photo 2 showing bed position]*`;
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

  const isLondonDirect =
    ['LHR', 'LGW', 'LCY', 'STN', 'LTN'].includes(hubIata) ||
    !bestPos ||
    match.lhrPositioning?.positioningNeeded === false;

  // Build the user's exact clean card layout
  let card = '';
  if (isLondonDirect) {
    card += `<b>Option ${index} for ${bizCostStr} Total cost (Departing London)</b>\n`;
    card += `${escapeHtml(outBizDate)} @ ${escapeHtml(outBizDepTime)}\n`;
  } else {
    card += `<b>Option ${index} for ${totalCostStr} Total cost (${posCostStr} recommended LHR connection + ${bizCostStr} Biz flights)</b>\n`;
    card += `${escapeHtml(lhrOutDate)} @ ${escapeHtml(lhrOutDepTime)}\n`;
    card += `LHR to ${escapeHtml(hubIata)} arriving ${escapeHtml(lhrOutArrTime)} with ${escapeHtml(lhrOutAirline)} ${escapeHtml(lhrOutAircraft)}\n\n`;
    card += `<i>${escapeHtml(outBufferText)}</i>\n\n`;
  }

  // Outbound Business Flight Legs (handles direct as well as 1+ stopovers with individual photos & buffers)
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
            durationMins:
              match.outbound?.totalDurationMins || (outboundLeg.durationMins ?? 720),
            carrier: bizAirline,
            aircraft: bizAircraft,
            seatType: outboundLeg.seatType || 'True 180° Lie-Flat Seat',
            cabinPhotos: match.cabinPhotos,
          },
        ];
  const outLayovers = match.outbound?.layovers || [];

  outLegs.forEach((leg, idx) => {
    const legDepTime = toAmPm(leg.departureTime || '14:00');
    const legArrDate = toUkDate(leg.arrivalDate || leg.departureDate);
    const legArrTime = toAmPm(leg.arrivalTime || '07:00');
    const legDuration = formatHoursMinutes(leg.durationMins);
    const legSeatType = leg.seatType ? ` (${escapeHtml(leg.seatType)})` : '';
    const legPhotosStr = formatLegPhotosHtml(leg.cabinPhotos || match.cabinPhotos);

    card += `${escapeHtml(leg.from)} to ${escapeHtml(leg.to)} @ ${escapeHtml(legDepTime)} (${escapeHtml(legDuration)} flight), arriving @ ${escapeHtml(legArrDate)} @ ${escapeHtml(legArrTime)} with ${escapeHtml(leg.carrier)} ${escapeHtml(leg.aircraft)}${legSeatType}\n`;
    card += `${legPhotosStr}\n\n`;

    if (idx < outLegs.length - 1) {
      const lay = outLayovers[idx];
      const layDuration = formatHoursMinutes(lay?.durationMins);
      const layCity = lay?.city || lay?.airport || leg.to;
      card += `<i>- ${escapeHtml(layDuration)} stopover in ${escapeHtml(layCity)} -</i>\n\n`;
    }
  });

  card += `<b>- Number of nights at ${escapeHtml(destination)} = ${escapeHtml(nightsNum)} -</b>\n\n`;

  // Inbound Business Flight Legs (handles direct as well as 1+ stopovers with individual photos & buffers)
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
            durationMins:
              match.inbound?.totalDurationMins || (inboundLeg.durationMins ?? 720),
            carrier: returnBizAirline,
            aircraft: returnBizAircraft,
            seatType: inboundLeg.seatType || 'True 180° Lie-Flat Seat',
            cabinPhotos: match.cabinPhotos,
          },
        ];
  const inLayovers = match.inbound?.layovers || [];

  const inFirstLegDepDate = toUkDate(inLegs[0]?.departureDate || match.inbound?.departureDate);
  const inFirstLegDepTime = toAmPm(inLegs[0]?.departureTime || match.inbound?.departureTime || '14:00');
  card += `${escapeHtml(inFirstLegDepDate)} @ ${escapeHtml(inFirstLegDepTime)}\n`;

  inLegs.forEach((leg, idx) => {
    const legDepTime = toAmPm(leg.departureTime || '14:00');
    const legArrDate = toUkDate(leg.arrivalDate || leg.departureDate);
    const legArrTime = toAmPm(leg.arrivalTime || '06:00');
    const legDuration = formatHoursMinutes(leg.durationMins);
    const legSeatType = leg.seatType ? ` (${escapeHtml(leg.seatType)})` : '';
    const legPhotosStr = formatLegPhotosHtml(leg.cabinPhotos || match.cabinPhotos);

    card += `${escapeHtml(leg.from)} to ${escapeHtml(leg.to)} (${escapeHtml(legDuration)} flight), arriving @ ${escapeHtml(legArrDate)} @ ${escapeHtml(legArrTime)} with ${escapeHtml(leg.carrier)} ${escapeHtml(leg.aircraft)}${legSeatType}\n`;
    card += `${legPhotosStr}\n\n`;

    if (idx < inLegs.length - 1) {
      const lay = inLayovers[idx];
      const layDuration = formatHoursMinutes(lay?.durationMins);
      const layCity = lay?.city || lay?.airport || leg.to;
      card += `<i>- ${escapeHtml(layDuration)} stopover in ${escapeHtml(layCity)} -</i>\n\n`;
    }
  });

  if (!isLondonDirect) {
    card += `<i>${escapeHtml(inBufferText)}</i>\n\n`;
    card += `${escapeHtml(hubIata)} to LHR arriving ${escapeHtml(lhrInArrTime)} with ${escapeHtml(lhrInAirline)} ${escapeHtml(lhrInAircraft)}\n`;
  }

  // Live Booking Deep Links
  card += `\n🔗 <b>Live Booking Links:</b>\n`;
  if (match.bookingLinks) {
    card += `• <b>Business Class (${escapeHtml(hubIata)} ⇄ ${escapeHtml(destination)}):</b> ${formatOtaDeepLinks(match.bookingLinks)}\n`;
  }
  if (!isLondonDirect && bestPos?.bookingLinks) {
    card += `• <b>LHR Positioning (LHR ⇄ ${escapeHtml(hubIata)}):</b> ${formatOtaDeepLinks(bestPos.bookingLinks)}\n`;
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
      ? `[Photo 1 showing upright seat](${uprightUrl}) [Photo 2 showing bed position](${bedUrl})`
      : uprightUrl
      ? `[Photo 1 showing upright seat](${uprightUrl})`
      : bedUrl
      ? `[Photo 2 showing bed position](${bedUrl})`
      : `*[Photo 1 showing upright seat] [Photo 2 showing bed position]*`;

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
  let card = `### Option ${index} for ${totalCostStr} Total cost (${posCostStr} recommended LHR connection + ${bizCostStr} Biz flights)\n\n`;
  card += `${lhrOutDate} @ ${lhrOutDepTime}\n`;
  card += `LHR to ${hubIata} arriving ${lhrOutArrTime} with ${lhrOutAirline} ${lhrOutAircraft}\n\n`;
  card += `*${outBufferText}*\n\n`;

  // Outbound Business Flight Legs (handles direct as well as 1+ stopovers with individual photos & buffers)
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
            durationMins:
              match.outbound?.totalDurationMins || (outboundLeg.durationMins ?? 720),
            carrier: bizAirline,
            aircraft: bizAircraft,
            seatType: outboundLeg.seatType || 'True 180° Lie-Flat Seat',
            cabinPhotos: match.cabinPhotos,
          },
        ];
  const outLayovers = match.outbound?.layovers || [];

  outLegs.forEach((leg, idx) => {
    const legDepTime = toAmPm(leg.departureTime || '14:00');
    const legArrDate = toUkDate(leg.arrivalDate || leg.departureDate);
    const legArrTime = toAmPm(leg.arrivalTime || '07:00');
    const legDuration = formatHoursMinutes(leg.durationMins);
    const legSeatType = leg.seatType ? ` (${leg.seatType})` : '';
    const legPhotosStr = formatLegPhotosMarkdown(leg.cabinPhotos || match.cabinPhotos);

    card += `${leg.from} to ${leg.to} @ ${legDepTime} (${legDuration} flight), arriving @ ${legArrDate} @ ${legArrTime} with ${leg.carrier} ${leg.aircraft}${legSeatType}\n`;
    card += `${legPhotosStr}\n\n`;

    if (idx < outLegs.length - 1) {
      const lay = outLayovers[idx];
      const layDuration = formatHoursMinutes(lay?.durationMins);
      const layCity = lay?.city || lay?.airport || leg.to;
      card += `*- ${layDuration} stopover in ${layCity} -*\n\n`;
    }
  });

  card += `**- Number of nights at ${destination} = ${nightsNum} -**\n\n`;

  // Inbound Business Flight Legs (handles direct as well as 1+ stopovers with individual photos & buffers)
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
            durationMins:
              match.inbound?.totalDurationMins || (inboundLeg.durationMins ?? 720),
            carrier: returnBizAirline,
            aircraft: returnBizAircraft,
            seatType: inboundLeg.seatType || 'True 180° Lie-Flat Seat',
            cabinPhotos: match.cabinPhotos,
          },
        ];
  const inLayovers = match.inbound?.layovers || [];

  const inFirstLegDepDate = toUkDate(inLegs[0]?.departureDate || match.inbound?.departureDate);
  const inFirstLegDepTime = toAmPm(inLegs[0]?.departureTime || match.inbound?.departureTime || '14:00');
  card += `${inFirstLegDepDate} @ ${inFirstLegDepTime}\n`;

  inLegs.forEach((leg, idx) => {
    const legDepTime = toAmPm(leg.departureTime || '14:00');
    const legArrDate = toUkDate(leg.arrivalDate || leg.departureDate);
    const legArrTime = toAmPm(leg.arrivalTime || '06:00');
    const legDuration = formatHoursMinutes(leg.durationMins);
    const legSeatType = leg.seatType ? ` (${leg.seatType})` : '';
    const legPhotosStr = formatLegPhotosMarkdown(leg.cabinPhotos || match.cabinPhotos);

    card += `${leg.from} to ${leg.to} (${legDuration} flight), arriving @ ${legArrDate} @ ${legArrTime} with ${leg.carrier} ${leg.aircraft}${legSeatType}\n`;
    card += `${legPhotosStr}\n\n`;

    if (idx < inLegs.length - 1) {
      const lay = inLayovers[idx];
      const layDuration = formatHoursMinutes(lay?.durationMins);
      const layCity = lay?.city || lay?.airport || leg.to;
      card += `*- ${layDuration} stopover in ${layCity} -*\n\n`;
    }
  });

  card += `*${inBufferText}*\n\n`;
  card += `${hubIata} to LHR arriving ${lhrInArrTime} with ${lhrInAirline} ${lhrInAircraft}\n\n`;

  // Live Booking Deep Links
  card += `🔗 **Live Booking Links:**\n`;
  if (match.bookingLinks) {
    const gf = match.bookingLinks.googleFlights;
    const sky = match.bookingLinks.skyscannerOtaComparison || match.bookingLinks.skyscanner;
    const trip = match.bookingLinks.tripCom;
    const kayak = match.bookingLinks.kayakUk || match.bookingLinks.kayak;
    const links = [];
    if (gf) links.push(`[Google Flights (Live OTA)](${gf})`);
    if (sky) links.push(`[Skyscanner](${sky})`);
    if (trip) links.push(`[Trip.com UK](${trip})`);
    if (kayak) links.push(`[Kayak UK](${kayak})`);
    card += `• **Business Class (${hubIata} ⇄ ${destination}):** ${links.join(' | ')}\n`;
  }
  if (bestPos?.bookingLinks) {
    const gf = bestPos.bookingLinks.googleFlights;
    const sky = bestPos.bookingLinks.skyscannerOtaComparison || bestPos.bookingLinks.skyscanner;
    const trip = bestPos.bookingLinks.tripCom;
    const kayak = bestPos.bookingLinks.kayakUk || bestPos.bookingLinks.kayak;
    const links = [];
    if (gf) links.push(`[Google Flights (Live OTA)](${gf})`);
    if (sky) links.push(`[Skyscanner](${sky})`);
    if (trip) links.push(`[Trip.com UK](${trip})`);
    if (kayak) links.push(`[Kayak UK](${kayak})`);
    card += `• **LHR Positioning (LHR ⇄ ${hubIata}):** ${links.join(' | ')}\n`;
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
