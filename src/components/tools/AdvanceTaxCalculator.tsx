import { useMemo } from "react"

import { RULES, inr, plan, type Profile } from "@/lib/tax/india"
import { Disclaimer, Money, TimedList, hasFigures, longDate, todayInIndia, useProfile } from "./shared"

const PAID_LABELS = ["By 15 June", "16 June to 15 September", "16 September to 15 December", "16 December to 15 March", "16 to 31 March"]

export function AdvanceTaxCalculator() {
  const { profile: p, update, clear } = useProfile()
  const set = (patch: Partial<Profile>) => update({ ...p, ...patch })
  const today = todayInIndia()
  const { schedule: s, next, pay } = useMemo(() => plan(p, today), [p, today])
  const rows = [...s.instalments, s.yearEnd]
  const started = hasFigures(p)
  const nextRow = rows[next]
  const incurred = rows.slice(0, next).reduce((sum, row) => sum + row.interest, 0)
  const avoidable = s.defermentInterest - incurred
  const lateGains = p.timed.some((t) => t.period === 4 && t.amount > 0)

  return (
    <div className="t-grid">
      <form className="t-form" onSubmit={(e) => e.preventDefault()}>
        <fieldset>
          <legend>You</legend>
          <div className="t-cols">
            <div className="t-field">
              <label htmlFor="regime">Tax regime</label>
              <select id="regime" value={p.regime} onChange={(e) => set({ regime: e.target.value as Profile["regime"] })}>
                <option value="new">New regime (default)</option>
                <option value="old">Old regime</option>
              </select>
            </div>
            <div className="t-field">
              <label htmlFor="resident">Residence</label>
              <select id="resident" value={p.resident ? "yes" : "no"} onChange={(e) => set({ resident: e.target.value === "yes" })}>
                <option value="yes">Resident in India</option>
                <option value="no">Non-resident</option>
              </select>
            </div>
            <div className="t-field">
              <label htmlFor="age">Age during the year</label>
              <select id="age" value={p.age} onChange={(e) => set({ age: e.target.value as Profile["age"] })}>
                <option value="under60">Under 60</option>
                <option value="60to79">60 to 79</option>
                <option value="80plus">80 or over</option>
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Income for the full year, taxed at slab rates</legend>
          <div className="t-cols">
            <Money id="salary" label="Salary" hint="Before the standard deduction, which is applied for you." value={p.salary} onChange={(salary) => set({ salary })} />
            <Money id="business" label="Business or profession" hint="Net profit, or the presumptive income you will declare." value={p.business} onChange={(business) => set({ business })} />
            <Money id="house" label="House property" hint="Net rent after the 30% deduction and interest." value={p.houseProperty} onChange={(houseProperty) => set({ houseProperty })} allowNegative />
            <Money id="other" label="Interest and other income" hint="Include short-term gains on property, debt funds and other assets." value={p.other} onChange={(other) => set({ other })} />
            {p.regime === "old" && <Money id="deductions" label="Deductions" hint="Old regime only: 80C, 80D, HRA and the like." value={p.deductions} onChange={(deductions) => set({ deductions })} />}
          </div>
          <label className="t-check">
            <input type="checkbox" checked={p.presumptive} onChange={(e) => set({ presumptive: e.target.checked })} />
            <span>I declare business or professional income on the presumptive basis, so the whole amount is due in one instalment by 15 March.</span>
          </label>
        </fieldset>

        <fieldset>
          <legend>Capital gains and dividends</legend>
          <p className="t-hint">These are due only from the instalment after they arise, so the date matters. Enter each one with its period.</p>
          <TimedList idPrefix="timed" items={p.timed} onChange={(timed) => set({ timed })} />
        </fieldset>

        <fieldset>
          <legend>Tax already taken care of</legend>
          <Money id="tds" label="TDS and TCS for the full year" hint="Tax your employer, bank, clients and brokers deduct, including what they will deduct before 31 March." value={p.tds} onChange={(tds) => set({ tds })} />
          <p className="t-sub">Advance tax you have paid</p>
          <div className="t-cols">
            {PAID_LABELS.map((label, i) => (
              <Money key={i} id={`paid-${i}`} label={label} value={p.paid[i]} onChange={(amount) => set({ paid: p.paid.map((v, j) => (j === i ? amount : v)) as Profile["paid"] })} />
            ))}
          </div>
        </fieldset>

        <p className="t-hint">Your figures stay in this browser and are not sent anywhere. <button type="button" className="t-link" onClick={clear}>Clear everything</button></p>
      </form>

      <section className="t-result" aria-live="polite" aria-label="Result">
        {!started ? (
          <div className="t-empty">
            <p className="t-kicker">Result</p>
            <p>Enter your income for the year and the instalments appear here.</p>
          </div>
        ) : (
          <>
            <div className="t-headline">
              <p className="t-kicker">{s.exempt ? "Advance tax" : next < 5 ? `Pay by ${longDate(nextRow.due)}` : "Tax year over"}</p>
              <p className="t-big">{s.exempt ? "Not required" : next < 5 ? inr(pay[next]) : inr(s.balance)}</p>
              <p className="t-note">
                {s.exempt === "senior" && "A resident aged 60 or over with no business or professional income does not pay advance tax. The tax is paid with the return."}
                {s.exempt === "below-threshold" && `Tax after TDS is ${inr(s.liability)}, below the ${inr(RULES.threshold)} at which advance tax starts.`}
                {!s.exempt && next < 5 && pay[next] === 0 && "You have paid enough for this date."}
                {!s.exempt && next < 5 && pay[next] > 0 && `This brings your advance tax to ${inr(nextRow.required)}, the amount due by this date.`}
                {!s.exempt && next === 5 && "Balance of tax for the year, payable with interest before you file the return."}
              </p>
            </div>

            {!s.exempt && (
              <table className="t-table">
                <caption>Instalments for Tax Year {RULES.taxYear}</caption>
                <thead><tr><th scope="col">Due</th><th scope="col">Due by then</th><th scope="col">Paid by then</th><th scope="col">{next < 5 ? "To pay" : "Short"}</th></tr></thead>
                <tbody>
                  {rows.map((row, i) => (i < 4 || lateGains) && (
                    <tr key={row.due} className={i === next ? "now" : i < next ? "past" : undefined}>
                      <th scope="row">{longDate(row.due)}</th>
                      <td>{inr(row.required)}</td>
                      <td>{inr(row.paid)}</td>
                      <td>
                        {i < next ? (row.shortfall > 0 ? <span className={row.interest > 0 ? "t-bad" : undefined}>{inr(row.shortfall)} short</span> : "Met") : inr(pay[i])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!s.exempt && (incurred > 0 || avoidable > 0 || s.defaultInterestPerMonth > 0) && (
              <div className="t-alert">
                {incurred > 0 && <p><strong>{inr(incurred)} of interest already incurred</strong> on dates that have passed with too little paid (section 425).</p>}
                {next < 5 && (avoidable > 0 || s.defaultInterestPerMonth > 0) && (
                  <p>
                    <strong>If you pay nothing more:</strong>
                    {avoidable > 0 && ` a further ${inr(avoidable)} for the dates still ahead`}
                    {avoidable > 0 && s.defaultInterestPerMonth > 0 && ", and"}
                    {s.defaultInterestPerMonth > 0 && ` ${inr(s.defaultInterestPerMonth)} for each month from April 2027 until the balance is paid (section 424)`}.
                    Paying the amounts in the table on time avoids all of it.
                  </p>
                )}
                {next === 5 && s.defaultInterestPerMonth > 0 && <p>{inr(s.defaultInterestPerMonth)} for each month from April 2027 until the balance of {inr(s.balance)} is paid, because less than 90% was paid in advance (section 424).</p>}
              </div>
            )}

            <dl className="t-break">
              <div><dt>Total income</dt><dd>{inr(s.tax.totalIncome)}</dd></div>
              <div><dt>Tax at slab rates</dt><dd>{inr(s.tax.slabTax)}</dd></div>
              {s.tax.specialTax > 0 && <div><dt>Tax on capital gains</dt><dd>{inr(s.tax.specialTax)}</dd></div>}
              {s.tax.rebate > 0 && <div><dt>Rebate</dt><dd>−{inr(s.tax.rebate)}</dd></div>}
              {s.tax.surcharge > 0 && <div><dt>Surcharge</dt><dd>{inr(s.tax.surcharge)}</dd></div>}
              <div><dt>Health and education cess</dt><dd>{inr(s.tax.cess)}</dd></div>
              <div className="sum"><dt>Tax for the year</dt><dd>{inr(s.tax.total)}</dd></div>
              <div><dt>TDS and TCS</dt><dd>{p.tds > 0 ? "−" : ""}{inr(p.tds)}</dd></div>
              <div className="sum"><dt>To be paid as advance tax</dt><dd>{inr(s.liability)}</dd></div>
            </dl>

            <div className="t-next">
              <a className="route" href="/tools/forecast">Test a sale, bonus or dividend</a>
              <a className="route" href="/tools/reminders">Put the dates in my calendar</a>
              <a className="route" href="/tools/reconcile">Check TDS against my records</a>
            </div>
          </>
        )}
        <Disclaimer />
      </section>
    </div>
  )
}
