import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// Completed work published from the MW Work Register (see work-desk/README.md).
// One Markdown file per entry in src/content/work-log/. Files starting with "_" are ignored.
const workLog = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/work-log" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    venture: z.enum([
      "CA4CPA",
      "CA4CPA KPO Solutions",
      "Legal Suvidha",
      "DigiComply",
      "MKW Advisors",
      "GrowBiz10x",
      "CorpReady Academy",
      "Mayank Wadhera (direct)",
    ]),
    // Only filled when the client approved being named ("Approved – named" in the register).
    client: z.string().optional(),
    // How the client is described when anonymised, e.g. "A 12-person CPA firm in Texas".
    clientDescription: z.string().optional(),
    summary: z.string(),
    outcome: z.string().optional(),
    tags: z.array(z.string()).default([]),
    // Job ID from the register. Kept for traceability; never shown on the site.
    job: z.string().regex(/^JOB-\d{4}$/),
  }),
});

export const collections = { workLog };
