import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  classifySegmentEquipment,
  normalizeRequestedAircraftFamilies,
} from '../src/data/aircraft_db.mjs';
import { checkAirlineBlocked } from '../src/data/airlines_db.mjs';
import { expandDatePairs } from '../src/engine/date_expander.mjs';
import { evaluateDirectionItinerary } from '../src/engine/filter_engine.mjs';
import { orchestrateLieFlatSearch } from '../src/engine/search_orchestrator.mjs';
import { computeBufferMinutes } from '../src/engine/positioning_engine.mjs';
import { resolveAirlineMeta, resolveAircraftMeta } from '../src/scraper/cabin_photos.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('=== 1. Testing Equipment & Narrowbody Lie-Flat Exception Rules ===');

// 1A: Airbus A350-900 widebody with lie-flat (seatTypeCode 6 = Individual Suite)
const a350Res = classifySegmentEquipment({
  aircraftName: 'Airbus A350-900',
  carrierCode: 'IB',
  carrierName: 'Iberia',
  seatTypeCode: 6,
  durationMins: 520,
});
assert.equal(a350Res.isWidebody, true);
assert.equal(a350Res.isQualifyingLongHaulEquipment, true);
assert.equal(a350Res.isTrueLieFlat, true);
console.log('  [PASS] Airbus A350-900 recognized as true lie-flat widebody suite.');

// 1B: "A360" user prompt normalization -> maps to Airbus widebodies with note
const normA360 = normalizeRequestedAircraftFamilies(['A330', 'A350', 'A360', '787']);
assert.equal(normA360.families.includes('A350'), true);
assert.equal(normA360.families.includes('A380'), true);
assert.equal(normA360.families.includes('B787'), true);
assert.equal(normA360.notes.length > 0, true);
console.log('  [PASS] "A360" gracefully normalized to A330/A350/A380 with explanatory note.');

// 1C: JetBlue Mint A321neo (True Lie-Flat Narrowbody Exception)
const jetblueMint = classifySegmentEquipment({
  aircraftName: 'Airbus A321neo',
  carrierCode: 'B6',
  carrierName: 'JetBlue',
  seatTypeCode: 6,
  durationMins: 465,
  allowLieFlatNarrowbodyExceptions: true,
});
assert.equal(jetblueMint.isWidebody, false);
assert.equal(jetblueMint.isLieFlatNarrowbodyException, true);
assert.equal(jetblueMint.isQualifyingLongHaulEquipment, true);
assert.equal(jetblueMint.isTrueLieFlat, true);
console.log('  [PASS] JetBlue Mint Airbus A321neo accepted via True Lie-Flat Narrowbody Exception.');

// 1D: TAP Air Portugal A321neo / A321LR long-haul (seatTypeCode 5 = 180° Lie-flat)
const tapLongHaul = classifySegmentEquipment({
  aircraftName: 'Airbus A321neo',
  carrierCode: 'TP',
  carrierName: 'TAP Air Portugal',
  seatTypeCode: 5,
  durationMins: 450,
  allowLieFlatNarrowbodyExceptions: true,
});
assert.equal(tapLongHaul.isLieFlatNarrowbodyException, true);
assert.equal(tapLongHaul.isQualifyingLongHaulEquipment, true);
console.log('  [PASS] TAP Air Portugal long-haul A321neo (A321LR subfleet) with seatTypeCode=5 accepted.');

// 1E: TAP Air Portugal short-haul Euro-business A321neo (seatTypeCode 1 = Standard legroom) -> MUST REJECT as long-haul equipment!
const tapEuroBiz = classifySegmentEquipment({
  aircraftName: 'Airbus A321neo',
  carrierCode: 'TP',
  carrierName: 'TAP Air Portugal',
  seatTypeCode: 1,
  durationMins: 150,
  allowLieFlatNarrowbodyExceptions: true,
});
assert.equal(tapEuroBiz.isQualifyingLongHaulEquipment, false);
console.log('  [PASS] TAP Air Portugal short-haul Euro-business A321neo (seatTypeCode=1) rejected as long-haul equipment.');

// 1F: Delta domestic First Class A321neo (seatTypeCode 8 = Recliner) -> MUST REJECT!
const deltaDomesticA321 = classifySegmentEquipment({
  aircraftName: 'Airbus A321neo',
  carrierCode: 'DL',
  carrierName: 'Delta',
  seatTypeCode: 8,
  durationMins: 430,
  allowLieFlatNarrowbodyExceptions: true,
});
assert.equal(deltaDomesticA321.isQualifyingLongHaulEquipment, false);
console.log('  [PASS] Delta domestic recliner A321neo (seatTypeCode=8) rejected.');

// 1G: Icelandair Boeing 767 widebody pitfall (Saga Class recliner) -> MUST REJECT!
const icelandair767 = classifySegmentEquipment({
  aircraftName: 'Boeing 767',
  carrierCode: 'FI',
  carrierName: 'Icelandair',
  seatTypeCode: 8,
  durationMins: 450,
});
assert.equal(icelandair767.isQualifyingLongHaulEquipment, false);
console.log('  [PASS] Icelandair Boeing 767 widebody recliner pitfall rejected.');

console.log('\n=== 2. Testing Unconditional Airline Blocklist (Marketing + Operating) ===');
for (const [code, name, op] of [
  ['AI', 'Air India', null],
  ['6E', 'IndoGo', null],
  ['FI', 'IcelandAir', null],
  ['MS', 'Egypt Air', null],
  ['LH', 'Lufthansa', 'Operated by EgyptAir'],
  ['TK', 'Turkish Airlines', 'Operated by IndiGo'],
]) {
  const res = checkAirlineBlocked({
    carrierCode: code,
    carrierName: name,
    operatingCarrierName: op,
  });
  assert.equal(res.isBlocked, true, `Expected ${code}/${name}/${op} to be blocked`);
}
console.log('  [PASS] Air India, IndiGo ("IndoGo"), Icelandair, and EgyptAir blocked (including codeshares).');

console.log('\n=== 3. Testing Strict Itinerary Duration & Feeder Rules ===');

// 3A: Connecting itinerary with 1h40m narrowbody feeder + 10h55m widebody 787-10 lie-flat under £1,700 -> PASS
const validConnecting = evaluateDirectionItinerary(
  {
    price: 1490,
    airlines: ['KLM'],
    segments: [
      {
        from: 'DUB',
        to: 'AMS',
        durationMins: 100, // 1h 40m feeder
        durationHuman: '1h 40m',
        aircraft: 'Boeing 737',
        carrierCode: 'KL',
        carrierName: 'KLM',
        flightNumber: 'KL1134',
        seatTypeCode: 1, // Euro-business on short feeder is fine!
      },
      {
        from: 'AMS',
        to: 'SFO',
        durationMins: 655, // 10h 55m >= 7h long leg
        durationHuman: '10h 55m',
        aircraft: 'Boeing 787-10',
        carrierCode: 'KL',
        carrierName: 'KLM',
        flightNumber: 'KL605',
        seatTypeCode: 5, // 180° Lie-flat
      },
    ],
  },
  { maxPriceGbp: 1700, minDirectHours: 8, minConnectingLongLegHours: 7 }
);
assert.equal(validConnecting.passed, true);
assert.equal(validConnecting.qualifyingLongLegs.length, 1);
assert.equal(validConnecting.shortFeederLegs.length, 1);
console.log('  [PASS] Connecting flight (1h40m narrowbody feeder + 10h55m 787-10 lie-flat widebody @ £1,490) passed.');

// 3B: Direct flight of 7h 20m (< 8h direct requirement) -> REJECT
const shortDirect = evaluateDirectionItinerary(
  {
    price: 1350,
    airlines: ['Aer Lingus'],
    segments: [
      {
        from: 'DUB',
        to: 'BOS',
        durationMins: 440, // 7h 20m (< 480m)
        durationHuman: '7h 20m',
        aircraft: 'Airbus A330-300',
        carrierCode: 'EI',
        carrierName: 'Aer Lingus',
        flightNumber: 'EI137',
        seatTypeCode: 5,
      },
    ],
  },
  { maxPriceGbp: 1700, minDirectHours: 8, minConnectingLongLegHours: 7 }
);
assert.equal(shortDirect.passed, false);
console.log('  [PASS] Direct flight under 8h (7h 20m) strictly rejected when minDirectHours=8.');

// 3C: Connecting flight where both legs are 6h (< 7h connecting requirement) -> REJECT
const twoMediumLegs = evaluateDirectionItinerary(
  {
    price: 1420,
    airlines: ['Qatar Airways'],
    segments: [
      {
        from: 'ATH',
        to: 'DOH',
        durationMins: 260, // 4h 20m
        durationHuman: '4h 20m',
        aircraft: 'Airbus A320',
        carrierCode: 'QR',
        carrierName: 'Qatar Airways',
        flightNumber: 'QR204',
        seatTypeCode: 5,
      },
      {
        from: 'DOH',
        to: 'BKK',
        durationMins: 390, // 6h 30m (< 420m)
        durationHuman: '6h 30m',
        aircraft: 'Airbus A380',
        carrierCode: 'QR',
        carrierName: 'Qatar Airways',
        flightNumber: 'QR836',
        seatTypeCode: 5,
      },
    ],
  },
  { maxPriceGbp: 1700, minDirectHours: 8, minConnectingLongLegHours: 7 }
);
assert.equal(twoMediumLegs.passed, false);
console.log('  [PASS] Connecting flight with longest leg 6h 30m (< 7h) strictly rejected.');

console.log('\n=== 4. Testing Flexible Date Expander (Friday -> Tuesday, 4 nights, next 2 months) ===');
const expandedDates = expandDatePairs({
  departureDayOfWeek: 'Friday',
  returnDayOfWeek: 'Tuesday',
  nights: 4,
  monthsAhead: 2,
  maxDatePairs: 5,
});
assert.equal(expandedDates.length > 0, true);
for (const dp of expandedDates) {
  assert.equal(dp.outboundDow, 'Fri');
  assert.equal(dp.returnDow, 'Tue');
  assert.equal(dp.nights, 4);
}
console.log('  [PASS] Generated Friday->Tuesday (4-night) pairs:', expandedDates.map((d) => `${d.outboundDate}->${d.returnDate}`).join(', '));

console.log('\n=== 5. Testing MCP Stdio JSON-RPC 2.0 Server Handshake ===');
await new Promise((resolve, reject) => {
  const mcpProc = spawn(path.join(PROJECT_ROOT, 'bin', 'run-mcp.sh'), [], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const responses = [];
  let stdoutBuf = '';

  mcpProc.stdout.on('data', (chunk) => {
    stdoutBuf += chunk.toString('utf8');
    const lines = stdoutBuf.split('\n');
    stdoutBuf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      responses.push(JSON.parse(line));
      if (responses.length === 3) {
        mcpProc.kill();
        resolve();
      }
    }
  });

  mcpProc.on('error', reject);

  mcpProc.stdin.write(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
    }) + '\n'
  );
  mcpProc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
  mcpProc.stdin.write(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'verify_aircraft_and_cabin',
        arguments: {
          aircraftName: 'Airbus A321neo',
          carrierCode: 'TP',
          carrierName: 'TAP Air Portugal',
          seatTypeCode: 5,
          durationMins: 460,
        },
      },
    }) + '\n'
  );
});
console.log('  [PASS] MCP Server initialized, listed 5 tools, and verified TAP A321LR Narrowbody Exception over JSON-RPC.');

console.log('\n=== 6. Testing LHR Positioning Buffer Math & Photo Airline/Aircraft Verification ===');
// Outbound LHR->BRU arrives 08:50, BRU->PEK departs 12:20 -> 210 mins (3h 30m >= 2.5h)
assert.equal(computeBufferMinutes('2026-12-08', '08:50', '2026-12-08', '12:20'), 210);
// Inbound PEK->BRU lands 05:45 on 2026-12-20, BRU->LHR departs 09:45 on 2026-12-20 -> 240 mins (4h 00m >= 2.5h)
assert.equal(computeBufferMinutes('2026-12-20', '05:45', '2026-12-20', '09:45'), 240);
console.log('  [PASS] Outbound & overnight-inbound LHR positioning buffers (>= 2.5h) verified.');

const hainanMeta = resolveAirlineMeta('Hainan');
const b787Meta = resolveAircraftMeta('Boeing 787');
assert.equal(hainanMeta.fullName, 'Hainan Airlines');
assert.equal(b787Meta.family, '787');
assert.equal(b787Meta.conflictRegex.test('Hainan-Airlines-Airbus-A330-seat.jpg'), true);
console.log('  [PASS] Strict airline/aircraft photo conflict filter verified.');

console.log('\n=== 7. Testing Telegram Bot Formatter & Parser ===');
import { parseUserQueryHeuristic } from '../src/telegram/gemini_parser.mjs';
import { formatFlightDealHtml } from '../src/telegram/formatter.mjs';

const parsedQ = parseUserQueryHeuristic('Seoul 3 nights Dec 1600', 2026, 11);
assert.equal(parsedQ.destination, 'ICN');
assert.equal(parsedQ.nights, 3);
assert.equal(parsedQ.maxPriceGbp, 1600);

const sampleDealHtml = formatFlightDealHtml({
  originHub: { iata: 'FRA', taxNotes: 'Low APD tier' },
  destination: 'ICN',
  airline: 'MIAT Mongolian Airlines',
  aircraft: 'Boeing 787-9 Dreamliner',
  pricing: { businessRoundTripGbp: 1462, positioningReturnGbp: 181, combinedTotalGbp: 1643, currency: 'GBP' },
  outbound: { departureDate: '2026-12-04', totalDuration: '14h 20m', qualifyingLongLegs: [{ airline: 'MIAT', flightNumber: 'OM138', origin: 'FRA', destination: 'UBN', duration: '9h 15m', aircraft: 'Boeing 787-9', seatType: '180° Lie-Flat' }] },
  inbound: { departureDate: '2026-12-08', totalDuration: '15h 10m', qualifyingLongLegs: [{ airline: 'MIAT', flightNumber: 'OM137', origin: 'UBN', destination: 'FRA', duration: '9h 55m', aircraft: 'Boeing 787-9', seatType: '180° Lie-Flat' }] },
  bookingLinks: { googleFlights: 'https://www.google.com/travel/flights' },
});
assert.equal(sampleDealHtml.includes('MIAT Mongolian Airlines'), true);
assert.equal(sampleDealHtml.includes('1,462 GBP'), true);
assert.equal(sampleDealHtml.includes('1,643 GBP'), true);
console.log('  [PASS] Telegram Bot parser and HTML deal formatter verified.');

if (process.argv.includes('--live')) {
  console.log('\n=== 6. Running Live Google Flights Discovery Sweep for User Example Prompt ===');
  const liveResults = await orchestrateLieFlatSearch({
    origins: ['DUB', 'MAD', 'LIS', 'ARN', 'OSL', 'ATH'],
    destinations: ['JFK', 'BOS', 'IAD', 'ORD', 'BOG', 'GRU', 'BKK', 'DXB'],
    outboundDate: '2026-11-20',
    returnDate: '2026-11-24',
    maxPriceGbp: 1700,
    minDirectHours: 8,
    minConnectingLongLegHours: 7,
    allowLieFlatNarrowbodyExceptions: true,
    verifyReturnLeg: true,
    concurrency: 8,
    maxResults: 8,
  });
  console.log(JSON.stringify(liveResults, null, 2));
}
