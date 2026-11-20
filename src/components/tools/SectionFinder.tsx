import { useEffect, useMemo, useState } from "react"

import { findSections, POPULAR } from "@/lib/tax/section-map"

const WHY = { old: "1961 section", new: "2025 section", heading: "Heading" } as const

export function SectionFinder() {
  const [q, setQ] = useState("")
  // a link like /tools/section-finder?q=80C opens with that search
  useEffect(() => {
    const from = new URLSearchParams(location.search).get("q")
    if (from) setQ(from)
  }, [])
  const hits = useMemo(() => findSections(q), [q])
  const search = (value: string) => {
    setQ(value)
    try { history.replaceState(null, "", value ? `?q=${encodeURIComponent(value)}` : location.pathname) } catch { /* the address bar is optional */ }
  }

  return (
    <div className="t-finder">
      <form className="t-form" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="t-field">
          <label htmlFor="sf-q">A section of either Act, or words from its heading</label>
          <input id="sf-q" type="search" autoComplete="off" value={q} placeholder="e.g. 80C, 194J, 393, presumptive" onChange={(e) => search(e.target.value)} />
        </div>
        <p className="t-hint">Try: {POPULAR.map((p, i) => <span key={p}>{i > 0 && " · "}<button type="button" className="t-link" onClick={() => search(p)}>{p}</button></span>)}</p>
      </form>

      <div aria-live="polite">
        {q.trim() && hits.length === 0 && <p className="t-note">No section matches “{q}”. Check the number, or search for words from the heading.</p>}
        {hits.length > 0 && (
          <ol className="t-hits">
            {hits.map(({ section: s, why }) => (
              <li key={s.number}>
                <p className="t-hit-new"><small>Income-tax Act, 2025</small>Section {s.number}</p>
                <div>
                  <strong>{s.heading}</strong>
                  <p className="t-hit-old">
                    {s.old.length > 0 ? <>Replaces section{s.old.length > 1 ? "s" : ""} <b>{s.old.join(", ")}</b> of the 1961 Act{s.shared && " (shared by the sections of this group)"}</> : "A new provision, with no single section in the 1961 Act"}
                  </p>
                  <p className="t-hint">{s.chapter}{s.part && ` · ${s.part}`} · matched on the {WHY[why].toLowerCase()}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="t-disclaimer">From the ICAI's tabular mapping of the Income-tax Act, 2025 as enacted, against the Income-tax Act, 1961: 536 sections. The 1961 Act applies to Tax Year 2025-26 and earlier; the 2025 Act from 1 April 2026. A mapping gives the nearest section, not identical wording: read the section before relying on it, and check amendments made by later Finance Acts.</p>
    </div>
  )
}
