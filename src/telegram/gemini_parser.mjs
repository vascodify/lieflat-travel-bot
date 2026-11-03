/**
 * Natural language search parser for the Telegram Travel Bot.
 * Translates user text queries into structured parameters for orchestrateLieFlatSearch.
 * Uses Google Gemini Flash REST API via native fetch with robust regex/word-number fallback.
 */

const KNOWN_AIRPORT_NAMES = {
  seoul: 'ICN',
  incheon: 'ICN',
  tokyo: 'TYO',
  haneda: 'HND',
  narita: 'NRT',
  rio: 'GIG',
  'rio de janeiro': 'GIG',
  bangkok: 'BKK',
  singapore: 'SIN',
  dubai: 'DXB',
  doha: 'DOH',
  sao: 'GRU',
  'sao paulo': 'GRU',
  buenos: 'EZE',
  'buenos aires': 'EZE',
  ezeiza: 'EZE',
  santiago: 'SCL',
  bogota: 'BOG',
  lima: 'LIM',
  cancun: 'CUN',
  'mexico city': 'MEX',
  'new york': 'JFK',
  nyc: 'JFK',
  jfk: 'JFK',
  newark: 'EWR',
  miami: 'MIA',
  'los angeles': 'LAX',
  lax: 'LAX',
  'san francisco': 'SFO',
  sfo: 'SFO',
  chicago: 'ORD',
  ord: 'ORD',
  boston: 'BOS',
  bos: 'BOS',
  washington: 'IAD',
  toronto: 'YYZ',
  montreal: 'YUL',
  vancouver: 'YVR',
  taipei: 'TPE',
  hong: 'HKG',
  'hong kong': 'HKG',
  hkg: 'HKG',
  kuala: 'KUL',
  'kuala lumpur': 'KUL',
  bali: 'DPS',
  denpasar: 'DPS',
  jakarta: 'CGK',
  phuket: 'HKT',
  manila: 'MNL',
  shanghai: 'PVG',
  beijing: 'PEK',
  johannesburg: 'JNB',
  'cape town': 'CPT',
  nairobi: 'NBO',
  maldives: 'MLE',
  male: 'MLE',
  zanzibar: 'ZNZ',
  sydney: 'SYD',
  melbourne: 'MEL',
  auckland: 'AKL',
};

const NUMBER_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fourteen: 14,
};

const MONTH_NAMES = {
  january: '01', jan: '01',
  february: '02', feb: '02',
  march: '03', mar: '03',
  april: '04', apr: '04',
  may: '05',
  june: '06', jun: '06',
  july: '07', jul: '07',
  august: '08', aug: '08',
  september: '09', sep: '09', sept: '09',
  october: '10', oct: '10',
  november: '11', nov: '11',
  december: '12', dec: '12',
};

function parseNumberToken(token) {
  if (!token) return null;
  const clean = String(token).trim().toLowerCase();
  if (/^\d+$/.test(clean)) return parseInt(clean, 10);
  return NUMBER_WORDS[clean] ?? null;
}

export async function parseUserQueryWithGemini(
  userText,
  { geminiApiKey = process.env.GEMINI_API_KEY, modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash' } = {}
) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Always compute heuristic baseline so we never lose nights vs monthsAhead distinction
  const heuristic = parseUserQueryHeuristic(userText, currentYear, currentMonth);

  if (geminiApiKey && geminiApiKey.startsWith('AIza')) {
    try {
      const prompt = `You are an expert flight search query parser. Extract flight search parameters from the user's message.
Return ONLY valid JSON matching this exact schema:
{
  "destination": "3-letter IATA code (use TYO for Tokyo, ICN for Seoul, BKK for Bangkok, EZE for Buenos Aires, GIG for Rio)",
  "nights": integer (trip duration in nights, e.g. 3, 4; default 4. Do NOT confuse with 'next X months'),
  "monthsAhead": integer (how many months ahead to search if user says 'in the next X months', e.g. 2, 4, 6; default 2),
  "targetMonth": "YYYY-MM" (e.g. "2026-12" if a specific month name is requested, null if searching across next X months),
  "departureDayOfWeek": "Friday" | "Saturday" | "Thursday" | null,
  "maxPriceGbp": number or null (only if user explicitly stated a price/budget cap like 'under 1600' or 'max 1700', otherwise null),
  "preferLowApd": true,
  "summary": "Brief 1-line plain English summary of what will be searched"
}

Current date: ${now.toISOString().split('T')[0]}.
User message: "${userText}"`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJsonText) {
          const parsed = JSON.parse(rawJsonText);
          if (parsed.destination && parsed.destination.length === 3) {
            parsed.destination = parsed.destination.toUpperCase();
            parsed.nights = Number(parsed.nights) || heuristic.nights || 4;
            parsed.monthsAhead = Number(parsed.monthsAhead) || heuristic.monthsAhead || 2;
            parsed.maxPriceGbp = parsed.maxPriceGbp ? Number(parsed.maxPriceGbp) : heuristic.maxPriceGbp;
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn('[GeminiParser] Gemini API parse failed, falling back to heuristic parser:', err.message);
    }
  }

  return heuristic;
}

export async function parseAudioWithGemini(
  audioBuffer,
  mimeType = 'audio/ogg',
  { geminiApiKey = process.env.GEMINI_API_KEY, modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash' } = {}
) {
  const now = new Date();
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is missing in your .env file.');
  }
  if (!geminiApiKey.startsWith('AIza')) {
    throw new Error(
      'Your GEMINI_API_KEY in .env does not appear to be a valid Google AI Studio key (keys from aistudio.google.com start with "AIzaSy...").'
    );
  }

  const base64Audio = Buffer.from(audioBuffer).toString('base64');
  const prompt = `Listen carefully to this voice note and extract the flight search parameters.
Return ONLY valid JSON matching this exact schema:
{
  "transcription": "Verbatim transcript of what the user said in the voice note",
  "destination": "3-letter IATA code (use TYO for Tokyo, ICN for Seoul, BKK for Bangkok, EZE for Buenos Aires, GIG for Rio)",
  "nights": integer (trip length in nights, e.g. 3, 4; default 4),
  "monthsAhead": integer (search window in months if user says 'next X months', default 2),
  "targetMonth": "YYYY-MM" (e.g. "2026-12", null if unspecified),
  "departureDayOfWeek": "Friday" | "Saturday" | "Thursday" | null,
  "maxPriceGbp": number or null (only if user explicitly stated a price like 'under 1600', otherwise null),
  "summary": "Brief 1-line plain English summary of what will be searched"
}

Current date: ${now.toISOString().split('T')[0]}.`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Audio,
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini Audio API error (${resp.status}): ${errText}`);
  }

  const data = await resp.json();
  const rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJsonText) {
    throw new Error('Gemini did not return parsed audio contents.');
  }

  const parsed = JSON.parse(rawJsonText);
  if (parsed.destination && parsed.destination.length === 3) {
    parsed.destination = parsed.destination.toUpperCase();
  } else {
    parsed.destination = 'ICN';
  }
  parsed.nights = Number(parsed.nights) || 4;
  parsed.monthsAhead = Number(parsed.monthsAhead) || 2;
  parsed.maxPriceGbp = parsed.maxPriceGbp ? Number(parsed.maxPriceGbp) : 2400;
  return parsed;
}

export function parseUserQueryHeuristic(userText, currentYear, currentMonth) {
  const text = String(userText).toLowerCase();
  const numberWordPattern = `(?:\\d+|${Object.keys(NUMBER_WORDS).join('|')})`;

  // 1. Destination
  let destination = null;
  const iataMatch = userText.match(/\b([A-Z]{3})\b/);
  if (iataMatch && !['FOR', 'THE', 'AND', 'GBP', 'LHR', 'BOT', 'ANY', 'ALL', 'NOT'].includes(iataMatch[1])) {
    destination = iataMatch[1];
  } else {
    // Sort keys by length descending so "rio de janeiro" matches before "rio"
    const sortedCities = Object.entries(KNOWN_AIRPORT_NAMES).sort((a, b) => b[0].length - a[0].length);
    for (const [city, code] of sortedCities) {
      if (text.includes(city)) {
        destination = code;
        break;
      }
    }
  }
  if (!destination) destination = 'ICN';

  // 2. Months Ahead window (e.g. "in the next 4 months", "next 6 months", "within 3 months")
  let monthsAhead = 2;
  let hasExplicitMonthsAhead = false;
  const monthsAheadRegex = new RegExp(
    `(?:next|within|over\\s+the\\s+next|in\\s+the\\s+next)\\s+(${numberWordPattern})\\s*months?\\b`,
    'i'
  );
  const monthsAheadMatch = text.match(monthsAheadRegex);
  if (monthsAheadMatch) {
    const val = parseNumberToken(monthsAheadMatch[1]);
    if (val && val >= 1 && val <= 12) {
      monthsAhead = val;
      hasExplicitMonthsAhead = true;
    }
  }

  // 3. Trip length in Nights (strictly match "nights" or "days", or "for X months in <Month>" typo)
  let nights = 4;
  const nightsRegex = new RegExp(`\\b(${numberWordPattern})\\s*(?:nights?|days?)\\b`, 'i');
  const nightsMatch = text.match(nightsRegex);
  if (nightsMatch) {
    const val = parseNumberToken(nightsMatch[1]);
    if (val && val >= 1 && val <= 30) {
      nights = val;
    }
  } else if (!hasExplicitMonthsAhead) {
    // Handle voice-to-text typo like "Buenos Aires for 4 months in December" -> 4 nights
    const typoNightsMatch = text.match(new RegExp(`\\bfor\\s+(${numberWordPattern})\\s*months?\\s+in\\b`, 'i'));
    if (typoNightsMatch) {
      const val = parseNumberToken(typoNightsMatch[1]);
      if (val && val >= 1 && val <= 14) {
        nights = val;
      }
    }
  }

  // 4. Price / Budget ceiling (strip thousands commas first so "£1,500" -> "£1500")
  const textNoCommas = text.replace(/(\d),(\d{3})\b/g, '$1$2');
  let maxPriceGbp = 2400; // Flexible default so users see lowest available verified fares even in peak season
  let explicitBudget = false;
  const priceMatch =
    textNoCommas.match(/(?:£|\$|under|max|below|budget|ceiling)\s*(?:£|\$)?\s*(\d{3,4})\b/i) ||
    textNoCommas.match(/\b(\d{3,4})\s*(?:gbp|pounds)\b/i) ||
    textNoCommas.match(/\b(1\d{3}|[89]\d{2}|2[1-9]\d{2}|[34]\d{3})\b/);
  if (priceMatch) {
    const val = parseInt(priceMatch[1], 10);
    if (val >= 800 && val <= 5000 && (val < 2024 || val > 2035)) {
      maxPriceGbp = val;
      explicitBudget = true;
    }
  }

  // 5. Target Month (only if user named a specific month like "December" or "Jan")
  let targetMonth = null;
  for (const [mName, mNum] of Object.entries(MONTH_NAMES)) {
    const mRegex = new RegExp(`\\b${mName}\\b`, 'i');
    if (mRegex.test(text)) {
      const year = parseInt(mNum, 10) < currentMonth ? currentYear + 1 : currentYear;
      targetMonth = `${year}-${mNum}`;
      break;
    }
  }

  return {
    destination,
    nights,
    monthsAhead,
    targetMonth,
    departureDayOfWeek: 'Friday',
    returnDayOfWeek: null,
    maxPriceGbp,
    explicitBudget,
    preferLowApd: true,
    summary: `Lie-flat to ${destination} for ${nights} nights${
      targetMonth ? ` in ${targetMonth}` : ` (next ${monthsAhead} months)`
    }${explicitBudget ? ` [max £${maxPriceGbp} GBP]` : ''}`,
  };
}
