// Reconcile a tax statement (AIS or Form 26AS figures) against your own records.
// Works on any two tables that share a party column and an amount column. No browser dependencies.

export type Table = { headers: string[]; rows: string[][] };

/** Parse pasted spreadsheet cells (tab-separated) or CSV text, with quoted fields. */
export function parseTable(text: string): Table {
  const clean = text.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "").trim();
  if (!clean) return { headers: [], rows: [] };
  const firstLine = clean.split("\n")[0];
  const sep = firstLine.includes("\t") ? "\t" : firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n") { row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  row.push(cell.trim());
  rows.push(row);
  const filled = rows.filter((r) => r.some((c) => c !== ""));
  const [headers = [], ...body] = filled;
  return { headers, rows: body };
}

/** "1,23,456.50", "₹ 1,200", "(500)" and "500 Dr" all become numbers; anything else is null. */
export function parseAmount(text: string): number | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  const negative = /^\(.*\)$/.test(t) || /^-/.test(t);
  const digits = t.replace(/^[(-]|\)$/g, "").replace(/₹|rs\.?|inr|,|\s|(dr|cr)\.?$/gi, "");
  if (!/^\d+(\.\d+)?$/.test(digits)) return null;
  const n = Number(digits);
  return negative ? -n : n;
}

const PARTY = /\b(tan|pan|deductor|party|name|payer|source|description|particulars|company|bank|scrip)\b/i;
const TAX = /\b(tds|tcs|tax deducted|tax collected|tax)\b/i;
const AMOUNT = /\b(amount|paid|credited|gross|income|value|receipt|interest|dividend)\b/i;

export type Columns = { party: number; amount: number; tax: number };

/** Guess which columns hold the party, the amount and the tax deducted. -1 means not found. */
export function guessColumns(table: Table): Columns {
  const numeric = (col: number) =>
    table.rows.length > 0 && table.rows.filter((r) => parseAmount(r[col] ?? "") !== null).length >= table.rows.length * 0.6;
  const find = (pattern: RegExp, wantNumeric: boolean, skip: number[] = []) =>
    table.headers.findIndex((h, i) => !skip.includes(i) && pattern.test(h) && numeric(i) === wantNumeric);
  let party = find(PARTY, false);
  if (party === -1) party = table.headers.findIndex((_, i) => !numeric(i));
  const tax = find(TAX, true);
  let amount = find(AMOUNT, true, [tax]);
  if (amount === -1) amount = table.headers.findIndex((_, i) => i !== tax && numeric(i));
  return { party, amount, tax };
}

const ID = /\b([A-Z]{4}[0-9]{5}[A-Z]|[A-Z]{5}[0-9]{4}[A-Z])\b/;

/** The TAN or PAN in a piece of text, if it has one. */
export function partyId(text: string): string | null {
  return (text ?? "").toUpperCase().match(ID)?.[1] ?? null;
}

/** A name without its TAN or PAN, punctuation and company suffixes, so two spellings of one party agree. */
export function partyName(text: string): string {
  return (text ?? "")
    .toUpperCase()
    .replace(ID, " ")
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\b(PRIVATE|PVT|LIMITED|LTD|LLP|INDIA|THE|CO|COMPANY|CORPORATION|CORP|INC)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type Status = "match" | "differs" | "statement-only" | "records-only";

export type Line = {
  key: string;
  label: string;
  status: Status;
  statementAmount: number;
  recordsAmount: number;
  statementTax: number;
  recordsTax: number;
  /** Statement minus records. */
  amountGap: number;
  taxGap: number;
};

export type Result = {
  lines: Line[];
  counts: Record<Status, number>;
  totals: { statementAmount: number; recordsAmount: number; statementTax: number; recordsTax: number };
  skipped: number;
};

type Entry = { id: string | null; name: string; label: string; amount: number; tax: number };
type Side = Map<string, { label: string; amount: number; tax: number }>;

function read(table: Table, cols: Columns): { entries: Entry[]; skipped: number } {
  const entries: Entry[] = [];
  let skipped = 0;
  for (const row of table.rows) {
    const label = row[cols.party] ?? "";
    const amount = parseAmount(row[cols.amount] ?? "");
    // a TAN or PAN anywhere on the row identifies the party, whichever column it sits in
    const id = partyId(label) ?? row.map(partyId).find(Boolean) ?? null;
    const name = partyName(label);
    // total and sub-total lines in a pasted statement are not entries
    if ((!id && !name) || amount === null || /^(GRAND |SUB )?TOTAL\b/.test(name)) { skipped++; continue; }
    const tax = cols.tax >= 0 ? parseAmount(row[cols.tax] ?? "") ?? 0 : 0;
    entries.push({ id, name, label, amount, tax });
  }
  return { entries, skipped };
}

function total(entries: Entry[], idOf: Map<string, string>): Side {
  const side: Side = new Map();
  for (const e of entries) {
    const key = e.id ?? idOf.get(e.name) ?? e.name;
    const entry = side.get(key) ?? { label: e.label, amount: 0, tax: 0 };
    entry.amount += e.amount;
    entry.tax += e.tax;
    side.set(key, entry);
  }
  return side;
}

/** Compare the two tables party by party. Amounts within `tolerance` rupees count as matching. */
export function reconcile(statement: Table, sCols: Columns, records: Table, rCols: Columns, tolerance = 1): Result {
  const s = read(statement, sCols);
  const r = read(records, rCols);
  // where one side gives only a name, use the TAN or PAN the other side gives for that name
  const idOf = new Map<string, string>();
  for (const e of [...s.entries, ...r.entries]) if (e.id && e.name) idOf.set(e.name, e.id);
  const sSide = total(s.entries, idOf);
  const rSide = total(r.entries, idOf);
  const keys = new Set([...sSide.keys(), ...rSide.keys()]);
  const lines: Line[] = [];
  for (const key of keys) {
    const a = sSide.get(key);
    const b = rSide.get(key);
    const amountGap = (a?.amount ?? 0) - (b?.amount ?? 0);
    const taxGap = (a?.tax ?? 0) - (b?.tax ?? 0);
    const status: Status = !b
      ? "statement-only"
      : !a
        ? "records-only"
        : Math.abs(amountGap) <= tolerance && Math.abs(taxGap) <= tolerance
          ? "match"
          : "differs";
    lines.push({
      key,
      label: a?.label || b?.label || key,
      status,
      statementAmount: a?.amount ?? 0,
      recordsAmount: b?.amount ?? 0,
      statementTax: a?.tax ?? 0,
      recordsTax: b?.tax ?? 0,
      amountGap,
      taxGap,
    });
  }
  const order: Status[] = ["differs", "statement-only", "records-only", "match"];
  lines.sort((x, y) => order.indexOf(x.status) - order.indexOf(y.status) || Math.abs(y.amountGap) - Math.abs(x.amountGap));
  const counts = { match: 0, differs: 0, "statement-only": 0, "records-only": 0 };
  const totals = { statementAmount: 0, recordsAmount: 0, statementTax: 0, recordsTax: 0 };
  for (const line of lines) {
    counts[line.status]++;
    totals.statementAmount += line.statementAmount;
    totals.recordsAmount += line.recordsAmount;
    totals.statementTax += line.statementTax;
    totals.recordsTax += line.recordsTax;
  }
  return { lines, counts, totals, skipped: s.skipped + r.skipped };
}

export function toCsv(result: Result): string {
  const quote = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ["Party", "Status", "Amount per statement", "Amount per records", "Amount gap", "Tax per statement", "Tax per records", "Tax gap"];
  const body = result.lines.map((l) =>
    [l.label, l.status, l.statementAmount, l.recordsAmount, l.amountGap, l.statementTax, l.recordsTax, l.taxGap].map(quote).join(","),
  );
  return [head.map(quote).join(","), ...body].join("\r\n");
}
