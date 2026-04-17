export interface MonthConfig {
  key: string;              // e.g. "oct-25" — used as DB key in monthlyData JSON
  label: string;            // e.g. "Oct 25" — shown in column header
  workdayHours: number;     // Mon-Fri calendar days × 8 h (adjust for holidays as needed)
  quarterStart?: boolean;   // true → darker left border to mark quarter boundary
  hidden?: boolean;         // if true, column is not rendered (data is still preserved)
}

// Months span complete quarters only.
// To add a month: append one entry to this array.
// To hide a month: add hidden: true (data is preserved, just not displayed).
// Adjust workdayHours when local holidays reduce the available working time.
export const MONTHS: MonthConfig[] = [
  // Q4 2025
  { key: "oct-25", label: "Oct 25", workdayHours: 184, quarterStart: true },  // 23 days
  { key: "nov-25", label: "Nov 25", workdayHours: 160 },                      // 20 days
  { key: "dec-25", label: "Dec 25", workdayHours: 184 },                      // 23 days
  // Q1 2026
  { key: "jan-26", label: "Jan 26", workdayHours: 176, quarterStart: true },  // 22 days
  { key: "feb-26", label: "Feb 26", workdayHours: 160 },                      // 20 days
  { key: "mar-26", label: "Mar 26", workdayHours: 176 },                      // 22 days
  // Q2 2026
  { key: "apr-26", label: "Apr 26", workdayHours: 176, quarterStart: true },  // 22 days
  { key: "may-26", label: "May 26", workdayHours: 168 },                      // 21 days
  { key: "jun-26", label: "Jun 26", workdayHours: 176 },                      // 22 days
  // Q3 2026
  { key: "jul-26", label: "Jul 26", workdayHours: 184, quarterStart: true },  // 23 days
  { key: "aug-26", label: "Aug 26", workdayHours: 168 },                      // 21 days
  { key: "sep-26", label: "Sep 26", workdayHours: 176 },                      // 22 days
];

export const VISIBLE_MONTHS = MONTHS.filter((m) => !m.hidden);

export function hoursToFte(hours: number, monthHours: number): number {
  return Math.round((hours / monthHours) * 10) / 10;
}

const MONTH_ABBREV: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/** Distribute soldHrs across months proportionally by weekday count within [startDate, endDate]. */
export function distributeHours(
  soldHrs: number,
  startDate: string,
  endDate: string,
  months: MonthConfig[],
): Record<string, number> {
  const projectStart = parseIsoDate(startDate);
  const projectEnd   = parseIsoDate(endDate);

  const weekdaysPerMonth: Record<string, number> = {};
  let totalWeekdays = 0;

  for (const month of months) {
    const [abbrev, yy] = month.key.split("-");
    const m = MONTH_ABBREV[abbrev];
    if (!m || !yy) continue;
    const year = 2000 + parseInt(yy);
    const monthStart = new Date(year, m - 1, 1);
    const monthEnd   = new Date(year, m, 0);

    const from = projectStart > monthStart ? projectStart : monthStart;
    const to   = projectEnd   < monthEnd   ? projectEnd   : monthEnd;

    const wd = from <= to ? countWeekdays(from, to) : 0;
    weekdaysPerMonth[month.key] = wd;
    totalWeekdays += wd;
  }

  if (totalWeekdays === 0) return {};

  const result: Record<string, number> = {};
  for (const month of months) {
    const wd = weekdaysPerMonth[month.key] ?? 0;
    if (wd > 0) {
      result[month.key] = Math.round((soldHrs * wd / totalWeekdays) * 10) / 10;
    }
  }
  return result;
}
