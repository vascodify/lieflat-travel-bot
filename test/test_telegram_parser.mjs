import { parseUserQueryHeuristic } from '../src/telegram/gemini_parser.mjs';

console.log('Testing query parser heuristics...');

const cases = [
  { input: 'Seoul for 3 nights in Dec', expectedDest: 'ICN', expectedNights: 3 },
  { input: 'Fly to Tokyo for 4 nights under £1,500 in January', expectedDest: 'HND', expectedNights: 4, expectedMaxPrice: 1500 },
  { input: 'Rio de Janeiro 4 nights next month', expectedDest: 'GIG', expectedNights: 4 },
  { input: 'Bangkok 5 nights max 1400 gbp', expectedDest: 'BKK', expectedNights: 5, expectedMaxPrice: 1400 },
];

for (const c of cases) {
  const res = parseUserQueryHeuristic(c.input, 2026, 11);
  console.log(`[PASS] "${c.input}" -> dest: ${res.destination}, nights: ${res.nights}, maxPrice: £${res.maxPriceGbp}, month: ${res.targetMonth}`);
  if (c.expectedDest && res.destination !== c.expectedDest) {
    throw new Error(`Expected dest ${c.expectedDest}, got ${res.destination}`);
  }
  if (c.expectedNights && res.nights !== c.expectedNights) {
    throw new Error(`Expected nights ${c.expectedNights}, got ${res.nights}`);
  }
}

console.log('All query parser heuristic tests passed!');
