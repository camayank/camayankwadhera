// Reconcile a year's books with GSTR-1, GSTR-3B and GSTR-2B month by month, before GSTR-9 and GSTR-9C.
// No browser dependencies.
//
// Sources checked in November 2026:
// - Section 16(4), CGST Act: credit for a year's invoices must be claimed by 30 November of the next year, or
//   the date the annual return is filed if earlier. For 2025-26 that is 30 November 2026.
// - Sections 37 and 39: errors in GSTR-1 and GSTR-3B for a year can be corrected up to the same date.
// - Section 16(2)(aa): credit only for invoices that appear in GSTR-2B. GSTR-9 Table 8A now fills from GSTR-2B.
// - Section 50: interest at 18% a year on tax paid late, and on excess credit claimed and used.
// - GSTR-9 and 9C are due by 31 December; 9C applies above ₹5 crore of turnover.

export const FIELDS = [
  { key: "salesBooks", label: "Sales in books", group: "Taxable value of sales" },
  { key: "sales1", label: "Sales in GSTR-1", group: "Taxable value of sales" },
  { key: "sales3b", label: "Sales in GSTR-3B", group: "Taxable value of sales" },
  { key: "taxBooks", label: "Output tax in books", group: "Output tax" },
  { key: "tax1", label: "Output tax in GSTR-1", group: "Output tax" },
  { key: "tax3b", label: "Output tax in GSTR-3B", group: "Output tax" },
  { key: "itcBooks", label: "Credit in books", group: "Input tax credit" },
  { key: "itc2b", label: "Credit in GSTR-2B", group: "Input tax credit" },
  { key: "itc3b", label: "Credit claimed in GSTR-3B", group: "Input tax credit" },
] as const;

export type Field = (typeof FIELDS)[number]["key"];
export type Month = Record<Field, number>;

export const MONTHS = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];

export const emptyYear = (): Month[] => MONTHS.map(() => Object.fromEntries(FIELDS.map((f) => [f.key, 0])) as Month);

export const GST_INTEREST = 0.18;

export type MonthCheck = {
  month: string;
  /** Last date for that month's GSTR-3B (the 20th of the next month for monthly filers). */
  due: string;
  /** Sales in books not reported in GSTR-1. */
  unreported: number;
  /** Tax in GSTR-1 above the tax paid through GSTR-3B. */
  shortPaid: number;
  /** Credit claimed in GSTR-3B above GSTR-2B. */
  excessItc: number;
  /** Interest at 18% a year to the check date, on the short payment and the excess credit. */
  interest: number;
};

export type Gstr9Result = {
  months: MonthCheck[];
  totals: Month;
  /** Last date to claim credit or correct returns for the year: 30 November after the year ends. */
  cutoff: string;
  daysToCutoff: number;
  /** Credit in books and in GSTR-2B that was never claimed in GSTR-3B. */
  unclaimedItc: number;
  /** Credit claimed beyond GSTR-2B for the year. */
  excessItc: number;
  shortPaid: number;
  unreported: number;
  interest: number;
  /** Sales in books minus sales in GSTR-3B, for the GSTR-9C turnover reconciliation. */
  turnoverGap: number;
  actions: { tone: "bad" | "warn" | "good"; title: string; detail: string }[];
};

const pad = (n: number) => String(n).padStart(2, "0");
const days = (from: string, to: string) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000));
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/** The year starting 1 April `startYear`. */
export function reconcileYear(year: Month[], startYear: number, asOf: string, tolerance = 10): Gstr9Result {
  const months: MonthCheck[] = year.map((m, i) => {
    const calMonth = ((i + 3) % 12) + 1; // April is 4
    const calYear = i < 9 ? startYear : startYear + 1;
    const next = calMonth === 12 ? { y: calYear + 1, m: 1 } : { y: calYear, m: calMonth + 1 };
    const due = `${next.y}-${pad(next.m)}-20`;
    const unreported = Math.max(0, m.salesBooks - m.sales1);
    const shortPaid = Math.max(0, m.tax1 - m.tax3b);
    const excessItc = Math.max(0, m.itc3b - m.itc2b);
    return { month: `${MONTHS[i]} ${calYear}`, due, unreported: unreported > tolerance ? unreported : 0, shortPaid: shortPaid > tolerance ? shortPaid : 0, excessItc: excessItc > tolerance ? excessItc : 0, interest: 0 };
  });
  // a month's excess credit that later months make up is timing, not excess: charge interest on it only when
  // the year as a whole claimed more than GSTR-2B
  const yearExcess = year.reduce((s, m) => s + m.itc3b - m.itc2b, 0) > tolerance;
  for (const m of months) {
    const late = m.shortPaid + (yearExcess ? m.excessItc : 0);
    m.interest = Math.round((late * GST_INTEREST * days(m.due, asOf)) / 365);
  }
  const totals = Object.fromEntries(FIELDS.map((f) => [f.key, year.reduce((s, m) => s + m[f.key], 0)])) as Month;
  const cutoff = `${startYear + 1}-11-30`;
  const daysToCutoff = Math.round((Date.parse(cutoff) - Date.parse(asOf)) / 86_400_000);
  // credit is lost only when it was available in 2B, is in the books, and was never claimed
  const unclaimedItc = Math.max(0, Math.min(totals.itcBooks, totals.itc2b) - totals.itc3b);
  const excessItc = Math.max(0, totals.itc3b - totals.itc2b);
  const shortPaid = Math.max(0, totals.tax1 - totals.tax3b);
  const unreported = Math.max(0, totals.salesBooks - totals.sales1);
  const interest = months.reduce((s, m) => s + m.interest, 0);
  const turnoverGap = totals.salesBooks - totals.sales3b;
  const open = daysToCutoff >= 0;
  const fy = `${startYear}-${pad((startYear + 1) % 100)}`;

  const actions: Gstr9Result["actions"] = [];
  if (unclaimedItc > tolerance) actions.push(open
    ? { tone: "warn", title: `Claim ${inr(unclaimedItc)} of credit before 30 November ${startYear + 1}`, detail: `This credit is in your books and in GSTR-2B but was never claimed in GSTR-3B. Claim it in the GSTR-3B filed before 30 November ${startYear + 1}, and before filing GSTR-9; after that it is lost under section 16(4).` }
    : { tone: "bad", title: `${inr(unclaimedItc)} of credit was not claimed in time`, detail: `The section 16(4) date for ${fy} has passed, so this credit cannot now be claimed. Report it in GSTR-9 as credit not availed.` });
  if (excessItc > tolerance) actions.push({ tone: "bad", title: `Reverse ${inr(excessItc)} of credit claimed beyond GSTR-2B`, detail: "Pay it back through DRC-03, with interest at 18% a year if it was used, and show the reversal in GSTR-9. Check first whether the difference is import credit or reverse charge, which do not appear in 2B in the same way." });
  if (shortPaid > tolerance) actions.push({ tone: "bad", title: `Pay ${inr(shortPaid)} of tax reported in GSTR-1 but not paid in GSTR-3B`, detail: `Pay it ${open ? "in the next GSTR-3B or " : ""}through DRC-03 with interest at 18% a year; GSTR-9 Table 9 shows the tax paid against the tax payable.` });
  if (unreported > tolerance) actions.push({ tone: open ? "warn" : "bad", title: `${inr(unreported)} of sales in your books is not in GSTR-1`, detail: open ? `Report it through GSTR-1 before 30 November ${startYear + 1} and pay any tax with it, or explain it (advances, exempt supplies, credit notes) in GSTR-9C.` : "The date to correct GSTR-1 has passed. Pay any tax through DRC-03 and explain the difference in GSTR-9C." });
  if (Math.abs(turnoverGap) > tolerance) actions.push({ tone: "warn", title: `Turnover in books and GSTR-3B differ by ${inr(Math.abs(turnoverGap))}`, detail: "GSTR-9C reconciles audited turnover with the annual return. Typical reasons: unbilled revenue, credit notes after year end, exempt or non-GST income, and sales booked in another month." });
  if (actions.length === 0) actions.push({ tone: "good", title: "The year reconciles", detail: "Books, GSTR-1, GSTR-3B and GSTR-2B agree within the tolerance for every month." });

  return { months, totals, cutoff, daysToCutoff, unclaimedItc, excessItc, shortPaid, unreported, interest, turnoverGap, actions };
}

/** Numbers pasted from a spreadsheet: rows split on new lines, cells on tabs or commas outside numbers. */
export function parseGrid(text: string): number[][] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => l.split(/\t|;|,(?!\d{2,3}\b)/).map((c) => {
      const v = Number(c.replace(/[₹,\s]/g, "").replace(/^\((.*)\)$/, "-$1"));
      return Number.isFinite(v) ? v : 0;
    }));
}
