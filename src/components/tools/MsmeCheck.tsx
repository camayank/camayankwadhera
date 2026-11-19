import { useMemo, useState } from "react"

import { inr } from "@/lib/tax/india"
import { checkMsme, guessMsmeColumns, msmeCsv, MSME_RULES, type MsmeColumns, type MsmeSettings, type MsmeStatus } from "@/lib/tax/msme"
import { parseTable } from "@/lib/tax/reconcile"
import { ColumnPick, PasteBox, download } from "./paste"
import { longDate, todayInIndia } from "./shared"

const SAMPLE = `Supplier\tMSME category\tInvoice date\tCredit days\tAmount\tPaid on
Asha Castings\tMicro\t01/06/2026\t45\t2,00,000\t10/07/2026
Bharat Tools\tSmall\t01/09/2026\t30\t1,50,000\t
Chitra Prints\tMicro\t10/11/2026\t\t40,000\t
Kiran Fabricators\tSmall\t15/07/2026\t45\t3,20,000\t02/10/2026
Delta Steel\tMedium\t01/05/2026\t60\t5,00,000\t
Eastern Traders\tMicro (Trader)\t01/08/2026\t\t75,000\t`

const STATUS: Record<MsmeStatus, { label: string; tone: string; meaning: string }> = {
  disallowed: { label: "Deduction lost", tone: "bad", meaning: "Paid, or still unpaid, after both the due date and the end of the year. The expense is deductible only in the year it is paid." },
  overdue: { label: "Overdue", tone: "bad", meaning: "Past the due date and unpaid. Pay before the year ends and the expense stays deductible this year; MSMED interest is still owed from the due date." },
  upcoming: { label: "Pay by", tone: "warn", meaning: "Not yet due. Pay by the date shown to keep the deduction and avoid MSMED interest." },
  "late-paid": { label: "Paid late", tone: "warn", meaning: "Paid after the due date but within the year, so still deductible this year. The supplier is owed MSMED interest, which is not deductible." },
  "on-time": { label: "On time", tone: "good", meaning: "Paid within the time limit." },
  "not-covered": { label: "Not covered", tone: "muted", meaning: "Medium enterprises, traders and suppliers without Udyam registration as micro or small are outside the rule." },
  "other-year": { label: "Other year", tone: "muted", meaning: "Accepted outside the tax year being checked." },
}

const RATES = [
  { label: "Company, concessional regime (25.17%)", rate: 0.25168 },
  { label: "Firm or LLP (31.2%; 34.94% above ₹1 crore)", rate: 0.312 },
  { label: "Individual at the top slab (31.2% and up)", rate: 0.312 },
]

export function MsmeCheck() {
  const today = todayInIndia()
  const thisYearEnd = `${Number(today.slice(0, 4)) + (today.slice(5) > "03-31" ? 1 : 0)}-03-31`
  const [text, setText] = useState("")
  const [pick, setPick] = useState<MsmeColumns | null>(null)
  const [s, setS] = useState<MsmeSettings>({ yearEnd: thisYearEnd, asOf: today, defaultAgreedDays: 0, unlabelled: "covered" })
  const [rateIndex, setRateIndex] = useState(0)
  const rate = RATES[rateIndex].rate
  const [show, setShow] = useState<MsmeStatus | "all">("all")

  const table = useMemo(() => parseTable(text), [text])
  const cols = pick ?? guessMsmeColumns(table)
  const ready = table.rows.length > 0 && cols.accepted >= 0 && cols.amount >= 0
  const result = useMemo(() => (ready ? checkMsme(table, cols, s) : null), [ready, table, JSON.stringify(cols), JSON.stringify(s)])
  const bills = result?.bills.filter((b) => show === "all" || b.status === show) ?? []
  const atStake = result ? result.disallowed + result.overdue : 0
  const set = (patch: Partial<MsmeColumns>) => setPick({ ...cols, ...patch })
  const yearLabel = (end: string) => `${Number(end.slice(0, 4)) - 1}-${end.slice(2, 4)}`

  return (
    <div className="t-recon">
      <form className="t-form" onSubmit={(e) => e.preventDefault()}>
        <PasteBox id="m" title="1. Bills from micro and small suppliers" hint="Your payables or purchase list: supplier, the date goods or services were accepted (or the invoice date), the amount, and if you have them, the MSME category, the credit days agreed in writing and the date paid." text={text} setText={(t) => { setText(t); setPick(null) }}>
          {table.headers.length > 0 && (
            <div className="t-cols three">
              <ColumnPick id="m-supplier" label="Supplier" headers={table.headers} value={cols.supplier} onChange={(supplier) => set({ supplier })} optional />
              <ColumnPick id="m-accepted" label="Accepted on (or invoice date)" headers={table.headers} value={cols.accepted} onChange={(accepted) => set({ accepted })} />
              <ColumnPick id="m-amount" label="Amount" headers={table.headers} value={cols.amount} onChange={(amount) => set({ amount })} />
              <ColumnPick id="m-category" label="MSME category" headers={table.headers} value={cols.category} onChange={(category) => set({ category })} optional />
              <ColumnPick id="m-days" label="Credit days agreed" headers={table.headers} value={cols.agreedDays} onChange={(agreedDays) => set({ agreedDays })} optional />
              <ColumnPick id="m-paid" label="Paid on" headers={table.headers} value={cols.paid} onChange={(paid) => set({ paid })} optional />
            </div>
          )}
        </PasteBox>
        <fieldset>
          <legend>2. The year and your terms</legend>
          <div className="t-cols three">
            <div className="t-field">
              <label htmlFor="m-year">Tax year</label>
              <select id="m-year" value={s.yearEnd} onChange={(e) => setS({ ...s, yearEnd: e.target.value })}>
                {[-1, 0].map((k) => { const end = `${Number(thisYearEnd.slice(0, 4)) + k}-03-31`; return <option key={end} value={end}>{yearLabel(end)}</option> })}
              </select>
            </div>
            <div className="t-field">
              <label htmlFor="m-asof">Check as on</label>
              <input id="m-asof" type="date" value={s.asOf} onChange={(e) => setS({ ...s, asOf: e.target.value || today })} />
            </div>
            <div className="t-field">
              <label htmlFor="m-default">Where a bill shows no credit days</label>
              <select id="m-default" value={s.defaultAgreedDays} onChange={(e) => setS({ ...s, defaultAgreedDays: Number(e.target.value) })}>
                <option value={0}>No written agreement: 15 days</option>
                <option value={30}>Written agreement: 30 days</option>
                <option value={45}>Written agreement: 45 days</option>
              </select>
            </div>
            <div className="t-field">
              <label htmlFor="m-unlabelled">Where a bill shows no category</label>
              <select id="m-unlabelled" value={s.unlabelled} onChange={(e) => setS({ ...s, unlabelled: e.target.value as MsmeSettings["unlabelled"] })}>
                <option value="covered">Treat as micro or small</option>
                <option value="not-covered">Leave it out</option>
              </select>
            </div>
            <div className="t-field">
              <label htmlFor="m-rate">Your tax rate</label>
              <select id="m-rate" value={rateIndex} onChange={(e) => setRateIndex(Number(e.target.value))}>
                {RATES.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
              </select>
            </div>
          </div>
        </fieldset>
      </form>
      <p className="t-hint">
        Nothing you paste leaves this page. <button type="button" className="t-link" onClick={() => { setText(SAMPLE); setPick(null); setS({ ...s, yearEnd: "2027-03-31", asOf: "2026-11-20" }) }}>Try it with sample data</button>
        {text && <> · <button type="button" className="t-link" onClick={() => { setText(""); setPick(null) }}>Clear</button></>}
      </p>

      {result && (
        <section className="t-result wide" aria-live="polite" aria-label="MSME payment check result">
          <div className="t-headline">
            <p className="t-kicker">Deduction at stake for {yearLabel(s.yearEnd)}</p>
            <p className="t-big">{atStake > 0 ? inr(atStake) : "None"}</p>
            <p className="t-note">
              {atStake > 0
                ? `That is about ${inr(atStake * rate)} of extra tax for the year at your rate.${result.overdue > 0 && s.asOf <= s.yearEnd ? ` Paying the ${inr(result.overdue)} that is overdue before ${longDate(s.yearEnd)} keeps it deductible this year.` : ""}`
                : "No bill to a micro or small supplier has lost its deduction."}
              {result.upcoming > 0 && ` ${inr(result.upcoming)} more falls due soon; the dates are below.`}
              {result.skipped > 0 && ` ${result.skipped} ${result.skipped === 1 ? "row was" : "rows were"} left out for lack of a date or amount.`}
            </p>
          </div>

          <dl className="t-break">
            <div><dt>Deduction lost for the year</dt><dd>{inr(result.disallowed)}</dd></div>
            <div><dt>Overdue, still payable this year</dt><dd>{inr(result.overdue)}</dd></div>
            <div><dt>Not yet due</dt><dd>{inr(result.upcoming)}</dd></div>
            <div className="sum"><dt>Paid late; MSMED interest owed</dt><dd>{inr(result.latePaid)}</dd></div>
          </dl>

          <div className="t-filter" role="group" aria-label="Show">
            <button type="button" aria-pressed={show === "all"} onClick={() => setShow("all")}>All ({result.bills.length})</button>
            {(Object.keys(STATUS) as MsmeStatus[]).map((st) => result.counts[st] > 0 && (
              <button type="button" key={st} aria-pressed={show === st} onClick={() => setShow(st)}>{STATUS[st].label} ({result.counts[st]})</button>
            ))}
          </div>
          {show !== "all" && <p className="t-note">{STATUS[show].meaning}</p>}

          <div className="t-scroll">
            <table className="t-table">
              <caption className="sr-only">Bill by bill check</caption>
              <thead><tr><th scope="col">Supplier</th><th scope="col">Status</th><th scope="col">Amount</th><th scope="col">Accepted</th><th scope="col">Pay by</th><th scope="col">Paid</th><th scope="col">Days late</th></tr></thead>
              <tbody>
                {bills.map((b, i) => (
                  <tr key={i}>
                    <th scope="row">{b.supplier || "—"}<small>{b.category === "unknown" ? "category not given" : b.category} · {b.limitDays} days</small></th>
                    <td><span className={`t-status ${STATUS[b.status].tone}`}>{STATUS[b.status].label}</span></td>
                    <td>{inr(b.amount)}</td>
                    <td>{longDate(b.accepted)}</td>
                    <td>{b.status === "not-covered" || b.status === "other-year" ? "—" : longDate(b.due)}</td>
                    <td>{b.paid ? longDate(b.paid) : "Unpaid"}</td>
                    <td>{b.daysLate || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="t-next">
            <button type="button" className="btn" onClick={() => download("msme-payments.csv", msmeCsv(result))}>Download the check</button>
            <a className="route" href="/tools/compliance-calendar">Next: your full compliance calendar</a>
          </div>
          <p className="t-disclaimer">Based on {MSME_RULES.section} ({MSME_RULES.oldSection}) and section 15 of the MSMED Act, 2006. The rule covers only suppliers registered on Udyam as micro or small enterprises, other than traders, from the date of their registration. The time limit counts from the day goods or services are accepted, which can be later than the invoice date. Companies also report dues outstanding beyond 45 days in MSME-1. This is software working on the rows you paste, not a tax audit opinion.</p>
        </section>
      )}
    </div>
  )
}
