/**
 * European Departure Hubs Ranked by Business Class APD / Luxury Departure Taxes
 * & Curated Long-Haul Widebody Destination Clusters
 */

export const EUROPEAN_HUB_TIERS = {
  tier1_low_apd: [
    {
      iata: 'DUB',
      city: 'Dublin',
      country: 'Ireland',
      apdTaxEstimateGbp: 0,
      taxNotes: '€0 Irish Air Travel Tax (abolished) + US CBP Preclearance. Consistently Europe’s #1 origin for £1,150–£1,650 Business Class deals.',
      signatureCarriers: ['EI (A330 / A321LR)', 'B6 (JetBlue Mint A321neo)', 'QR (787)', 'EY (787)', 'UA/DL/AA'],
    },
    {
      iata: 'ARN',
      city: 'Stockholm',
      country: 'Sweden',
      apdTaxEstimateGbp: 0,
      taxNotes: 'Sweden completely abolished its aviation departure tax in July 2025 (£0 luxury tax). Top Nordic origin for cheap Asia & US Business Class.',
      signatureCarriers: ['SK', 'AY (A350 via HEL)', 'QR (787/A350)', 'TK (A350/787)', 'LH/LX'],
    },
    {
      iata: 'OSL',
      city: 'Oslo',
      country: 'Norway',
      apdTaxEstimateGbp: 22,
      taxNotes: 'Flat low Norwegian passenger fee (~£22, no Business Class multiplier). Frequent £1,200–£1,600 round-trip Business fares to Bangkok, Singapore, Dubai, and US.',
      signatureCarriers: ['QR (787)', 'AY (A350)', 'TK (A350/787)', 'ET (787)', 'BA/IB'],
    },
    {
      iata: 'MAD',
      city: 'Madrid',
      country: 'Spain',
      apdTaxEstimateGbp: 18,
      taxNotes: 'No Spanish luxury cabin tax (only standard Aena airport fee). Premier hub for Iberia A350-900 / A330 / A321XLR and Latin America widebodies under £1,550.',
      signatureCarriers: ['IB (A350 / A330 / A321XLR)', 'LA (787)', 'AM (787)', 'AV (787)', 'UX (787)'],
    },
    {
      iata: 'LIS',
      city: 'Lisbon',
      country: 'Portugal',
      apdTaxEstimateGbp: 16,
      taxNotes: 'Minimal €2 carbon tax + low airport fees. Hub for TAP Air Portugal A330-900neo and true lie-flat A321LR to Americas & Africa.',
      signatureCarriers: ['TP (A330-900neo / A321LR)', 'EK (777)', 'QR (787)'],
    },
    {
      iata: 'ATH',
      city: 'Athens',
      country: 'Greece',
      apdTaxEstimateGbp: 19,
      taxNotes: 'Reduced Greek airport charges; aggressive competition among Gulf & Asian carriers yields sub-£1,500 Business Class to Asia & Middle East.',
      signatureCarriers: ['QR', 'EY (A321LR / 787)', 'GF (A321LR)', 'TR/SQ', 'EK (777 to EWR)'],
    },
    {
      iata: 'WAW',
      city: 'Warsaw',
      country: 'Poland',
      apdTaxEstimateGbp: 14,
      taxNotes: 'Zero Polish luxury cabin tax. Home to LOT Polish 787 Dreamliner plus cheap Star Alliance / Gulf carrier ex-EU fares.',
      signatureCarriers: ['LO (787)', 'QR', 'EK', 'TK', 'LH/OS'],
    },
    {
      iata: 'BUD',
      city: 'Budapest',
      country: 'Hungary',
      apdTaxEstimateGbp: 15,
      taxNotes: 'Hungary phased out its departure windfall tax; consistently one of Central Europe’s cheapest Business Class starting points.',
      signatureCarriers: ['QR', 'TK', 'LH/LX/OS', 'AF/KL', 'CA/MU (787/A350)'],
    },
    {
      iata: 'PRG',
      city: 'Prague',
      country: 'Czechia',
      apdTaxEstimateGbp: 16,
      taxNotes: 'No luxury cabin tax; strong ex-EU discounting to North America and Asia.',
      signatureCarriers: ['QR', 'EK', 'TK', 'LH/LX', 'KE (787/777)'],
    },
    {
      iata: 'HEL',
      city: 'Helsinki',
      country: 'Finland',
      apdTaxEstimateGbp: 18,
      taxNotes: 'No Finnish aviation luxury tax. Home to Finnair’s acclaimed A350-900 Collins AirLounge fixed-shell lie-flat suite.',
      signatureCarriers: ['AY (A350-900 / A330-300)', 'JL (787)'],
    },
  ],
  tier2_moderate_apd: [
    {
      iata: 'AMS',
      city: 'Amsterdam',
      country: 'Netherlands',
      apdTaxEstimateGbp: 25,
      taxNotes: 'Dutch flight tax is a flat ~€29.05 regardless of cabin class (unlike UK/France which heavily penalize Business Class).',
      signatureCarriers: ['KL (787 / 777)', 'DL (A330-900neo / A350)', 'B6 (JetBlue Mint A321LR)', 'CX (A350)', 'SQ (A350)'],
    },
    {
      iata: 'MXP',
      city: 'Milan Malpensa',
      country: 'Italy',
      apdTaxEstimateGbp: 24,
      taxNotes: 'Famous for fifth-freedom widebody flights (Emirates A380 MXP-JFK, Singapore Airlines A350 MXP-BCN) and La Compagnie all-business A321neo.',
      signatureCarriers: ['EK (A380 to JFK)', 'B0 (La Compagnie A321neo to EWR)', 'SQ (A350)', 'EY/QR', 'CX/BR/TG'],
    },
    {
      iata: 'FCO',
      city: 'Rome Fiumicino',
      country: 'Italy',
      apdTaxEstimateGbp: 24,
      taxNotes: 'Primary hub for ITA Airways A350-900, A330-900neo, and 1-1 lie-flat A321neo.',
      signatureCarriers: ['AZ (A350 / A330-900neo / A321neo)', 'DL', 'AA', 'UA', 'CX', 'SQ'],
    },
    {
      iata: 'BCN',
      city: 'Barcelona',
      country: 'Spain',
      apdTaxEstimateGbp: 18,
      taxNotes: 'Low Spanish airport taxes; direct A350/787/777 service to Americas, Asia, and Middle East.',
      signatureCarriers: ['IB/LEVEL', 'SQ (A350)', 'QR', 'EK', 'AA/DL/UA'],
    },
    {
      iata: 'CPH',
      city: 'Copenhagen',
      country: 'Denmark',
      apdTaxEstimateGbp: 20,
      taxNotes: 'Low Danish passenger fee; main SAS long-haul A350-900, A330-300, and A321LR hub.',
      signatureCarriers: ['SK (A350 / A330 / A321LR)', 'QR', 'TG (777)', 'SQ (A350)'],
    },
    {
      iata: 'ZRH',
      city: 'Zurich',
      country: 'Switzerland',
      apdTaxEstimateGbp: 28,
      taxNotes: 'No Swiss national ticket tax; SWISS A330/777/A340 flagship hub.',
      signatureCarriers: ['LX (777-300ER / A330 / A340)', 'WK', 'SQ (A350)', 'CX (A350)'],
    },
    {
      iata: 'BRU',
      city: 'Brussels',
      country: 'Belgium',
      apdTaxEstimateGbp: 22,
      taxNotes: 'Very low €2–€4 long-haul Belgian boarding tax; great Star Alliance & SkyTeam ex-EU fares.',
      signatureCarriers: ['SN (A330)', 'QR (787/A350)', 'EY (787)', 'SQ (A350)', 'UA (787)'],
    },
    {
      iata: 'VIE',
      city: 'Vienna',
      country: 'Austria',
      apdTaxEstimateGbp: 26,
      taxNotes: 'Austrian Air Transport Levy is flat €12; Austrian Airlines 787-9 Dreamliner hub.',
      signatureCarriers: ['OS (787-9 / 777 / 767)', 'BR (787)', 'QR', 'EK'],
    },
  ],
  tier3_high_apd_excluded_by_default: [
    {
      iata: 'LHR',
      city: 'London Heathrow',
      country: 'United Kingdom',
      apdTaxEstimateGbp: 224,
      taxNotes: 'HIGH TAX WARNING: UK Long-Haul Reduced/Standard Air Passenger Duty (APD) in Business Class is £200–£224+ plus high Heathrow PSC.',
    },
    {
      iata: 'LGW',
      city: 'London Gatwick',
      country: 'United Kingdom',
      apdTaxEstimateGbp: 202,
      taxNotes: 'HIGH TAX WARNING: Subject to full UK Business Class Long-Haul APD (£200–£224+).',
    },
    {
      iata: 'CDG',
      city: 'Paris Charles de Gaulle',
      country: 'France',
      apdTaxEstimateGbp: 105,
      taxNotes: 'HIGH TAX WARNING: France significantly increased its Solidarity Tax (TSBA) on long-haul Business/First tickets.',
    },
    {
      iata: 'FRA',
      city: 'Frankfurt',
      country: 'Germany',
      apdTaxEstimateGbp: 62,
      taxNotes: 'HIGH TAX WARNING: German long-haul Luftverkehrsteuer (~€70.83) + high Fraport transfer/security charges.',
    },
  ],
};

/**
 * Curated Long-Haul Destinations (all require >= 7h long leg or >= 8h nonstop from Europe)
 * Categorized by region and prioritized by sub-£1,700 Business Class deal frequency.
 */
export const LONG_HAUL_DESTINATIONS = {
  north_america_east_central: [
    { iata: 'JFK', city: 'New York (JFK)', country: 'USA', region: 'North America', typicalDealsGbp: '£1,150–£1,650' },
    { iata: 'EWR', city: 'New York / Newark (EWR)', country: 'USA', region: 'North America', typicalDealsGbp: '£1,150–£1,650' },
    { iata: 'BOS', city: 'Boston', country: 'USA', region: 'North America', typicalDealsGbp: '£1,100–£1,600' },
    { iata: 'IAD', city: 'Washington D.C. (Dulles)', country: 'USA', region: 'North America', typicalDealsGbp: '£1,250–£1,650' },
    { iata: 'ORD', city: 'Chicago (O’Hare)', country: 'USA', region: 'North America', typicalDealsGbp: '£1,250–£1,680' },
    { iata: 'MIA', city: 'Miami', country: 'USA', region: 'North America', typicalDealsGbp: '£1,300–£1,690' },
    { iata: 'YYZ', city: 'Toronto', country: 'Canada', region: 'North America', typicalDealsGbp: '£1,200–£1,650' },
    { iata: 'YUL', city: 'Montreal', country: 'Canada', region: 'North America', typicalDealsGbp: '£1,200–£1,650' },
  ],
  north_america_west: [
    { iata: 'LAX', city: 'Los Angeles', country: 'USA', region: 'North America West', typicalDealsGbp: '£1,450–£1,700' },
    { iata: 'SFO', city: 'San Francisco', country: 'USA', region: 'North America West', typicalDealsGbp: '£1,450–£1,700' },
    { iata: 'SEA', city: 'Seattle', country: 'USA', region: 'North America West', typicalDealsGbp: '£1,450–£1,700' },
    { iata: 'YVR', city: 'Vancouver', country: 'Canada', region: 'North America West', typicalDealsGbp: '£1,450–£1,700' },
  ],
  latin_america_caribbean: [
    { iata: 'BOG', city: 'Bogotá', country: 'Colombia', region: 'Latin America', typicalDealsGbp: '£1,250–£1,650' },
    { iata: 'GRU', city: 'São Paulo', country: 'Brazil', region: 'Latin America', typicalDealsGbp: '£1,300–£1,680' },
    { iata: 'GIG', city: 'Rio de Janeiro', country: 'Brazil', region: 'Latin America', typicalDealsGbp: '£1,350–£1,690' },
    { iata: 'MEX', city: 'Mexico City', country: 'Mexico', region: 'Latin America', typicalDealsGbp: '£1,350–£1,690' },
    { iata: 'CUN', city: 'Cancún', country: 'Mexico', region: 'Latin America', typicalDealsGbp: '£1,300–£1,680' },
    { iata: 'LIM', city: 'Lima', country: 'Peru', region: 'Latin America', typicalDealsGbp: '£1,450–£1,700' },
  ],
  south_southeast_asia: [
    { iata: 'BKK', city: 'Bangkok', country: 'Thailand', region: 'Southeast Asia', typicalDealsGbp: '£1,250–£1,680' },
    { iata: 'SIN', city: 'Singapore', country: 'Singapore', region: 'Southeast Asia', typicalDealsGbp: '£1,350–£1,690' },
    { iata: 'KUL', city: 'Kuala Lumpur', country: 'Malaysia', region: 'Southeast Asia', typicalDealsGbp: '£1,300–£1,680' },
    { iata: 'CGK', city: 'Jakarta', country: 'Indonesia', region: 'Southeast Asia', typicalDealsGbp: '£1,300–£1,680' },
    { iata: 'HKT', city: 'Phuket', country: 'Thailand', region: 'Southeast Asia', typicalDealsGbp: '£1,400–£1,700' },
  ],
  east_asia: [
    { iata: 'HKG', city: 'Hong Kong', country: 'Hong Kong', region: 'East Asia', typicalDealsGbp: '£1,350–£1,690' },
    { iata: 'ICN', city: 'Seoul (Incheon)', country: 'South Korea', region: 'East Asia', typicalDealsGbp: '£1,350–£1,690' },
    { iata: 'TYO', city: 'Tokyo (HND/NRT)', country: 'Japan', region: 'East Asia', typicalDealsGbp: '£1,450–£1,700' },
    { iata: 'PVG', city: 'Shanghai (Pudong)', country: 'China', region: 'East Asia', typicalDealsGbp: '£1,250–£1,650' },
    { iata: 'PEK', city: 'Beijing', country: 'China', region: 'East Asia', typicalDealsGbp: '£1,250–£1,650' },
    { iata: 'TPE', city: 'Taipei', country: 'Taiwan', region: 'East Asia', typicalDealsGbp: '£1,450–£1,700' },
  ],
  middle_east_africa_indian_ocean: [
    { iata: 'DXB', city: 'Dubai', country: 'UAE', region: 'Middle East', typicalDealsGbp: '£1,050–£1,550' },
    { iata: 'JNB', city: 'Johannesburg', country: 'South Africa', region: 'Africa', typicalDealsGbp: '£1,300–£1,680' },
    { iata: 'CPT', city: 'Cape Town', country: 'South Africa', region: 'Africa', typicalDealsGbp: '£1,400–£1,700' },
    { iata: 'NBO', city: 'Nairobi', country: 'Kenya', region: 'Africa', typicalDealsGbp: '£1,300–£1,650' },
    { iata: 'MLE', city: 'Malé (Maldives)', country: 'Maldives', region: 'Indian Ocean', typicalDealsGbp: '£1,450–£1,700' },
    { iata: 'ZNZ', city: 'Zanzibar', country: 'Tanzania', region: 'Africa / Indian Ocean', typicalDealsGbp: '£1,350–£1,680' },
  ],
};

/**
 * Helper to resolve origins based on hub tier preference or explicit list.
 */
export function resolveOriginHubs({ origins, preferLowApd = true, maxHubs = 6 }) {
  if (Array.isArray(origins) && origins.length > 0) {
    return origins.map((o) => String(o).trim().toUpperCase());
  }
  const tier1 = EUROPEAN_HUB_TIERS.tier1_low_apd.map((h) => h.iata);
  const tier2 = EUROPEAN_HUB_TIERS.tier2_moderate_apd.map((h) => h.iata);
  const combined = preferLowApd ? [...tier1, ...tier2] : [...tier1, ...tier2, 'LHR', 'CDG', 'FRA'];
  return combined.slice(0, maxHubs);
}

/**
 * Helper to resolve candidate long-haul destinations.
 */
export function resolveDestinations({ destinations, regions, maxDestinations = 8 }) {
  if (Array.isArray(destinations) && destinations.length > 0) {
    const cleaned = destinations.map((d) => String(d).trim().toUpperCase()).filter((d) => d && d !== 'ANY');
    if (cleaned.length > 0) {
      return cleaned;
    }
  }

  let pool = [];
  if (Array.isArray(regions) && regions.length > 0) {
    for (const r of regions) {
      const key = String(r).toLowerCase();
      for (const [clusterKey, list] of Object.entries(LONG_HAUL_DESTINATIONS)) {
        if (clusterKey.includes(key) || list.some((item) => item.region.toLowerCase().includes(key))) {
          pool.push(...list.map((i) => i.iata));
        }
      }
    }
  }

  if (pool.length === 0) {
    // High-yield balanced far destinations across North America, Latin America, Africa, and Asia (excluding Middle East)
    pool = [
      'JFK',
      'BOS',
      'MIA',
      'ORD',
      'BOG',
      'GRU',
      'NBO',
      'JNB',
      'EBB',
      'BKK',
      'SIN',
      'TYO',
    ];
  }

  return Array.from(new Set(pool)).slice(0, maxDestinations);
}
