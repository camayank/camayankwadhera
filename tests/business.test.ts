// Hand-worked cases for the GST credit match, the MSME payment check and the compliance calendar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTable } from "../src/lib/tax/reconcile.ts";
import { chaseMessage, gstinOf, guessGstColumns, invoiceKey, matchItc } from "../src/lib/tax/gst.ts";
import { categoryOf, checkBill, checkMsme, dueDate, guessMsmeColumns, parseDate, type MsmeSettings } from "../src/lib/tax/msme.ts";
import { complianceDates, DEFAULT_BUSINESS, yearAfter } from "../src/lib/tax/compliance.ts";
import { toIcs } from "../src/lib/tax/calendar.ts";

// ---------- GST ----------

test("GSTINs and invoice numbers are read the way suppliers write them", () => {
  assert.equal(gstinOf("06AABCN1234F1Z5"), "06AABCN1234F1Z5");
  assert.equal(gstinOf("gstin: 27aaacz9876q1zx"), "27AAACZ9876Q1ZX");
  assert.equal(gstinOf("06AABCN1234F1"), null);
  assert.equal(invoiceKey("INV/0042/26-27"), invoiceKey("inv-42/26-27"));
  assert.notEqual(invoiceKey("INV-42"), invoiceKey("INV-420"));
});

const PORTAL = `GSTIN of supplier\tTrade/Legal name\tInvoice number\tInvoice Date\tTaxable Value\tIntegrated Tax\tCentral Tax\tState/UT Tax
06AABCN1234F1Z5\tNorthwind Traders\tNW/0101/26-27\t05-10-2026\t1,00,000\t0\t9,000\t9,000
06AABCN1234F1Z5\tNorthwind Traders\tNW/0102/26-27\t12-10-2026\t50,000\t0\t4,500\t4,500
27AAACZ9876Q1ZX\tZeta Supplies\t42/26-27\t20-10-2026\t2,00,000\t36,000\t0\t0
29AAFCL5555K1Z2\tLakeside Services\tLS-9\t28-10-2026\t10,000\t1,800\t0\t0`;

const BOOKS = `Supplier\tGSTIN\tBill No\tBill Date\tTaxable\tIGST\tCGST\tSGST
Northwind Traders Pvt Ltd\t06AABCN1234F1Z5\tNW/101/26-27\t05/10/2026\t100000\t0\t9000\t9000
Northwind Traders Pvt Ltd\t06AABCN1234F1Z5\tNW/102/26-27\t12/10/2026\t50000\t0\t4000\t4000
Zeta Supplies\t27AAACZ9876Q1ZX\tZS-42\t20/10/2026\t200000\t36000\t0\t0
Orbit Packaging\t07AAGCO3333M1Z9\tOP/77\t30/10/2026\t40000\t0\t3600\t3600`;

test("GST columns are found in a GSTR-2B and a purchase register", () => {
  const portal = parseTable(PORTAL);
  assert.deepEqual(guessGstColumns(portal), { gstin: 0, name: 1, invoice: 2, date: 3, taxable: 4, tax: [5, 6, 7] });
  const books = parseTable(BOOKS);
  assert.deepEqual(guessGstColumns(books), { gstin: 1, name: 0, invoice: 2, date: 3, taxable: 4, tax: [5, 6, 7] });
});

test("credit is matched invoice by invoice, and missing or short invoices are put at risk", () => {
  const portal = parseTable(PORTAL);
  const books = parseTable(BOOKS);
  const r = matchItc(portal, guessGstColumns(portal), books, guessGstColumns(books));
  assert.deepEqual(r.counts, { match: 1, differs: 1, "number-differs": 1, "books-only": 1, "2b-only": 1 });
  // Northwind 102: books 8,000, portal 9,000, so 1,000 more is available; Orbit 7,200 is missing from 2B
  assert.equal(r.atRisk, 7_200);
  assert.equal(r.unclaimed, 1_000 + 1_800);
  assert.equal(r.totals.books, 18_000 + 8_000 + 36_000 + 7_200);
  assert.equal(r.vendors.length, 1);
  assert.equal(r.vendors[0].gstin, "07AAGCO3333M1Z9");
  const msg = chaseMessage(r.vendors[0], "October 2026");
  assert.match(msg, /OP\/77/);
  assert.match(msg, /Rs 7,200/);
});

test("a shortfall in GSTR-2B is credit at risk", () => {
  const portal = parseTable("GSTIN\tInvoice No\tIGST\n06AABCN1234F1Z5\tA1\t500");
  const books = parseTable("GSTIN\tInvoice No\tIGST\n06AABCN1234F1Z5\tA1\t800");
  const r = matchItc(portal, guessGstColumns(portal), books, guessGstColumns(books));
  assert.equal(r.counts.differs, 1);
  assert.equal(r.atRisk, 300);
  assert.equal(r.vendors[0].taxAtRisk, 300);
});

// ---------- MSME ----------

test("dates in Indian formats", () => {
  assert.equal(parseDate("05/04/2026"), "2026-04-05");
  assert.equal(parseDate("5-4-26"), "2026-04-05");
  assert.equal(parseDate("05.04.2026"), "2026-04-05");
  assert.equal(parseDate("5 Apr 2026"), "2026-04-05");
  assert.equal(parseDate("05-Apr-26"), "2026-04-05");
  assert.equal(parseDate("2026-04-05"), "2026-04-05");
  assert.equal(parseDate("46117"), "2026-04-05");
  assert.equal(parseDate("31/02/2026"), null);
  assert.equal(parseDate("pending"), null);
});

test("15 days with no written agreement, the agreed days up to 45 otherwise", () => {
  assert.deepEqual(dueDate("2026-04-01", 0), { due: "2026-04-16", limitDays: 15 });
  assert.deepEqual(dueDate("2026-04-01", 30), { due: "2026-05-01", limitDays: 30 });
  assert.deepEqual(dueDate("2026-04-01", 90), { due: "2026-05-16", limitDays: 45 });
  assert.equal(categoryOf("Micro"), "micro");
  assert.equal(categoryOf("Udyam - Small"), "small");
  assert.equal(categoryOf("Medium"), "medium");
  assert.equal(categoryOf("Micro (Trader)"), "trader");
  assert.equal(categoryOf("Non-MSME"), "none");
});

const settings: MsmeSettings = { yearEnd: "2027-03-31", asOf: "2026-11-20", defaultAgreedDays: 0, unlabelled: "covered" };

test("each bill gets a status for the year", () => {
  const bill = (accepted: string, paid: string | null, category: "micro" | "medium" = "micro", agreedDays = 45) =>
    checkBill({ accepted, paid, category, agreedDays }, settings).status;
  assert.equal(bill("2026-06-01", "2026-07-10"), "on-time");
  assert.equal(bill("2026-06-01", "2026-08-01"), "late-paid");
  assert.equal(bill("2026-09-01", null), "overdue");
  assert.equal(bill("2026-11-01", null), "upcoming");
  assert.equal(bill("2026-09-01", null, "medium"), "not-covered");
  assert.equal(bill("2026-03-10", null), "other-year");
  // after the year has ended, an unpaid bill past its date loses the deduction for the year
  const after = { ...settings, asOf: "2027-05-01" };
  assert.equal(checkBill({ accepted: "2027-03-10", paid: null, category: "small", agreedDays: 45 }, after).status, "disallowed");
  assert.equal(checkBill({ accepted: "2027-03-10", paid: "2027-04-20", category: "small", agreedDays: 45 }, after).status, "on-time");
  assert.equal(checkBill({ accepted: "2027-02-01", paid: "2027-04-20", category: "small", agreedDays: 45 }, after).status, "disallowed");
});

test("the payables list is totalled by status", () => {
  const table = parseTable(`Supplier\tMSME category\tInvoice date\tCredit days\tAmount\tPaid on
Asha Castings\tMicro\t01/06/2026\t45\t2,00,000\t10/07/2026
Bharat Tools\tSmall\t01/09/2026\t30\t1,50,000\t
Chitra Prints\tMicro\t10/11/2026\t\t40,000\t
Delta Steel\tMedium\t01/05/2026\t60\t5,00,000\t`);
  const cols = guessMsmeColumns(table);
  assert.deepEqual(cols, { supplier: 0, accepted: 2, amount: 4, category: 1, agreedDays: 3, paid: 5 });
  const r = checkMsme(table, cols, settings);
  assert.equal(r.overdue, 150_000);
  assert.equal(r.upcoming, 40_000);
  assert.equal(r.disallowed, 0);
  assert.equal(r.counts["not-covered"], 1);
  assert.equal(r.bills.find((b) => b.supplier === "Chitra Prints")!.due, "2026-11-25");
  assert.equal(r.bills.find((b) => b.supplier === "Bharat Tools")!.daysLate, 50);
});

// ---------- compliance calendar ----------

test("a company's calendar for a year has the expected dates", () => {
  const from = "2026-11-20";
  const dates = complianceDates(DEFAULT_BUSINESS, from, yearAfter(from));
  const has = (date: string, pattern: RegExp) => dates.some((d) => d.date === date && pattern.test(d.title));
  assert.ok(has("2026-11-30", /Income tax return for Tax Year 2025-26/) === false, "audited company without TP files by 31 October");
  assert.ok(has("2026-12-07", /Deposit TDS.*November 2026/));
  assert.ok(has("2026-12-11", /GSTR-1 for November 2026/));
  assert.ok(has("2026-12-15", /Advance tax: 75%/));
  assert.ok(has("2026-12-15", /PF and ESI for November 2026/));
  assert.ok(has("2026-12-20", /GSTR-3B.*November 2026/));
  assert.ok(has("2026-12-31", /GSTR-9 for 2025-26/));
  assert.ok(has("2027-01-31", /TDS statements for October–December 2026/));
  assert.ok(has("2027-04-30", /Deposit TDS.*March 2027/));
  assert.ok(has("2027-05-31", /TDS statements for January–March 2027/));
  assert.ok(has("2027-06-30", /DPT-3 for 2026-27/));
  assert.ok(has("2027-09-30", /Tax audit report for Tax Year 2026-27/));
  assert.ok(has("2027-10-30", /AOC-4 for 2026-27/));
  assert.ok(has("2027-10-31", /Income tax return for Tax Year 2026-27/));
  assert.ok(has("2026-11-29", /MGT-7.*2025-26/));
  assert.ok(dates.every((d) => d.date >= from && d.date <= "2027-11-19"));
  assert.ok(dates.every((d, i) => i === 0 || dates[i - 1].date <= d.date));
  assert.equal(new Set(dates.map((d) => d.uid)).size, dates.length);
});

test("QRMP, presumptive and non-audit dates", () => {
  const p = { ...DEFAULT_BUSINESS, entity: "proprietor" as const, audit: false, presumptive: true, gst: "qrmp" as const, qrmpDay: 24 as const, tds: false, payroll: false };
  const dates = complianceDates(p, "2027-01-01", "2027-12-31");
  const titles = (date: string) => dates.filter((d) => d.date === date).map((d) => d.title);
  assert.deepEqual(titles("2027-01-13"), ["GSTR-1 for October–December 2026"]);
  assert.deepEqual(titles("2027-01-24"), ["GSTR-3B for October–December 2026"]);
  assert.deepEqual(titles("2027-02-25"), ["GST payment (PMT-06) for January 2027"]);
  assert.deepEqual(titles("2027-03-15"), ["Advance tax: 100% of the year's tax"]);
  assert.equal(titles("2027-06-15").length, 0, "presumptive: no June instalment");
  assert.deepEqual(titles("2027-08-31"), ["Income tax return for Tax Year 2026-27"]);
  assert.ok(!dates.some((d) => d.area === "ROC" || d.area === "TDS"));
});

test("the calendar file keeps entries on the same date apart", () => {
  const dates = complianceDates(DEFAULT_BUSINESS, "2026-12-01", "2026-12-31");
  const ics = toIcs(dates, [3], new Date("2026-11-20T00:00:00Z"), "Compliance dates");
  assert.equal(ics.match(/BEGIN:VEVENT/g)!.length, dates.length);
  assert.equal(new Set(ics.match(/UID:[^\r]+/g)).size, dates.length);
});
