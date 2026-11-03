/**
 * Airline Blocklist & Carrier Intelligence Database
 * Enforces strict exclusion of blacklisted airlines across BOTH marketing and operating carriers ("Operated by...").
 */

export const DEFAULT_BLOCKED_AIRLINES = [
  {
    code: 'AI',
    name: 'Air India',
    aliases: ['air india', 'airindia', 'air india express', 'aix connect', 'ix'],
    reason: 'Default unconditional exclusion (inconsistent legacy cabin hardware / unretrofitted widebodies & service reliability).',
  },
  {
    code: '6E',
    name: 'IndiGo',
    aliases: ['indigo', 'indogo', 'interglobe aviation', '6e'],
    reason: 'Default unconditional exclusion (low-cost carrier; codeshares with Turkish/Qatar and operates wet-leased widebodies without true Business Class).',
  },
  {
    code: 'FI',
    name: 'Icelandair',
    aliases: ['icelandair', 'iceland air', 'fi'],
    reason: 'Default unconditional exclusion (Saga Class on 767/757/737 MAX is a recliner seat, never true lie-flat).',
  },
  {
    code: 'MS',
    name: 'EgyptAir',
    aliases: ['egyptair', 'egypt air', 'ms'],
    reason: 'Default unconditional exclusion (dry airline, inconsistent hard/soft Business Class product, Star Alliance codeshare trap).',
  },
];

/**
 * Checks whether any leg or itinerary involves a blocked airline (either as marketing carrier or operating carrier).
 */
export function checkAirlineBlocked({
  carrierCode,
  carrierName,
  operatingCarrierName,
   itineraryAirlines = [],
  customBlockedList = [],
}) {
  const codeUpper = String(carrierCode || '').trim().toUpperCase();
  const textToCheck = [
    carrierName || '',
    operatingCarrierName || '',
    ...itineraryAirlines,
  ]
    .join(' | ')
    .toLowerCase();

  // 1. Check built-in unconditional blocklist
  for (const blocked of DEFAULT_BLOCKED_AIRLINES) {
    if (codeUpper === blocked.code) {
      return {
        isBlocked: true,
        matchedAirline: blocked.name,
        reason: blocked.reason,
      };
    }
    for (const alias of blocked.aliases) {
      // Match whole word or substring for multi-word airline names
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = alias.length <= 3 ? new RegExp(`\\b${escaped}\\b`, 'i') : new RegExp(escaped, 'i');
      if (regex.test(textToCheck)) {
        return {
          isBlocked: true,
          matchedAirline: blocked.name,
          reason: blocked.reason,
        };
      }
    }
  }

  // 2. Check custom user-provided airlines to avoid
  if (Array.isArray(customBlockedList)) {
    for (const rawCustom of customBlockedList) {
      const clean = String(rawCustom || '').trim().toLowerCase();
      if (!clean) continue;

      // Normalize common user typos like "IndoGo", "Egypt Air", "Iceland Air"
      if (clean === 'indogo' || clean === 'indigo') {
        if (codeUpper === '6E' || /indigo|indogo/i.test(textToCheck)) {
          return { isBlocked: true, matchedAirline: 'IndiGo', reason: 'Excluded per user prompt' };
        }
      }
      if (clean === codeUpper.toLowerCase() || textToCheck.includes(clean)) {
        return {
          isBlocked: true,
          matchedAirline: String(rawCustom),
          reason: `Excluded per user prompt ("${rawCustom}")`,
        };
      }
    }
  }

  return {
    isBlocked: false,
    matchedAirline: null,
    reason: null,
  };
}
