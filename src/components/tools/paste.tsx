import type { ReactNode } from "react"

/** A box to paste spreadsheet cells into, or load a CSV file from. */
export function PasteBox({ id, title, hint, text, setText, children }: {
  id: string
  title: string
  hint: ReactNode
  text: string
  setText: (t: string) => void
  /** Column pickers, shown once the paste has a header row. */
  children?: ReactNode
}) {
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
      {children}
    </fieldset>
  )
}

/** Choose which column of the pasted table holds a value. */
export function ColumnPick({ id, label, headers, value, onChange, optional = false }: {
  id: string
  label: string
  headers: string[]
  value: number
  onChange: (n: number) => void
  optional?: boolean
}) {
  return (
    <div className="t-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {(optional || value === -1) && <option value={-1}>{optional ? "None" : "Choose a column"}</option>}
        {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
      </select>
    </div>
  )
}

/** Save text as a file in the visitor's downloads. */
export function download(name: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }))
  Object.assign(document.createElement("a"), { href: url, download: name }).click()
  URL.revokeObjectURL(url)
}
