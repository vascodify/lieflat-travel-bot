/**
 * Google Flights `tfs` Protobuf Encoder
 * Encodes flight legs, cabin class (Business = 3, First = 4), trip type (Round-Trip = 1, One-Way = 2),
 * and passenger counts into Google Flights' URL-safe base64 protobuf query string.
 */

function encodeVarint(val) {
  const bytes = [];
  let v = val >>> 0;
  while (v > 127) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v);
  return Buffer.from(bytes);
}

function encodeTag(fieldNumber, wireType) {
  return encodeVarint((fieldNumber << 3) | wireType);
}

function encodeBytes(fieldNumber, buf) {
  const data = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf;
  return Buffer.concat([encodeTag(fieldNumber, 2), encodeVarint(data.length), data]);
}

function encodeAirport(iata) {
  return encodeBytes(2, String(iata).trim().toUpperCase());
}

/**
 * Encodes a selected segment inside a FlightLeg (protobuf field 4 of FlightLeg).
 * Locking in `selectedSegments` on leg 0 causes Google Flights to return the exact
 * Step-2 "Returning flights" list and true combined round-trip price for each return option.
 */
function encodeSelectedSegment({ from, departureDate, date, to, carrierCode, flightNumber }) {
  const depDate = String(departureDate || date || '').trim();
  const carrier = String(carrierCode || '').trim().toUpperCase();
  const numOnly = String(flightNumber || '')
    .toUpperCase()
    .replace(new RegExp(`^${carrier}`), '')
    .replace(/[^0-9]/g, '');

  return Buffer.concat([
    encodeBytes(1, String(from || '').trim().toUpperCase()),
    encodeBytes(2, depDate),
    encodeBytes(3, String(to || '').trim().toUpperCase()),
    encodeBytes(5, carrier),
    encodeBytes(6, numOnly),
  ]);
}

function encodeFlightLeg({ date, from, to, maxStops = null, selectedSegments = null }) {
  const parts = [encodeBytes(2, date)];
  if (Array.isArray(selectedSegments) && selectedSegments.length > 0) {
    for (const seg of selectedSegments) {
      parts.push(encodeBytes(4, encodeSelectedSegment(seg)));
    }
  }
  if (maxStops !== null && maxStops !== undefined) {
    parts.push(Buffer.concat([encodeTag(5, 0), encodeVarint(maxStops)]));
  }
  parts.push(encodeBytes(13, encodeAirport(from)));
  parts.push(encodeBytes(14, encodeAirport(to)));
  return Buffer.concat(parts);
}

export const CABIN_SEAT_MAP = {
  ECONOMY: 1,
  PREMIUM_ECONOMY: 2,
  BUSINESS: 3,
  FIRST: 4,
};

export const TRIP_TYPE_MAP = {
  ROUND_TRIP: 1,
  ONE_WAY: 2,
  MULTI_CITY: 3,
};

export function buildGoogleFlightsTfs({
  legs,
  cabin = 'BUSINESS',
  tripType = 'ROUND_TRIP',
  adults = 1,
}) {
  const seatCode = CABIN_SEAT_MAP[String(cabin).toUpperCase()] || 3;
  const tripCode = TRIP_TYPE_MAP[String(tripType).toUpperCase()] || (legs.length > 1 ? 1 : 2);

  const parts = [
    Buffer.concat([encodeTag(1, 0), encodeVarint(28)]),
    Buffer.concat([encodeTag(2, 0), encodeVarint(2)]),
  ];

  for (const leg of legs) {
    parts.push(encodeBytes(3, encodeFlightLeg(leg)));
  }

  for (let i = 0; i < Math.max(1, adults); i++) {
    parts.push(Buffer.concat([encodeTag(8, 0), encodeVarint(1)]));
  }

  parts.push(Buffer.concat([encodeTag(9, 0), encodeVarint(seatCode)]));
  parts.push(Buffer.concat([encodeTag(14, 0), encodeVarint(1)]));
  parts.push(Buffer.concat([encodeTag(19, 0), encodeVarint(tripCode)]));

  return Buffer.concat(parts).toString('base64url');
}

export function buildGoogleFlightsUrl({
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
}) {
  const legs = [
    {
      date: outboundDate,
      from: origin,
      to: destination,
      maxStops,
      selectedSegments: selectedOutboundSegments,
    },
  ];
  if (returnDate) {
    legs.push({
      date: returnDate,
      from: destination,
      to: origin,
      maxStops,
      selectedSegments: selectedReturnSegments,
    });
  }
  const tfs = buildGoogleFlightsTfs({
    legs,
    cabin,
    tripType: returnDate ? 'ROUND_TRIP' : 'ONE_WAY',
  });
  return `https://www.google.com/travel/flights/search?tfs=${tfs}&hl=${hl}&gl=${gl}&curr=${currency}`;
}
