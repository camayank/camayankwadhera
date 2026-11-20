import { useMemo, useState } from "react"

import { inr } from "@/lib/tax/india"
import { parseTable } from "@/lib/tax/reconcile"
import { checkTds, guessTdsColumns, headsOf, readPayments, TDS_RULES, tdsCsv, type Nature, type TdsColumns } from "@/lib/tax/tds"
import { ColumnPick, PasteBox, download } from "./paste"
import { longDate, todayInIndia } from "./shared"

const SAMPLE = `Date\tParty\tPAN\tLedger\tAmount\tTDS
05/04/2026\tMehta & Associates\tAAFFM1234K\tProfessional Fees\t30,000\t0
05/07/2026\tMehta & Associates\tAAFFM1234K\tProfessional Fees\t30,000\t0
10/05/2026\tRaju Transport\tBCDPR4321Q\tFreight Outward\t25,000\t0
10/08/2026\tRaju Transport\tBCDPR4321Q\tFreight Outward\t40,000\t400
15/06/2026\tSunrise Estates Pvt Ltd\tAAJCS9999P\tOffice Rent\t60,000\t6,000
15/07/2026\tSunrise Estates Pvt Ltd\tAAJCS9999P\tOffice Rent\t45,000\t0
20/06/2026\tAnil Kumar\t\tInterest on Unsecured Loan\t12,000\t0
01/09/2026\tPixel Works LLP\tAAMFP2222D\tAdvertisement\t1,20,000\t0
30/06/2026\tBSES\tAAACB1111C\tElectricity\t80,000\t0`

const NATURES: { value: Nature; label: string }[] = [
  ...Object.entries(TDS_RULES).map(([value, r]) => ({ value: value as Nature, label: `${r.label} (old ${r.old})` })),
  { value: "none", label: "No TDS (goods, utilities, taxes, salaries)" },
]

export function TdsCheck() {
  const today = todayInIndia()
  const [text, setText] = useState("")
  const [pick, setPick] = useState<TdsColumns | null>(null)
  const [overrides, setOverrides] = useState<Record<string, Nature>>({})
  const [asOf, setAsOf] = useState(today)
  const [view, setView] = useState<"payees" | "payments">("payees")

  const table = useMemo(() => parseTable(text), [text])
  const cols = pick ?? guessTdsColumns(table)
  const ready = table.rows.length > 0 && cols.date >= 0 && cols.amount >= 0 && cols.head >= 0
  const heads = useMemo(() => (ready ? headsOf(table, cols) : []), [ready, table, JSON.stringify(cols)])
  const result = useMemo(() => {
    if (!ready) return null
    const { payments, skipped } = readPayments(table, cols, overrides)
    return { ...checkTds(payments, { asOf, panColumnMeansMissing: cols.pan >= 0 }), skipped }
  }, [ready, table, JSON.stringify(cols), JSON.stringify(overrides), asOf])
  const set = (patch: Partial<TdsColumns>) => setPick({ ...cols, ...patch })
  const reset = (t: string) => { setText(t); setPick(null); setOverrides({}) }

  return (
    <div className="t-recon">
      <form className="t-form" onSubmit={(e) => e.preventDefault()}>
        <PasteBox id="tds" title="1. Your expense payments" hint="From the ledger or a day book: date, party, the ledger head or narration, the amount before GST, and if you have them, the party's PAN and the TDS deducted. One year at a time, because thresholds count by year." text={text} setText={reset}>
          {table.headers.length > 0 && (
            <div className="t-cols three">
              <ColumnPick id="tds-date" label="Date" headers={table.headers} value={cols.date} onChange={(date) => set({ date })} />
              <ColumnPick id="tds-party" label="Party" headers={table.headers} value={cols.party} onChange={(party) => set({ party })} />
              <ColumnPick id="tds-head" label="Ledger head or narration" headers={table.headers} value={cols.head} onChange={(head) => set({ head })} />
              <ColumnPick id="tds-amount" label="Amount (before GST)" headers={table.headers} value={cols.amount} onChange={(amount) => set({ amount })} />
              <ColumnPick id="tds-pan" label="PAN" headers={table.headers} value={cols.pan} onChange={(pan) => set({ pan })} optional />
              <ColumnPick id="tds-deducted" label="TDS deducted" headers={table.headers} value={cols.deducted} onChange={(deducted) => set({ deducted })} optional />
            </div>
          )}
        </PasteBox>
        {heads.length > 0 && (
          <fieldset>
            <legend>2. What each ledger head is</legend>
            <p className="t-hint">Matched from the words in the head. Correct any that are wrong; the rate and threshold follow.</p>
            <div className="t-heads">
              {heads.map((h) => (
                <div className="t-field" key={h.head}>
                  <label htmlFor={`head-${h.head}`}>{h.head} <small>({h.count})</small></label>
                  <select id={`head-${h.head}`} value={overrides[h.head] ?? h.nature} onChange={(e) => setOverrides({ ...overrides, [h.head]: e.target.value as Nature })}>
                    {NATURES.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="t-field t-period">
              <label htmlFor="tds-asof">Work out interest up to</label>
              <input id="tds-asof" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value || today)} />
            </div>
          </fieldset>
        )}
      </form>
      <p className="t-hint">
        Nothing you paste leaves this page. <button type="button" className="t-link" onClick={() => { reset(SAMPLE); setAsOf("2026-11-20") }}>Try it with sample data</button>
        {text && <> · <button type="button" className="t-link" onClick={() => reset("")}>Clear</button></>}
      </p>

      {result && (
        <section className="t-result wide" aria-live="polite" aria-label="TDS check result">
          <div className="t-headline">
            <p className="t-kicker">TDS not deducted</p>
            <p className="t-big">{result.shortfall > 0 ? inr(result.shortfall) : "None"}</p>
            <p className="t-note">
              {result.shortfall > 0
                ? `Plus about ${inr(result.interest)} of interest at 1% a month to ${longDate(asOf)}. Deduct and pay it now: the interest keeps running, and 30% of the ${inr(result.disallowance / 0.3)} of expenses with nothing deducted is disallowed unless the tax is paid by the return due date.`
                : "Every payment above its threshold had the tax deducted."}
              {result.unclassified > 0 && ` ${result.unclassified} ${result.unclassified === 1 ? "payment was" : "payments were"} treated as not needing TDS; check the heads above.`}
              {result.skipped > 0 && ` ${result.skipped} ${result.skipped === 1 ? "row was" : "rows were"} left out for lack of a date or amount.`}
            </p>
          </div>

          <dl className="t-break">
            <div><dt>TDS that should have been deducted</dt><dd>{inr(result.lines.reduce((s, l) => s + l.required, 0))}</dd></div>
            <div><dt>Shortfall</dt><dd>{inr(result.shortfall)}</dd></div>
            <div><dt>Interest at 1% a month</dt><dd>{inr(result.interest)}</dd></div>
            <div className="sum"><dt>Expense at risk of 30% disallowance</dt><dd>{inr(result.disallowance)}</dd></div>
          </dl>

          <div className="t-filter" role="group" aria-label="Show">
            <button type="button" aria-pressed={view === "payees"} onClick={() => setView("payees")}>By payee ({result.payees.length})</button>
            <button type="button" aria-pressed={view === "payments"} onClick={() => setView("payments")}>By payment ({result.lines.length})</button>
          </div>

          <div className="t-scroll">
            {view === "payees" ? (
              <table className="t-table">
                <caption className="sr-only">Payees and the TDS on their payments</caption>
                <thead><tr><th scope="col">Payee</th><th scope="col">Paid in the year</th><th scope="col">TDS due</th><th scope="col">Shortfall</th><th scope="col">Interest</th></tr></thead>
                <tbody>
                  {result.payees.map((p) => (
                    <tr key={p.key}>
                      <th scope="row">{p.party || p.pan}<small>{TDS_RULES[p.nature as keyof typeof TDS_RULES].label} · old {TDS_RULES[p.nature as keyof typeof TDS_RULES].old} · {p.pan || "no PAN given"}</small></th>
                      <td>{inr(p.total)}</td>
                      <td>{inr(p.required)}</td>
                      <td>{p.shortfall > 0 ? <span className="t-status bad">{inr(p.shortfall)}</span> : "—"}</td>
                      <td>{p.interest > 0 ? inr(p.interest) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="t-table">
                <caption className="sr-only">Each payment</caption>
                <thead><tr><th scope="col">Payment</th><th scope="col">Amount</th><th scope="col">Rate</th><th scope="col">TDS due</th><th scope="col">Deducted</th><th scope="col">Shortfall</th></tr></thead>
                <tbody>
                  {result.lines.map((l, i) => (
                    <tr key={i}>
                      <th scope="row">{l.party}<small>{longDate(l.date)} · {l.head} · {l.reason}</small></th>
                      <td>{inr(l.amount)}</td>
                      <td>{l.liable ? `${+(l.rate * 100).toFixed(1)}%` : "—"}</td>
                      <td>{inr(l.required)}</td>
                      <td>{inr(l.deducted)}</td>
                      <td>{l.shortfall > 0 ? <span className="t-status bad">{inr(l.shortfall)}</span> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="t-next">
            <button type="button" className="btn" onClick={() => download("tds-check.csv", tdsCsv(result))}>Download the check</button>
            <a className="route" href="/tools/compliance-calendar">Next: TDS deposit and return dates</a>
          </div>
          <p className="t-disclaimer">Rates and thresholds of section 393(1) of the Income-tax Act, 2025 for payments to residents, as set by the Finance Act, 2025 and unchanged for Tax Year 2026-27. Interest is under section 398 at 1% a month or part of a month for tax not deducted; tax deducted but paid late carries 1.5%. The 30% disallowance is under section 35 (old 40(a)(ia)). Not covered: salary, payments to non-residents, purchase of goods, property purchase, lower deduction certificates and Form 15G/15H. A ledger head is a guess at the nature of a payment; the contract decides.</p>
        </section>
      )}
    </div>
  )
}
