export interface MonthConfig {
  key: string;      // e.g. "aug-25" — used as DB key in monthlyData JSON
  label: string;    // e.g. "Aug 25" — shown in column header
  hidden?: boolean; // if true, column is not rendered (data is still preserved)
}

// To add a month: append one entry to this array.
// To hide a month: add hidden: true (data is preserved, just not displayed).
// No other file needs to change.
export const MONTHS: MonthConfig[] = [
  { key: "aug-25", label: "Aug 25" },
  { key: "sep-25", label: "Sep 25" },
  { key: "oct-25", label: "Oct 25" },
  { key: "nov-25", label: "Nov 25" },
  { key: "dec-25", label: "Dec 25" },
  { key: "jan-26", label: "Jan 26" },
  { key: "feb-26", label: "Feb 26" },
  { key: "mar-26", label: "Mar 26" },
  { key: "apr-26", label: "Apr 26" },
  { key: "may-26", label: "May 26" },
  { key: "jun-26", label: "Jun 26" },
  { key: "jul-26", label: "Jul 26" },
];

export const VISIBLE_MONTHS = MONTHS.filter((m) => !m.hidden);

// Standard monthly hours used to calculate FTE
export const MONTHLY_HOURS = 172;

export function hoursToFte(hours: number): number {
  return Math.round((hours / MONTHLY_HOURS) * 10) / 10;
}
