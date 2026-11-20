import { useMemo, useState, type ClipboardEvent } from "react"

import { emptyYear, FIELDS, MONTHS, parseGrid, reconcileYear, type Field, type Month } from "@/lib/tax/gstr9"
import { inr } from "@/lib/tax/india"
import { download } from "./paste"
import { longDate, todayInIndia } from "./shared"

function sample(): Month[] {
  const base = [42, 38, 45, 50, 47, 52, 60, 58, 55, 49, 51, 64].map((l) => l * 100_000)
  return base.map((sales, i) => {
    const tax = Math.round(sales * 0.18)
    const itc = Math.round(tax * 0.55)
    const m: Month = { salesBooks: sales, sales1: sales, sales3b: sales, taxBooks: tax, tax1: tax, tax3b: tax, itcBooks: itc, itc2b: itc, itc3b: itc }
    if (i === 2) m.tax3b = tax - 45_000
    if (i === 7) { m.itc2b = itc - 38_000 }
    if (i === 9) { m.itc3b = itc - 62_000 }
    if (i === 11) { m.salesBooks = sales + 250_000; m.taxBooks = tax + 45_000 }
    return m
  })
}

export function Gstr9Recon() {
  const today = todayInIndia()
  // the year whose 30 November date is next: before December, last year
  const defaultStart = Number(today.slice(0, 4)) - (today.slice(5) >= "12-01" ? 0 : 1)
  const [start, setStart] = useState(defaultStart)
  const [year, setYear] = useState<Month[]>(emptyYear)
  const [asOf, setAsOf] = useState(today)
  const filled = year.some((m) => FIELDS.some((f) => m[f.key] !== 0))
  const r = useMemo(() => reconcileYear(year, start, asOf), [year, start, asOf])
  const fy = `${start}-${String((start + 1) % 100).padStart(2, "0")}`

  const setCell = (row: number, key: Field, value: number) => setYear((y) => y.map((m, i) => (i === row ? { ...m, [key]: value } : m)))
  const onPaste = (row: number, col: number) => (e: ClipboardEvent<HTMLInputElement>) => {
    const grid = parseGrid(e.clipboardData.getData("text"))
    if (grid.length <= 1 && (grid[0]?.length ?? 0) <= 1) return // a single value: let the input take it
    e.preventDefault()
    setYear((y) => y.map((m, i) => {
      const line = grid[i - row]
      if (!line) return m
      const next = { ...m }
      line.forEach((v, j) => { const f = FIELDS[col + j]; if (f) next[f.key] = v })
      return next
    }))
  }
  const csv = () => {
    const head = ["Month", ...FIELDS.map((f) => f.label), "Sales not in GSTR-1", "Tax short paid", "Credit above 2B", "Interest at 18%"]
    const lines = year.map((m, i) => [r.months[i].month, ...FIELDS.map((f) => m[f.key]), r.months[i].unreported, r.months[i].shortPaid, r.months[i].excessItc, r.months[i].interest].join(","))
    return [head.join(","), ...lines, ["Total", ...FIELDS.map((f) => r.totals[f.key])].join(",")].join("\r\n")
  }

  return (
    <div className="t-recon">
      <form className="t-form" onSubmit={(e) => e.preventDefault()}>
        <fieldset>
          <legend>1. The year</legend>
          <div className="t-cols three">
            <div className="t-field">
              <label htmlFor="g9-year">Financial year</label>
              <select id="g9-year" value={start} onChange={(e) => setStart(Number(e.target.value))}>
                {[defaultStart - 1, defaultStart, defaultStart + 1].map((y) => <option key={y} value={y}>{y}-{String((y + 1) % 100).padStart(2, "0")}</option>)}
              </select>
            </div>
            <div className="t-field">
              <label htmlFor="g9-asof">Check as on</label>
              <input id="g9-asof" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value || today)} />
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>2. Month by month</legend>
          <p className="t-hint">Taxable values and tax from your books, GSTR-1, GSTR-3B and GSTR-2B. Copy a block of cells from Excel and paste it into the first cell; it fills across and down. Monthly filers only; for QRMP, enter each quarter's figures in its last month.</p>
        </fieldset>
      </form>
      <div className="t-scroll t-grid-wrap">
        <table className="t-grid">
          <caption className="sr-only">Figures for each month of {fy}</caption>
          <thead>
            <tr><th scope="col">Month</th>{FIELDS.map((f) => <th scope="col" key={f.key}>{f.label}</th>)}</tr>
          </thead>
          <tbody>
            {year.map((m, i) => (
              <tr key={i}>
                <th scope="row">{MONTHS[i].slice(0, 3)} {i < 9 ? start : start + 1}</th>
                {FIELDS.map((f, j) => (
                  <td key={f.key}>
                    <input aria-label={`${f.label}, ${MONTHS[i]}`} inputMode="decimal" value={m[f.key] ? m[f.key].toLocaleString("en-IN") : ""}
                      onChange={(e) => setCell(i, f.key, Number(e.target.value.replace(/[^\d.-]/g, "")) || 0)} onPaste={onPaste(i, j)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th scope="row">Year</th>{FIELDS.map((f) => <td key={f.key}>{r.totals[f.key] ? inr(r.totals[f.key]) : "—"}</td>)}</tr>
          </tfoot>
        </table>
      </div>
      <p className="t-hint">
        Nothing you enter leaves this page. <button type="button" className="t-link" onClick={() => { setYear(sample()); setStart(2025); setAsOf("2026-11-20") }}>Try it with sample data</button>
        {filled && <> · <button type="button" className="t-link" onClick={() => setYear(emptyYear())}>Clear</button></>}
      </p>

      {filled && (
        <section className="t-result wide" aria-live="polite" aria-label="GSTR-9 reconciliation result">
          <div className="t-headline">
            <p className="t-kicker">{fy} · {r.daysToCutoff >= 0 ? `${r.daysToCutoff} days to ${longDate(r.cutoff)}` : `the ${longDate(r.cutoff)} date has passed`}</p>
            <p className="t-big">{r.actions[0].tone === "good" ? "Reconciled" : `${r.actions.length} ${r.actions.length === 1 ? "thing" : "things"} to fix`}</p>
            <p className="t-note">{longDate(r.cutoff)} is the last date to claim the year's credit and correct its GSTR-1 and GSTR-3B, or the date GSTR-9 is filed if that is earlier. GSTR-9{r.totals.salesBooks > 50_000_000 ? " and 9C are" : " is"} due by 31 December {start + 1}.</p>
          </div>

          <ol className="t-actions">
            {r.actions.map((a, i) => (
              <li key={i}><span className={`t-status ${a.tone}`}>{a.tone === "good" ? "Done" : a.tone === "bad" ? "Fix" : "Act"}</span><div><strong>{a.title}</strong><p>{a.detail}</p></div></li>
            ))}
          </ol>

          <dl className="t-break">
            <div><dt>Credit to claim before the cut-off</dt><dd>{inr(r.unclaimedItc)}</dd></div>
            <div><dt>Credit claimed beyond GSTR-2B</dt><dd>{inr(r.excessItc)}</dd></div>
            <div><dt>Tax in GSTR-1 not paid in GSTR-3B</dt><dd>{inr(r.shortPaid)}</dd></div>
            <div className="sum"><dt>Interest at 18% to {longDate(asOf)}</dt><dd>{inr(r.interest)}</dd></div>
          </dl>

          <div className="t-scroll">
            <table className="t-table">
              <caption className="sr-only">Differences by month</caption>
              <thead><tr><th scope="col">Month</th><th scope="col">Sales not in GSTR-1</th><th scope="col">Tax short paid</th><th scope="col">Credit above 2B</th><th scope="col">Interest</th></tr></thead>
              <tbody>
                {r.months.filter((m) => m.unreported || m.shortPaid || m.excessItc).map((m) => (
                  <tr key={m.month}>
                    <th scope="row">{m.month}<small>GSTR-3B due {longDate(m.due)}</small></th>
                    <td>{m.unreported ? inr(m.unreported) : "—"}</td>
                    <td>{m.shortPaid ? <span className="t-status bad">{inr(m.shortPaid)}</span> : "—"}</td>
                    <td>{m.excessItc ? <span className="t-status bad">{inr(m.excessItc)}</span> : "—"}</td>
                    <td>{m.interest ? inr(m.interest) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="t-next">
            <button type="button" className="btn" onClick={() => download(`gstr9-reconciliation-${fy}.csv`, csv())}>Download the working</button>
            <a className="route" href="/tools/gst-itc">Find which invoices are missing from GSTR-2B</a>
          </div>
          <p className="t-disclaimer">A month showing more credit in GSTR-3B than in GSTR-2B can still be right: credit carried from an earlier month, import credit and reverse charge do not line up with 2B month by month, which is why the year's total decides the reversal. Interest is worked out from each month's GSTR-3B due date at 18% a year; the law charges it only on tax paid from cash and on excess credit that was used, so treat it as the most it could be. Section 16(4) of the CGST Act; sections 37, 39 and 50.</p>
        </section>
      )}
    </div>
  )
}
