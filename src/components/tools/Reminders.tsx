import { useMemo, useState } from "react"

import { googleLink, reminders, toIcs } from "@/lib/tax/calendar"
import { RULES, inr, plan } from "@/lib/tax/india"
import { hasFigures, longDate, todayInIndia, useProfile } from "./shared"

const ALERTS = [
  { days: 14, label: "Two weeks before" },
  { days: 7, label: "One week before" },
  { days: 3, label: "Three days before" },
  { days: 1, label: "The day before" },
]

export function Reminders() {
  const { profile } = useProfile()
  const today = todayInIndia()
  const { pay, next, schedule } = useMemo(() => plan(profile, today), [profile, today])
  const useAmounts = hasFigures(profile) && !schedule.exempt
  const items = useMemo(() => reminders(useAmounts ? pay : undefined), [useAmounts, pay])
  const [alerts, setAlerts] = useState([7, 1])
  const [withAmounts, setWithAmounts] = useState(true)
  const titles = ["Instalment 1 of 4: 15% due", "Instalment 2 of 4: 45% due", "Instalment 3 of 4: 75% due", "Instalment 4 of 4: 100% due", "Gains and dividends after 15 March"]
  const ahead = items.filter((item) => item.date >= today)

  const download = () => {
    const chosen = withAmounts ? ahead : reminders().filter((item) => item.date >= today)
    const url = URL.createObjectURL(new Blob([toIcs(chosen, alerts)], { type: "text/calendar" }))
    const link = Object.assign(document.createElement("a"), { href: url, download: `advance-tax-${RULES.taxYear}.ics` })
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="t-dates">
      <ol className="t-datelist">
        {items.map((item, i) => {
          const past = item.date < today
          return (
            <li key={item.date} className={past ? "past" : i === next ? "now" : undefined}>
              <p className="t-date">{longDate(item.date)}<small>{past ? "Passed" : i === next ? "Next" : "Ahead"}</small></p>
              <div>
                <strong>{titles[i]}</strong>
                {useAmounts && !past && <p className="t-amount">{pay[i] > 0 ? `${inr(pay[i])} to pay, from your figures in the calculator` : "Nothing further to pay, from your figures in the calculator"}</p>}
                {!past && <a className="route" href={googleLink(withAmounts ? item : reminders()[i])} target="_blank" rel="noopener">Add to Google Calendar</a>}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="t-result">
        <p className="t-kicker">All dates in one file</p>
        {ahead.length === 0 ? (
          <p>Every date for Tax Year {RULES.taxYear} has passed.</p>
        ) : (
          <>
            <p>Download the {ahead.length} remaining {ahead.length === 1 ? "date" : "dates"} as a calendar file. It opens in Apple Calendar, Outlook and Google Calendar.</p>
            <fieldset className="t-checks">
              <legend>Remind me</legend>
              {ALERTS.map((alert) => (
                <label className="t-check" key={alert.days}>
                  <input type="checkbox" checked={alerts.includes(alert.days)} onChange={(e) => setAlerts(e.target.checked ? [...alerts, alert.days] : alerts.filter((d) => d !== alert.days))} />
                  <span>{alert.label}</span>
                </label>
              ))}
            </fieldset>
            {useAmounts && (
              <label className="t-check">
                <input type="checkbox" checked={withAmounts} onChange={(e) => setWithAmounts(e.target.checked)} />
                <span>Include my estimated amounts in the calendar entries</span>
              </label>
            )}
            <button type="button" className="btn solid" onClick={download}>Download calendar file</button>
            {!useAmounts && <p className="t-hint">Want the amount in each entry? <a href="/tools/advance-tax">Work out your instalments</a> first, then come back.</p>}
          </>
        )}
        <p className="t-disclaimer">Dates are the instalment dates in section 408 of the Income-tax Act, 2025 for Tax Year {RULES.taxYear}. If a due date is a bank holiday, check the last working day for your bank.</p>
      </div>
    </div>
  )
}
