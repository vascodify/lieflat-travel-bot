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
  'new york': 'NYC',
  'new york city': 'NYC',
  nyc: 'NYC',
  manhattan: 'NYC',
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
  entebbe: 'EBB',
  uganda: 'EBB',
  kampala: 'EBB',
  maldives: 'MLE',
  male: 'MLE',
  zanzibar: 'ZNZ',
  mauritius: 'MRU',
  seychelles: 'SEZ',
  cairo: 'CAI',
  morocco: 'RAK',
  marrakech: 'RAK',
  casablanca: 'CMN',
  japan: 'TYO',
  argentina: 'EZE',
  brazil: 'GIG',
  colombia: 'BOG',
  peru: 'LIM',
  chile: 'SCL',
  korea: 'ICN',
  thailand: 'BKK',
  vietnam: 'SGN',
  hanoi: 'HAN',
  saigon: 'SGN',
  'ho chi minh': 'SGN',
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
  { geminiApiKey = process.env.GEMINI_API_KEY, modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash' } = {}
) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Compute heuristic baseline
  const heuristic = parseUserQueryHeuristic(userText, currentYear, currentMonth);

  if (geminiApiKey && typeof geminiApiKey === 'string' && geminiApiKey.trim().length > 10) {
    const candidateModels = [modelName, 'gemini-3.5-flash', 'gemini-3.6-flash'].filter(
      (m, idx, arr) => arr.indexOf(m) === idx
    );

    for (const mod of candidateModels) {
      try {
        const prompt = `You are an expert flight search query parser. Extract flight search parameters from the user's message.
Return ONLY valid JSON matching this exact schema:
{
  "destination": "3-letter IATA code or metro code (use NYC for New York/JFK/EWR, LON for London, TYO for Tokyo, ICN for Seoul, BKK for Bangkok, EZE for Buenos Aires, GIG for Rio, EBB for Entebbe/Uganda)",
  "nights": integer or array of integers (e.g. 4 or [3, 4] if user mentions "3 or 4 nights", "3-4 nights", etc.; default 4),
  "monthsAhead": integer (how many months ahead to search if user says 'in the next X months', e.g. 2, 4, 6; default 2),
  "targetMonth": "YYYY-MM" (e.g. "2026-12" if a specific month name is requested, null if searching across next X months),
  "departureDayOfWeek": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday" | null (MUST be null unless user explicitly named a specific departure day in the message),
  "returnDayOfWeek": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday" | null (MUST be null unless user explicitly named a return/arrival day),
  "maxPriceGbp": number or null (only if user explicitly stated a price/budget cap like 'under 1600' or 'max 1700', otherwise null),
  "preferLowApd": true,
  "summary": "Brief 1-line plain English summary of what will be searched"
}

Current date: ${now.toISOString().split('T')[0]}.
User message: "${userText}"`;

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${geminiApiKey}`;
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
            } else {
              parsed.destination = heuristic.destination || null;
            }
            if (Array.isArray(parsed.nights)) {
              parsed.nights = parsed.nights.map(Number).filter((n) => !Number.isNaN(n) && n > 0);
            } else {
              parsed.nights = Number(parsed.nights) || heuristic.nights || 4;
            }
            parsed.monthsAhead = Number(parsed.monthsAhead) || heuristic.monthsAhead || 2;
            parsed.maxPriceGbp = parsed.maxPriceGbp ? Number(parsed.maxPriceGbp) : heuristic.maxPriceGbp;
            if (!parsed.summary) {
              parsed.summary = heuristic.summary;
            }
            return parsed;
          }
        }
      } catch (err) {
        // try next candidate model
      }
    }
  }

  return heuristic;
}

export async function parseAudioWithGemini(
  audioBuffer,
  mimeType = 'audio/ogg',
  { geminiApiKey = process.env.GEMINI_API_KEY, modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash' } = {}
) {
  const now = new Date();
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is missing in your .env file.');
  }

  const base64Audio = Buffer.from(audioBuffer).toString('base64');
  const prompt = `Listen carefully to this voice note and extract the flight search parameters.
Return ONLY valid JSON matching this exact schema:
{
  "transcription": "Verbatim transcript of what the user said in the voice note",
  "destination": "3-letter IATA code or metro code (use NYC for New York/JFK/EWR, LON for London, TYO for Tokyo, ICN for Seoul, BKK for Bangkok, EZE for Buenos Aires, GIG for Rio, EBB for Entebbe)",
  "nights": integer or array of integers (e.g. 4 or [3, 4] if user mentions "3 or 4 nights"; default 4),
  "monthsAhead": integer (search window in months if user says 'next X months', default 2),
  "targetMonth": "YYYY-MM" (e.g. "2026-12", null if unspecified),
  "departureDayOfWeek": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday" | null (MUST be null unless user explicitly named a specific day in the message),
  "returnDayOfWeek": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday" | null (MUST be null unless explicitly named),
  "maxPriceGbp": number or null (only if user explicitly stated a price like 'under 1600', otherwise null),
  "summary": "Brief 1-line plain English summary of what will be searched"
}

Current date: ${now.toISOString().split('T')[0]}.`;

  const candidateModels = [modelName, 'gemini-3.5-flash', 'gemini-3.6-flash'].filter(
    (m, idx, arr) => arr.indexOf(m) === idx
  );

  let lastError = null;
  for (const mod of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${geminiApiKey}`;
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
        lastError = new Error(`Gemini Audio API error (${resp.status}): ${errText}`);
        continue;
      }

      const data = await resp.json();
      const rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJsonText) {
        continue;
      }

      const parsed = JSON.parse(rawJsonText);
      if (parsed.destination && parsed.destination.length === 3) {
        parsed.destination = parsed.destination.toUpperCase();
      } else {
        parsed.destination = null;
      }
      parsed.nights = Number(parsed.nights) || 4;
      parsed.monthsAhead = Number(parsed.monthsAhead) || 2;
      parsed.maxPriceGbp = parsed.maxPriceGbp ? Number(parsed.maxPriceGbp) : 2400;
      return parsed;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Could not process audio with Gemini.');
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
  // If destination is not detected in text, leave as null (do NOT force to ICN)

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

  // 3. Trip length in Nights (e.g. "3 or 4 nights", "3-4 nights", "4 nights")
  let nights = 4;
  const rangeMatch = text.match(/\b(\d+)\s*(?:to|or|-)\s*(\d+)\s*(?:nights?|days?)\b/i);
  if (rangeMatch) {
    const n1 = parseInt(rangeMatch[1], 10);
    const n2 = parseInt(rangeMatch[2], 10);
    if (n1 >= 1 && n2 <= 30) {
      nights = [Math.min(n1, n2), Math.max(n1, n2)];
    }
  } else {
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

  // 6. Departure day of week & return day of week
  let departureDayOfWeek = null;
  let returnDayOfWeek = null;

  const depMatch = text.match(/(?:departing|leave|outbound|depart)\s+(?:on\s+a\s+|on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (depMatch) {
    const d = depMatch[1].toLowerCase();
    departureDayOfWeek = d.charAt(0).toUpperCase() + d.slice(1);
  } else {
    const standaloneDay = text.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (standaloneDay && !text.includes('returning') && !text.includes('back on')) {
      const d = standaloneDay[1].toLowerCase();
      departureDayOfWeek = d.charAt(0).toUpperCase() + d.slice(1);
    }
  }

  const retMatch = text.match(/(?:returning|return|back|arriving\s*back)\s+(?:on\s+a\s+|on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (retMatch) {
    const r = retMatch[1].toLowerCase();
    returnDayOfWeek = r.charAt(0).toUpperCase() + r.slice(1);
  }

  return {
    destination,
    nights,
    monthsAhead,
    targetMonth,
    departureDayOfWeek,
    returnDayOfWeek,
    maxPriceGbp,
    explicitBudget,
    preferLowApd: true,
    summary: destination
      ? `Lie-flat to ${destination} for ${nights} nights${
          targetMonth ? ` in ${targetMonth}` : ` (next ${monthsAhead} months)`
        }${explicitBudget ? ` [max £${maxPriceGbp} GBP]` : ''}`
      : `Flight search query (${nights} nights)`,
  };
}
