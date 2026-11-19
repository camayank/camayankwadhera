import { useMemo, useState } from "react"

import { inr } from "@/lib/tax/india"
import { guessColumns, parseTable, reconcile, toCsv, type Columns, type Status } from "@/lib/tax/reconcile"
import { useProfile } from "./shared"

const SAMPLE_STATEMENT = `Deductor\tTAN\tAmount paid or credited\tTax deducted
HDFC Bank Ltd\tMUMH03189E\t1,84,500\t18,450
Northwind Ventures Pvt Ltd\tDELN04521B\t24,00,000\t2,40,000
Zeta Securities Ltd\tBLRZ00417C\t3,10,000\t31,000
Orbit Technologies Ltd\tPNEO11872A\t6,00,000\t60,000`
const SAMPLE_RECORDS = `Party\tTAN\tIncome booked\tTDS expected
HDFC Bank\tMUMH03189E\t1,84,500\t18,450
Northwind Ventures\tDELN04521B\t21,00,000\t2,10,000
Orbit Technologies\tPNEO11872A\t6,00,000\t60,000
Lakeside Advisors LLP\tHYDL07733D\t4,50,000\t45,000`

const STATUS: Record<Status, { label: string; meaning: string }> = {
  differs: { label: "Amounts differ", meaning: "Both sides show this party with different figures. Check for a payment booked in another year, or tax deducted on an advance." },
  "statement-only": { label: "Only in the statement", meaning: "The department has income reported against your PAN that your records do not show. Report it, or ask the payer to correct their filing if it is wrong." },
  "records-only": { label: "Only in your records", meaning: "You booked income the statement does not show. If tax was deducted, the payer may not have filed or may have quoted a wrong PAN, and the credit will not reach you until they do." },
  match: { label: "Matches", meaning: "Same figures on both sides." },
}

function Side({ id, title, hint, text, setText, cols, setCols, headers }: {
  id: string; title: string; hint: string; text: string; setText: (t: string) => void
  cols: Columns; setCols: (c: Columns) => void; headers: string[]
}) {
  const pick = (key: keyof Columns, label: string, optional = false) => (
    <div className="t-field">
      <label htmlFor={`${id}-${key}`}>{label}</label>
      <select id={`${id}-${key}`} value={cols[key]} onChange={(e) => setCols({ ...cols, [key]: Number(e.target.value) })}>
        {(optional || cols[key] === -1) && <option value={-1}>{optional ? "None" : "Choose a column"}</option>}
        {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
      </select>
    </div>
  )
  return (
    <fieldset>
      <legend>{title}</legend>
      <p className="t-hint" id={`${id}-hint`}>{hint}</p>
      <label className="sr-only" htmlFor={`${id}-text`}>{title}: paste the table here</label>
      <textarea id={`${id}-text`} aria-describedby={`${id}-hint`} spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste rows here, with the header row first" />
      <label className="t-file">
        <span>or choose a CSV file</span>
        <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setText(await file.text()) }} />
      </label>
      {headers.length > 0 && (
        <div className="t-cols three">
          {pick("party", "Party or TAN column")}
          {pick("amount", "Amount column")}
          {pick("tax", "Tax deducted column", true)}
        </div>
      )}
    </fieldset>
  )
}

export function Reconcile() {
  const { profile, update } = useProfile()
  const [sText, setSText] = useState("")
  const [rText, setRText] = useState("")
  const [sPick, setSPick] = useState<Columns | null>(null)
  const [rPick, setRPick] = useState<Columns | null>(null)
  const [tolerance, setTolerance] = useState(1)
  const [show, setShow] = useState<Status | "all">("all")
  const [applied, setApplied] = useState(false)

  const sTable = useMemo(() => parseTable(sText), [sText])
  const rTable = useMemo(() => parseTable(rText), [rText])
  const sCols = sPick ?? guessColumns(sTable)
  const rCols = rPick ?? guessColumns(rTable)
  const ready = sTable.rows.length > 0 && rTable.rows.length > 0 && sCols.party >= 0 && sCols.amount >= 0 && rCols.party >= 0 && rCols.amount >= 0
  const result = useMemo(() => (ready ? reconcile(sTable, sCols, rTable, rCols, tolerance) : null), [ready, sTable, rTable, sCols.party, sCols.amount, sCols.tax, rCols.party, rCols.amount, rCols.tax, tolerance])
  const lines = result?.lines.filter((line) => show === "all" || line.status === show) ?? []
  const open = result ? result.counts.differs + result.counts["statement-only"] + result.counts["records-only"] : 0
  const hasTax = sCols.tax >= 0

  const download = () => {
    if (!result) return
    const url = URL.createObjectURL(new Blob([toCsv(result)], { type: "text/csv" }))
    Object.assign(document.createElement("a"), { href: url, download: "tax-statement-reconciliation.csv" }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="t-recon">
      <form className="t-form t-two" onSubmit={(e) => e.preventDefault()}>
        <Side id="s" title="1. Your tax statement" hint="The TDS or income rows from your AIS or Form 26AS. Copy them into a spreadsheet, then paste the cells here." text={sText} setText={(t) => { setSText(t); setSPick(null); setApplied(false) }} cols={sCols} setCols={setSPick} headers={sTable.headers} />
        <Side id="r" title="2. Your own records" hint="The same income from your books, broker statements or invoices, with a party name or TAN and an amount on each row." text={rText} setText={(t) => { setRText(t); setRPick(null) }} cols={rCols} setCols={setRPick} headers={rTable.headers} />
      </form>
      <p className="t-hint">
        Nothing you paste leaves this page. <button type="button" className="t-link" onClick={() => { setSText(SAMPLE_STATEMENT); setRText(SAMPLE_RECORDS); setSPick(null); setRPick(null) }}>Try it with sample data</button>
        {(sText || rText) && <> · <button type="button" className="t-link" onClick={() => { setSText(""); setRText(""); setSPick(null); setRPick(null) }}>Clear</button></>}
      </p>

      {result && (
        <section className="t-result wide" aria-live="polite" aria-label="Reconciliation result">
          <div className="t-headline">
            <p className="t-kicker">Result</p>
            <p className="t-big">{open === 0 ? "Everything matches" : `${open} ${open === 1 ? "party needs" : "parties need"} a look`}</p>
            <p className="t-note">{result.counts.match} of {result.lines.length} parties match. Rows are grouped by TAN or PAN where one is present, otherwise by name.{result.skipped > 0 && ` ${result.skipped} ${result.skipped === 1 ? "row was" : "rows were"} left out as blank or total lines.`}</p>
          </div>

          <div className="t-filter" role="group" aria-label="Show">
            <button type="button" aria-pressed={show === "all"} onClick={() => setShow("all")}>All ({result.lines.length})</button>
            {(Object.keys(STATUS) as Status[]).map((status) => result.counts[status] > 0 && (
              <button type="button" key={status} aria-pressed={show === status} onClick={() => setShow(status)}>{STATUS[status].label} ({result.counts[status]})</button>
            ))}
            <label className="t-tol">Treat as equal within ₹
              <input type="number" min={0} max={100000} value={tolerance} onChange={(e) => setTolerance(Math.max(0, Number(e.target.value) || 0))} />
            </label>
          </div>
          {show !== "all" && <p className="t-note">{STATUS[show].meaning}</p>}

          <div className="t-scroll">
            <table className="t-table">
              <caption className="sr-only">Party by party comparison</caption>
              <thead><tr><th scope="col">Party</th><th scope="col">Status</th><th scope="col">Statement</th><th scope="col">Records</th><th scope="col">Gap</th>{hasTax && <><th scope="col">Tax, statement</th><th scope="col">Tax, records</th></>}</tr></thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.key}>
                    <th scope="row">{line.label}{line.label.toUpperCase().includes(line.key) ? "" : <small>{line.key}</small>}</th>
                    <td><span className={`t-status ${line.status}`}>{STATUS[line.status].label}</span></td>
                    <td>{inr(line.statementAmount)}</td>
                    <td>{inr(line.recordsAmount)}</td>
                    <td>{line.amountGap === 0 ? "—" : (line.amountGap > 0 ? "+" : "−") + inr(Math.abs(line.amountGap))}</td>
                    {hasTax && <><td>{inr(line.statementTax)}</td><td>{inr(line.recordsTax)}</td></>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><th scope="row">Total</th><td></td><td>{inr(result.totals.statementAmount)}</td><td>{inr(result.totals.recordsAmount)}</td><td>{inr(result.totals.statementAmount - result.totals.recordsAmount)}</td>{hasTax && <><td>{inr(result.totals.statementTax)}</td><td>{inr(result.totals.recordsTax)}</td></>}</tr>
              </tfoot>
            </table>
          </div>

          <div className="t-next">
            <button type="button" className="btn" onClick={download}>Download the comparison</button>
            {hasTax && result.totals.statementTax > 0 && (
              applied
                ? <a className="route" href="/tools/advance-tax">TDS set to {inr(result.totals.statementTax)}. Open the calculator</a>
                : <button type="button" className="t-link" onClick={() => { update({ ...profile, tds: Math.round(result.totals.statementTax) }); setApplied(true) }}>Use {inr(result.totals.statementTax)} as my TDS so far in the calculator</button>
            )}
          </div>
          <p className="t-disclaimer">The statement shows what payers have reported so far; tax deducted late in a quarter appears only after they file. The credit you can claim is what the statement shows by the time you file your return. This comparison works on the rows you paste and does not read your account on the tax portal.</p>
        </section>
      )}
    </div>
  )
}
