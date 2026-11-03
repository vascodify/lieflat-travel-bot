/**
 * Natural language search parser for the Telegram Travel Bot.
 * Translates user text queries into structured parameters for orchestrateLieFlatSearch.
 * Uses Google Gemini Flash REST API via native fetch with regex fallback.
 */

const KNOWN_AIRPORT_NAMES = {
  seoul: 'ICN',
  incheon: 'ICN',
  tokyo: 'HND',
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
  santiago: 'SCL',
  bogota: 'BOG',
  cancun: 'CUN',
  'new york': 'JFK',
  nyc: 'JFK',
  jfk: 'JFK',
  miami: 'MIA',
  'los angeles': 'LAX',
  lax: 'LAX',
  'san francisco': 'SFO',
  sfo: 'SFO',
  chicago: 'ORD',
  ord: 'ORD',
  boston: 'BOS',
  bos: 'BOS',
  taipei: 'TPE',
  hong: 'HKG',
  'hong kong': 'HKG',
  hkg: 'HKG',
  kuala: 'KUL',
  'kuala lumpur': 'KUL',
  bali: 'DPS',
  denpasar: 'DPS',
  phuket: 'HKT',
  manila: 'MNL',
  johannesburg: 'JNB',
  'cape town': 'CPT',
  nairobi: 'NBO',
  sydney: 'SYD',
  melbourne: 'MEL',
  auckland: 'AKL',
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

export async function parseUserQueryWithGemini(userText, { geminiApiKey = process.env.GEMINI_API_KEY, modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash' } = {}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (geminiApiKey) {
    try {
      const prompt = `You are a flight search query parser. Extract flight search parameters from the user's message.
Return ONLY valid JSON matching this exact schema:
{
  "destination": "3-letter IATA code, e.g. ICN, GIG, HND, BKK",
  "nights": integer (e.g. 3, 4, default 4),
  "targetMonth": "YYYY-MM" (e.g. "2026-12", null if unspecified),
  "departureDayOfWeek": "Friday" | "Saturday" | "Thursday" | null,
  "maxPriceGbp": number (default 1700),
  "preferLowApd": true,
  "maxOriginHubs": 5,
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
            parsed.nights = Number(parsed.nights) || 4;
            parsed.maxPriceGbp = Number(parsed.maxPriceGbp) || 1700;
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn('[GeminiParser] Gemini API parse failed, falling back to heuristic parser:', err.message);
    }
  }

  // Fallback heuristic parser
  return parseUserQueryHeuristic(userText, currentYear, currentMonth);
}

export function parseUserQueryHeuristic(userText, currentYear, currentMonth) {
  const text = String(userText).toLowerCase();
  
  // 1. Destination
  let destination = null;
  // Match 3-letter IATA uppercase in raw text
  const iataMatch = userText.match(/\b([A-Z]{3})\b/);
  if (iataMatch && !['FOR', 'THE', 'AND', 'GBP', 'LHR', 'BOT'].includes(iataMatch[1])) {
    destination = iataMatch[1];
  } else {
    for (const [city, code] of Object.entries(KNOWN_AIRPORT_NAMES)) {
      if (text.includes(city)) {
        destination = code;
        break;
      }
    }
  }
  if (!destination) destination = 'ICN'; // sensible default

  // 2. Nights
  let nights = 4;
  const nightsMatch = text.match(/(\d+)\s*(?:night|day)/i);
  if (nightsMatch) {
    nights = parseInt(nightsMatch[1], 10);
  }

  // 3. Price
  let maxPriceGbp = 1700;
  const priceMatch = text.match(/(?:£|\$|under|max|budget)?\s*(\d{3,4})(?:\s*gbp|\s*pounds)?/i);
  if (priceMatch) {
    const val = parseInt(priceMatch[1], 10);
    if (val >= 800 && val <= 5000) {
      maxPriceGbp = val;
    }
  }

  // 4. Target Month
  let targetMonth = null;
  for (const [mName, mNum] of Object.entries(MONTH_NAMES)) {
    if (text.includes(mName)) {
      const year = parseInt(mNum, 10) < currentMonth ? currentYear + 1 : currentYear;
      targetMonth = `${year}-${mNum}`;
      break;
    }
  }

  return {
    destination,
    nights,
    targetMonth,
    departureDayOfWeek: 'Friday',
    returnDayOfWeek: 'Tuesday',
    maxPriceGbp,
    preferLowApd: true,
    maxOriginHubs: 5,
    summary: `Lie-flat to ${destination} for ${nights} nights (max £${maxPriceGbp} GBP)`,
  };
}
