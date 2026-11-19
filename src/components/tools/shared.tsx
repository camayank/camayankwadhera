import { useEffect, useState } from "react"

import { EMPTY_PROFILE, PERIODS, TIMED_LABELS, type Period, type Profile, type TimedIncome, type TimedKind } from "@/lib/tax/india"

const KEY = "advance-tax-2026-27"

/** The visitor's figures, kept in this browser only. Storage can be unavailable, so every access is guarded. */
export function useProfile() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY)
      if (saved) setProfile({ ...EMPTY_PROFILE, ...JSON.parse(saved) })
    } catch {
      /* start empty */
    }
    setLoaded(true)
  }, [])
  const update = (next: Profile) => {
    setProfile(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* figures stay on the page for this visit */
    }
  }
  const clear = () => {
    setProfile(EMPTY_PROFILE)
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* nothing stored */
    }
  }
  return { profile, update, clear, loaded }
}

export const hasFigures = (p: Profile) =>
  p.salary + p.business + p.other + Math.abs(p.houseProperty) + p.timed.reduce((sum, t) => sum + t.amount, 0) > 0

/** Today's date in India, as YYYY-MM-DD: the due dates are Indian dates wherever the visitor is. */
export function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "2026-12-15" as "15 Dec 2026". */
export function longDate(date: string) {
  const [year, month, day] = date.split("-").map(Number)
  return `${day} ${MONTHS[month - 1]} ${year}`
}

const group = (n: number) => (n ? Math.abs(n).toLocaleString("en-IN") : "")

/** A rupee amount typed with Indian digit grouping. */
export function Money({ id, label, hint, value, onChange, allowNegative = false }: {
  id: string
  label: string
  hint?: string
  value: number
  onChange: (n: number) => void
  allowNegative?: boolean
}) {
  const negative = value < 0
  return (
    <div className="t-field">
      <label htmlFor={id}>{label}</label>
      <div className="t-money">
        <span aria-hidden="true">{negative ? "−₹" : "₹"}</span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={group(value)}
          aria-describedby={hint ? id + "-hint" : undefined}
          onChange={(e) => {
            const digits = Number(e.target.value.replace(/[^0-9]/g, "").slice(0, 13)) || 0
            onChange(negative ? -digits : digits)
          }}
        />
        {allowNegative && (
          <button type="button" className="t-sign" aria-pressed={negative} onClick={() => onChange(-value)}>
            {negative ? "Loss" : "Income"}
          </button>
        )}
      </div>
      {hint && <p className="t-hint" id={id + "-hint"}>{hint}</p>}
    </div>
  )
}

/** Gains and dividends, each with the period it arose in. */
export function TimedList({ idPrefix, items, onChange, addLabel = "Add a gain or dividend" }: {
  idPrefix: string
  items: TimedIncome[]
  onChange: (items: TimedIncome[]) => void
  addLabel?: string
}) {
  const set = (i: number, patch: Partial<TimedIncome>) => onChange(items.map((item, j) => (j === i ? { ...item, ...patch } : item)))
  return (
    <div className="t-timed">
      {items.map((item, i) => (
        <fieldset className="t-timed-row" key={i}>
          <legend className="sr-only">Gain or dividend {i + 1}</legend>
          <div className="t-field">
            <label htmlFor={`${idPrefix}-kind-${i}`}>Type</label>
            <select id={`${idPrefix}-kind-${i}`} value={item.kind} onChange={(e) => set(i, { kind: e.target.value as TimedKind })}>
              {(Object.keys(TIMED_LABELS) as TimedKind[]).map((kind) => <option key={kind} value={kind}>{TIMED_LABELS[kind]}</option>)}
            </select>
          </div>
          <Money id={`${idPrefix}-amount-${i}`} label="Amount" value={item.amount} onChange={(amount) => set(i, { amount })} />
          <div className="t-field">
            <label htmlFor={`${idPrefix}-period-${i}`}>When it arises</label>
            <select id={`${idPrefix}-period-${i}`} value={item.period} onChange={(e) => set(i, { period: Number(e.target.value) as Period })}>
              {PERIODS.map((label, period) => <option key={period} value={period}>{label}</option>)}
            </select>
          </div>
          <button type="button" className="t-remove" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove gain or dividend ${i + 1}`}>Remove</button>
        </fieldset>
      ))}
      <button type="button" className="t-add" onClick={() => onChange([...items, { kind: "ltcgEquity", amount: 0, period: 2 }])}>+ {addLabel}</button>
    </div>
  )
}

export function Disclaimer() {
  return (
    <p className="t-disclaimer">
      An estimate for resident and non-resident individuals for Tax Year 2026-27 under the Income-tax Act, 2025. It leaves out losses brought forward, foreign tax credit, the alternative minimum tax and income taxed at other special rates. This is software, not a chartered accountant's opinion or service. Check the figures with your adviser before you pay.
    </p>
  )
}
