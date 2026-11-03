/**
 * Comprehensive Aircraft & Business Class Cabin Database
 * Covers:
 * 1. Widebody aircraft families (Airbus A330/A340/A350/A380, Boeing 747/767/777/787)
 * 2. True Lie-Flat Narrowbody Exceptions (JetBlue Mint A321neo/LR, TAP A321LR, Aer Lingus A321LR/XLR, SAS A321LR, Iberia A321XLR, La Compagnie A321neo, ITA A321neo, Etihad A321LR, United 757-200 Polaris, etc.)
 * 3. Google Flights seatTypeCode decoding (5 = Lie-flat, 6 = Individual Suite, 7 = Angled flat, 4/8 = Recliner, 1-3 = Standard pitch)
 * 4. Widebody non-lie-flat pitfalls
 */

export const SEAT_TYPE_CODES = {
  1: { label: 'Standard / Blocked-Middle Pitch (Euro-Business)', isLieFlat: false, category: 'standard' },
  2: { label: 'Below Average Legroom', isLieFlat: false, category: 'standard' },
  3: { label: 'Above Average Legroom', isLieFlat: false, category: 'standard' },
  4: { label: 'Recliner Seat (Non-Flat)', isLieFlat: false, category: 'recliner' },
  5: { label: 'True 180° Lie-Flat Seat', isLieFlat: true, category: 'lie_flat' },
  6: { label: 'True 180° Lie-Flat Individual Suite / Pod', isLieFlat: true, category: 'lie_flat_suite' },
  7: { label: 'Angled Flat Seat (Not 180° Flat)', isLieFlat: false, category: 'angled_flat' },
  8: { label: 'Recliner Seat (Regional / Domestic First)', isLieFlat: false, category: 'recliner' },
  9: { label: 'True 180° Lie-Flat Seat', isLieFlat: true, category: 'lie_flat' },
};

export const WIDEBODY_FAMILIES = [
  {
    family: 'A330',
    manufacturer: 'Airbus',
    displayName: 'Airbus A330 (A330-200 / A330-300 / A330-800neo / A330-900neo)',
    patterns: [/airbus\s*a330/i, /\ba330\b/i, /\ba33[2389]\b/i, /330-?[2389]00/i],
    notes: 'Most long-haul carriers feature 1-2-1 or 2-2-2 180° lie-flat beds; A330-900neo features modern 1-2-1 suites (e.g. Delta One Suites, Virgin Atlantic, Condor, ITA, TAP).',
  },
  {
    family: 'A340',
    manufacturer: 'Airbus',
    displayName: 'Airbus A340 (A340-300 / A340-600)',
    patterns: [/airbus\s*a340/i, /\ba340\b/i, /\ba34[2356]\b/i, /340-?[2356]00/i],
    notes: 'Four-engine widebody operated primarily by Lufthansa and Edelweiss/SWISS with 180° lie-flat Business Class.',
  },
  {
    family: 'A350',
    manufacturer: 'Airbus',
    displayName: 'Airbus A350 XWB (A350-900 / A350-1000)',
    patterns: [/airbus\s*a350/i, /\ba350\b/i, /\ba35[9k]\b/i, /350-?(900|1000)/i],
    notes: 'Flagship modern widebody with lower cabin altitude (6,000 ft), higher humidity, and almost universally 1-2-1 direct-aisle-access lie-flat suites (Qsuite, BA Club Suite, Air France, Virgin, Iberia, Finnair AirLounge, Cathay, Singapore, Lufthansa Allegris).',
  },
  {
    family: 'A380',
    manufacturer: 'Airbus',
    displayName: 'Airbus A380-800 Superjumbo',
    patterns: [/airbus\s*a380/i, /\ba380\b/i, /\ba388\b/i],
    notes: 'Double-deck widebody with 180° lie-flat seats across all current operators (Emirates, British Airways, Qatar, Singapore, Qantas, Lufthansa, ANA, Korean Air, Etihad, Asiana).',
  },
  {
    family: 'B747',
    manufacturer: 'Boeing',
    displayName: 'Boeing 747 (747-400 / 747-8 Intercontinental)',
    patterns: [/boeing\s*747/i, /\b747\b/i, /\bb74[48]\b/i],
    notes: 'Operated on passenger routes by Lufthansa, Korean Air, and Air China with 180° lie-flat seats.',
  },
  {
    family: 'B767',
    manufacturer: 'Boeing',
    displayName: 'Boeing 767 (767-300ER / 767-400ER)',
    patterns: [/boeing\s*767/i, /\b767\b/i, /\bb76[234]\b/i],
    notes: 'United (1-1-1 Polaris suites), Delta (1-2-1 Delta One), Austrian, and LATAM operate 180° lie-flat 767s. Note: Icelandair 767s are recliners ONLY and are blocked.',
  },
  {
    family: 'B777',
    manufacturer: 'Boeing',
    displayName: 'Boeing 777 (777-200ER / 777-200LR / 777-300ER)',
    patterns: [/boeing\s*777/i, /\b777\b/i, /\bb77[23lw]\b/i],
    notes: 'Long-haul workhorse widebody with 180° lie-flat beds or private suites (Qsuite, BA Club Suite, ANA The Room, Air France, United Polaris, SWISS, KLM).',
  },
  {
    family: 'B787',
    manufacturer: 'Boeing',
    displayName: 'Boeing 787 Dreamliner (787-8 / 787-9 / 787-10)',
    patterns: [/boeing\s*787/i, /\b787\b/i, /dreamliner/i, /\bb78[89x]\b/i],
    notes: 'Composite widebody with low 6,000 ft cabin altitude and large dimmable windows; 1-2-1 lie-flat pods on almost all full-service long-haul carriers.',
  },
];

/**
 * Curated Registry of Narrowbody Aircraft with TRUE 180° Lie-Flat Business Class
 * Specifically accounts for carriers like JetBlue (Mint) and TAP Air Portugal (A321LR),
 * plus Aer Lingus, SAS, Iberia, La Compagnie, ITA Airways, Etihad, United 757 Polaris, etc.
 */
export const LIEFLAT_NARROWBODY_EXCEPTIONS = [
  {
    id: 'jetblue-mint-a321',
    carrierCodes: ['B6'],
    carrierNames: [/jetblue/i],
    aircraftPatterns: [/a321/i, /321neo/i, /321lr/i],
    productName: 'JetBlue Mint (1-1 Private Suites with Doors / 180° Lie-Flat)',
    layout: '1-1 Herringbone Suites (A321neo/A321LR) or 2-2/1-1 Suites (A321 Classic)',
    requiresGoogleSeatCode: false, // All transatlantic & Mint-marketed Business legs on B6 A321 are true lie-flat
    minDurationMinsIfNoSeatCode: 270,
    notes: 'Widely considered one of the best transatlantic Business Class seats in the sky despite being on an A321neo/LR; every seat on the A321LR is a 1-1 Thompson Vantage SOLO private suite with a sliding door.',
  },
  {
    id: 'tap-portugal-a321lr',
    carrierCodes: ['TP'],
    carrierNames: [/tap\b/i, /tap\s*air\s*portugal/i, /tap\s*portugal/i],
    aircraftPatterns: [/a321/i, /321neo/i, /321lr/i],
    productName: 'TAP Air Portugal Executive Class A321LR (180° Lie-Flat)',
    layout: '2-2 / 1-1 Staggered Thompson Vantage 180° Lie-Flat (rows 1-5)',
    // TAP flies both short-haul Euro-business A321neos (seatTypeCode 1) and long-haul A321LRs (seatTypeCode 5/6)
    requiresGoogleSeatCode: true,
    minDurationMinsIfNoSeatCode: 330, // >5.5h flights (North America, Brazil, Africa) use the A321LR subfleet
    notes: 'TAP operates the A321LR (often shown as A321neo in schedules) with true 180° lie-flat staggered seats (including 1-1 "throne" single seats in rows 2 & 4) on flights from Lisbon/Porto to the US East Coast, Canada, and Northern Brazil.',
  },
  {
    id: 'aer-lingus-a321lr-xlr',
    carrierCodes: ['EI'],
    carrierNames: [/aer\s*lingus/i],
    aircraftPatterns: [/a321/i, /321neo/i, /321lr/i, /321xlr/i],
    productName: 'Aer Lingus Business Class A321LR / A321XLR (180° Lie-Flat)',
    layout: '2-2 / 1-1 Staggered Thompson Vantage 180° Lie-Flat',
    requiresGoogleSeatCode: true,
    minDurationMinsIfNoSeatCode: 330,
    notes: 'Identical hard product to TAP A321LR and JetBlue Classic Mint with 180° lie-flat beds and throne seats on transatlantic routes from Dublin/Shannon/Manchester.',
  },
  {
    id: 'sas-a321lr',
    carrierCodes: ['SK'],
    carrierNames: [/\bsas\b/i, /scandinavian/i],
    aircraftPatterns: [/a321/i, /321neo/i, /321lr/i],
    productName: 'SAS Business A321LR (180° Lie-Flat)',
    layout: '2-2 / 1-1 Staggered Thompson Vantage 180° Lie-Flat',
    requiresGoogleSeatCode: true,
    minDurationMinsIfNoSeatCode: 360,
    notes: 'Three-class long-haul A321LR with 22 true 180° lie-flat Business seats.',
  },
  {
    id: 'iberia-a321xlr',
    carrierCodes: ['IB'],
    carrierNames: [/iberia/i],
    aircraftPatterns: [/a321/i, /321neo/i, /321xlr/i],
    productName: 'Iberia Business A321XLR (1-1 Private Lie-Flat Suites)',
    layout: '1-1 Thompson Vantage SOLO Herringbone 180° Lie-Flat Suites',
    requiresGoogleSeatCode: true,
    minDurationMinsIfNoSeatCode: 360,
    notes: 'Launch operator of the Airbus A321XLR on Madrid to Boston/Washington with 14 direct-aisle-access 1-1 lie-flat suites.',
  },
  {
    id: 'la-compagnie-a321neo',
    carrierCodes: ['B0'],
    carrierNames: [/la\s*compagnie/i],
    aircraftPatterns: [/a321/i, /321neo/i],
    productName: 'La Compagnie All-Business A321neo (76 Lie-Flat Beds)',
    layout: '2-2 Collins Aerospace Diamond 180° Lie-Flat',
    requiresGoogleSeatCode: false,
    minDurationMinsIfNoSeatCode: 300,
    notes: '100% Business Class boutique airline operating Paris Orly (ORY), Milan (MXP), and Nice (NCE) to Newark (EWR) with 76 full lie-flat beds.',
  },
  {
    id: 'ita-airways-a321neo',
    carrierCodes: ['AZ'],
    carrierNames: [/ita\s*airways/i],
    aircraftPatterns: [/a321/i, /321neo/i],
    productName: 'ITA Airways Long-Haul A321neo (1-1 Stelia Opera Lie-Flat)',
    layout: '1-1 Reverse Herringbone 180° Lie-Flat Pods',
    requiresGoogleSeatCode: true,
    minDurationMinsIfNoSeatCode: 270,
    notes: 'Dedicated subfleet of A321neos with 12 full 1-1 reverse-herringbone lie-flat suites designed by Walter De Silva.',
  },
  {
    id: 'etihad-a321lr',
    carrierCodes: ['EY'],
    carrierNames: [/etihad/i],
    aircraftPatterns: [/a321/i, /321neo/i, /321lr/i],
    productName: 'Etihad Airways A321LR First & Business Suites (1-1 Lie-Flat)',
    layout: '1-1 Reverse Herringbone 180° Lie-Flat Suites',
    requiresGoogleSeatCode: true,
    minDurationMinsIfNoSeatCode: 270,
    notes: 'Etihad A321LR features 14 direct-aisle-access 1-1 lie-flat Business suites plus 2 enclosed First suites.',
  },
  {
    id: 'american-a321t-xlr',
    carrierCodes: ['AA'],
    carrierNames: [/american/i],
    aircraftPatterns: [/a321/i, /321t/i, /321xlr/i, /321neo/i],
    productName: 'American Airlines Flagship Business A321T / A321XLR (180° Lie-Flat)',
    layout: '2-2 Collins Diamond (A321T) or 1-1 Flagship Suite (A321XLR)',
    requiresGoogleSeatCode: true, // Strict: standard AA A321/A321neo has domestic recliners (seatTypeCode 8)
    minDurationMinsIfNoSeatCode: 9999,
    notes: 'Only accepted when Google Flights confirms seatTypeCode 5 (Lie-flat) or 6 (Suite) on Flagship transcon/transatlantic subfleets.',
  },
  {
    id: 'united-757-polaris',
    carrierCodes: ['UA'],
    carrierNames: [/united/i],
    aircraftPatterns: [/757/i, /b752/i, /a321xlr/i],
    productName: 'United Polaris / Business Boeing 757-200 (180° Lie-Flat)',
    layout: '2-2 Collins Diamond 180° Lie-Flat',
    requiresGoogleSeatCode: true,
    minDurationMinsIfNoSeatCode: 360,
    notes: 'All United Boeing 757-200s feature 16 Collins Diamond 180° lie-flat beds used on transatlantic routes (e.g. DUB/EDI/LIS/OPO/AGP to EWR/IAD/ORD).',
  },
  {
    id: 'delta-757-delta-one',
    carrierCodes: ['DL'],
    carrierNames: [/delta/i],
    aircraftPatterns: [/757/i, /b752/i],
    productName: 'Delta One Boeing 757-200 (75S Subfleet 180° Lie-Flat)',
    layout: '2-2 Collins Diamond 180° Lie-Flat',
    requiresGoogleSeatCode: true, // Strict: standard DL 757 has recliners (seatTypeCode 8)
    minDurationMinsIfNoSeatCode: 9999,
    notes: 'Only accepted when operated by the internationally configured 75S subfleet (verified via seatTypeCode 5).',
  },
  {
    id: 'qatar-sadia-gulf-a320-family',
    carrierCodes: ['QR', 'SV', 'GF'],
    carrierNames: [/qatar/i, /saudia/i, /gulf\s*air/i],
    aircraftPatterns: [/a320/i, /a321/i, /321neo/i],
    productName: 'Middle East Boutique Narrowbody 180° Lie-Flat (Collins Diamond / Falcon Gold)',
    layout: '2-2 180° Lie-Flat Beds',
    requiresGoogleSeatCode: true,
    minDurationMinsIfNoSeatCode: 300,
    notes: 'Gulf Air A321neo LR, long-haul Saudia A320/A321neo, and select Qatar Airways A320s feature full 180° horizontal lie-flat beds.',
  },
  {
    id: 'flydubai-737max-lieflat',
    carrierCodes: ['FZ'],
    carrierNames: [/flydubai/i],
    aircraftPatterns: [/737\s*max/i, /737max/i, /b38m/i, /b39m/i],
    productName: 'flydubai Business Class Boeing 737 MAX (180° Lie-Flat)',
    layout: '2-2 / 1-1 Staggered Thompson Vantage 180° Lie-Flat',
    requiresGoogleSeatCode: true,
    minDurationMinsIfNoSeatCode: 9999,
    notes: 'Accepted only when fitted with the Thompson Vantage lie-flat cabin (seatTypeCode 5 or 6), rejecting standard recliner 737-800/MAX subfleets.',
  },
];

/**
 * Widebody Non-Lie-Flat Pitfalls
 * Airlines that operate widebody aircraft (787, A330, A350, 767) with RECLINER or ANGLED seats
 * marketed as Business or "Premium" class.
 */
export const WIDEBODY_PITFALLS = [
  {
    carrierCode: 'FI',
    carrierPattern: /icelandair/i,
    reason: 'Icelandair Boeing 767 (and 757/737 MAX) Saga Class only has 2-1-2 / 2-2 recliner seats with 40" pitch — NO lie-flat beds anywhere in fleet (also on unconditional airline blocklist).',
  },
  {
    carrierCode: 'N0',
    carrierPattern: /norse/i,
    reason: 'Norse Atlantic Boeing 787 "Premium" cabin is a 2-3-2 recliner seat (43" pitch), NOT lie-flat Business Class.',
  },
  {
    carrierCode: 'Z0',
    carrierPattern: /norse/i,
    reason: 'Norse Atlantic UK Boeing 787 "Premium" cabin is a 2-3-2 recliner seat, NOT lie-flat Business Class.',
  },
  {
    carrierCode: 'BF',
    carrierPattern: /french\s*bee/i,
    reason: 'French bee Airbus A350 "Premium Blue" cabin is a 2-3-2 recliner seat, NOT lie-flat Business Class.',
  },
  {
    carrierCode: 'TR',
    carrierPattern: /\bscoot\b/i,
    reason: 'Scoot Boeing 787 "ScootPlus" is a recliner cabin, NOT lie-flat Business Class.',
  },
  {
    carrierCode: 'D7',
    carrierPattern: /airasia\s*x/i,
    reason: 'AirAsia X Airbus A330 "Premium Flatbed" is an angled-flat seat (not true 180° horizontal lie-flat).',
  },
  {
    carrierCode: 'EW',
    carrierPattern: /eurowings\b(?!\s*discover)/i,
    reason: 'Standard Eurowings BIZclass on narrowbodies is blocked-middle only (Note: Discover Airlines / 4Y A330 has true 180° lie-flat).',
  },
];

/**
 * Normalize user-requested aircraft family filters (including "A360" typo handling).
 */
export function normalizeRequestedAircraftFamilies(requestedList) {
  if (!requestedList || !Array.isArray(requestedList) || requestedList.length === 0) {
    return {
      families: WIDEBODY_FAMILIES.map((f) => f.family),
      notes: [],
    };
  }

  const normalized = new Set();
  const notes = [];

  for (const raw of requestedList) {
    const item = String(raw).trim().toUpperCase();
    if (item.includes('360')) {
      notes.push(
        'Note: Airbus never produced an A360 (skipping from A350 to A380); automatically matched A330/A350/A380 widebody families.'
      );
      normalized.add('A330');
      normalized.add('A350');
      normalized.add('A380');
      continue;
    }
    if (item.includes('330')) normalized.add('A330');
    else if (item.includes('340')) normalized.add('A340');
    else if (item.includes('350')) normalized.add('A350');
    else if (item.includes('380')) normalized.add('A380');
    else if (item.includes('747')) normalized.add('B747');
    else if (item.includes('767')) normalized.add('B767');
    else if (item.includes('777')) normalized.add('B777');
    else if (item.includes('787') || item.includes('DREAMLINER')) normalized.add('B787');
    else if (item.includes('A321') || item.includes('NARROW')) normalized.add('A321_LIEFLAT');
    else if (item.includes('757')) normalized.add('B757_LIEFLAT');
  }

  if (normalized.size === 0) {
    return {
      families: WIDEBODY_FAMILIES.map((f) => f.family),
      notes,
    };
  }

  return {
    families: Array.from(normalized),
    notes,
  };
}

/**
 * Classify an aircraft string from Google Flights (e.g. "Airbus A350-900", "Boeing 787-9", "Airbus A321neo")
 * combined with carrier info and Google Flights' seatTypeCode.
 */
export function classifySegmentEquipment({
  aircraftName,
  carrierCode,
  carrierName,
  operatingCarrierName,
  seatTypeCode,
  durationMins,
  allowLieFlatNarrowbodyExceptions = true,
  allowedWidebodyFamilies = null,
}) {
  const aircraft = String(aircraftName || 'Unknown Aircraft').trim();
  const seatInfo = SEAT_TYPE_CODES[seatTypeCode] || {
    label: seatTypeCode ? `Seat Code ${seatTypeCode}` : 'Unlisted Seat Metadata',
    isLieFlat: null,
    category: 'unknown',
  };

  // 1. Check widebody pitfalls first
  const combinedCarrierText = `${carrierName || ''} ${operatingCarrierName || ''}`.trim();
  for (const pitfall of WIDEBODY_PITFALLS) {
    if (
      (carrierCode && pitfall.carrierCode === carrierCode.toUpperCase()) ||
      pitfall.carrierPattern.test(combinedCarrierText)
    ) {
      return {
        isWidebody: false,
        isLieFlatNarrowbodyException: false,
        isQualifyingLongHaulEquipment: false,
        isTrueLieFlat: false,
        family: 'PITFALL_NON_LIEFLAT',
        aircraft,
        seatLabel: seatInfo.label,
        rejectionReason: pitfall.reason,
      };
    }
  }

  // 2. Check if aircraft is a Widebody
  for (const wb of WIDEBODY_FAMILIES) {
    if (wb.patterns.some((rx) => rx.test(aircraft))) {
      // Check if user restricted to specific widebody families (e.g. only A350)
      if (
        Array.isArray(allowedWidebodyFamilies) &&
        allowedWidebodyFamilies.length > 0 &&
        !allowedWidebodyFamilies.includes(wb.family)
      ) {
        return {
          isWidebody: true,
          isLieFlatNarrowbodyException: false,
          isQualifyingLongHaulEquipment: false,
          isTrueLieFlat: seatInfo.isLieFlat === true,
          family: wb.family,
          aircraft,
          seatLabel: seatInfo.label,
          rejectionReason: `Widebody ${wb.family} (${aircraft}) is not in requested families [${allowedWidebodyFamilies.join(', ')}]`,
        };
      }

      // Verify true lie-flat status on this widebody
      // If Google Flights explicitly marks it as standard pitch (1-3), recliner (4/8), or angled flat (7), reject!
      if (seatTypeCode && [1, 2, 3, 4, 7, 8].includes(seatTypeCode)) {
        return {
          isWidebody: true,
          isLieFlatNarrowbodyException: false,
          isQualifyingLongHaulEquipment: false,
          isTrueLieFlat: false,
          family: wb.family,
          aircraft,
          seatLabel: seatInfo.label,
          rejectionReason: `Widebody ${aircraft} on ${carrierName || carrierCode} has non-lie-flat cabin (${seatInfo.label})`,
        };
      }

      return {
        isWidebody: true,
        isLieFlatNarrowbodyException: false,
        isQualifyingLongHaulEquipment: true,
        isTrueLieFlat: true,
        family: wb.family,
        aircraft,
        seatLabel: seatInfo.isLieFlat ? seatInfo.label : 'True 180° Lie-Flat Seat',
        productNotes: wb.notes,
      };
    }
  }

  // 3. Not a widebody -> Check True Lie-Flat Narrowbody Exceptions (JetBlue Mint, TAP A321LR, Aer Lingus A321LR/XLR, etc.)
  for (const exc of LIEFLAT_NARROWBODY_EXCEPTIONS) {
    const carrierMatches =
      (carrierCode && exc.carrierCodes.includes(carrierCode.toUpperCase())) ||
      exc.carrierNames.some((rx) => rx.test(combinedCarrierText));
    const aircraftMatches = exc.aircraftPatterns.some((rx) => rx.test(aircraft));

    if (carrierMatches && aircraftMatches) {
      // Verify that this specific flight is the long-haul lie-flat subfleet and NOT a short-haul Euro-business flight
      const confirmedBySeatCode = seatTypeCode === 5 || seatTypeCode === 6;
      const explicitlyNonLieFlat = seatTypeCode && [1, 2, 3, 4, 7, 8].includes(seatTypeCode);
      const confirmedByDuration =
        !seatTypeCode && durationMins && durationMins >= exc.minDurationMinsIfNoSeatCode;

      if (explicitlyNonLieFlat) {
        return {
          isWidebody: false,
          isLieFlatNarrowbodyException: false,
          isQualifyingLongHaulEquipment: false,
          isTrueLieFlat: false,
          family: 'NARROWBODY_NON_LIEFLAT',
          aircraft,
          seatLabel: seatInfo.label,
          rejectionReason: `${carrierName || carrierCode} ${aircraft} on this leg is configured with ${seatInfo.label}, not the long-haul lie-flat cabin.`,
        };
      }

      if (confirmedBySeatCode || (!exc.requiresGoogleSeatCode && confirmedByDuration) || confirmedByDuration) {
        if (!allowLieFlatNarrowbodyExceptions) {
          return {
            isWidebody: false,
            isLieFlatNarrowbodyException: true,
            isQualifyingLongHaulEquipment: false,
            isTrueLieFlat: true,
            family: 'NARROWBODY_LIEFLAT_EXCEPTION',
            aircraft,
            seatLabel: `${exc.productName} (${seatInfo.label})`,
            exceptionDetails: exc,
            rejectionReason: `True lie-flat narrowbody (${exc.productName}) excluded because strict widebody-only mode was requested.`,
          };
        }

        return {
          isWidebody: false,
          isLieFlatNarrowbodyException: true,
          isQualifyingLongHaulEquipment: true,
          isTrueLieFlat: true,
          family: 'NARROWBODY_LIEFLAT_EXCEPTION',
          aircraft,
          seatLabel: `${exc.productName} — ${seatInfo.label}`,
          exceptionDetails: exc,
          productNotes: exc.notes,
        };
      }
    }
  }

  // 4. Standard Narrowbody / Regional Jet (allowed ONLY on short connecting feeder legs < 7 hours!)
  return {
    isWidebody: false,
    isLieFlatNarrowbodyException: false,
    isQualifyingLongHaulEquipment: false,
    isTrueLieFlat: seatInfo.isLieFlat === true,
    family: 'NARROWBODY',
    aircraft,
    seatLabel: seatInfo.label,
    rejectionReason: `Aircraft "${aircraft}" is a standard narrowbody/regional jet (${seatInfo.label}) and not an approved widebody or lie-flat narrowbody exception.`,
  };
}
