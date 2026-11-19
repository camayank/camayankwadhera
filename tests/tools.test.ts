import { test } from "node:test";
import assert from "node:assert/strict";
import { guessColumns, parseAmount, parseTable, partyId, partyName, reconcile } from "../src/lib/tax/reconcile.ts";
import { reminders, toIcs } from "../src/lib/tax/calendar.ts";

test("amounts in Indian formats", () => {
  assert.equal(parseAmount("1,23,456.50"), 123456.5);
  assert.equal(parseAmount("₹ 1,200"), 1200);
  assert.equal(parseAmount("(500)"), -500);
  assert.equal(parseAmount("500 Dr"), 500);
  assert.equal(parseAmount("n/a"), null);
  assert.equal(parseAmount("HDFC Bank MUMH03189E"), null);
});

test("parties match on TAN, or on the name without company suffixes", () => {
  assert.equal(partyId("HDFC Bank Ltd (MUMH03189E)"), "MUMH03189E");
  assert.equal(partyName("HDFC Bank Ltd (MUMH03189E)"), "HDFC BANK");
  assert.equal(partyName("Acme Software Pvt. Ltd."), partyName("ACME SOFTWARE PRIVATE LIMITED"));
});

test("reconciliation finds what differs and what is missing", () => {
  const statement = parseTable(
    'Deductor,TAN,Amount paid,TDS\n"HDFC Bank Ltd",MUMH03189E,"1,20,000","12,000"\nAcme Software Pvt Ltd,DELA12345B,500000,50000\nZeta Broking,BLRZ00011C,40000,4000\nTotal,,660000,66000',
  );
  // the records give a TAN for one party and only names for the rest
  const records = parseTable("Party\tReceipt\tTax\nHDFC Bank MUMH03189E\t120000\t12000\nAcme Software Private Limited\t450000\t45000\nOld Client LLP\t75000\t0");
  const sCols = guessColumns(statement);
  assert.deepEqual(sCols, { party: 0, amount: 2, tax: 3 });
  const result = reconcile(statement, sCols, records, guessColumns(records));
  assert.deepEqual(result.counts, { match: 1, differs: 1, "statement-only": 1, "records-only": 1 });
  const acme = result.lines.find((l) => l.key === "DELA12345B")!;
  assert.equal(acme.amountGap, 50_000);
  assert.equal(acme.taxGap, 5_000);
  assert.equal(result.totals.statementTax, 66_000);
});

test("calendar file has five all-day events with alerts", () => {
  const ics = toIcs(reminders(), [7, 1], new Date("2026-11-19T00:00:00Z"));
  assert.equal(ics.match(/BEGIN:VEVENT/g)!.length, 5);
  assert.equal(ics.match(/BEGIN:VALARM/g)!.length, 10);
  assert.match(ics, /DTSTART;VALUE=DATE:20261215\r\nDTEND;VALUE=DATE:20261216/);
  assert.ok(ics.split("\r\n").every((line) => line.length <= 75));
});
