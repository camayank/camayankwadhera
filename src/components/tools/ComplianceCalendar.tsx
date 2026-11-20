import { useEffect, useMemo, useState } from "react"

import { googleLink, toIcs } from "@/lib/tax/calendar"
import { complianceDates, DEFAULT_BUSINESS, QRMP_22_STATES, yearAfter, type Area, type BusinessProfile, type Entity, type GstScheme } from "@/lib/tax/compliance"
import { download } from "./paste"
import { longDate, todayInIndia } from "./shared"

const KEY = "compliance-profile"

const ENTITIES: { value: Entity; label: string }[] = [
  { value: "company", label: "Private or public company" },
  { value: "llp", label: "LLP" },
  { value: "firm", label: "Partnership firm" },
  { value: "proprietor", label: "Proprietor or professional" },
  { value: "salaried", label: "Individual, no business income" },
]
const GST: { value: GstScheme; label: string }[] = [
  { value: "monthly", label: "Monthly returns" },
  { value: "qrmp", label: "Quarterly returns, monthly payment (QRMP)" },
  { value: "composition", label: "Composition scheme" },
  { value: "none", label: "Not registered" },
]
const AREAS: Area[] = ["Income tax", "TDS", "GST", "Payroll", "ROC"]
const ALERTS = [7, 3, 1]

function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="t-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}{hint && <small className="t-hint" style={{ display: "block", margin: 0 }}>{hint}</small>}</span>
    </label>
  )
}

export function ComplianceCalendar() {
  const today = todayInIndia()
  const [p, setP] = useState<BusinessProfile>(DEFAULT_BUSINESS)
  const [areas, setAreas] = useState<Area[]>(AREAS)
  const [alerts, setAlerts] = useState([7, 1])
  const [showAll, setShowAll] = useState(false)

  // the profile is remembered in this browser only; storage can be unavailable
  useEffect(() => {
    try { const saved = localStorage.getItem(KEY); if (saved) setP({ ...DEFAULT_BUSINESS, ...JSON.parse(saved) }) } catch { /* start with the default */ }
  }, [])
  const update = (patch: Partial<BusinessProfile>) => {
    const next = { ...p, ...patch }
    if (next.entity === "company") next.audit = true
    if (next.entity === "salaried") { next.audit = false; next.gst = "none"; next.tds = false; next.payroll = false }
    setP(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* kept for this visit */ }
  }

  const all = useMemo(() => complianceDates(p, today, yearAfter(today)), [p, today])
  const dates = all.filter((d) => areas.includes(d.area))
  const next30 = dates.filter((d) => d.date <= addDaysLocal(today, 30)).length
  const business = p.entity !== "salaried"
  const soon = addDaysLocal(today, 90)
  const listed = showAll ? dates : dates.filter((d) => d.date <= soon)

  return (
    <div className="t-dates">
      <div>
        <form className="t-form" onSubmit={(e) => e.preventDefault()}>
          <fieldset>
            <legend>Your business</legend>
            <div className="t-cols">
              <div className="t-field">
                <label htmlFor="c-entity">Type</label>
                <select id="c-entity" value={p.entity} onChange={(e) => update({ entity: e.target.value as Entity })}>
                  {ENTITIES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </div>
              {business && (
                <div className="t-field">
                  <label htmlFor="c-gst">GST</label>
                  <select id="c-gst" value={p.gst} onChange={(e) => update({ gst: e.target.value as GstScheme })}>
                    {GST.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                  </select>
                </div>
              )}
              {p.gst === "qrmp" && (
                <div className="t-field">
                  <label htmlFor="c-qrmp">Your state</label>
                  <select id="c-qrmp" value={p.qrmpDay} onChange={(e) => update({ qrmpDay: Number(e.target.value) as 22 | 24 })}>
                    <option value={22}>GSTR-3B on the 22nd (western and southern states)</option>
                    <option value={24}>GSTR-3B on the 24th (all other states)</option>
                  </select>
                  <p className="t-hint">The 22nd applies in {QRMP_22_STATES.join(", ")}.</p>
                </div>
              )}
              {p.entity === "company" && (
                <div className="t-field">
                  <label htmlFor="c-agm">AGM date</label>
                  <input id="c-agm" type="date" value={`${today.slice(0, 4)}-${p.agm}`} max={`${today.slice(0, 4)}-09-30`} onChange={(e) => e.target.value && update({ agm: e.target.value.slice(5) })} />
                  <p className="t-hint">By 30 September. AOC-4 and MGT-7 count from it.</p>
                </div>
              )}
            </div>
            {business && (
              <div className="t-checks t-checks-light">
                {p.entity !== "company" && <Check label="Accounts are audited for income tax" checked={p.audit} onChange={(audit) => update({ audit })} />}
                {p.entity !== "company" && <Check label="Presumptive income (one advance tax date)" checked={p.presumptive} onChange={(presumptive) => update({ presumptive })} />}
                <Check label="Transfer pricing report needed" checked={p.transferPricing} onChange={(transferPricing) => update({ transferPricing })} />
                <Check label="Deducts TDS" checked={p.tds} onChange={(tds) => update({ tds })} />
                <Check label="Pays PF or ESI" checked={p.payroll} onChange={(payroll) => update({ payroll })} />
                {(p.gst === "monthly" || p.gst === "qrmp") && <Check label="GST turnover above ₹5 crore" checked={p.over5crore} onChange={(over5crore) => update({ over5crore })} />}
                {p.entity === "company" && <Check label="Owes MSME suppliers beyond 45 days" checked={p.msmeDues} onChange={(msmeDues) => update({ msmeDues })} />}
              </div>
            )}
          </fieldset>
          <fieldset className="t-checks t-checks-light">
            <legend>Show</legend>
            {AREAS.map((a) => <Check key={a} label={a} checked={areas.includes(a)} onChange={(v) => setAreas(v ? [...areas, a] : areas.filter((x) => x !== a))} />)}
          </fieldset>
        </form>

        <ol className="t-datelist t-cal">
          {listed.map((d, i) => (
            <li key={d.uid} className={i === 0 ? "now" : undefined}>
              <p className="t-date">{longDate(d.date)}<small>{d.area}</small></p>
              <div>
                <strong>{d.title}</strong>
                <p className="t-amount">{d.detail}</p>
                <a className="route" href={googleLink(d)} target="_blank" rel="noopener">Add to Google Calendar</a>
              </div>
            </li>
          ))}
          {dates.length === 0 && <li><p>No dates for the choices above.</p></li>}
        </ol>
        {listed.length < dates.length && (
          <button type="button" className="t-add t-more" onClick={() => setShowAll(true)}>Show all {dates.length} dates for the next twelve months</button>
        )}
      </div>

      <div className="t-result">
        <p className="t-kicker">The next twelve months</p>
        <p className="t-big">{dates.length} dates</p>
        <p className="t-note">{next30} in the next 30 days. Download them all as one calendar file for Apple Calendar, Outlook or Google Calendar, with alerts before each date.</p>
        <fieldset className="t-checks">
          <legend>Remind me</legend>
          {ALERTS.map((days) => (
            <label className="t-check" key={days}>
              <input type="checkbox" checked={alerts.includes(days)} onChange={(e) => setAlerts(e.target.checked ? [...alerts, days] : alerts.filter((x) => x !== days))} />
              <span>{days === 1 ? "The day before" : `${days} days before`}</span>
            </label>
          ))}
        </fieldset>
        <button type="button" className="btn solid" disabled={dates.length === 0} onClick={() => download("compliance-calendar.ics", toIcs(dates, alerts, new Date(), "Compliance dates"), "text/calendar")}>Download calendar file</button>
        <p className="t-hint">Your choices are remembered in this browser only.</p>
        <p className="t-disclaimer">Statutory due dates as they stand in November 2026, under the Income-tax Act, 2025, the GST law and the Companies Act, 2013. Governments extend dates by notification, and a date falling on a holiday may move; check the portal close to each date. State professional tax, labour returns and event-based filings are not included.</p>
      </div>
    </div>
  )
}

function addDaysLocal(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
