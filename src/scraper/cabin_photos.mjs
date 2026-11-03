import fs from 'node:fs';
import path from 'node:path';

/**
 * Normalizes short carrier names from Google Flights (e.g. "Hainan" -> "Hainan Airlines",
 * "United" -> "United Airlines", "Delta" -> "Delta Air Lines") so image searches
 * match the airline cabin rather than geographic locations.
 */
const AIRLINE_METADATA = {
  hainan: { fullName: 'Hainan Airlines', tokens: ['hainan'] },
  'hainan airlines': { fullName: 'Hainan Airlines', tokens: ['hainan'] },
  united: { fullName: 'United Airlines', tokens: ['united', 'polaris'] },
  'united airlines': { fullName: 'United Airlines', tokens: ['united', 'polaris'] },
  delta: { fullName: 'Delta Air Lines', tokens: ['delta'] },
  'delta air lines': { fullName: 'Delta Air Lines', tokens: ['delta'] },
  american: { fullName: 'American Airlines', tokens: ['american'] },
  'american airlines': { fullName: 'American Airlines', tokens: ['american'] },
  iberia: { fullName: 'Iberia Airlines', tokens: ['iberia'] },
  'tap air portugal': { fullName: 'TAP Air Portugal', tokens: ['tap'] },
  tap: { fullName: 'TAP Air Portugal', tokens: ['tap'] },
  klm: { fullName: 'KLM Royal Dutch Airlines', tokens: ['klm'] },
  'air france': { fullName: 'Air France', tokens: ['air france', 'air-france', 'airfrance'] },
  lufthansa: { fullName: 'Lufthansa', tokens: ['lufthansa', 'allegris'] },
  swiss: { fullName: 'SWISS International Air Lines', tokens: ['swiss'] },
  finnair: { fullName: 'Finnair', tokens: ['finnair', 'airlounge'] },
  qatar: { fullName: 'Qatar Airways', tokens: ['qatar', 'qsuite'] },
  'qatar airways': { fullName: 'Qatar Airways', tokens: ['qatar', 'qsuite'] },
  emirates: { fullName: 'Emirates', tokens: ['emirates'] },
  etihad: { fullName: 'Etihad Airways', tokens: ['etihad'] },
  'etihad airways': { fullName: 'Etihad Airways', tokens: ['etihad'] },
  'british airways': { fullName: 'British Airways', tokens: ['british airways', 'british-airways', 'club suite', 'club-suite'] },
  virgin: { fullName: 'Virgin Atlantic', tokens: ['virgin'] },
  'virgin atlantic': { fullName: 'Virgin Atlantic', tokens: ['virgin'] },
  'royal jordanian': { fullName: 'Royal Jordanian', tokens: ['royal jordanian', 'royal-jordanian'] },
  lot: { fullName: 'LOT Polish Airlines', tokens: ['lot polish', 'lot-polish', 'lot_polish'] },
  'lot polish airlines': { fullName: 'LOT Polish Airlines', tokens: ['lot polish', 'lot-polish'] },
  turkish: { fullName: 'Turkish Airlines', tokens: ['turkish'] },
  'turkish airlines': { fullName: 'Turkish Airlines', tokens: ['turkish'] },
  sas: { fullName: 'SAS Scandinavian Airlines', tokens: ['sas', 'scandinavian'] },
  'aer lingus': { fullName: 'Aer Lingus', tokens: ['aer lingus', 'aer-lingus', 'aerlingus'] },
  jetblue: { fullName: 'JetBlue Mint', tokens: ['jetblue', 'mint'] },
  'jetblue mint': { fullName: 'JetBlue Mint', tokens: ['jetblue', 'mint'] },
  'la compagnie': { fullName: 'La Compagnie', tokens: ['compagnie'] },
  'ita airways': { fullName: 'ITA Airways', tokens: ['ita airways', 'ita-airways'] },
  austrian: { fullName: 'Austrian Airlines', tokens: ['austrian'] },
  brussels: { fullName: 'Brussels Airlines', tokens: ['brussels airlines', 'brussels-airlines'] },
  cathay: { fullName: 'Cathay Pacific', tokens: ['cathay'] },
  'cathay pacific': { fullName: 'Cathay Pacific', tokens: ['cathay'] },
  singapore: { fullName: 'Singapore Airlines', tokens: ['singapore'] },
  'singapore airlines': { fullName: 'Singapore Airlines', tokens: ['singapore'] },
  ana: { fullName: 'ANA All Nippon Airways', tokens: ['ana', 'nippon', 'the room'] },
  jal: { fullName: 'Japan Airlines', tokens: ['japan airlines', 'japan-airlines', 'jal', 'sky suite'] },
  'air china': { fullName: 'Air China', tokens: ['air china', 'air-china'] },
  'china eastern': { fullName: 'China Eastern', tokens: ['china eastern', 'china-eastern'] },
  'china southern': { fullName: 'China Southern', tokens: ['china southern', 'china-southern'] },
  eva: { fullName: 'EVA Air', tokens: ['eva air', 'eva-air'] },
  'eva air': { fullName: 'EVA Air', tokens: ['eva air', 'eva-air'] },
  latam: { fullName: 'LATAM Airlines', tokens: ['latam'] },
  'latam airlines': { fullName: 'LATAM Airlines', tokens: ['latam'] },
  'latam airlines brasil': { fullName: 'LATAM Airlines', tokens: ['latam'] },
  avianca: { fullName: 'Avianca', tokens: ['avianca'] },
  'air europa': { fullName: 'Air Europa', tokens: ['air europa', 'air-europa', 'aireuropa'] },
  azul: { fullName: 'Azul Brazilian Airlines', tokens: ['azul'] },
  'royal air maroc': { fullName: 'Royal Air Maroc', tokens: ['royal air maroc', 'royal-air-maroc'] },
};

const AIRCRAFT_FAMILY_TOKENS = [
  { family: '787', regex: /787|dreamliner|\b78[89]\b/i, conflictRegex: /\b(a330|330|a350|350|a380|380|777|773|772|767|747|a321|321|a320|737)\b/i },
  { family: 'A350', regex: /a?350|\b359\b/i, conflictRegex: /\b(787|789|788|dreamliner|a330|330|a380|380|777|773|767|747|a321|321|737)\b/i },
  { family: 'A330', regex: /a?330|\b33[2389]\b/i, conflictRegex: /\b(787|789|788|dreamliner|a350|350|a380|380|777|773|767|747|a321|321|737)\b/i },
  { family: 'A380', regex: /a?380/i, conflictRegex: /\b(787|dreamliner|a330|330|a350|350|777|773|767|747|a321|321|737)\b/i },
  { family: '777', regex: /777|\b77[23]w?\b/i, conflictRegex: /\b(787|789|788|dreamliner|a330|330|a350|350|a380|380|767|747|a321|321|737)\b/i },
  { family: '767', regex: /767|\b76[34]\b/i, conflictRegex: /\b(787|dreamliner|a330|330|a350|350|a380|380|777|773|747|a321|321|737)\b/i },
  { family: '747', regex: /747|\b74[48]\b/i, conflictRegex: /\b(787|dreamliner|a330|330|a350|350|a380|380|777|773|767|a321|321|737)\b/i },
  { family: 'A340', regex: /a?340|\b34[36]\b/i, conflictRegex: /\b(787|dreamliner|a330|330|a350|350|a380|380|777|773|767|747|a321|321)\b/i },
  { family: 'A321', regex: /a?321/i, conflictRegex: /\b(787|dreamliner|a330|330|a350|350|a380|380|777|773|767|747)\b/i },
  { family: '757', regex: /757/i, conflictRegex: /\b(787|dreamliner|a330|330|a350|350|a380|380|777|773|767|747|a321)\b/i },
];

export function resolveAirlineMeta(rawCarrierName) {
  const raw = String(rawCarrierName || '').trim();
  const lower = raw.toLowerCase();
  if (AIRLINE_METADATA[lower]) {
    return AIRLINE_METADATA[lower];
  }
  for (const [key, meta] of Object.entries(AIRLINE_METADATA)) {
    if (lower.includes(key)) return meta;
  }
  const fullName =
    !/air|lines|ways|mint|compagnie|klm|sas|ana|jal|lot|swiss|finnair|emirates|lufthansa/i.test(raw)
      ? `${raw} Airlines`
      : raw;
  return {
    fullName,
    tokens: [raw.toLowerCase()],
  };
}

export function resolveAircraftMeta(rawAircraft) {
  const clean = String(rawAircraft || 'Widebody')
    .replace(/\bPassenger\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  for (const item of AIRCRAFT_FAMILY_TOKENS) {
    if (item.regex.test(clean)) {
      return { cleanName: clean, ...item };
    }
  }
  return {
    cleanName: clean,
    family: clean,
    regex: new RegExp(clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    conflictRegex: null,
  };
}

const photoQueryCache = new Map();

async function fetchBingImageCards(query, timeoutMs = 8000) {
  if (photoQueryCache.has(query)) {
    return photoQueryCache.get(query);
  }
  const searchUrl = `https://www.bing.com/images/async?q=${encodeURIComponent(query)}&first=0&count=28&qft=+filterui:photo-photo`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const html = await res.text();
    const cards = [...html.matchAll(/m="(\{&quot;.*?&quot;\})"/g)]
      .map((m) => {
        try {
          return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    photoQueryCache.set(query, cards);
    return cards;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Strictly scores and filters image candidates so:
 * 1. Both airline and aircraft family are verified to match the booking (rejecting wrong aircraft in filename/title).
 * 2. Upright mode (`mode === 'upright'`) selects an upright seat photo and penalizes flat bed photos.
 * 3. Bed mode (`mode === 'bed'`) requires/prioritizes a flat/bed position photo.
 */
function scoreAndFilterCandidates(cards, { airlineMeta, aircraftMeta, mode = 'upright' }) {
  const verified = [];

  for (const card of cards) {
    const title = String(card.t || '').trim();
    const murl = String(card.murl || '').trim();
    const turl = String(card.turl || '').trim();
    const purl = String(card.purl || '').trim();
    const fileBase = murl.split('/').pop()?.split('?')[0] || '';
    const combinedText = `${title} ${fileBase} ${purl}`.toLowerCase();

    if (!murl && !turl) continue;
    if (/\.gif($|\?)|\.svg($|\?)/i.test(murl)) continue;

    // Reject diagrams, seatmaps, exterior plane-spotting, economy class, lounges, food closeups, or destination beaches
    if (
      /seat\s*map|seatmap|layout|diagram|livery|takeoff|landing|runway|airport\s*lounge|lounge\s*review|beach|island|resort|hotel|amenity\s*kit|menu|catering/i.test(
        combinedText
      )
    ) {
      continue;
    }
    if (/\beconomy\b|\bcoach\b|\bpremium\s*economy\b/i.test(combinedText) && !/\bbusiness\b|\bmint\b|\bpolaris\b|\bqsuite\b/i.test(combinedText)) {
      continue;
    }

    // STRICT VERIFICATION 1: Must match the target airline!
    const matchesAirline = airlineMeta.tokens.some((tok) => combinedText.includes(tok));
    if (!matchesAirline) continue;

    // STRICT VERIFICATION 2: Must match the target aircraft family (e.g. 787 / A350 / A330)
    const matchesAircraft = aircraftMeta.regex.test(combinedText);
    if (!matchesAircraft) continue;

    // STRICT VERIFICATION 3: Reject if the image filename (`fileBase`) explicitly belongs to a conflicting aircraft family!
    // (e.g. prevents `Hainan-Business-Class-787-1.jpg` from being picked when searching for `Hainan Airbus A330`)
    if (
      aircraftMeta.conflictRegex &&
      aircraftMeta.conflictRegex.test(fileBase) &&
      !aircraftMeta.regex.test(fileBase)
    ) {
      continue;
    }

    let score = 20; // Base score for passing strict airline + aircraft verification

    // Bonus if the image filename itself contains both airline and aircraft
    if (airlineMeta.tokens.some((tok) => fileBase.toLowerCase().includes(tok))) score += 8;
    if (aircraftMeta.regex.test(fileBase)) score += 8;

    // Bonus for business class cabin/seat terms
    if (/business|mint|polaris|delta[\s-]*one|qsuite|club[\s-]*suite|executive/i.test(combinedText)) {
      score += 10;
    }

    const hasBedKeywordsInFileOrTitle =
      /(flat[\s_-]*bed|lie[\s_-]*flat|180[\s_-]*flat|\bbed\b|\bflatbed\b|\bflat\b|sleeping|mattress|bedding|duvet|pillow|turndown|reclined|full[\s_-]*flat|-agy\b)/i.test(
        `${title} ${fileBase}`
      );
    const hasUprightSeatKeywords =
      /\b(seat|seats|cabin|suite|pod|interior|upright|window)\b/i.test(`${title} ${fileBase}`);

    if (mode === 'upright') {
      // For the upright seat photo: reward seat/cabin views, strongly penalize bed/mattress/sleeping views
      if (hasUprightSeatKeywords) score += 12;
      if (hasBedKeywordsInFileOrTitle) score -= 35;
    } else if (mode === 'bed') {
      // For the flat/bed photo: strongly reward explicit bed/lie-flat/mattress/sleeping keywords
      if (hasBedKeywordsInFileOrTitle) score += 35;
      if (/(flat[\s_-]*bed|lie[\s_-]*flat|180[\s_-]*flat|\bbed\b|\bflatbed\b|\bflat\b|mattress|sleep|reclin|-agy\b)/i.test(fileBase)) {
        score += 45;
      }
      if (/^AP1Gcz/i.test(fileBase)) {
        score -= 35;
      }
    }

    // Trusted aviation review photography sources
    if (
      /thepointsguy|onemileatatime|executivetraveller|liveandletsfly|headforpoints|upgradedpoints|simpleflying|samchui| Princeoftravel|turningleftforless/i.test(
        purl
      )
    ) {
      score += 8;
    }

    const hiResProxyUrl = turl ? `${turl}&w=800&h=520&c=7&rs=1&qlt=90` : murl;
    const oipMatch = turl.match(/id=([^&]+)/);
    const imageId = oipMatch ? oipMatch[1] : murl.split('?')[0];

    verified.push({
      imageId,
      title: title.replace(/\s+/g, ' ').trim(),
      originalImageUrl: murl,
      proxyImageUrl: hiResProxyUrl,
      sourcePageUrl: purl,
      hasBedKeywords: hasBedKeywordsInFileOrTitle,
      verifiedAirline: airlineMeta.fullName,
      verifiedAircraftFamily: aircraftMeta.family,
      score,
    });
  }

  verified.sort((a, b) => b.score - a.score);
  return verified;
}

/**
 * Fetches 2 strictly verified Business Class photos for a flight option:
 * 1. Upright Seat Position (`[Airline] [Aircraft] business class`)
 * 2. Flat / Bed Position (`[Airline] [Aircraft] business class bed`)
 *
 * Guarantees both images match the exact airline & aircraft family and are distinct.
 */
export async function fetchCabinAndBedPhotos({
  airlineName,
  aircraftName,
  downloadDir = null,
  filePrefix = null,
} = {}) {
  const airlineMeta = resolveAirlineMeta(airlineName);
  const aircraftMeta = resolveAircraftMeta(aircraftName);

  // User's exact two primary query variables:
  const cabinQuery = `${airlineMeta.fullName} ${aircraftMeta.cleanName} business class`;
  const bedQuery = `${airlineMeta.fullName} ${aircraftMeta.cleanName} business class bed`;

  // Supplemental specific queries to ensure rich pool of upright seat vs flat bed photos
  const uprightSuppQuery = `${airlineMeta.fullName} ${aircraftMeta.family} business class seat upright cabin`;
  const bedSuppQuery = `${airlineMeta.fullName} ${aircraftMeta.family} business class lie flat bed sleeping`;

  const [cabinCards1, cabinCards2, bedCards1, bedCards2] = await Promise.all([
    fetchBingImageCards(cabinQuery),
    fetchBingImageCards(uprightSuppQuery),
    fetchBingImageCards(bedQuery),
    fetchBingImageCards(bedSuppQuery),
  ]);

  const uprightCandidates = scoreAndFilterCandidates([...cabinCards1, ...cabinCards2], {
    airlineMeta,
    aircraftMeta,
    mode: 'upright',
  });

  // Strictly evaluate bed candidates ONLY from the bed queries first so upright cabin photos do not dilute bed results
  const bedCandidates = scoreAndFilterCandidates([...bedCards1, ...bedCards2], {
    airlineMeta,
    aircraftMeta,
    mode: 'bed',
  });

  // Prefer bed candidates that explicitly mention bed/flat/sleep/mattress/recline in title or filename
  const explicitBedCandidates = bedCandidates.filter((c) => c.hasBedKeywords);

  const uprightPick = uprightCandidates[0] || null;
  const bedPick =
    explicitBedCandidates.find((c) => c.imageId !== uprightPick?.imageId) ||
    bedCandidates.find((c) => c.imageId !== uprightPick?.imageId) ||
    uprightCandidates.find((c) => c.imageId !== uprightPick?.imageId) ||
    null;

  const cabinGoogleUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(cabinQuery)}`;
  const bedGoogleUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(bedQuery)}`;

  const output = {
    airlineNormalized: airlineMeta.fullName,
    aircraftNormalized: aircraftMeta.cleanName,
    aircraftFamilyVerified: aircraftMeta.family,
    cabinPhoto: {
      position: 'Upright Seat Position',
      query: cabinQuery,
      title:
        uprightPick?.title ||
        `${airlineMeta.fullName} ${aircraftMeta.cleanName} Business Class Seat (Upright)`,
      imageUrl: uprightPick?.proxyImageUrl || null,
      originalImageUrl: uprightPick?.originalImageUrl || null,
      sourcePageUrl: uprightPick?.sourcePageUrl || null,
      googleImagesSearchUrl: cabinGoogleUrl,
      verifiedAirlineAndAircraft: Boolean(uprightPick),
      localFilePath: null,
    },
    bedPhoto: {
      position: 'Lie-Flat Bed Position',
      query: bedQuery,
      title:
        bedPick?.title ||
        `${airlineMeta.fullName} ${aircraftMeta.cleanName} Business Class Seat (Lie-Flat Bed)`,
      imageUrl: bedPick?.proxyImageUrl || null,
      originalImageUrl: bedPick?.originalImageUrl || null,
      sourcePageUrl: bedPick?.sourcePageUrl || null,
      googleImagesSearchUrl: bedGoogleUrl,
      verifiedAirlineAndAircraft: Boolean(bedPick),
      localFilePath: null,
    },
  };

  if (downloadDir) {
    try {
      fs.mkdirSync(downloadDir, { recursive: true });
      const slug =
        filePrefix ||
        `${airlineMeta.fullName}_${aircraftMeta.cleanName}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '');

      for (const [key, suffix] of [
        ['cabinPhoto', 'upright_seat'],
        ['bedPhoto', 'lieflat_bed'],
      ]) {
        const photoObj = output[key];
        const urlToDownload = photoObj.imageUrl || photoObj.originalImageUrl;
        if (!urlToDownload) continue;
        const resp = await fetch(urlToDownload);
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          const targetPath = path.join(downloadDir, `${slug}_${suffix}.jpg`);
          fs.writeFileSync(targetPath, buf);
          photoObj.localFilePath = targetPath;
        }
      }
    } catch {
      // Ignore optional local download errors
    }
  }

  return output;
}
