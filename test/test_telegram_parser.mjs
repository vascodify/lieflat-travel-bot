import { parseUserQueryHeuristic } from '../src/telegram/gemini_parser.mjs';

console.log('Testing query parser heuristics...');

const cases = [
  { input: 'Seoul for 3 nights in Dec', expectedDest: 'ICN', expectedNights: 3 },
  { input: 'Fly to Tokyo for 4 nights under £1,500 in January', expectedDest: 'TYO', expectedNights: 4, expectedMaxPrice: 1500 },
  { input: 'Rio de Janeiro 4 nights next month', expectedDest: 'GIG', expectedNights: 4 },
  { input: 'Bangkok 5 nights max 1400 gbp', expectedDest: 'BKK', expectedNights: 5, expectedMaxPrice: 1400 },
  { input: 'Four nights in Buenos Aires departing anytime in the next 4 months from any of the European hubs', expectedDest: 'EZE', expectedNights: 4, expectedMonthsAhead: 4 },
  { input: 'What is the cheapest business class flight you can find to Buenos Aires for four nights departing any time in the next 6 months', expectedDest: 'EZE', expectedNights: 4, expectedMonthsAhead: 6 },
];

for (const c of cases) {
  const res = parseUserQueryHeuristic(c.input, 2026, 11);
  console.log(`[PASS] "${c.input}" -> dest: ${res.destination}, nights: ${res.nights}, monthsAhead: ${res.monthsAhead}, maxPrice: £${res.maxPriceGbp}, month: ${res.targetMonth}`);
  if (c.expectedDest && res.destination !== c.expectedDest) {
    throw new Error(`Expected dest ${c.expectedDest}, got ${res.destination}`);
  }
  if (c.expectedNights && res.nights !== c.expectedNights) {
    throw new Error(`Expected nights ${c.expectedNights}, got ${res.nights}`);
  }
  if (c.expectedMonthsAhead && res.monthsAhead !== c.expectedMonthsAhead) {
    throw new Error(`Expected monthsAhead ${c.expectedMonthsAhead}, got ${res.monthsAhead}`);
  }
  if (c.expectedMaxPrice && res.maxPriceGbp !== c.expectedMaxPrice) {
    throw new Error(`Expected maxPriceGbp ${c.expectedMaxPrice}, got ${res.maxPriceGbp}`);
  }
}

console.log('All query parser heuristic tests passed!');
