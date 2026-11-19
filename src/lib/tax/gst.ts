// Match GSTR-2B (what suppliers have reported) against the purchase register (what you booked),
// invoice by invoice, to find input tax credit that is at risk or unclaimed. No browser dependencies.
//
// Background checked in November 2026: credit can be taken only for invoices that appear in GSTR-2B,
// which is built from the Invoice Management System (IMS) and generated in draft on the 14th of each month.

import { parseAmount, type Table } from "./reconcile.ts";

export type GstColumns = {
  gstin: number;
  /** -1 when there is no supplier name column. */
  name: number;
  invoice: number;
  /** -1 when there is no date column. */
  date: number;
  /** -1 when there is no taxable value column. */
  taxable: number;
  /** Columns that are added together to give the credit on the invoice (IGST, CGST, SGST, cess, or one total). */
  tax: number[];
};

const GSTIN = /\b(\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d])\b/;

export function gstinOf(text: string): string | null {
  return (text ?? "").toUpperCase().replace(/\s/g, "").match(GSTIN)?.[1] ?? null;
}

/** "INV/0042/26-27" and "inv-42/26-27" both become "INV422627": case, punctuation and leading zeros are ignored. */
export function invoiceKey(text: string): string {
  return (text ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/^0+(?=\d)/, ""))
    .join("");
}

/** Only the digits, used for a looser second pass when the full keys differ. */
const digitsOf = (text: string) => invoiceKey(text).replace(/\D/g, "");

const TAX_HEAD = /(igst|cgst|sgst|utgst|integrated|central|state|union|cess|itc|input tax|total tax|tax amount)/i;
const NOT_TAX = /\b(taxable|invoice value|total value|rate|place|supply|reverse|eligib\w*|period|date|number|no)\b/i;

/** Guess the columns of a GSTR-2B or purchase register paste. -1 means not found. */
export function guessGstColumns(table: Table): GstColumns {
  const numeric = (col: number) =>
    table.rows.length > 0 && table.rows.filter((r) => parseAmount(r[col] ?? "") !== null).length >= table.rows.length * 0.6;
  const hasGstin = (col: number) =>
    table.rows.length > 0 && table.rows.filter((r) => gstinOf(r[col] ?? "")).length >= table.rows.length * 0.6;
  const headers = table.headers;
  let gstin = headers.findIndex((h, i) => /gstin|gst no|gst number/i.test(h) && hasGstin(i));
  if (gstin === -1) gstin = headers.findIndex((_, i) => hasGstin(i));
  const name = headers.findIndex((h, i) => i !== gstin && /(name|supplier|party|vendor)/i.test(h) && !/gstin|\b(no|number|date|value)\b|#/i.test(h));
  const invoice = headers.findIndex((h, i) => i !== gstin && /(invoice|bill|document|doc|voucher|ref).*(no|number|#)|^inv(oice)?$/i.test(h));
  const date = headers.findIndex((h) => /date/i.test(h));
  const taxable = headers.findIndex((h, i) => /taxable/i.test(h) && numeric(i));
  const tax = headers
    .map((h, i) => (TAX_HEAD.test(h) && !NOT_TAX.test(h) && numeric(i) ? i : -1))
    .filter((i) => i >= 0 && i !== taxable);
  return { gstin, name, invoice, date, taxable, tax };
}

export type Invoice = { gstin: string; invoice: string; key: string; date: string; taxable: number; tax: number; label: string };

function read(table: Table, cols: GstColumns): { invoices: Invoice[]; skipped: number } {
  const invoices: Invoice[] = [];
  let skipped = 0;
  for (const row of table.rows) {
    const gstin = gstinOf(row[cols.gstin] ?? "") ?? row.map(gstinOf).find(Boolean) ?? null;
    const invoice = row[cols.invoice] ?? "";
    const key = invoiceKey(invoice);
    if (!gstin || !key) { skipped++; continue; }
    const tax = cols.tax.reduce((sum, c) => sum + (parseAmount(row[c] ?? "") ?? 0), 0);
    const taxable = cols.taxable >= 0 ? parseAmount(row[cols.taxable] ?? "") ?? 0 : 0;
    const label = cols.name >= 0 ? row[cols.name] ?? "" : "";
    invoices.push({ gstin, invoice, key, date: cols.date >= 0 ? row[cols.date] ?? "" : "", taxable, tax, label });
  }
  return { invoices, skipped };
}

export type ItcStatus = "match" | "differs" | "number-differs" | "books-only" | "2b-only";

export type ItcLine = {
  status: ItcStatus;
  gstin: string;
  supplier: string;
  invoice: string;
  date: string;
  booksTax: number;
  portalTax: number;
  /** Portal minus books. */
  gap: number;
};

export type Vendor = { gstin: string; supplier: string; invoices: number; taxAtRisk: number; lines: ItcLine[] };

export type ItcResult = {
  lines: ItcLine[];
  counts: Record<ItcStatus, number>;
  totals: { books: number; portal: number };
  /** Credit in your books that GSTR-2B does not support: missing invoices plus shortfalls. */
  atRisk: number;
  /** Credit in GSTR-2B that your books do not show. */
  unclaimed: number;
  /** Suppliers to chase, largest amount first. */
  vendors: Vendor[];
  skipped: number;
};

type Bucket = Map<string, Invoice>;

function bucket(invoices: Invoice[]): Bucket {
  const map: Bucket = new Map();
  for (const inv of invoices) {
    const id = inv.gstin + "|" + inv.key;
    const found = map.get(id);
    if (found) { found.tax += inv.tax; found.taxable += inv.taxable; }
    else map.set(id, { ...inv });
  }
  return map;
}

/** Match the two sides invoice by invoice. Credit within `tolerance` rupees counts as matching. */
export function matchItc(portal: Table, pCols: GstColumns, books: Table, bCols: GstColumns, tolerance = 1): ItcResult {
  const p = read(portal, pCols);
  const b = read(books, bCols);
  const pMap = bucket(p.invoices);
  const bMap = bucket(b.invoices);
  const lines: ItcLine[] = [];
  const line = (status: ItcStatus, inv: Invoice, booksTax: number, portalTax: number, other?: Invoice): ItcLine => ({
    status,
    gstin: inv.gstin,
    supplier: inv.label || other?.label || "",
    invoice: other && other.invoice !== inv.invoice ? `${inv.invoice} / ${other.invoice}` : inv.invoice,
    date: inv.date || other?.date || "",
    booksTax,
    portalTax,
    gap: portalTax - booksTax,
  });

  // pass 1: same supplier, same invoice number
  for (const [id, bi] of bMap) {
    const pi = pMap.get(id);
    if (!pi) continue;
    lines.push(line(Math.abs(pi.tax - bi.tax) <= tolerance ? "match" : "differs", bi, bi.tax, pi.tax, pi));
    pMap.delete(id);
    bMap.delete(id);
  }
  // pass 2: same supplier and the same digits in the number with the same credit, e.g. "INV-42" against "42/26-27"
  for (const [id, bi] of bMap) {
    const digits = digitsOf(bi.invoice);
    const hit = [...pMap].find(([, pi]) => pi.gstin === bi.gstin && Math.abs(pi.tax - bi.tax) <= tolerance && digits !== "" &&
      (digitsOf(pi.invoice) === digits || digitsOf(pi.invoice).startsWith(digits) || digits.startsWith(digitsOf(pi.invoice))));
    if (!hit) continue;
    lines.push(line("number-differs", bi, bi.tax, hit[1].tax, hit[1]));
    pMap.delete(hit[0]);
    bMap.delete(id);
  }
  for (const bi of bMap.values()) lines.push(line("books-only", bi, bi.tax, 0));
  for (const pi of pMap.values()) lines.push(line("2b-only", pi, 0, pi.tax));

  const order: ItcStatus[] = ["books-only", "differs", "2b-only", "number-differs", "match"];
  lines.sort((x, y) => order.indexOf(x.status) - order.indexOf(y.status) || Math.abs(y.gap) - Math.abs(x.gap));

  const counts = { match: 0, differs: 0, "number-differs": 0, "books-only": 0, "2b-only": 0 };
  const totals = { books: 0, portal: 0 };
  let atRisk = 0;
  let unclaimed = 0;
  const vendors = new Map<string, Vendor>();
  for (const l of lines) {
    counts[l.status]++;
    totals.books += l.booksTax;
    totals.portal += l.portalTax;
    const risk = l.status === "books-only" ? l.booksTax : l.status === "differs" && l.gap < 0 ? -l.gap : 0;
    if (l.status === "2b-only") unclaimed += l.portalTax;
    else if (l.status === "differs" && l.gap > 0) unclaimed += l.gap;
    if (risk > tolerance) {
      atRisk += risk;
      const v = vendors.get(l.gstin) ?? { gstin: l.gstin, supplier: l.supplier, invoices: 0, taxAtRisk: 0, lines: [] };
      v.invoices++;
      v.taxAtRisk += risk;
      v.supplier ||= l.supplier;
      v.lines.push(l);
      vendors.set(l.gstin, v);
    }
  }
  return {
    lines,
    counts,
    totals,
    atRisk,
    unclaimed,
    vendors: [...vendors.values()].sort((x, y) => y.taxAtRisk - x.taxAtRisk),
    skipped: p.skipped + b.skipped,
  };
}

const rupees = (n: number) => "Rs " + Math.round(n).toLocaleString("en-IN");

/** A message to send a supplier whose invoices are missing from GSTR-2B or short in it. */
export function chaseMessage(v: Vendor, period: string): string {
  const rows = v.lines.map((l) =>
    l.status === "books-only"
      ? `- Invoice ${l.invoice}${l.date ? ` dated ${l.date}` : ""}: GST ${rupees(l.booksTax)}, not reported`
      : `- Invoice ${l.invoice}${l.date ? ` dated ${l.date}` : ""}: GST ${rupees(l.booksTax)} in our books, ${rupees(l.portalTax)} reported`,
  );
  return [
    `Dear ${v.supplier || "Sir/Madam"},`,
    "",
    `While reconciling our GSTR-2B${period ? ` for ${period}` : ""}, we found that the following invoices from your GSTIN ${v.gstin} are not reported, or are reported with a different amount, in your GSTR-1:`,
    "",
    ...rows,
    "",
    `Total GST affected: ${rupees(v.taxAtRisk)}.`,
    "",
    "We cannot take credit for these until they appear in our GSTR-2B. Please report or correct them in your next GSTR-1 or IFF (or through GSTR-1A for the current period) and confirm once done.",
    "",
    "Thank you.",
  ].join("\n");
}

export function itcCsv(result: ItcResult): string {
  const quote = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ["Status", "Supplier GSTIN", "Supplier", "Invoice", "Date", "GST in books", "GST in GSTR-2B", "Gap (2B minus books)"];
  const body = result.lines.map((l) => [l.status, l.gstin, l.supplier, l.invoice, l.date, l.booksTax, l.portalTax, l.gap].map(quote).join(","));
  return [head.map(quote).join(","), ...body].join("\r\n");
}
