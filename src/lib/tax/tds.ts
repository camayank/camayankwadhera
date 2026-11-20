// Read an expense ledger and find payments that needed TDS under the Income-tax Act, 2025, the shortfall,
// and the interest on it. No browser dependencies.
//
// Sources checked in November 2026 (rates and thresholds from the Finance Act, 2025, unchanged by the
// Finance Act, 2026 and carried into the table in section 393(1) of the 2025 Act):
// - Contractors (old 194C): 1% to an individual or HUF, 2% to others, once a single payment exceeds ₹30,000
//   or the year's payments exceed ₹1,00,000.
// - Professional fees (old 194J): 10% above ₹50,000 a year; technical services 2% above ₹50,000;
//   a director's fees or commission 10% with no threshold.
// - Commission or brokerage (old 194H): 2% above ₹20,000 a year.
// - Rent (old 194-I): 10% for land, building or furniture, 2% for plant or machinery, above ₹50,000 a month.
// - Interest other than on securities, paid by anyone other than a bank (old 194A): 10% above ₹10,000 a year.
// - No PAN (old 206AA): at least 20%.
// - Section 398 (old 201(1A)): interest at 1% a month or part of a month from the date tax was deductible
//   to the date it is deducted, and 1.5% from deduction to payment.
// - Section 35 (old 40(a)(ia)): 30% of the expense is disallowed if the tax is not deducted, or not paid by
//   the due date of the return.

import { parseAmount, type Table } from "./reconcile.ts";
import { parseDate } from "./msme.ts";

export type Nature = "contract" | "professional" | "technical" | "director" | "commission" | "rent-building" | "rent-machinery" | "interest" | "none";

type Rule = { label: string; old: string; sl: string; rate: (individual: boolean) => number; basis: "year" | "contract" | "month" | "always"; threshold: number };

export const TDS_RULES: Record<Exclude<Nature, "none">, Rule> = {
  contract: { label: "Contractor", old: "194C", sl: "6(i)", rate: (ind) => (ind ? 0.01 : 0.02), basis: "contract", threshold: 100_000 },
  professional: { label: "Professional fees", old: "194J", sl: "6(iii)", rate: () => 0.1, basis: "year", threshold: 50_000 },
  technical: { label: "Technical services", old: "194J", sl: "6(iii)", rate: () => 0.02, basis: "year", threshold: 50_000 },
  director: { label: "Director's fees or commission", old: "194J", sl: "6(iii)", rate: () => 0.1, basis: "always", threshold: 0 },
  commission: { label: "Commission or brokerage", old: "194H", sl: "1(ii)", rate: () => 0.02, basis: "year", threshold: 20_000 },
  "rent-building": { label: "Rent of land, building or furniture", old: "194-I", sl: "2(ii)", rate: () => 0.1, basis: "month", threshold: 50_000 },
  "rent-machinery": { label: "Rent of plant or machinery", old: "194-I", sl: "2(ii)", rate: () => 0.02, basis: "month", threshold: 50_000 },
  interest: { label: "Interest (not from a bank)", old: "194A", sl: "5(iii)", rate: () => 0.1, basis: "year", threshold: 10_000 },
};

/** A single contract payment above this needs TDS even when the year's total is lower. */
export const CONTRACT_SINGLE = 30_000;
export const NO_PAN_RATE = 0.2;
export const INTEREST_NOT_DEDUCTED = 0.01;
export const DISALLOWED_SHARE = 0.3;

// order matters: the first match wins, so the narrower words come first
const WORDS: [Nature, RegExp][] = [
  ["director", /director|sitting fee/i],
  ["interest", /interest/i],
  ["rent-machinery", /(machine|equipment|plant|crane|generator|dg set).*(rent|hire|lease)|(rent|hire|lease).*(machine|equipment|plant|crane|generator)/i],
  ["rent-building", /\brent|lease rent|office rent|godown|warehouse rent|premises/i],
  ["commission", /commission|brokerage|incentive to agent/i],
  ["technical", /technical (service|fee|support)|call cent/i],
  ["professional", /professional|consult|legal|advocate|lawyer|audit fee|ca fee|chartered|retainer|architect|doctor|medical fee|design fee|valuation fee/i],
  ["contract", /contract|labou?r|job ?work|printing|freight|transport|cartage|courier|catering|advertis|repair|maintenance|amc|manpower|security|housekeeping|cleaning|carriage|event|fabricat|installation/i],
];

export function natureOf(text: string): Nature {
  for (const [nature, re] of WORDS) if (re.test(text ?? "")) return nature;
  return "none";
}

/** The fourth character of a PAN gives the holder's status: P is an individual, H a HUF. */
export function panStatus(pan: string): "individual" | "other" | "invalid" {
  const p = (pan ?? "").toUpperCase().replace(/\s/g, "");
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(p)) return "invalid";
  return p[3] === "P" || p[3] === "H" ? "individual" : "other";
}

export type TdsColumns = {
  party: number;
  /** -1 when the ledger has no PAN column. */
  pan: number;
  /** The ledger head or narration that says what the payment was for. */
  head: number;
  date: number;
  amount: number;
  /** -1 when there is no column; nothing is then treated as deducted. */
  deducted: number;
};

export function guessTdsColumns(table: Table): TdsColumns {
  const find = (re: RegExp, skip: number[] = []) => table.headers.findIndex((h, i) => !skip.includes(i) && re.test(h));
  const numeric = (i: number) => table.rows.filter((r) => parseAmount(r[i] ?? "") !== null).length >= table.rows.length * 0.6;
  const deducted = find(/tds|deducted|withheld/i);
  const pan = find(/\bpan\b/i);
  const head = find(/ledger|head|nature|account|expense|narration|particular|description/i, [pan]);
  const party = find(/party|vendor|payee|supplier|name|creditor/i, [head, pan]);
  const date = find(/date/i);
  const amount = table.headers.findIndex((h, i) => i !== deducted && /amount|value|debit|paid|total|gross/i.test(h) && numeric(i));
  return { party, pan, head, date, amount, deducted };
}

export type TdsSettings = { asOf: string; /** Treat payees with no PAN column entry as having no PAN. */ panColumnMeansMissing: boolean };

export type Payment = {
  party: string;
  pan: string;
  head: string;
  date: string;
  amount: number;
  deducted: number;
  nature: Nature;
};

export type TdsLine = Payment & {
  /** Whether this payment falls within the threshold for this payee. */
  liable: boolean;
  rate: number;
  required: number;
  shortfall: number;
  months: number;
  interest: number;
  reason: string;
};

export type PayeeSummary = { key: string; party: string; pan: string; nature: Nature; total: number; required: number; shortfall: number; interest: number; payments: number };

export type TdsResult = {
  lines: TdsLine[];
  payees: PayeeSummary[];
  shortfall: number;
  interest: number;
  /** 30% of the expenses on which no tax at all was deducted. */
  disallowance: number;
  unclassified: number;
  skipped: number;
};

/** Calendar months from the month of `from` to the month of `to`, both counted, a part month as a whole one. */
export function monthsOrPart(from: string, to: string): number {
  if (to < from) return 0;
  const a = Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7));
  const b = Number(to.slice(0, 4)) * 12 + Number(to.slice(5, 7));
  return b - a + 1;
}

export function readPayments(table: Table, cols: TdsColumns, natures: Record<string, Nature>): { payments: Payment[]; skipped: number } {
  const payments: Payment[] = [];
  let skipped = 0;
  for (const row of table.rows) {
    const date = parseDate(row[cols.date] ?? "");
    const amount = parseAmount(row[cols.amount] ?? "");
    if (!date || amount === null || amount <= 0) { skipped++; continue; }
    const head = row[cols.head] ?? "";
    payments.push({
      party: (row[cols.party] ?? "").trim(),
      pan: cols.pan >= 0 ? (row[cols.pan] ?? "").trim().toUpperCase() : "",
      head,
      date,
      amount,
      deducted: cols.deducted >= 0 ? parseAmount(row[cols.deducted] ?? "") ?? 0 : 0,
      nature: natures[head.trim()] ?? natureOf(head),
    });
  }
  return { payments, skipped };
}

/** Distinct ledger heads with the nature each was matched to, for the visitor to correct. */
export function headsOf(table: Table, cols: TdsColumns): { head: string; nature: Nature; count: number }[] {
  const map = new Map<string, { head: string; nature: Nature; count: number }>();
  for (const row of table.rows) {
    const head = (row[cols.head] ?? "").trim();
    if (!head) continue;
    const found = map.get(head) ?? { head, nature: natureOf(head), count: 0 };
    found.count++;
    map.set(head, found);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function checkTds(payments: Payment[], s: TdsSettings): TdsResult {
  const lines: TdsLine[] = [];
  let unclassified = 0;
  // group by payee and nature: thresholds count per payee, per kind of payment, per year
  const groups = new Map<string, Payment[]>();
  for (const p of payments) {
    if (p.nature === "none") { unclassified++; continue; }
    const key = `${p.pan || p.party.toLowerCase().replace(/[^a-z0-9]/g, "")}|${p.nature}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const payees: PayeeSummary[] = [];
  for (const [key, list] of groups) {
    const rule = TDS_RULES[list[0].nature as Exclude<Nature, "none">];
    const total = list.reduce((sum, p) => sum + p.amount, 0);
    const byMonth = new Map<string, number>();
    for (const p of list) byMonth.set(p.date.slice(0, 7), (byMonth.get(p.date.slice(0, 7)) ?? 0) + p.amount);
    const summary: PayeeSummary = { key, party: list[0].party, pan: list[0].pan, nature: list[0].nature, total, required: 0, shortfall: 0, interest: 0, payments: list.length };
    for (const p of list) {
      const status = panStatus(p.pan);
      const noPan = s.panColumnMeansMissing && status === "invalid";
      let liable: boolean;
      let reason: string;
      if (rule.basis === "always") { liable = true; reason = "No threshold"; }
      else if (rule.basis === "month") {
        const month = byMonth.get(p.date.slice(0, 7)) ?? 0;
        liable = month > rule.threshold;
        reason = liable ? `Rent for the month is above ₹${rule.threshold.toLocaleString("en-IN")}` : "Within the monthly threshold";
      } else if (rule.basis === "contract") {
        liable = total > rule.threshold || p.amount > CONTRACT_SINGLE;
        reason = total > rule.threshold ? "Year's payments above ₹1,00,000" : p.amount > CONTRACT_SINGLE ? "Single payment above ₹30,000" : "Within the threshold";
      } else {
        liable = total > rule.threshold;
        reason = liable ? `Year's payments above ₹${rule.threshold.toLocaleString("en-IN")}` : "Within the threshold";
      }
      const base = rule.rate(status === "individual");
      const rate = noPan ? Math.max(base, NO_PAN_RATE) : base;
      const required = liable ? Math.round(p.amount * rate) : 0;
      const shortfall = Math.max(0, required - p.deducted);
      const months = shortfall > 0 ? monthsOrPart(p.date, s.asOf) : 0;
      const interest = Math.round(shortfall * INTEREST_NOT_DEDUCTED * months);
      if (noPan && liable) reason += "; no valid PAN, so 20%";
      lines.push({ ...p, liable, rate, required, shortfall, months, interest, reason });
      summary.required += required;
      summary.shortfall += shortfall;
      summary.interest += interest;
    }
    payees.push(summary);
  }
  lines.sort((a, b) => b.shortfall - a.shortfall || a.date.localeCompare(b.date));
  payees.sort((a, b) => b.shortfall - a.shortfall || b.total - a.total);
  const shortfall = lines.reduce((sum, l) => sum + l.shortfall, 0);
  const interest = lines.reduce((sum, l) => sum + l.interest, 0);
  const disallowance = Math.round(lines.filter((l) => l.liable && l.required > 0 && l.deducted === 0).reduce((sum, l) => sum + l.amount, 0) * DISALLOWED_SHARE);
  return { lines, payees, shortfall, interest, disallowance, unclassified, skipped: 0 };
}

export function tdsCsv(result: TdsResult): string {
  const quote = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ["Party", "PAN", "Ledger head", "Nature", "Old section", "Date", "Amount", "Rate", "TDS required", "TDS deducted", "Shortfall", "Months", "Interest at 1%", "Why"];
  const body = result.lines.map((l) => {
    const rule = l.nature === "none" ? null : TDS_RULES[l.nature];
    return [l.party, l.pan, l.head, rule?.label ?? "", rule?.old ?? "", l.date, l.amount, `${(l.rate * 100).toFixed(1)}%`, l.required, l.deducted, l.shortfall, l.months, l.interest, l.reason].map(quote).join(",");
  });
  return [head.map(quote).join(","), ...body].join("\r\n");
}
