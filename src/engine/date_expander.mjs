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
  departureDayOfWeek = 'Friday', // e.g., "Friday"
  returnDayOfWeek = null, // e.g., "Tuesday"
  nights = 4, // e.g., 4 nights (Friday -> Tuesday)
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
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));
  const endWindow = new Date(
    Date.UTC(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth() + Math.max(1, Number(monthsAhead) || 2),
      cursor.getUTCDate()
    )
  );

  const depDow = parseDayOfWeek(departureDayOfWeek) ?? 5; // Default Friday (5)
  const retDow = parseDayOfWeek(returnDayOfWeek);

  // Compute trip length in nights:
  // If both departureDayOfWeek and returnDayOfWeek are provided (e.g. Friday=5 to Tuesday=2 -> (2 - 5 + 7) % 7 = 4 nights)
  let tripNights = Number(nights) || 4;
  if (retDow !== null && !nights) {
    const delta = (retDow - depDow + 7) % 7;
    tripNights = delta === 0 ? 7 : delta;
  }

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
    if (mIdx !== -1) {
      monthFilter = mIdx + 1;
    } else if (/^\d{4}-(\d{2})$/.test(mStr)) {
      monthFilter = Number(mStr.split('-')[1]);
    } else if (/^\d{1,2}$/.test(mStr)) {
      monthFilter = Number(mStr);
    }
  }

  const allCandidates = [];
  const iter = new Date(cursor);
  while (iter <= endWindow) {
    if (iter.getUTCDay() === depDow) {
      if (!monthFilter || iter.getUTCMonth() + 1 === monthFilter) {
        const retDateObj = new Date(iter.getTime() + tripNights * 24 * 60 * 60 * 1000);
        allCandidates.push({
          outboundDate: toIsoDate(iter),
          returnDate: toIsoDate(retDateObj),
          outboundDow: DAY_INDEX_TO_SHORT[iter.getUTCDay()],
          returnDow: DAY_INDEX_TO_SHORT[retDateObj.getUTCDay()],
          nights: tripNights,
        });
      }
    }
    iter.setUTCDate(iter.getUTCDate() + 1);
  }

  if (allCandidates.length <= maxDatePairs) {
    return allCandidates;
  }

  // Evenly sample across the window so we cover early, middle, and late weeks in the 2-month window
  const sampled = [];
  const step = (allCandidates.length - 1) / Math.max(1, maxDatePairs - 1);
  for (let i = 0; i < maxDatePairs; i++) {
    const idx = Math.round(i * step);
    const item = allCandidates[idx];
    if (item && !sampled.some((s) => s.outboundDate === item.outboundDate)) {
      sampled.push(item);
    }
  }
  return sampled;
}
