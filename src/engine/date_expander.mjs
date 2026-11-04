/**
 * Flexible Date Pattern Expander
 * Supports:
 * - Explicit (outboundDate, returnDate)
 * - Day-of-week patterns (e.g., "Friday to Tuesday", nights = 4, monthsAhead = 2)
 * - Specific month filters (e.g., "November", "December", or "2026-11")
 */

const DAY_NAME_TO_INDEX = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

const DAY_INDEX_TO_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toIsoDate(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function parseDayOfWeek(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number' && input >= 0 && input <= 6) return input;
  const key = String(input).trim().toLowerCase();
  return DAY_NAME_TO_INDEX[key] ?? null;
}

/**
 * Generates candidate (outboundDate, returnDate) pairs based on flexible criteria.
 */
export function expandDatePairs({
  outboundDate = null,
  returnDate = null,
  departureDayOfWeek = null, // e.g., "Friday" or null for flexible days
  returnDayOfWeek = null, // e.g., "Tuesday"
  nights = 4, // e.g., 4 nights
  monthsAhead = 2, // e.g., scan next 2 months
  startDateFrom = null, // optional YYYY-MM-DD anchor
  targetMonth = null, // optional month number (1-12) or "2026-12"
  maxDatePairs = 6,
} = {}) {
  // 1. If exact dates are supplied, return them directly
  if (outboundDate && returnDate) {
    const outObj = new Date(`${outboundDate}T00:00:00Z`);
    const retObj = new Date(`${returnDate}T00:00:00Z`);
    const diffNights = Math.round((retObj - outObj) / (1000 * 60 * 60 * 24));
    return [
      {
        outboundDate,
        returnDate,
        outboundDow: DAY_INDEX_TO_SHORT[outObj.getUTCDay()],
        returnDow: DAY_INDEX_TO_SHORT[retObj.getUTCDay()],
        nights: diffNights,
      },
    ];
  }

  const now = startDateFrom ? new Date(`${startDateFrom}T00:00:00Z`) : new Date();
  // Start 14 days in the future by default so Business Class advance-purchase saver fares (I/Z class) are available
  const offsetDays = startDateFrom ? 0 : 14;
  let cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));
  let endWindow = new Date(
    Date.UTC(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth() + Math.max(1, Number(monthsAhead) || 2),
      cursor.getUTCDate()
    )
  );

  const explicitDepDow = parseDayOfWeek(departureDayOfWeek);
  // When no explicit day is requested, scan across ALL 7 days of the week (Sunday through Saturday)
  // so no bargain is missed regardless of which day of the week it departs.
  const targetDays = explicitDepDow !== null ? [explicitDepDow] : [0, 1, 2, 3, 4, 5, 6];
  const retDow = parseDayOfWeek(returnDayOfWeek);
  // When returning on a specific day (e.g. Sunday back in London), allow return flights departing:
  // 1. That exact day (e.g. Sunday) for same-day returns
  // 2. The day before (e.g. Saturday) for overnight/+1 day journeys that land on Sunday!
  const allowedRetDows = retDow !== null ? [retDow, (retDow - 1 + 7) % 7] : null;

  // Support single nights count or range of nights (e.g. [3, 4])
  const candidateNightsList = Array.isArray(nights)
    ? nights.map(Number).filter((n) => !Number.isNaN(n) && n > 0)
    : [Number(nights) || 4];

  // Parse optional targetMonth
  let monthFilter = null;
  if (targetMonth) {
    const mStr = String(targetMonth).trim().toLowerCase();
    const monthNames = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
    ];
    const mIdx = monthNames.findIndex((m) => m.startsWith(mStr));
    let targetYear = now.getUTCFullYear();
    if (mIdx !== -1) {
      monthFilter = mIdx + 1;
      if (monthFilter < now.getUTCMonth() + 1) targetYear += 1;
    } else if (/^\d{4}-(\d{2})$/.test(mStr)) {
      targetYear = Number(mStr.split('-')[0]);
      monthFilter = Number(mStr.split('-')[1]);
    } else if (/^\d{1,2}$/.test(mStr)) {
      monthFilter = Number(mStr);
      if (monthFilter < now.getUTCMonth() + 1) targetYear += 1;
    }

    if (monthFilter) {
      const monthStart = new Date(Date.UTC(targetYear, monthFilter - 1, 1));
      const monthEnd = new Date(Date.UTC(targetYear, monthFilter, 0, 23, 59, 59));
      cursor = monthStart > cursor ? monthStart : cursor;
      endWindow = monthEnd;
    }
  }

  const allCandidates = [];
  const iter = new Date(cursor);
  while (iter <= endWindow) {
    if (targetDays.includes(iter.getUTCDay())) {
      if (!monthFilter || iter.getUTCMonth() + 1 === monthFilter) {
        for (const tripNights of candidateNightsList) {
          // Pair A: Same-day destination arrival (D -> D + tripNights)
          const retSameDayObj = new Date(iter.getTime() + tripNights * 24 * 60 * 60 * 1000);
          if (allowedRetDows === null || allowedRetDows.includes(retSameDayObj.getUTCDay())) {
            allCandidates.push({
              outboundDate: toIsoDate(iter),
              returnDate: toIsoDate(retSameDayObj),
              outboundDow: DAY_INDEX_TO_SHORT[iter.getUTCDay()],
              returnDow: DAY_INDEX_TO_SHORT[retSameDayObj.getUTCDay()],
              nights: tripNights,
              expectedArrivalDayOffset: 0,
            });
          }

          // Pair B: Overnight destination arrival (D -> D + tripNights + 1)
          if (retDow === null || allowedRetDows.includes(new Date(iter.getTime() + (tripNights + 1) * 24 * 60 * 60 * 1000).getUTCDay())) {
            const retOvernightObj = new Date(iter.getTime() + (tripNights + 1) * 24 * 60 * 60 * 1000);
            allCandidates.push({
              outboundDate: toIsoDate(iter),
              returnDate: toIsoDate(retOvernightObj),
              outboundDow: DAY_INDEX_TO_SHORT[iter.getUTCDay()],
              returnDow: DAY_INDEX_TO_SHORT[retOvernightObj.getUTCDay()],
              nights: tripNights,
              expectedArrivalDayOffset: 1,
            });
          }
        }
      }
    }
    iter.setUTCDate(iter.getUTCDate() + 1);
  }

  if (allCandidates.length <= maxDatePairs * 2) {
    return allCandidates;
  }

  // Evenly sample across the window
  const sampled = [];
  const step = (allCandidates.length - 1) / Math.max(1, maxDatePairs * 2 - 1);
  for (let i = 0; i < maxDatePairs * 2; i++) {
    const idx = Math.round(i * step);
    const item = allCandidates[idx];
    if (item && !sampled.some((s) => s.outboundDate === item.outboundDate && s.returnDate === item.returnDate)) {
      sampled.push(item);
    }
  }
  return sampled;
}
