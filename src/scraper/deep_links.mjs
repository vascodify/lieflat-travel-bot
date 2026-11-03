import { buildGoogleFlightsUrl } from './protobuf.mjs';

/**
 * Generates direct, pre-populated booking and aggregator deep links
 * for Google Flights, Skyscanner (Gotogate/Lastminute/Booking/Trip), Trip.com, Kayak UK,
 * Momondo UK, Lastminute.com, and Expedia UK in either BUSINESS or ECONOMY cabin.
 */
export function generateAggregatorDeepLinks({
  origin,
  destination,
  outboundDate, // YYYY-MM-DD
  returnDate = null, // YYYY-MM-DD
  cabin = 'BUSINESS',
  currency = 'GBP',
  airlineCode = null,
  selectedOutboundSegments = null,
  selectedReturnSegments = null,
}) {
  const orig = String(origin).trim().toUpperCase();
  const dest = String(destination).trim().toUpperCase();
  const origLower = orig.toLowerCase();
  const destLower = dest.toLowerCase();

  // YYMMDD format for Skyscanner
  const toYYMMDD = (dateStr) => (dateStr ? dateStr.replace(/-/g, '').slice(2, 8) : '');
  const outYYMMDD = toYYMMDD(outboundDate);
  const retYYMMDD = toYYMMDD(returnDate);

  const isEconomy = String(cabin || 'BUSINESS').toUpperCase() === 'ECONOMY';
  const skyscannerCabin = isEconomy ? 'economy' : 'business';
  const tripComClass = isEconomy ? 'y' : 'c';
  const kayakCabinSegment = isEconomy ? '' : '/business';
  const lastminuteCabin = isEconomy ? 'Y' : 'C';
  const expediaCabin = isEconomy ? 'economy' : 'business';

  // 1. Google Flights Exact Itinerary Search Link (GBP) — locks in selected outbound & return segments when provided
  const googleFlightsUrl = buildGoogleFlightsUrl({
    origin: orig,
    destination: dest,
    outboundDate,
    returnDate,
    cabin,
    currency,
    selectedOutboundSegments,
    selectedReturnSegments,
  });

  const googleFlightsRouteUrl = buildGoogleFlightsUrl({
    origin: orig,
    destination: dest,
    outboundDate,
    returnDate,
    cabin,
    currency,
  });

  // 2. Skyscanner UK (Compares Gotogate, Lastminute.com, Booking.com, Trip.com, Mytrip, eDreams)
  const skyscannerPath = returnDate
    ? `${origLower}/${destLower}/${outYYMMDD}/${retYYMMDD}/`
    : `${origLower}/${destLower}/${outYYMMDD}/`;
  const skyscannerUrl = `https://www.skyscanner.net/transport/flights/${skyscannerPath}?adultsv2=1&cabinclass=${skyscannerCabin}&currency=${currency}&locale=en-GB&market=UK`;

  // 3. Trip.com UK Direct Deep Link
  const tripComUrl = returnDate
    ? `https://uk.trip.com/flights/showfarefirst?dcity=${origLower}&acity=${destLower}&ddate=${outboundDate}&rdate=${returnDate}&triptype=rt&class=${tripComClass}&lowpricesource=searchform&quantity=1&curr=${currency}&locale=en-GB`
    : `https://uk.trip.com/flights/showfarefirst?dcity=${origLower}&acity=${destLower}&ddate=${outboundDate}&triptype=ow&class=${tripComClass}&lowpricesource=searchform&quantity=1&curr=${currency}&locale=en-GB`;

  // 4. Kayak UK Direct Deep Link (with optional carrier filter)
  const kayakCarrierFilter = airlineCode ? `&fs=airlines=${airlineCode}` : '';
  const kayakUrl = returnDate
    ? `https://www.kayak.co.uk/flights/${orig}-${dest}/${outboundDate}/${returnDate}${kayakCabinSegment}/1adults?sort=bestflight_a${kayakCarrierFilter}`
    : `https://www.kayak.co.uk/flights/${orig}-${dest}/${outboundDate}${kayakCabinSegment}/1adults?sort=bestflight_a${kayakCarrierFilter}`;

  // 5. Momondo UK (Often surfaces the lowest Gotogate / Lastminute / Booking.com OTA fares)
  const momondoUrl = returnDate
    ? `https://www.momondo.co.uk/flight-search/${orig}-${dest}/${outboundDate}/${returnDate}${kayakCabinSegment}/1adults?sort=price_a${kayakCarrierFilter}`
    : `https://www.momondo.co.uk/flight-search/${orig}-${dest}/${outboundDate}${kayakCabinSegment}/1adults?sort=price_a${kayakCarrierFilter}`;

  // 6. Lastminute.com UK Direct Flight Search
  const lastminuteUrl = returnDate
    ? `https://www.lastminute.com/flights/search?depAp=${orig}&arrAp=${dest}&depDate=${outboundDate}&retDate=${returnDate}&cabinClass=${lastminuteCabin}&adults=1`
    : `https://www.lastminute.com/flights/search?depAp=${orig}&arrAp=${dest}&depDate=${outboundDate}&cabinClass=${lastminuteCabin}&adults=1`;

  // 7. Expedia UK Deep Link
  const expediaUrl = returnDate
    ? `https://www.expedia.co.uk/Flights-Search?trip=roundtrip&leg1=from:${orig},to:${dest},departure:${outboundDate}TANYT&leg2=from:${dest},to:${orig},departure:${returnDate}TANYT&passengers=adults:1&options=cabinclass:${expediaCabin}&mode=search`
    : `https://www.expedia.co.uk/Flights-Search?trip=oneway&leg1=from:${orig},to:${dest},departure:${outboundDate}TANYT&passengers=adults:1&options=cabinclass:${expediaCabin}&mode=search`;

  return {
    googleFlights: googleFlightsUrl,
    skyscannerOtaComparison: skyscannerUrl,
    tripCom: tripComUrl,
    kayakUk: kayakUrl,
    momondoUk: momondoUrl,
    lastminuteCom: lastminuteUrl,
    expediaUk: expediaUrl,
    markdownLinks: [
      `[Google Flights (Live OTA Links)](${googleFlightsUrl})`,
      `[Skyscanner (Gotogate / Booking.com / Lastminute)](${skyscannerUrl})`,
      `[Trip.com UK](${tripComUrl})`,
      `[Kayak UK](${kayakUrl})`,
      `[Momondo UK](${momondoUrl})`,
      `[Lastminute.com](${lastminuteUrl})`,
    ].join(' • '),
  };
}
