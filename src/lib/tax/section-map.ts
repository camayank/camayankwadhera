// Find a section of the Income-tax Act, 1961 in the Income-tax Act, 2025, and back. No browser dependencies.

import { CHAPTERS, PARTS, SECTIONS } from "./section-map.data.ts";

export type Section = {
  /** Section number in the 2025 Act. */
  number: number;
  heading: string;
  /** Sections of the 1961 Act it replaces, as the ICAI mapping writes them. */
  old: string[];
  chapter: string;
  part: string;
  /** The 1961 sections are listed for a group of sections, not this one alone. */
  shared: boolean;
};

export const ALL: Section[] = SECTIONS.map(([number, heading, old, chapter, part, shared]) => ({
  number,
  heading,
  old: old ? old.split(" ") : [],
  chapter: CHAPTERS[chapter],
  part: part >= 0 ? PARTS[part] : "",
  shared: shared === 1,
}));

/** "194-I", "194 I" and "194i" are one section; so are "80 C" and "80C". Sub-sections are dropped. */
export function sectionKey(text: string): string {
  return (text ?? "").toUpperCase().replace(/\(.*$/, "").replace(/[^0-9A-Z]/g, "");
}

export type Hit = { section: Section; why: "old" | "new" | "heading" };

/** Look up a 1961 section, a 2025 section, or words in a heading. Best matches first. */
export function findSections(query: string, limit = 30): Hit[] {
  const q = query.trim();
  if (!q) return [];
  const hits: Hit[] = [];
  const seen = new Set<number>();
  const add = (section: Section, why: Hit["why"]) => { if (!seen.has(section.number)) { seen.add(section.number); hits.push({ section, why }); } };

  const asSection = q.replace(/^(sec(tion)?\.?|s\.|u\/s)\s*/i, "");
  if (/^\d+\s*-?\s*[a-z]*(\(.*)?$/i.test(asSection)) {
    const key = sectionKey(asSection);
    // a 1961 section, exactly
    for (const s of ALL) if (s.old.some((o) => sectionKey(o) === key)) add(s, "old");
    // a 2025 section, when the query is a bare number
    if (/^\d+$/.test(key)) { const n = Number(key); const s = ALL.find((x) => x.number === n); if (s) add(s, "new"); }
    // and 1961 sections that start with it, e.g. "80" finds 80C, 80D...
    if (/\d$/.test(key)) {
      for (const s of ALL) if (s.old.some((o) => { const k = sectionKey(o); return k.startsWith(key) && /^[A-Z]/.test(k.slice(key.length)) })) add(s, "old");
    }
    return hits.slice(0, limit);
  }
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const scored = ALL.map((s) => {
    const text = `${s.heading} ${s.part} ${s.chapter}`.toLowerCase();
    const head = s.heading.toLowerCase();
    let score = 0;
    for (const w of words) { if (head.includes(w)) score += 3; else if (text.includes(w)) score += 1; else return { s, score: 0 }; }
    return { s, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.s.number - b.s.number);
  for (const { s } of scored) add(s, "heading");
  return hits.slice(0, limit);
}

/** A few lookups people make most, for the empty state. */
export const POPULAR = ["80C", "80D", "44AD", "43B", "40(a)(ia)", "54", "115BAC", "139", "143", "148", "194C", "194J", "234B", "270A"];
