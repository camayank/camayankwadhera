// Hand-worked cases for the TDS checker, the GSTR-9 reconciliation and the section finder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTable } from "../src/lib/tax/reconcile.ts";
import { checkTds, guessTdsColumns, headsOf, monthsOrPart, natureOf, panStatus, readPayments } from "../src/lib/tax/tds.ts";
import { emptyYear, parseGrid, reconcileYear } from "../src/lib/tax/gstr9.ts";
import { ALL, findSections, sectionKey } from "../src/lib/tax/section-map.ts";

// ---------- TDS ----------

test("ledger heads are read as kinds of payment", () => {
  assert.equal(natureOf("Professional Fees"), "professional");
  assert.equal(natureOf("Legal & Consultancy"), "professional");
  assert.equal(natureOf("Office Rent"), "rent-building");
  assert.equal(natureOf("Machinery Hire Charges"), "rent-machinery");
  assert.equal(natureOf("Freight Outward"), "contract");
  assert.equal(natureOf("Interest on Unsecured Loan"), "interest");
  assert.equal(natureOf("Directors Sitting Fees"), "director");
  assert.equal(natureOf("Sales Commission"), "commission");
  assert.equal(natureOf("Electricity"), "none");
  assert.equal(panStatus("ABCPK1234L"), "individual");
  assert.equal(panStatus("AAACN1234F"), "other");
  assert.equal(panStatus("PANNOTAVBL"), "invalid");
  assert.equal(monthsOrPart("2026-06-02", "2026-06-05"), 1);
  assert.equal(monthsOrPart("2026-04-30", "2026-11-20"), 8);
});

const LEDGER = `Date\tParty\tPAN\tLedger\tAmount\tTDS
05/04/2026\tMehta & Associates\tAAFFM1234K\tProfessional Fees\t30,000\t0
05/07/2026\tMehta & Associates\tAAFFM1234K\tProfessional Fees\t30,000\t0
10/05/2026\tRaju Transport\tBCDPR4321Q\tFreight Outward\t25,000\t0
10/08/2026\tRaju Transport\tBCDPR4321Q\tFreight Outward\t40,000\t400
15/06/2026\tSunrise Estates Pvt Ltd\tAAJCS9999P\tOffice Rent\t60,000\t6,000
15/07/2026\tSunrise Estates Pvt Ltd\tAAJCS9999P\tOffice Rent\t45,000\t0
20/06/2026\tAnil Kumar\t\tInterest on Unsecured Loan\t12,000\t0
30/06/2026\tBSES\tAAACB1111C\tElectricity\t80,000\t0`;

test("payments needing TDS, the shortfall and the interest", () => {
  const table = parseTable(LEDGER);
  const cols = guessTdsColumns(table);
  assert.deepEqual(cols, { party: 1, pan: 2, head: 3, date: 0, amount: 4, deducted: 5 });
  assert.equal(headsOf(table, cols).length, 5);
  const { payments } = readPayments(table, cols, {});
  const r = checkTds(payments, { asOf: "2026-11-20", panColumnMeansMissing: true });
  const line = (party: string, date: string) => r.lines.find((l) => l.party === party && l.date === date)!;

  // professional: 60,000 in the year is above 50,000, so both payments at 10%
  assert.equal(line("Mehta & Associates", "2026-04-05").required, 3_000);
  assert.equal(line("Mehta & Associates", "2026-04-05").months, 8);
  assert.equal(line("Mehta & Associates", "2026-04-05").interest, 240);
  // contract: 65,000 a year, but the 40,000 payment is above 30,000; individual, so 1%
  assert.equal(line("Raju Transport", "2026-05-10").required, 0);
  assert.equal(line("Raju Transport", "2026-08-10").required, 400);
  assert.equal(line("Raju Transport", "2026-08-10").shortfall, 0);
  // rent: June above 50,000, July not
  assert.equal(line("Sunrise Estates Pvt Ltd", "2026-06-15").shortfall, 0);
  assert.equal(line("Sunrise Estates Pvt Ltd", "2026-07-15").required, 0);
  // interest above 10,000 with no PAN: 20%
  assert.equal(line("Anil Kumar", "2026-06-20").rate, 0.2);
  assert.equal(line("Anil Kumar", "2026-06-20").shortfall, 2_400);
  assert.equal(r.unclassified, 1);
  assert.equal(r.shortfall, 3_000 + 3_000 + 2_400);
  // 30% of the expenses with nothing deducted: 30,000 + 30,000 + 12,000
  assert.equal(r.disallowance, 21_600);
});

test("a director's fees have no threshold, and a correction to the head is respected", () => {
  const table = parseTable("Date\tParty\tLedger\tAmount\n01/10/2026\tR Sharma\tSitting fees\t5000\n01/10/2026\tAcme Ltd\tMisc expenses\t2,00,000");
  const cols = guessTdsColumns(table);
  const { payments } = readPayments(table, cols, { "Misc expenses": "contract" });
  const r = checkTds(payments, { asOf: "2026-10-15", panColumnMeansMissing: false });
  assert.equal(r.lines.find((l) => l.party === "R Sharma")!.required, 500);
  assert.equal(r.lines.find((l) => l.party === "Acme Ltd")!.required, 4_000);
});

// ---------- GSTR-9 ----------

test("a year is reconciled month by month", () => {
  const year = emptyYear().map((m) => ({ ...m, salesBooks: 1_000_000, sales1: 1_000_000, sales3b: 1_000_000, taxBooks: 180_000, tax1: 180_000, tax3b: 180_000, itcBooks: 90_000, itc2b: 90_000, itc3b: 90_000 }));
  year[2] = { ...year[2], tax3b: 170_000 }; // June 2025: 10,000 short paid
  year[9] = { ...year[9], itc3b: 60_000 }; // January 2026: 30,000 of credit not claimed
  year[11] = { ...year[11], salesBooks: 1_050_000 }; // March 2026: 50,000 not in GSTR-1 or 3B
  const r = reconcileYear(year, 2025, "2026-11-20");
  assert.equal(r.cutoff, "2026-11-30");
  assert.equal(r.daysToCutoff, 10);
  assert.equal(r.shortPaid, 10_000);
  assert.equal(r.unclaimedItc, 30_000);
  assert.equal(r.excessItc, 0);
  assert.equal(r.unreported, 50_000);
  assert.equal(r.turnoverGap, 50_000);
  assert.equal(r.months[2].month, "June 2025");
  assert.equal(r.months[2].due, "2025-07-20");
  // 10,000 × 18% × 488 days / 365
  assert.equal(r.months[2].interest, Math.round(10_000 * 0.18 * 488 / 365));
  assert.equal(r.months[11].due, "2026-04-20");
  assert.match(r.actions[0].title, /Claim ₹30,000/);
});

test("after 30 November the unclaimed credit is lost", () => {
  const year = emptyYear();
  year[0] = { ...year[0], itcBooks: 5_000, itc2b: 5_000 };
  const r = reconcileYear(year, 2025, "2026-12-05");
  assert.equal(r.actions[0].tone, "bad");
  assert.match(r.actions[0].title, /not claimed in time/);
});

test("numbers pasted from a spreadsheet", () => {
  assert.deepEqual(parseGrid("1,00,000\t2,500\n(300)\t\n"), [[100000, 2500], [-300, 0]]);
});

// ---------- section finder ----------

test("every section of the 2025 Act is in the map", () => {
  assert.equal(ALL.length, 536);
  assert.deepEqual(ALL.map((s) => s.number), Array.from({ length: 536 }, (_, i) => i + 1));
  assert.equal(sectionKey("194-I"), "194I");
  assert.equal(sectionKey("40(a)(ia)"), "40");
});

test("old sections are found in the new Act", () => {
  const first = (q: string) => findSections(q)[0]?.section.number;
  assert.equal(first("80C"), 123);
  assert.equal(first("80D"), 126);
  assert.equal(first("44AD"), 58);
  assert.equal(first("43B"), 37);
  assert.equal(first("40(a)(ia)"), 35);
  assert.equal(first("54"), 82);
  assert.equal(first("115BAC"), 202);
  assert.equal(first("139"), 263);
  assert.equal(first("148"), 280);
  assert.equal(first("194C"), 393);
  assert.equal(first("194-I"), 393);
  assert.equal(first("201"), 398);
  assert.equal(first("234B"), 424);
  assert.equal(first("270A"), 439);
  assert.equal(findSections("424").some((h) => h.why === "new" && h.section.old.includes("234B")), true);
  assert.equal(findSections("presumptive")[0].section.number, 58);
});
