/**
 * Formatter for Telegram messages.
 * Formats flight search results into rich Telegram HTML messages.
 */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatFlightDealHtml(match, index = 1) {
  const {
    originHub,
    destination,
    airline,
    aircraft,
    pricing,
    outbound,
    inbound,
    cabinPhotos,
    lhrPositioning,
    bookingLinks,
    usesNarrowbodyException,
  } = match;

  const businessPrice = pricing?.businessRoundTripGbp ? `£${pricing.businessRoundTripGbp.toLocaleString('en-GB')}` : 'N/A';
  const posPrice = pricing?.positioningReturnGbp ? `£${pricing.positioningReturnGbp.toLocaleString('en-GB')}` : '£0';
  const totalPrice = pricing?.combinedTotalGbp ? `£${pricing.combinedTotalGbp.toLocaleString('en-GB')}` : businessPrice;

  let text = `✈️ <b>OPTION ${index}: ${escapeHtml(airline)} — ${escapeHtml(aircraft)}</b>\n`;
  text += `📍 <b>Route:</b> <code>${escapeHtml(originHub?.iata || 'HUB')} ⇄ ${escapeHtml(destination)}</code>\n`;
  if (originHub?.taxNotes) {
    text += `🏛 <b>Origin Tax:</b> <i>${escapeHtml(originHub.taxNotes)}</i>\n`;
  }
  text += `💰 <b>Price:</b> <b>${businessPrice} GBP</b> (Business RT)\n`;
  if (lhrPositioning?.recommendedPair || (pricing?.positioningReturnGbp && pricing.positioningReturnGbp > 0)) {
    text += `➕ <b>LHR Positioning:</b> <b>+${posPrice} GBP</b>\n`;
    text += `💎 <b>Combined Total:</b> <b><u>${totalPrice} GBP</u></b>\n`;
  }

  text += `\n🛫 <b>OUTBOUND: ${escapeHtml(outbound?.departureDate || '')} (${escapeHtml(outbound?.totalDuration || '')})</b>\n`;
  if (outbound?.qualifyingLongLegs?.length) {
    for (const leg of outbound.qualifyingLongLegs) {
      text += `  • <b>${escapeHtml(leg.airline)} ${escapeHtml(leg.flightNumber || '')}</b>: ${escapeHtml(leg.origin)} ➔ ${escapeHtml(leg.destination)} (${escapeHtml(leg.duration)})\n`;
      text += `    💺 <i>${escapeHtml(leg.aircraft)}</i> — <b>${escapeHtml(leg.seatType || '180° Lie-Flat')}</b>\n`;
    }
  }
  if (outbound?.layovers?.length) {
    for (const l of outbound.layovers) {
      text += `    ⏱ Layover in ${escapeHtml(l.airport)}: ${escapeHtml(l.durationHuman || '')}\n`;
    }
  }

  if (inbound) {
    text += `\n🛬 <b>RETURN: ${escapeHtml(inbound?.departureDate || '')} (${escapeHtml(inbound?.totalDuration || '')})</b>\n`;
    if (inbound?.qualifyingLongLegs?.length) {
      for (const leg of inbound.qualifyingLongLegs) {
        text += `  • <b>${escapeHtml(leg.airline)} ${escapeHtml(leg.flightNumber || '')}</b>: ${escapeHtml(leg.origin)} ➔ ${escapeHtml(leg.destination)} (${escapeHtml(leg.duration)})\n`;
        text += `    💺 <i>${escapeHtml(leg.aircraft)}</i> — <b>${escapeHtml(leg.seatType || '180° Lie-Flat')}</b>\n`;
      }
    }
    if (inbound?.layovers?.length) {
      for (const l of inbound.layovers) {
        text += `    ⏱ Layover in ${escapeHtml(l.airport)}: ${escapeHtml(l.durationHuman || '')}\n`;
      }
    }
  }

  // Positioning
  if (lhrPositioning?.recommendedPair) {
    const p = lhrPositioning.recommendedPair;
    text += `\n🇬🇧 <b>Recommended LHR Positioning (Separate Ticket):</b>\n`;
    text += `  • <b>Outbound:</b> LHR ➔ ${escapeHtml(originHub?.iata)} on ${escapeHtml(p.outboundFlight?.airline)} (${escapeHtml(p.outboundFlight?.departs)} ➔ ${escapeHtml(p.outboundFlight?.arrives)})\n`;
    text += `    <i>Buffer before Business departure: ${escapeHtml(p.outboundBufferHours)}h</i>\n`;
    text += `  • <b>Return:</b> ${escapeHtml(originHub?.iata)} ➔ LHR on ${escapeHtml(p.returnFlight?.airline)} (${escapeHtml(p.returnFlight?.departs)} ➔ ${escapeHtml(p.returnFlight?.arrives)})\n`;
    text += `    <i>Buffer after Business arrival: ${escapeHtml(p.returnBufferHours)}h</i>\n`;
    text += `  • <b>Positioning Fare:</b> ~£${p.combinedPriceGbp} GBP (separate booking)\n`;
  }

  // OTA Deep links
  if (bookingLinks) {
    text += `\n🔗 <b>Live Booking Deep Links:</b>\n`;
    const links = [];
    if (bookingLinks.googleFlights) links.push(`<a href="${escapeHtml(bookingLinks.googleFlights)}">Google Flights (Direct Selection)</a>`);
    if (bookingLinks.skyscanner) links.push(`<a href="${escapeHtml(bookingLinks.skyscanner)}">Skyscanner</a>`);
    if (bookingLinks.tripCom) links.push(`<a href="${escapeHtml(bookingLinks.tripCom)}">Trip.com</a>`);
    if (bookingLinks.kayak) links.push(`<a href="${escapeHtml(bookingLinks.kayak)}">Kayak</a>`);
    if (bookingLinks.momondo) links.push(`<a href="${escapeHtml(bookingLinks.momondo)}">Momondo</a>`);
    text += links.join(' | ') + '\n';
  }

  return text;
}

export function formatSearchSummaryHtml(summary) {
  let text = `🎯 <b>Lie-Flat Flight Search Results</b>\n\n`;
  text += `• Scanned Hubs: <code>${(summary.originsScanned || []).join(', ')}</code>\n`;
  text += `• Destination: <code>${(summary.destinationsScanned || []).join(', ')}</code>\n`;
  text += `• Budget Ceiling: <b>£${summary.maxPriceGbp} GBP</b>\n`;
  text += `• Verified Lie-Flat Deals Found: <b>${summary.verifiedMatchesCount}</b>\n`;
  text += `• Blocklist Filter: <i>Air India, IndiGo, Icelandair, EgyptAir strictly excluded</i>\n`;
  return text;
}
