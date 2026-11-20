// Payments to micro and small enterprises: which unpaid or late bills lose their deduction for the tax year.
// No browser dependencies.
//
// Sources checked in November 2026:
// - Section 37(2)(g) of the Income-tax Act, 2025 (section 43B(h) of the 1961 Act): a sum payable to a micro or
//   small enterprise beyond the time limit in section 15 of the MSMED Act, 2006 is deductible only in the year
//   it is actually paid. Unlike the other clauses, paying before the return due date does not save it.
// - Section 15, MSMED Act: pay by the agreed date, which cannot be more than 45 days from acceptance; with no
//   written agreement, within 15 days of acceptance. Medium enterprises and traders are outside the rule.
// - Section 16, MSMED Act: a late payer owes interest at three times the bank rate with monthly rests, and under
//   section 23 that interest is never deductible.

import { parseAmount, type Table } from "./reconcile.ts";

export const MSME_RULES = {
  noAgreementDays: 15,
  maxAgreedDays: 45,
  section: "section 37(2)(g) of the Income-tax Act, 2025",
  oldSection: "section 43B(h) of the 1961 Act",
} as const;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const iso = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
};
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

/** Dates as Indian records write them: 05/04/2026, 5-4-26, 05.04.2026, 5 Apr 2026, 05-Apr-26, 2026-04-05, or an Excel serial. */
export function parseDate(text: string): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) return iso(fullYear(+m[3]), +m[2], +m[1]);
  m = t.match(/^(\d{1,2})[\s/.-]*([a-z]{3})[a-z]*[\s/.,-]*(\d{2}|\d{4})$/i);
  if (m) {
    const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    return month ? iso(fullYear(+m[3]), month, +m[1]) : null;
  }
  if (/^\d{5}$/.test(t)) {
    const serial = Number(t);
    if (serial > 30_000 && serial < 70_000) return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
  }
  return null;
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type Category = "micro" | "small" | "medium" | "trader" | "none" | "unknown";

export function categoryOf(text: string): Category {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return "unknown";
  if (/trad/.test(t)) return "trader";
  if (/micro/.test(t)) return "micro";
  if (/small/.test(t)) return "small";
  if (/medium/.test(t)) return "medium";
  if (/^(no|non|not|n\/a|na|-|large)\b/.test(t)) return "none";
  return "unknown";
}

export type MsmeColumns = {
  supplier: number;
  /** Date the goods or services were accepted; the invoice date if that is all the records hold. */
  accepted: number;
  amount: number;
  /** -1 when there is no column; every row is then treated as covered or not by the `unlabelled` setting. */
  category: number;
  /** -1 when there is no column; the default agreement then applies. */
  agreedDays: number;
  /** -1 when there is no column; every bill is then treated as unpaid. */
  paid: number;
};

export function guessMsmeColumns(table: Table): MsmeColumns {
  const find = (pattern: RegExp, skip: number[] = []) => table.headers.findIndex((h, i) => !skip.includes(i) && pattern.test(h));
  const paid = find(/pa(id|yment).*date|date.*pa(id|yment)|paid on|settled/i);
  const acceptance = find(/accept|receipt date|grn|delivery/i, [paid]);
  const accepted = acceptance >= 0 ? acceptance : find(/(invoice|bill).*date|^date$/i, [paid]);
  const agreedDays = find(/credit|terms|agreed|days/i);
  const category = find(/categor|msme|udyam|type|class/i);
  const supplier = find(/supplier|vendor|party|name|creditor/i, [category]);
  const amount = table.headers.findIndex((h, i) => i !== agreedDays && /amount|value|outstanding|payable|total/i.test(h) &&
    table.rows.filter((r) => parseAmount(r[i] ?? "") !== null).length >= table.rows.length * 0.6);
  return { supplier, accepted, amount, category, agreedDays, paid };
}

export type MsmeSettings = {
  /** Last day of the tax year being checked: 31 March. */
  yearEnd: string;
  /** The date the check is made for; normally today. */
  asOf: string;
  /** Days agreed in writing when a row does not say; 0 means no written agreement. */
  defaultAgreedDays: number;
  /** How to treat rows with no category: as micro or small (covered), or as outside the rule. */
  unlabelled: "covered" | "not-covered";
};

export type MsmeStatus = "disallowed" | "overdue" | "upcoming" | "late-paid" | "on-time" | "not-covered" | "other-year";

export type Bill = {
  supplier: string;
  category: Category;
  accepted: string;
  amount: number;
  limitDays: number;
  due: string;
  paid: string | null;
  status: MsmeStatus;
  /** Days paid or outstanding beyond the due date, as of the check date. */
  daysLate: number;
};

export type MsmeResult = {
  bills: Bill[];
  counts: Record<MsmeStatus, number>;
  /** Deduction lost for the year: the expense moves to the year it is paid. */
  disallowed: number;
  /** Already past the due date and unpaid; paying before the year ends keeps the deduction in this year. */
  overdue: number;
  /** Not yet due. */
  upcoming: number;
  /** Paid late but within the year: deductible, but MSMED interest is owed and is not deductible. */
  latePaid: number;
  skipped: number;
};

const dayCount = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/** The last date to pay without losing the deduction: 15 days with no written agreement, else the agreed days up to 45. */
export function dueDate(accepted: string, agreedDays: number): { due: string; limitDays: number } {
  const limitDays = agreedDays > 0 ? Math.min(agreedDays, MSME_RULES.maxAgreedDays) : MSME_RULES.noAgreementDays;
  return { due: addDays(accepted, limitDays), limitDays };
}

export function checkBill(b: { accepted: string; paid: string | null; category: Category; agreedDays: number }, s: MsmeSettings): { status: MsmeStatus; due: string; limitDays: number; daysLate: number } {
  const { due, limitDays } = dueDate(b.accepted, b.agreedDays);
  const covered = b.category === "micro" || b.category === "small" || (b.category === "unknown" && s.unlabelled === "covered");
  // tax years run 1 April to 31 March
  const yearStart = `${Number(s.yearEnd.slice(0, 4)) - 1}-04-01`;
  const lateBy = (on: string) => Math.max(0, dayCount(due, on));
  if (!covered) return { status: "not-covered", due, limitDays, daysLate: 0 };
  if (b.accepted > s.yearEnd || b.accepted < yearStart) return { status: "other-year", due, limitDays, daysLate: 0 };
  if (b.paid) {
    if (b.paid <= due) return { status: "on-time", due, limitDays, daysLate: 0 };
    return { status: b.paid > s.yearEnd ? "disallowed" : "late-paid", due, limitDays, daysLate: lateBy(b.paid) };
  }
  if (s.asOf <= due) return { status: "upcoming", due, limitDays, daysLate: 0 };
  return { status: s.asOf > s.yearEnd ? "disallowed" : "overdue", due, limitDays, daysLate: lateBy(s.asOf) };
}

export function checkMsme(table: Table, cols: MsmeColumns, s: MsmeSettings): MsmeResult {
  const bills: Bill[] = [];
  let skipped = 0;
  for (const row of table.rows) {
    const accepted = parseDate(row[cols.accepted] ?? "");
    const amount = parseAmount(row[cols.amount] ?? "");
    if (!accepted || amount === null || amount <= 0) { skipped++; continue; }
    const category = cols.category >= 0 ? categoryOf(row[cols.category] ?? "") : "unknown";
    const agreed = cols.agreedDays >= 0 ? parseAmount(row[cols.agreedDays] ?? "") : null;
    const paid = cols.paid >= 0 ? parseDate(row[cols.paid] ?? "") : null;
    const r = checkBill({ accepted, paid, category, agreedDays: agreed ?? s.defaultAgreedDays }, s);
    bills.push({ supplier: row[cols.supplier] ?? "", category, accepted, amount, paid, ...r });
  }
  const order: MsmeStatus[] = ["disallowed", "overdue", "upcoming", "late-paid", "on-time", "not-covered", "other-year"];
  bills.sort((x, y) => order.indexOf(x.status) - order.indexOf(y.status) || (x.status === "upcoming" ? x.due.localeCompare(y.due) : y.amount - x.amount));
  const counts = { disallowed: 0, overdue: 0, upcoming: 0, "late-paid": 0, "on-time": 0, "not-covered": 0, "other-year": 0 };
  const sum = { disallowed: 0, overdue: 0, upcoming: 0, latePaid: 0 };
  for (const b of bills) {
    counts[b.status]++;
    if (b.status === "disallowed") sum.disallowed += b.amount;
    if (b.status === "overdue") sum.overdue += b.amount;
    if (b.status === "upcoming") sum.upcoming += b.amount;
    if (b.status === "late-paid") sum.latePaid += b.amount;
  }
  return { bills, counts, ...sum, skipped };
}

export function msmeCsv(result: MsmeResult): string {
  const quote = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Supplier", "Category", "Accepted on", "Amount", "Days allowed", "Pay by", "Paid on", "Status", "Days late"];
  const body = result.bills.map((b) => [b.supplier, b.category, b.accepted, b.amount, b.limitDays, b.due, b.paid, b.status, b.daysLate].map(quote).join(","));
  return [head.map(quote).join(","), ...body].join("\r\n");
}
