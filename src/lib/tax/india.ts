// Indian advance tax for individuals, Tax Year 2026-27 (1 April 2026 to 31 March 2027),
// under the Income-tax Act, 2025. Pure functions with no browser dependencies, so the
// figures can be tested on their own (see tests/tax.test.ts).
//
// Sources checked in November 2026:
// - Instalments and due dates: section 408. Liability threshold: section 404.
// - Interest for deferment: section 425. Interest for default: section 424.
// - Rounding of the amount on which interest is charged: rule 269, Income-tax Rules, 2026.
// - Slabs, rebate, surcharge and capital gains rates: unchanged by the Finance Act, 2026.
//
// When the rules change, change RULES and the tests; the screens read everything from here.

export const RULES = {
  taxYear: "2026-27",
  starts: "2026-04-01",
  ends: "2027-03-31",
  /** Advance tax applies only when tax after TDS is at least this much. */
  threshold: 10_000,
  cess: 0.04,
  new: {
    slabs: [
      [400_000, 0],
      [800_000, 0.05],
      [1_200_000, 0.1],
      [1_600_000, 0.15],
      [2_000_000, 0.2],
      [2_400_000, 0.25],
      [Infinity, 0.3],
    ] as [number, number][],
    standardDeduction: 75_000,
    rebateIncomeLimit: 1_200_000,
    rebateMax: 60_000,
    topSurcharge: 0.25,
  },
  old: {
    slabs: {
      under60: [[250_000, 0], [500_000, 0.05], [1_000_000, 0.2], [Infinity, 0.3]],
      "60to79": [[300_000, 0], [500_000, 0.05], [1_000_000, 0.2], [Infinity, 0.3]],
      "80plus": [[500_000, 0], [1_000_000, 0.2], [Infinity, 0.3]],
    } as Record<Age, [number, number][]>,
    standardDeduction: 50_000,
    rebateIncomeLimit: 500_000,
    rebateMax: 12_500,
    housePropertyLossCap: 200_000,
    topSurcharge: 0.37,
  },
  stcgEquityRate: 0.2,
  ltcgRate: 0.125,
  ltcgEquityExemption: 125_000,
  /** Surcharge bands on total income. Tax on dividends and capital gains never bears more than cappedSurcharge. */
  surcharge: [
    [5_000_000, 0.1],
    [10_000_000, 0.15],
    [20_000_000, 0.25],
    [50_000_000, 0.37],
  ] as [number, number][],
  cappedSurcharge: 0.15,
  /** Cumulative share of the year's tax due by each instalment date. */
  instalments: [
    { due: "2026-06-15", share: 0.15, safeHarbour: 0.12, interest: 0.03 },
    { due: "2026-09-15", share: 0.45, safeHarbour: 0.36, interest: 0.03 },
    { due: "2026-12-15", share: 0.75, safeHarbour: 0.75, interest: 0.03 },
    { due: "2027-03-15", share: 1, safeHarbour: 1, interest: 0.01 },
  ],
  /** Tax on gains and dividends arising after 15 March must be paid by this date. */
  yearEnd: "2027-03-31",
  defaultInterestPerMonth: 0.01,
  defaultSafeShare: 0.9,
} as const;

export type Age = "under60" | "60to79" | "80plus";
export type Regime = "new" | "old";

/** Income that the law lets you pay for only after it arises (section 425(4)). */
export type TimedKind = "dividend" | "stcgEquity" | "ltcgEquity" | "ltcgOther";

/** 0: 1 Apr to 15 Jun. 1: 16 Jun to 15 Sep. 2: 16 Sep to 15 Dec. 3: 16 Dec to 15 Mar. 4: 16 to 31 Mar. */
export type Period = 0 | 1 | 2 | 3 | 4;

export const PERIODS = [
  "1 Apr to 15 Jun",
  "16 Jun to 15 Sep",
  "16 Sep to 15 Dec",
  "16 Dec to 15 Mar",
  "16 to 31 Mar",
] as const;

export const TIMED_LABELS: Record<TimedKind, string> = {
  dividend: "Dividends",
  stcgEquity: "Short-term gains on listed shares and equity funds",
  ltcgEquity: "Long-term gains on listed shares and equity funds",
  ltcgOther: "Other long-term gains (property, unlisted shares, gold)",
};

export type TimedIncome = { kind: TimedKind; amount: number; period: Period };

export type Profile = {
  regime: Regime;
  resident: boolean;
  age: Age;
  /** Declares business or professional income on the presumptive basis: one instalment, by 15 March. */
  presumptive: boolean;
  salary: number;
  business: number;
  /** Net income from house property; a loss is entered as a negative number. */
  houseProperty: number;
  /** Interest and any other income taxed at slab rates, including short-term gains on other assets. */
  other: number;
  /** Deductions that apply only under the old regime. */
  deductions: number;
  timed: TimedIncome[];
  /** Tax deducted or collected at source for the whole year. */
  tds: number;
  /** Advance tax paid in each period (not cumulative). */
  paid: [number, number, number, number, number];
};

export const EMPTY_PROFILE: Profile = {
  regime: "new",
  resident: true,
  age: "under60",
  presumptive: false,
  salary: 0,
  business: 0,
  houseProperty: 0,
  other: 0,
  deductions: 0,
  timed: [],
  tds: 0,
  paid: [0, 0, 0, 0, 0],
};

export type TaxBreakdown = {
  totalIncome: number;
  slabIncome: number;
  slabTax: number;
  specialTax: number;
  rebate: number;
  surcharge: number;
  cess: number;
  total: number;
};

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
const floor100 = (n: number) => Math.floor(pos(n) / 100) * 100;
/** Section 516: amounts payable are rounded to the nearest ten rupees. */
const round10 = (n: number) => Math.round(n / 10) * 10;

function slabTaxOn(income: number, slabs: readonly (readonly [number, number])[]) {
  let tax = 0;
  let floor = 0;
  for (const [ceiling, rate] of slabs) {
    if (income > floor) tax += (Math.min(income, ceiling) - floor) * rate;
    floor = ceiling;
  }
  return tax;
}

type Parts = { ordinary: number; dividend: number; stcgEquity: number; ltcgEquity: number; ltcgOther: number };

/** Split a profile into the amounts each rate applies to, counting timed income up to and including `through`. */
function partsOf(p: Profile, through: Period): Parts {
  const timed = (kind: TimedKind) =>
    p.timed.filter((t) => t.kind === kind && t.period <= through).reduce((sum, t) => sum + pos(t.amount), 0);
  const std = p.regime === "new" ? RULES.new.standardDeduction : RULES.old.standardDeduction;
  const salary = pos(p.salary - Math.min(std, pos(p.salary)));
  const house =
    p.regime === "new" ? pos(p.houseProperty) : Math.max(p.houseProperty || 0, -RULES.old.housePropertyLossCap);
  const deductions = p.regime === "old" ? pos(p.deductions) : 0;
  const dividend = timed("dividend");
  // deductions come off other slab income first, then dividends
  const beforeDividend = salary + pos(p.business) + house + pos(p.other) - deductions;
  return {
    ordinary: pos(beforeDividend),
    dividend: pos(dividend + Math.min(0, beforeDividend)),
    stcgEquity: timed("stcgEquity"),
    ltcgEquity: timed("ltcgEquity"),
    ltcgOther: timed("ltcgOther"),
  };
}

const totalOf = (x: Parts) => x.ordinary + x.dividend + x.stcgEquity + x.ltcgEquity + x.ltcgOther;

/** Bring total income down to `target`, taking it from slab income first and capital gains last. */
function reduceTo(x: Parts, target: number): Parts {
  let excess = totalOf(x) - target;
  const out = { ...x };
  for (const key of ["ordinary", "dividend", "ltcgOther", "ltcgEquity", "stcgEquity"] as const) {
    const cut = Math.min(out[key], pos(excess));
    out[key] -= cut;
    excess -= cut;
  }
  return out;
}

function surchargeRate(income: number, top: number) {
  let rate = 0;
  for (const [above, r] of RULES.surcharge) if (income > above) rate = Math.min(r, top);
  return rate;
}

/** Income tax plus surcharge, before cess. `relief` applies marginal relief at the surcharge thresholds. */
function taxAndSurcharge(p: Profile, x: Parts, relief: boolean) {
  const regime = p.regime === "new" ? RULES.new : RULES.old;
  const slabs = p.regime === "new" ? RULES.new.slabs : RULES.old.slabs[p.resident ? p.age : "under60"];
  const exemption = slabs[0][0];
  const slabIncome = x.ordinary + x.dividend;
  const totalIncome = totalOf(x);

  // A resident whose slab income is below the exemption limit sets the unused part against gains, highest rate first.
  let unused = p.resident ? pos(exemption - slabIncome) : 0;
  const use = (amount: number) => {
    const cut = Math.min(amount, unused);
    unused -= cut;
    return amount - cut;
  };
  const stcg = use(x.stcgEquity);
  const ltcgOther = use(x.ltcgOther);
  const ltcgEquity = pos(use(x.ltcgEquity) - RULES.ltcgEquityExemption);

  const slabTax = slabTaxOn(slabIncome, slabs);
  const stcgTax = stcg * RULES.stcgEquityRate;
  const ltcgOtherTax = ltcgOther * RULES.ltcgRate;
  const ltcgEquityTax = ltcgEquity * RULES.ltcgRate;
  const specialTax = stcgTax + ltcgOtherTax + ltcgEquityTax;

  let rebate = 0;
  if (p.resident) {
    if (totalIncome <= regime.rebateIncomeLimit) {
      // New regime: the rebate does not reduce tax charged at special rates. Old regime: not against equity LTCG.
      const eligible = p.regime === "new" ? slabTax : slabTax + stcgTax + ltcgOtherTax;
      rebate = Math.min(eligible, regime.rebateMax);
    } else if (p.regime === "new" && specialTax === 0) {
      // Just above the limit, tax cannot exceed the income earned above it.
      rebate = pos(slabTax - (totalIncome - regime.rebateIncomeLimit));
    }
  }
  const slabTaxNet = slabTax - Math.min(rebate, slabTax);
  const tax = slabTax + specialTax - rebate;

  // Surcharge: the 25% and 37% rates look only at income other than dividends and capital gains,
  // and tax on dividends and capital gains never bears more than 15%.
  const cappedIncome = x.dividend + x.stcgEquity + x.ltcgEquity + x.ltcgOther;
  const dividendTax = slabIncome > 0 ? slabTaxNet * (x.dividend / slabIncome) : 0;
  const cappedTax = tax - slabTaxNet + dividendTax;
  const baseRate = surchargeRate(totalIncome, RULES.cappedSurcharge);
  const fullRate = Math.max(baseRate, surchargeRate(totalIncome - cappedIncome, regime.topSurcharge));
  let surcharge = cappedTax * baseRate + (tax - cappedTax) * fullRate;

  if (relief && surcharge > 0) {
    // Marginal relief: crossing a threshold cannot cost more than the income earned above it.
    const crossed = RULES.surcharge.map(([above]) => above).filter((above) => totalIncome > above).pop()!;
    const atThreshold = taxAndSurcharge(p, reduceTo(x, crossed), false);
    const ceiling = atThreshold.tax + atThreshold.surcharge + (totalIncome - crossed);
    if (tax + surcharge > ceiling) surcharge = pos(ceiling - tax);
  }
  return { totalIncome, slabIncome, slabTax, specialTax, rebate, tax, surcharge };
}

/** Tax for the year, counting dividends and capital gains that arise up to and including `through`. */
export function computeTax(p: Profile, through: Period = 4): TaxBreakdown {
  const r = taxAndSurcharge(p, partsOf(p, through), true);
  const cess = (r.tax + r.surcharge) * RULES.cess;
  return {
    totalIncome: r.totalIncome,
    slabIncome: r.slabIncome,
    slabTax: r.slabTax,
    specialTax: r.specialTax,
    rebate: r.rebate,
    surcharge: r.surcharge,
    cess,
    total: round10(r.tax + r.surcharge + cess),
  };
}

export type Instalment = {
  due: string;
  /** Cumulative advance tax required by this date. */
  required: number;
  /** Cumulative advance tax paid by this date. */
  paid: number;
  /** required minus paid, never below zero. */
  shortfall: number;
  /** Interest for deferment on this instalment. */
  interest: number;
  /** True when the shortfall is within the 12% / 36% allowance and bears no interest. */
  withinAllowance: boolean;
};

export type Schedule = {
  tax: TaxBreakdown;
  /** Tax for the year after TDS: the amount advance tax is measured against. */
  liability: number;
  /** Why no advance tax is needed, when that is the case. */
  exempt: null | "below-threshold" | "senior";
  instalments: Instalment[];
  /** Tax still to pay by 31 March on gains and dividends arising after 15 March. */
  yearEnd: Instalment;
  defermentInterest: number;
  /** Interest per month from 1 April if less than 90% was paid in advance. */
  defaultInterestPerMonth: number;
  /** Tax left to pay after all advance tax entered. */
  balance: number;
};

export function computeSchedule(p: Profile): Schedule {
  const tax = computeTax(p, 4);
  const tds = pos(p.tds);
  const liability = pos(tax.total - tds);
  const senior = p.resident && p.age !== "under60" && pos(p.business) === 0;
  const exempt = senior ? "senior" : liability < RULES.threshold ? "below-threshold" : null;

  let paid = 0;
  const instalments: Instalment[] = RULES.instalments.map((rule, i) => {
    paid += pos(p.paid[i]);
    // Tax measured on the gains and dividends that had arisen by this date.
    const due = pos(computeTax(p, i as Period).total - tds);
    const share = p.presumptive ? (i === 3 ? 1 : 0) : rule.share;
    const allowance = p.presumptive ? share : rule.safeHarbour;
    const required = exempt ? 0 : round10(due * share);
    const shortfall = pos(required - paid);
    const withinAllowance = shortfall > 0 && paid >= due * allowance;
    const interest = exempt || withinAllowance ? 0 : floor100(shortfall) * rule.interest;
    return { due: rule.due, required, paid, shortfall, interest, withinAllowance };
  });

  paid += pos(p.paid[4]);
  const march = instalments[3];
  const lateRequired = exempt ? 0 : liability;
  // Only the tax on income arising after 15 March is measured here; an earlier shortfall is already charged above.
  const lateShortfall = pos(lateRequired - Math.max(paid, march.required));
  const yearEnd: Instalment = {
    due: RULES.yearEnd,
    required: lateRequired,
    paid,
    shortfall: pos(lateRequired - paid),
    interest: exempt ? 0 : floor100(lateShortfall) * RULES.instalments[3].interest,
    withinAllowance: false,
  };

  const defermentInterest = instalments.reduce((sum, row) => sum + row.interest, 0) + yearEnd.interest;
  const balance = pos(liability - paid);
  const defaultInterestPerMonth =
    !exempt && paid < liability * RULES.defaultSafeShare ? floor100(balance) * RULES.defaultInterestPerMonth : 0;
  return { tax, liability, exempt, instalments, yearEnd, defermentInterest, defaultInterestPerMonth, balance };
}

/** The index of the next instalment on or after `today` (YYYY-MM-DD); 4 for the year-end date; 5 once the year is over. */
export function nextInstalment(today: string): number {
  const dates = [...RULES.instalments.map((rule) => rule.due), RULES.yearEnd];
  const index = dates.findIndex((due) => today <= due);
  return index === -1 ? 5 : index;
}

/** What to pay on each remaining date to stay free of interest from here on. */
export function plan(p: Profile, today: string) {
  const schedule = computeSchedule(p);
  const next = nextInstalment(today);
  const rows = [...schedule.instalments, schedule.yearEnd];
  let covered = next > 0 ? rows[Math.min(next, rows.length) - 1].paid : 0;
  const pay = rows.map((row, i) => {
    if (i < next) return 0;
    const paidSoFar = Math.max(covered, row.paid);
    const amount = pos(row.required - paidSoFar);
    covered = paidSoFar + amount;
    return amount;
  });
  return { schedule, next, pay };
}

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
