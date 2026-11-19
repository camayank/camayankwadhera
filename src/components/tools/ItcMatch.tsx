import { useMemo, useState } from "react"

import { chaseMessage, guessGstColumns, itcCsv, matchItc, type GstColumns, type ItcStatus } from "@/lib/tax/gst"
import { inr } from "@/lib/tax/india"
import { parseTable, type Table } from "@/lib/tax/reconcile"
import { ColumnPick, PasteBox, download } from "./paste"

const SAMPLE_2B = `GSTIN of supplier\tTrade/Legal name\tInvoice number\tInvoice Date\tTaxable Value\tIntegrated Tax\tCentral Tax\tState/UT Tax
06AABCN1234F1Z5\tNorthwind Traders\tNW/0101/26-27\t05-10-2026\t1,00,000\t0\t9,000\t9,000
06AABCN1234F1Z5\tNorthwind Traders\tNW/0102/26-27\t12-10-2026\t50,000\t0\t4,500\t4,500
27AAACZ9876Q1ZX\tZeta Supplies\t42/26-27\t20-10-2026\t2,00,000\t36,000\t0\t0
29AAFCL5555K1Z2\tLakeside Services\tLS-9\t28-10-2026\t10,000\t1,800\t0\t0`
const SAMPLE_BOOKS = `Supplier\tGSTIN\tBill No\tBill Date\tTaxable\tIGST\tCGST\tSGST
Northwind Traders Pvt Ltd\t06AABCN1234F1Z5\tNW/101/26-27\t05/10/2026\t1,00,000\t0\t9,000\t9,000
Northwind Traders Pvt Ltd\t06AABCN1234F1Z5\tNW/102/26-27\t12/10/2026\t50,000\t0\t4,000\t4,000
Zeta Supplies\t27AAACZ9876Q1ZX\tZS-42\t20/10/2026\t2,00,000\t36,000\t0\t0
Orbit Packaging\t07AAGCO3333M1Z9\tOP/77\t30/10/2026\t40,000\t0\t3,600\t3,600
Orbit Packaging\t07AAGCO3333M1Z9\tOP/81\t31/10/2026\t25,000\t0\t2,250\t2,250`

const STATUS: Record<ItcStatus, { label: string; tone: string; meaning: string }> = {
  "books-only": { label: "Not in GSTR-2B", tone: "bad", meaning: "You booked credit on these invoices but the supplier has not reported them. Do not claim this credit yet; ask the supplier to file." },
  differs: { label: "Amount differs", tone: "warn", meaning: "The supplier reported a different tax amount. Where 2B is lower, claim only what it shows and ask for a correction; where it is higher, check your booking." },
  "2b-only": { label: "Not in your books", tone: "info", meaning: "The supplier reported these invoices against your GSTIN but your register does not have them. Book them if genuine, or reject them in IMS if not yours." },
  "number-differs": { label: "Probable match", tone: "warn", meaning: "Same supplier and same tax, but the invoice number is written differently. Check them and correct the number in your books if needed." },
  match: { label: "Matches", tone: "good", meaning: "Same supplier, invoice and tax on both sides." },
}

function Pickers({ id, table, cols, setCols }: { id: string; table: Table; cols: GstColumns; setCols: (c: GstColumns) => void }) {
  if (table.headers.length === 0) return null
  return (
    <>
      <div className="t-cols three">
        <ColumnPick id={`${id}-gstin`} label="Supplier GSTIN" headers={table.headers} value={cols.gstin} onChange={(gstin) => setCols({ ...cols, gstin })} />
        <ColumnPick id={`${id}-invoice`} label="Invoice number" headers={table.headers} value={cols.invoice} onChange={(invoice) => setCols({ ...cols, invoice })} />
        <ColumnPick id={`${id}-name`} label="Supplier name" headers={table.headers} value={cols.name} onChange={(name) => setCols({ ...cols, name })} optional />
      </div>
      <fieldset className="t-checks t-taxcols">
        <legend>Tax columns to add up</legend>
        {table.headers.map((h, i) => (
          <label className="t-check" key={i}>
            <input type="checkbox" checked={cols.tax.includes(i)} onChange={(e) => setCols({ ...cols, tax: e.target.checked ? [...cols.tax, i] : cols.tax.filter((c) => c !== i) })} />
            <span>{h || `Column ${i + 1}`}</span>
          </label>
        ))}
      </fieldset>
    </>
  )
}

export function ItcMatch() {
  const [pText, setPText] = useState("")
  const [bText, setBText] = useState("")
  const [pPick, setPPick] = useState<GstColumns | null>(null)
  const [bPick, setBPick] = useState<GstColumns | null>(null)
  const [tolerance, setTolerance] = useState(1)
  const [period, setPeriod] = useState("")
  const [show, setShow] = useState<ItcStatus | "all">("all")
  const [copied, setCopied] = useState("")

  const pTable = useMemo(() => parseTable(pText), [pText])
  const bTable = useMemo(() => parseTable(bText), [bText])
  const pCols = pPick ?? guessGstColumns(pTable)
  const bCols = bPick ?? guessGstColumns(bTable)
  const usable = (t: Table, c: GstColumns) => t.rows.length > 0 && c.gstin >= 0 && c.invoice >= 0 && c.tax.length > 0
  const ready = usable(pTable, pCols) && usable(bTable, bCols)
  const result = useMemo(() => (ready ? matchItc(pTable, pCols, bTable, bCols, tolerance) : null), [ready, pTable, bTable, JSON.stringify(pCols), JSON.stringify(bCols), tolerance])
  const lines = result?.lines.filter((l) => show === "all" || l.status === show) ?? []

  const copy = async (gstin: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(gstin) } catch { setCopied("") }
  }

  return (
    <div className="t-recon">
      <form className="t-form t-two" onSubmit={(e) => e.preventDefault()}>
        <PasteBox id="p" title="1. GSTR-2B" hint="Download GSTR-2B as Excel from the GST portal, open the B2B sheet, and paste the invoice rows with one header row above them." text={pText} setText={(t) => { setPText(t); setPPick(null) }}>
          <Pickers id="p" table={pTable} cols={pCols} setCols={setPPick} />
        </PasteBox>
        <PasteBox id="b" title="2. Your purchase register" hint="The same month's purchases from Tally, Zoho or Excel, with the supplier GSTIN, bill number and tax on each row." text={bText} setText={(t) => { setBText(t); setBPick(null) }}>
          <Pickers id="b" table={bTable} cols={bCols} setCols={setBPick} />
        </PasteBox>
      </form>
      <p className="t-hint">
        Nothing you paste leaves this page. <button type="button" className="t-link" onClick={() => { setPText(SAMPLE_2B); setBText(SAMPLE_BOOKS); setPPick(null); setBPick(null); setPeriod("October 2026") }}>Try it with sample data</button>
        {(pText || bText) && <> · <button type="button" className="t-link" onClick={() => { setPText(""); setBText(""); setPPick(null); setBPick(null) }}>Clear</button></>}
      </p>

      {result && (
        <section className="t-result wide" aria-live="polite" aria-label="Credit match result">
          <div className="t-headline">
            <p className="t-kicker">Credit at risk</p>
            <p className="t-big">{result.atRisk > 0 ? inr(result.atRisk) : "None"}</p>
            <p className="t-note">
              {result.atRisk > 0
                ? `Booked in your register but not supported by GSTR-2B, across ${result.vendors.length} ${result.vendors.length === 1 ? "supplier" : "suppliers"}. Claiming it can mean reversal with interest.`
                : "Every invoice in your register is supported by GSTR-2B."}
              {result.unclaimed > 0 && ` A further ${inr(result.unclaimed)} is in GSTR-2B but not in your books.`}
              {result.skipped > 0 && ` ${result.skipped} ${result.skipped === 1 ? "row was" : "rows were"} left out for lack of a GSTIN or invoice number.`}
            </p>
          </div>

          <dl className="t-break">
            <div><dt>Credit in your books</dt><dd>{inr(result.totals.books)}</dd></div>
            <div><dt>Credit in GSTR-2B</dt><dd>{inr(result.totals.portal)}</dd></div>
            <div><dt>Not supported by 2B</dt><dd>{inr(result.atRisk)}</dd></div>
            <div className="sum"><dt>In 2B, not yet booked</dt><dd>{inr(result.unclaimed)}</dd></div>
          </dl>

          <div className="t-filter" role="group" aria-label="Show">
            <button type="button" aria-pressed={show === "all"} onClick={() => setShow("all")}>All ({result.lines.length})</button>
            {(Object.keys(STATUS) as ItcStatus[]).map((s) => result.counts[s] > 0 && (
              <button type="button" key={s} aria-pressed={show === s} onClick={() => setShow(s)}>{STATUS[s].label} ({result.counts[s]})</button>
            ))}
            <label className="t-tol">Treat as equal within ₹
              <input type="number" min={0} max={100000} value={tolerance} onChange={(e) => setTolerance(Math.max(0, Number(e.target.value) || 0))} />
            </label>
          </div>
          {show !== "all" && <p className="t-note">{STATUS[show].meaning}</p>}

          <div className="t-scroll">
            <table className="t-table">
              <caption className="sr-only">Invoice by invoice comparison</caption>
              <thead><tr><th scope="col">Supplier and invoice</th><th scope="col">Status</th><th scope="col">GST, books</th><th scope="col">GST, 2B</th><th scope="col">Gap</th></tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <th scope="row">{l.supplier || l.gstin}<small>{l.gstin} · {l.invoice}{l.date && ` · ${l.date}`}</small></th>
                    <td><span className={`t-status ${STATUS[l.status].tone}`}>{STATUS[l.status].label}</span></td>
                    <td>{inr(l.booksTax)}</td>
                    <td>{inr(l.portalTax)}</td>
                    <td>{l.gap === 0 ? "—" : (l.gap > 0 ? "+" : "−") + inr(Math.abs(l.gap))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.vendors.length > 0 && (
            <div className="t-chase">
              <p className="t-kicker">Suppliers to chase</p>
              <div className="t-field t-period">
                <label htmlFor="itc-period">Return period for the message</label>
                <input id="itc-period" value={period} placeholder="e.g. October 2026" onChange={(e) => setPeriod(e.target.value)} />
              </div>
              <ol className="t-vendors">
                {result.vendors.map((v) => (
                  <li key={v.gstin}>
                    <div>
                      <strong>{v.supplier || v.gstin}</strong>
                      <span>{v.gstin} · {v.invoices} {v.invoices === 1 ? "invoice" : "invoices"} · {inr(v.taxAtRisk)} at risk</span>
                    </div>
                    <button type="button" className="t-link" onClick={() => copy(v.gstin, chaseMessage(v, period))}>{copied === v.gstin ? "Message copied" : "Copy message for this supplier"}</button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="t-next">
            <button type="button" className="btn" onClick={() => download("itc-match.csv", itcCsv(result))}>Download the comparison</button>
            <a className="route" href="/tools/msme-payments">Next: check payments due to MSME suppliers</a>
          </div>
          <p className="t-disclaimer">Credit can be claimed only on invoices in GSTR-2B, and only if the other conditions are met: the goods or services were received, the tax was paid to the government, and the credit is not blocked. This match checks the first condition on the rows you paste; it does not read your account on the GST portal or decide whether credit is eligible.</p>
        </section>
      )}
    </div>
  )
}
