import { buildGoogleFlightsUrl } from './protobuf.mjs';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-GB,en;q=0.9',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  Cookie: 'SOCS=CAESHAgBEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmVuIAEaBgiAo_CmBg',
};

function formatTimeTuple(tuple) {
  if (!Array.isArray(tuple) || tuple.length === 0) return '00:00';
  const hh = String(tuple[0] ?? 0).padStart(2, '0');
  const mm = String(tuple[1] ?? 0).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDateTuple(tuple) {
  if (!Array.isArray(tuple) || tuple.length < 3) return null;
  const yyyy = String(tuple[0]).padStart(4, '0');
  const mm = String(tuple[1]).padStart(2, '0');
  const dd = String(tuple[2]).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDurationHuman(mins) {
  if (!mins || typeof mins !== 'number') return '0h 0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

/**
 * Parses a raw Google Flights itinerary entry from `ds:1` data[2][0] or data[3][0].
 */
export function parseRawFlightEntry(entry, { currency = 'GBP' } = {}) {
  if (!Array.isArray(entry) || !Array.isArray(entry[0])) return null;

  const info = entry[0];
  const priceContainer = entry[1];
  const priceAmount = priceContainer?.[0]?.[1] ?? null;
  const bookingToken = priceContainer?.[1] ?? null;

  const primaryAirlineCode = info[0] || null;
  const itineraryAirlines = Array.isArray(info[1]) ? info[1] : [];
  const rawSegments = Array.isArray(info[2]) ? info[2] : [];
  const originAirport = info[3] || null;
  const depDate = formatDateTuple(info[4]);
  const depTime = formatTimeTuple(info[5]);
  const destAirport = info[6] || null;
  const arrDate = formatDateTuple(info[7]);
  const arrTime = formatTimeTuple(info[8]);
  const totalDurationMins = typeof info[9] === 'number' ? info[9] : null;
  const rawLayovers = Array.isArray(info[13]) ? info[13] : [];

  const segments = rawSegments.map((seg, idx) => {
    const flightMeta = Array.isArray(seg[22]) ? seg[22] : [];
    const carrierCode = flightMeta[0] || primaryAirlineCode || '';
    const flightNumber = flightMeta[1] ? `${carrierCode}${flightMeta[1]}` : carrierCode;
    const carrierName = flightMeta[3] || itineraryAirlines[0] || '';
    const operatingCarrierName = typeof seg[2] === 'string' ? seg[2] : null;
    const durationMins = typeof seg[11] === 'number' ? seg[11] : 0;
    const seatTypeCode = typeof seg[13] === 'number' ? seg[13] : null;
    const seatPitch = typeof seg[14] === 'string' ? seg[14] : null;
    const aircraftName = seg[17] || 'Unknown Aircraft';

    return {
      segmentIndex: idx + 1,
      from: seg[3] || '',
      fromAirportName: seg[4] || '',
      toAirportName: seg[5] || '',
      to: seg[6] || '',
      departureDate: formatDateTuple(seg[20]),
      departureTime: formatTimeTuple(seg[8]),
      arrivalDate: formatDateTuple(seg[21]),
      arrivalTime: formatTimeTuple(seg[10]),
      durationMins,
      durationHuman: formatDurationHuman(durationMins),
      durationHours: Number((durationMins / 60).toFixed(2)),
      aircraft: aircraftName,
      carrierCode,
      carrierName,
      flightNumber,
      operatingCarrierName,
      seatTypeCode,
      seatPitch,
    };
  });

  const layovers = rawLayovers.map((lay) => ({
    durationMins: lay[0] || 0,
    durationHuman: formatDurationHuman(lay[0] || 0),
    airport: lay[1] || lay[2] || '',
    airportName: lay[4] || '',
    city: lay[5] || '',
  }));

  return {
    primaryAirlineCode,
    airlines: itineraryAirlines,
    origin: originAirport,
    destination: destAirport,
    departureDate: depDate,
    departureTime: depTime,
    arrivalDate: arrDate,
    arrivalTime: arrTime,
    totalDurationMins,
    totalDurationHuman: formatDurationHuman(totalDurationMins),
    stops: Math.max(0, segments.length - 1),
    price: priceAmount,
    currency,
    bookingToken,
    segments,
    layovers,
  };
}

/**
 * Extracts `AF_initDataCallback({key: 'ds:1', ...})` JSON payload from Google Flights HTML.
 */
export function extractDs1FromHtml(html) {
  const match = html.match(
    /AF_initDataCallback\(\{key:\s*'ds:1'[\s\S]*?data:([\s\S]*?),\s*sideChannel:/
  );
  if (!match || !match[1]) {
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/**
 * Queries Google Flights for a specific route & date(s) and returns parsed itineraries.
 */
export async function fetchGoogleFlightsRoute({
  origin,
  destination,
  outboundDate,
  returnDate = null,
  cabin = 'BUSINESS',
  currency = 'GBP',
  gl = 'GB',
  hl = 'en',
  maxStops = null,
  selectedOutboundSegments = null,
  selectedReturnSegments = null,
  timeoutMs = 15000,
}) {
  const url = buildGoogleFlightsUrl({
    origin,
    destination,
    outboundDate,
    returnDate,
    cabin,
    currency,
    gl,
    hl,
    maxStops,
    selectedOutboundSegments,
    selectedReturnSegments,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        url,
        itineraries: [],
        error: `HTTP ${response.status} from Google Flights`,
      };
    }

    const html = await response.text();
    const ds1 = extractDs1FromHtml(html);
    if (!ds1) {
      return {
        ok: true,
        status: response.status,
        url,
        itineraries: [],
      };
    }

    const bestRaw = Array.isArray(ds1?.[2]?.[0]) ? ds1[2][0] : [];
    const otherRaw = Array.isArray(ds1?.[3]?.[0]) ? ds1[3][0] : [];
    const combinedRaw = [...bestRaw, ...otherRaw];

    const itineraries = [];
    for (const rawEntry of combinedRaw) {
      const parsed = parseRawFlightEntry(rawEntry, { currency });
      if (parsed && parsed.segments.length > 0) {
        itineraries.push(parsed);
      }
    }

    return {
      ok: true,
      status: response.status,
      url,
      itineraries,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      url,
      itineraries: [],
      error: err?.message || String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
