// A compliance calendar for one business: income tax, TDS, GST, payroll and ROC dates, built from a short profile.
// No browser dependencies.
//
// Sources checked in November 2026:
// - Advance tax: section 408, Income-tax Act, 2025 (15 Jun, 15 Sep, 15 Dec, 15 Mar; presumptive cases 15 Mar only).
// - Return due dates (section 263 of the 2025 Act, as amended by the Finance Act, 2026): 31 July with no business
//   income; 31 August for business or profession without audit; 31 October with audit; 30 November with a
//   transfer pricing report. The audit report is due a month before the return, on 30 September.
// - TDS: deposit by the 7th of the next month, and by 30 April for March. Quarterly statements in Forms 138, 140
//   and 144 by 31 July, 31 October, 31 January and 31 May.
// - GST: GSTR-1 by the 11th and GSTR-3B by the 20th for monthly filers. Under QRMP, GSTR-1 by the 13th after the
//   quarter, PMT-06 by the 25th for the first two months, and GSTR-3B by the 22nd or 24th depending on the state.
//   Composition: CMP-08 by the 18th after the quarter, GSTR-4 by 30 April. GSTR-9 and 9C by 31 December.
// - PF and ESI: by the 15th of the next month.
// - Companies Act: AGM by 30 September; AOC-4 within 30 days and MGT-7 within 60 days of it; DPT-3 by 30 June;
//   MSME-1 by 30 April and 31 October. DIR-3 KYC once every three financial years, by 30 June.
//   LLPs: Form 11 by 30 May and Form 8 by 30 October.

import type { Reminder } from "./calendar.ts";

export type Entity = "salaried" | "proprietor" | "firm" | "llp" | "company";
export type GstScheme = "none" | "monthly" | "qrmp" | "composition";

export type BusinessProfile = {
  entity: Entity;
  /** Accounts must be audited under the Income-tax Act (companies always are). */
  audit: boolean;
  /** Has international or specified domestic transactions needing a transfer pricing report. */
  transferPricing: boolean;
  /** Declares income on the presumptive basis, so advance tax is one instalment. */
  presumptive: boolean;
  gst: GstScheme;
  /** QRMP GSTR-3B is due on the 22nd in some states and the 24th in the rest. */
  qrmpDay: 22 | 24;
  /** Aggregate turnover above ₹5 crore, so GSTR-9C is filed with GSTR-9. */
  over5crore: boolean;
  tds: boolean;
  payroll: boolean;
  /** Owes micro or small suppliers for more than 45 days (companies file MSME-1). */
  msmeDues: boolean;
  /** Month and day the AGM is held, "MM-DD". */
  agm: string;
};

export const DEFAULT_BUSINESS: BusinessProfile = {
  entity: "company",
  audit: true,
  transferPricing: false,
  presumptive: false,
  gst: "monthly",
  qrmpDay: 22,
  over5crore: false,
  tds: true,
  payroll: true,
  msmeDues: false,
  agm: "09-30",
};

/** States and union territories where QRMP GSTR-3B is due on the 22nd; everywhere else it is the 24th. */
export const QRMP_22_STATES = [
  "Chhattisgarh", "Madhya Pradesh", "Gujarat", "Maharashtra", "Karnataka", "Goa", "Kerala", "Tamil Nadu",
  "Telangana", "Andhra Pradesh", "Dadra and Nagar Haveli and Daman and Diu", "Puducherry",
  "Andaman and Nicobar Islands", "Lakshadweep",
];

export type Area = "Income tax" | "TDS" | "GST" | "Payroll" | "ROC";

export type Due = Reminder & { uid: string; area: Area };

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
const on = (y: number, m: number, d: number) => {
  // months may run past 12 when a date falls in the next year
  const year = y + Math.floor((m - 1) / 12);
  const month = ((m - 1) % 12) + 1;
  return `${year}-${pad(month)}-${pad(d)}`;
};
const plusDays = (date: string, days: number) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const fy = (y: number) => `${y}-${pad((y + 1) % 100)}`;
const monthLabel = (y: number, m: number) => `${MONTH_NAMES[m - 1]} ${y}`;
const quarterOf = (m: number) => Math.floor(((m + 8) % 12) / 3); // April-June is 0
const QUARTER_LABELS = ["April–June", "July–September", "October–December", "January–March"];

/** Every date that applies to the business between `from` and `to`, inclusive, in order. */
export function complianceDates(p: BusinessProfile, from: string, to: string): Due[] {
  const out: Due[] = [];
  const add = (area: Area, key: string, date: string, title: string, detail: string) => {
    if (date >= from && date <= to) out.push({ uid: `${key}-${date}`, area, date, title, detail });
  };
  const business = p.entity !== "salaried";
  const startYear = Number(from.slice(0, 4)) - 1;
  const endYear = Number(to.slice(0, 4)) + 1;

  // monthly and quarterly items, by the month they relate to
  for (let y = startYear; y <= endYear; y++) {
    for (let m = 1; m <= 12; m++) {
      const period = monthLabel(y, m);
      const q = quarterOf(m);
      const quarterEnd = m % 3 === 0;
      const taxYear = m >= 4 ? y : y - 1;

      if (p.tds && business) {
        add("TDS", "tds-pay", m === 3 ? on(y, 4, 30) : on(y, m + 1, 7), `Deposit TDS and TCS for ${period}`,
          `Tax deducted or collected in ${period} must be deposited by today${m === 3 ? " (March tax has until 30 April)" : ""}. Late deposit costs interest for every month or part of a month.`);
        if (quarterEnd) {
          // 31 July, 31 October, 31 January, and 31 May for the last quarter
          const due = q === 3 ? on(y, 5, 31) : on(y, m + 1, 31);
          add("TDS", "tds-return", due, `TDS statements for ${QUARTER_LABELS[q]} ${y}`,
            `File the quarterly statements for Tax Year ${fy(taxYear)}: Form 138 for salary, Form 140 for other payments to residents, Form 144 for non-residents. A late statement carries a fee for each day of delay.`);
        }
      }

      if (p.payroll && business) {
        add("Payroll", "pf-esi", on(y, m + 1, 15), `PF and ESI for ${period}`,
          `Pay the provident fund and ESI contributions for ${period} wages and file the returns. The employees' share deposited late is not deductible for income tax.`);
      }

      if (p.gst === "monthly") {
        add("GST", "gstr1", on(y, m + 1, 11), `GSTR-1 for ${period}`,
          "Report your sales invoices. Your customers' credit depends on it, so file on time even if you pay later.");
        add("GST", "gstr3b", on(y, m + 1, 20), `GSTR-3B and GST payment for ${period}`,
          "Pay the month's GST and file the return. Claim credit only for invoices in GSTR-2B after reviewing them in IMS. Late tax costs 18% a year in interest.");
      }
      if (p.gst === "qrmp") {
        if (!quarterEnd) {
          add("GST", "pmt06", on(y, m + 1, 25), `GST payment (PMT-06) for ${period}`,
            "Under QRMP, pay the month's GST by challan, or the fixed sum the portal works out. Interest runs on tax paid late.");
        } else {
          add("GST", "gstr1q", on(y, m + 1, 13), `GSTR-1 for ${QUARTER_LABELS[q]} ${y}`, "Report the quarter's sales invoices (QRMP).");
          add("GST", "gstr3bq", on(y, m + 1, p.qrmpDay), `GSTR-3B for ${QUARTER_LABELS[q]} ${y}`,
            "File the quarterly return and pay the balance of the quarter's GST. Late tax costs 18% a year in interest.");
        }
      }
      if (p.gst === "composition" && quarterEnd) {
        add("GST", "cmp08", on(y, m + 1, 18), `CMP-08 for ${QUARTER_LABELS[q]} ${y}`, "Pay the composition tax for the quarter.");
      }
    }
  }

  // yearly items, by the tax year (1 April y to 31 March y+1) they relate to
  for (let y = startYear - 1; y <= endYear; y++) {
    const year = fy(y);
    const n = y + 1;

    const instalments = p.presumptive && p.entity !== "company"
      ? [{ date: on(n, 3, 15), share: "100%" }]
      : [{ date: on(y, 6, 15), share: "15%" }, { date: on(y, 9, 15), share: "45%" }, { date: on(y, 12, 15), share: "75%" }, { date: on(n, 3, 15), share: "100%" }];
    for (const it of instalments) {
      add("Income tax", "advance-tax", it.date, `Advance tax: ${it.share} of the year's tax`,
        `By today, ${it.share} of the income tax for Tax Year ${year}, after TDS, should be paid. A shortfall costs interest; use the advance tax calculator for the amount.`);
    }

    const audited = p.audit || p.entity === "company";
    const itr = p.transferPricing ? on(n, 11, 30) : audited ? on(n, 10, 31) : business ? on(n, 8, 31) : on(n, 7, 31);
    if (audited) add("Income tax", "tax-audit", on(n, 9, 30), `Tax audit report for Tax Year ${year}`, "The auditor uploads the audit report a month before the return is due.");
    add("Income tax", "itr", itr, `Income tax return for Tax Year ${year}`,
      `Last day to file the return without a late fee${p.transferPricing ? ", with the transfer pricing report filed earlier" : ""}. Unpaid tax after 31 March already costs interest.`);

    if (p.gst === "monthly" || p.gst === "qrmp") {
      add("GST", "gstr9", on(n, 12, 31), `GSTR-9${p.over5crore ? " and GSTR-9C" : ""} for ${year}`,
        p.over5crore ? "Annual return with the reconciliation statement (turnover above ₹5 crore)." : "Annual return. Optional if turnover for the year was ₹2 crore or less.");
    }
    if (p.gst === "composition") add("GST", "gstr4", on(n, 4, 30), `GSTR-4 for ${year}`, "Annual return for composition taxpayers.");

    if (p.entity === "company") {
      const agm = `${n}-${p.agm}`;
      add("ROC", "agm", agm, `AGM for ${year}`, "Adopt the audited accounts. The AOC-4 and MGT-7 dates below count from the AGM.");
      add("ROC", "aoc4", plusDays(agm, 30), `AOC-4 for ${year}`, "File the financial statements within 30 days of the AGM. Late filing costs ₹100 a day with no cap.");
      add("ROC", "mgt7", plusDays(agm, 60), `MGT-7 / MGT-7A for ${year}`, "File the annual return within 60 days of the AGM. Late filing costs ₹100 a day with no cap.");
      add("ROC", "dpt3", on(n, 6, 30), `DPT-3 for ${year}`, "Return of deposits, and of loans and money received that are not deposits.");
      add("ROC", "dir3", on(n, 6, 30), "DIR-3 KYC, if your three-year cycle ends this year",
        "Director KYC is now filed once every three financial years. Check each director's cycle; a change of mobile, email or address must be filed within 30 days whatever the cycle.");
      if (p.msmeDues) {
        add("ROC", "msme1", on(n, 4, 30), `MSME-1 for October ${y}–March ${n}`, "Report amounts owed to micro and small suppliers for more than 45 days.");
        add("ROC", "msme1", on(y, 10, 31), `MSME-1 for April–September ${y}`, "Report amounts owed to micro and small suppliers for more than 45 days.");
      }
    }
    if (p.entity === "llp") {
      add("ROC", "llp11", on(n, 5, 30), `LLP Form 11 for ${year}`, "Annual return of the LLP. Late filing costs ₹100 a day.");
      add("ROC", "llp8", on(n, 10, 30), `LLP Form 8 for ${year}`, "Statement of accounts and solvency. Late filing costs ₹100 a day.");
      add("ROC", "dir3", on(n, 6, 30), "DIR-3 KYC, if your three-year cycle ends this year",
        "Designated partners with a DIN file KYC once every three financial years. Check each partner's cycle.");
    }
  }

  const seen = new Set<string>();
  return out
    .filter((d) => (seen.has(d.uid) ? false : (seen.add(d.uid), true)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.area.localeCompare(b.area));
}

/** The date a year after `date`, less a day. */
export function yearAfter(date: string): string {
  return plusDays(`${Number(date.slice(0, 4)) + 1}${date.slice(4)}`, -1);
}
