/**
 * Trading days utility.
 * Trading days are Monday–Friday only. Weekends do not count.
 */

/**
 * Add N trading days to a start date, skipping weekends.
 */
export function addTradingDays(startDate: Date, tradingDays: number): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < tradingDays) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }
  return result;
}

/**
 * Count the number of trading days remaining from now until endDate.
 */
export function countTradingDaysRemaining(endDate: Date): number {
  const now = new Date();
  if (endDate <= now) return 0;
  let count = 0;
  const cursor = new Date(now);
  while (cursor < endDate) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      if (cursor <= endDate) count++;
    }
  }
  return count;
}

/**
 * Given a number of trading days, compute the approximate calendar weeks.
 * 5 trading days = 1 week, 20 = 4 weeks, etc.
 */
export function tradingDaysToWeeks(tradingDays: number): string {
  const weeks = tradingDays / 5;
  if (Number.isInteger(weeks)) return `${weeks} trading week${weeks !== 1 ? "s" : ""}`;
  return `${tradingDays} trading day${tradingDays !== 1 ? "s" : ""}`;
}
