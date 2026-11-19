import { useMemo, useState } from "react"

import { inr, plan, type Profile, type TimedIncome } from "@/lib/tax/india"
import { Disclaimer, Money, TimedList, hasFigures, longDate, todayInIndia, useProfile } from "./shared"

type Extra = { salary: number; business: number; other: number; tds: number; timed: TimedIncome[] }
const NONE: Extra = { salary: 0, business: 0, other: 0, tds: 0, timed: [] }

const apply = (p: Profile, x: Extra): Profile => ({
  ...p,
  salary: p.salary + x.salary,
  business: p.business + x.business,
  other: p.other + x.other,
  tds: p.tds + x.tds,
  timed: [...p.timed, ...x.timed.filter((t) => t.amount > 0)],
})

export function ForecastPlanner() {
  const { profile, update, loaded } = useProfile()
  const [extra, setExtra] = useState<Extra>({ ...NONE, timed: [{ kind: "ltcgEquity", amount: 0, period: 2 }] })
  const set = (patch: Partial<Extra>) => setExtra({ ...extra, ...patch })
  const today = todayInIndia()
  const before = useMemo(() => plan(profile, today), [profile, today])
  const after = useMemo(() => plan(apply(profile, extra), today), [profile, extra, today])
  const changed = extra.salary + extra.business + extra.other + extra.timed.reduce((sum, t) => sum + t.amount, 0) > 0
  const slabChange = extra.salary + extra.business + extra.other > 0
  const next = after.next
  const rowsBefore = [...before.schedule.instalments, before.schedule.yearEnd]
  const rowsAfter = [...after.schedule.instalments, after.schedule.yearEnd]
  const extraTax = after.schedule.tax.total - before.schedule.tax.total
  const extraInterest = after.schedule.defermentInterest - before.schedule.defermentInterest
  const pastInterest = rowsAfter.slice(0, next).reduce((sum, row) => sum + row.interest, 0) - rowsBefore.slice(0, next).reduce((sum, row) => sum + row.interest, 0)
  const showYearEnd = rowsAfter[4].required > rowsAfter[3].required
  const delta = (n: number) => (n === 0 ? "No change" : (n > 0 ? "+" : "−") + inr(Math.abs(n)))

  return (
    <div className="t-grid">
      <form className="t-form" onSubmit={(e) => e.preventDefault()}>
        <div className="t-base">
          <p className="t-kicker">Starting point</p>
          {loaded && !hasFigures(profile) ? (
            <p>No figures saved in this browser yet, so the test starts from zero income. <a href="/tools/advance-tax">Enter your year in the calculator</a> first for a comparison against your own position.</p>
          ) : (
            <p>Your figures from the calculator: tax for the year {inr(before.schedule.tax.total)}, of which {inr(before.schedule.liability)} is payable as advance tax. <a href="/tools/advance-tax">Edit</a></p>
          )}
        </div>

        <fieldset>
          <legend>A gain or dividend you expect</legend>
          <p className="t-hint">A share sale, an exit, a secondary, a property sale, a dividend. It counts only from the instalment after it arises.</p>
          <TimedList idPrefix="x" items={extra.timed} onChange={(timed) => set({ timed })} addLabel="Add another" />
        </fieldset>

        <fieldset>
          <legend>Other income that changes</legend>
          <div className="t-cols">
            <Money id="x-salary" label="Extra salary or bonus" value={extra.salary} onChange={(salary) => set({ salary })} />
            <Money id="x-business" label="Extra business or professional income" value={extra.business} onChange={(business) => set({ business })} />
            <Money id="x-other" label="Extra interest or other income" value={extra.other} onChange={(other) => set({ other })} />
            <Money id="x-tds" label="TDS on all of the above" hint="Tax that will be deducted at source on this extra income." value={extra.tds} onChange={(tds) => set({ tds })} />
          </div>
        </fieldset>

        <p className="t-hint">
          <button type="button" className="t-link" onClick={() => setExtra(NONE)}>Reset the test</button>
          {changed && <> · <button type="button" className="t-link" onClick={() => { update(apply(profile, extra)); setExtra(NONE) }}>Add this to my figures</button></>}
        </p>
      </form>

      <section className="t-result" aria-live="polite" aria-label="Effect">
        {!changed ? (
          <div className="t-empty">
            <p className="t-kicker">Effect</p>
            <p>Enter an amount and see what it does to the tax for the year and to each remaining instalment.</p>
          </div>
        ) : (
          <>
            <div className="t-headline">
              <p className="t-kicker">{next < 5 ? `New payment by ${longDate(rowsAfter[next].due)}` : "Extra tax for the year"}</p>
              <p className="t-big">{next < 5 ? inr(after.pay[next]) : inr(extraTax)}</p>
              <p className="t-note">
                {next < 5 && `${delta(after.pay[next] - before.pay[next])} against your current plan. `}
                Tax for the year rises by {inr(extraTax)} to {inr(after.schedule.tax.total)}.
              </p>
            </div>

            {after.schedule.exempt ? (
              <p className="t-note">{after.schedule.exempt === "senior" ? "No advance tax applies: a resident aged 60 or over with no business or professional income pays with the return." : "Tax after TDS stays below ₹10,000, so no advance tax applies."}</p>
            ) : (
              <table className="t-table">
                <caption>What to pay on each date</caption>
                <thead><tr><th scope="col">Due</th><th scope="col">Now</th><th scope="col">With this income</th><th scope="col">Change</th></tr></thead>
                <tbody>
                  {rowsAfter.map((row, i) => i >= next && (i < 4 || showYearEnd) && (
                    <tr key={row.due} className={i === next ? "now" : undefined}>
                      <th scope="row">{longDate(row.due)}</th>
                      <td>{inr(before.pay[i])}</td>
                      <td>{inr(after.pay[i])}</td>
                      <td>{delta(after.pay[i] - before.pay[i])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!after.schedule.exempt && pastInterest > 0 && (
              <div className="t-alert">
                <p><strong>{inr(pastInterest)} of interest on dates already past</strong></p>
                <p>{slabChange
                  ? "Salary, business and other income are measured for the whole year, so a rise makes the earlier instalments look short. The law gives relief of this kind only for capital gains, dividends and a business in its first year."
                  : "The gain or dividend is dated in a period whose instalment has already passed without enough tax paid."}</p>
              </div>
            )}
            {!after.schedule.exempt && extraInterest === 0 && !slabChange && (
              <p className="t-good">No interest arises from this, provided each amount in the table is paid by its date.</p>
            )}

            <div className="t-next">
              <a className="route" href="/tools/reminders">Put the dates in my calendar</a>
              <a className="route" href="/enquire?audience=founder-advisory">Talk through a larger transaction</a>
            </div>
          </>
        )}
        <Disclaimer />
      </section>
    </div>
  )
}
