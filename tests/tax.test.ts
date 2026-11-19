// Hand-worked cases for the advance tax engine. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_PROFILE, computeSchedule, computeTax, plan, type Profile } from "../src/lib/tax/india.ts";

const profile = (over: Partial<Profile>): Profile => ({ ...EMPTY_PROFILE, ...over });

test("new regime: salary of 12.75 lakh is covered by the rebate", () => {
  assert.equal(computeTax(profile({ salary: 1_275_000 })).total, 0);
});

test("new regime: 20 lakh of business income", () => {
  // 20,000 + 40,000 + 60,000 + 80,000 = 2,00,000; cess 8,000
  assert.equal(computeTax(profile({ business: 2_000_000 })).total, 208_000);
});

test("new regime: just above 12 lakh, tax is limited to the income above it", () => {
  // slab tax 61,500 limited to 10,000; cess 400
  assert.equal(computeTax(profile({ business: 1_210_000 })).total, 10_400);
});

test("a non-resident gets no rebate", () => {
  // 20,000 + 40,000 = 60,000; cess 2,400
  assert.equal(computeTax(profile({ business: 1_200_000, resident: false })).total, 62_400);
});

test("long-term equity gains: 1.25 lakh exempt, the rest at 12.5%", () => {
  // slab: 3,00,000 + 6,00,000 x 30% = 4,80,000. gains: 3,75,000 x 12.5% = 46,875. cess 21,075
  const p = profile({ business: 3_000_000, timed: [{ kind: "ltcgEquity", amount: 500_000, period: 0 }] });
  assert.equal(computeTax(p).total, 547_950);
});

test("the rebate does not cover short-term equity gains in the new regime", () => {
  // slab income 6 lakh: tax 10,000, wiped out by the rebate. gains 1,00,000 x 20% = 20,000; cess 800
  const p = profile({ business: 600_000, timed: [{ kind: "stcgEquity", amount: 100_000, period: 1 }] });
  assert.equal(computeTax(p).total, 20_800);
});

test("unused exemption limit is set against gains for a resident", () => {
  // slab income 1 lakh leaves 3 lakh unused; gains 5 lakh become 2 lakh x 20% = 40,000; cess 1,600
  const p = profile({ other: 100_000, timed: [{ kind: "stcgEquity", amount: 500_000, period: 0 }] });
  assert.equal(computeTax(p).total, 41_600);
  assert.equal(computeTax({ ...p, resident: false }).total, 104_000);
});

test("surcharge of 10% above 50 lakh", () => {
  // tax 3,00,000 + 36,00,000 x 30% = 13,80,000; surcharge 1,38,000; cess 60,720
  assert.equal(computeTax(profile({ business: 6_000_000 })).total, 1_578_720);
});

test("marginal relief just above 50 lakh", () => {
  // tax on 50 lakh 10,80,000 plus the extra 1,00,000 of income = 11,80,000; cess 47,200
  assert.equal(computeTax(profile({ business: 5_100_000 })).total, 1_227_200);
});

test("surcharge on capital gains stops at 15%", () => {
  // 6 crore of short-term equity gains, nothing else, non-resident: tax 1,20,00,000; surcharge 15%; cess 4%
  const p = profile({ resident: false, timed: [{ kind: "stcgEquity", amount: 60_000_000, period: 0 }] });
  assert.equal(computeTax(p).total, Math.round((12_000_000 * 1.15 * 1.04) / 10) * 10);
});

test("new regime stops at 25% surcharge, old regime goes to 37%", () => {
  const taxNew = 300_000 + (60_000_000 - 2_400_000) * 0.3;
  assert.equal(computeTax(profile({ business: 60_000_000 })).total, Math.round((taxNew * 1.25 * 1.04) / 10) * 10);
  const taxOld = 112_500 + (60_000_000 - 1_000_000) * 0.3;
  assert.equal(
    computeTax(profile({ business: 60_000_000, regime: "old" })).total,
    Math.round((taxOld * 1.37 * 1.04) / 10) * 10,
  );
});

test("old regime: salary 10.5 lakh with 1.5 lakh of deductions", () => {
  // income 8.5 lakh: 12,500 + 3,50,000 x 20% = 82,500; cess 3,300
  assert.equal(computeTax(profile({ regime: "old", salary: 1_050_000, deductions: 150_000 })).total, 85_800);
});

test("instalments are 15, 45, 75 and 100 percent of tax after TDS", () => {
  const s = computeSchedule(profile({ business: 2_000_000, tds: 8_000 }));
  assert.equal(s.liability, 200_000);
  assert.deepEqual(s.instalments.map((row) => row.required), [30_000, 90_000, 150_000, 200_000]);
});

test("nothing paid: interest is 3%, 3%, 3% and 1% of each shortfall", () => {
  const s = computeSchedule(profile({ business: 2_000_000, tds: 108_000 }));
  assert.equal(s.liability, 100_000);
  // 15,000 x 3% + 45,000 x 3% + 75,000 x 3% + 1,00,000 x 1%
  assert.deepEqual(s.instalments.map((row) => row.interest), [450, 1_350, 2_250, 1_000]);
  assert.equal(s.defermentInterest, 5_050);
  assert.equal(s.defaultInterestPerMonth, 1_000);
});

test("paying 12% by June and 36% by September avoids interest on those two", () => {
  const s = computeSchedule(
    profile({ business: 2_000_000, tds: 108_000, paid: [12_000, 24_000, 39_000, 25_000, 0] }),
  );
  assert.deepEqual(s.instalments.map((row) => row.interest), [0, 0, 0, 0]);
  assert.equal(s.instalments[0].withinAllowance, true);
  assert.equal(s.defaultInterestPerMonth, 0);
});

test("the amount interest is charged on is rounded down to a hundred rupees", () => {
  const s = computeSchedule(profile({ business: 2_000_000, tds: 108_000, paid: [14_950, 0, 0, 0, 0] }));
  // shortfall 50 rounds to nil, but 12% was paid anyway
  assert.equal(s.instalments[0].interest, 0);
  const t = computeSchedule(profile({ business: 2_000_000, tds: 108_000, paid: [0, 44_850, 0, 0, 0] }));
  // September shortfall 150 is charged as 100: 3
  assert.equal(t.instalments[1].interest, 0); // 44,850 is above 36%
  const u = computeSchedule(profile({ business: 2_000_000, tds: 108_000, paid: [0, 0, 74_850, 0, 0] }));
  assert.equal(u.instalments[2].interest, 3);
});

test("a gain in the third period creates no shortfall for June or September", () => {
  const p = profile({ timed: [{ kind: "stcgEquity", amount: 2_000_000, period: 2 }], resident: false });
  const s = computeSchedule(p);
  // tax 4,00,000 + cess 16,000
  assert.equal(s.liability, 416_000);
  assert.deepEqual(s.instalments.map((row) => row.required), [0, 0, 312_000, 416_000]);
  assert.deepEqual(s.instalments.map((row) => row.interest), [0, 0, 9_360, 4_160]);
});

test("a gain after 15 March is due by 31 March", () => {
  const p = profile({ resident: false, timed: [{ kind: "stcgEquity", amount: 1_000_000, period: 4 }] });
  const s = computeSchedule(p);
  assert.deepEqual(s.instalments.map((row) => row.required), [0, 0, 0, 0]);
  assert.equal(s.yearEnd.required, 208_000);
  assert.equal(s.yearEnd.interest, 2_080);
  assert.equal(computeSchedule({ ...p, paid: [0, 0, 0, 0, 208_000] }).yearEnd.interest, 0);
});

test("presumptive income: one instalment, by 15 March", () => {
  const s = computeSchedule(profile({ business: 2_000_000, presumptive: true }));
  assert.deepEqual(s.instalments.map((row) => row.required), [0, 0, 0, 208_000]);
  assert.deepEqual(s.instalments.map((row) => row.interest), [0, 0, 0, 2_080]);
});

test("no advance tax below 10,000 or for a resident senior without business income", () => {
  assert.equal(computeSchedule(profile({ business: 1_250_000, resident: false, tds: 61_000 })).exempt, "below-threshold");
  const senior = computeSchedule(profile({ other: 3_000_000, age: "60to79" }));
  assert.equal(senior.exempt, "senior");
  assert.equal(senior.defermentInterest, 0);
  assert.equal(computeSchedule(profile({ business: 3_000_000, age: "60to79" })).exempt, null);
});

test("the plan catches up an earlier shortfall at the next date", () => {
  const p = profile({ business: 2_000_000, tds: 8_000, paid: [10_000, 20_000, 0, 0, 0] });
  const { next, pay } = plan(p, "2026-11-19");
  assert.equal(next, 2);
  // 1,50,000 due by December less 30,000 paid; then 50,000 in March
  assert.deepEqual(pay, [0, 0, 120_000, 50_000, 0]);
});
