# camayankwadhera.com

Professional website of CA Mayank Wadhera, including the CA4CPA pages for US CPA firms.

## Stack

- [Astro](https://astro.build) for pages and routing
- [Tailwind CSS](https://tailwindcss.com) with [shadcn/ui](https://ui.shadcn.com) and [Magic UI](https://magicui.design) components
- [GSAP](https://gsap.com) and [Lenis](https://lenis.darkroom.engineering) for scroll animation and smooth scrolling
- [three.js](https://threejs.org) for the 3D hero scene

## Run locally

```bash
npm install
npm run dev
```

Build the static site into `dist/`:

```bash
npm run build
```

## Where things are

| Path | What it holds |
|---|---|
| `src/pages/` | One file per page (`index`, `about`, `ventures`, `work`, `insights`, `work-with-me`, `ca4cpa`, `sop`, `profile`, `enquire`, `privacy`, `404`) |
| `src/pages/tools/` | The tools: hub, advance tax calculator, what-if planner, tax statement check, reminders, GST credit match, MSME payments, compliance calendar |
| `src/components/tools/` | The interactive part of each tool (React) |
| `src/lib/tax/` | The tax rules and arithmetic, with no browser code, so they can be tested |
| `tests/` | Hand-worked cases for the tax arithmetic |
| `src/layouts/Layout.astro` | Shared header, footer and page shell |
| `src/components/kit/` | Sections built from Magic UI components |
| `src/components/ui/` | shadcn/ui and Magic UI components |
| `src/scripts/` | Motion, the 3D hero, the month-end walkthrough, the procedures stack, the enquiry form |
| `src/styles/global.css` | Design tokens and component styles |

## Tools

The tools at `/tools` run entirely in the visitor's browser. Nothing is sent to a server; the calculator's figures are kept in the browser's own storage so the other tools can use them.

All rates, limits and dates for the tax year are in the `RULES` object at the top of `src/lib/tax/india.ts`, with the sections of the Income-tax Act, 2025 they come from. When a Finance Act changes them, or a new tax year starts, update `RULES` and the cases in `tests/tax.test.ts`, then run:

```bash
npm test
```

The tests need Node 22.18 or later, which runs TypeScript files directly.

The business tools keep their rules in their own files, each with the sources it was checked against at the top:

| File | Tool | What to update when the law changes |
|---|---|---|
| `src/lib/tax/gst.ts` | GST credit match (`/tools/gst-itc`) | Column guesses if the GSTR-2B download changes |
| `src/lib/tax/msme.ts` | MSME payments (`/tools/msme-payments`) | `MSME_RULES`: the 15 and 45 day limits and the section numbers |
| `src/lib/tax/compliance.ts` | Compliance calendar (`/tools/compliance-calendar`) | The due dates in `complianceDates` |
| `src/lib/tax/tds.ts` | TDS checker (`/tools/tds-check`) | `TDS_RULES`: rates and thresholds from the Finance Act |
| `src/lib/tax/gstr9.ts` | GSTR-9 reconciliation (`/tools/gstr9`) | The 30 November cut-off and the 18% interest rate |
| `src/lib/tax/section-map.data.ts` | Section finder (`/tools/section-finder`) | Generated from the ICAI mapping; regenerate rather than edit |

Their cases are in `tests/business.test.ts` and `tests/stage2.test.ts`.

## Deploying

The site is live at https://camayankwadhera.com on Hostinger shared hosting. To update it, run `npm run build` and upload the contents of `dist/` to the site's `public_html` folder (keep Hostinger's `.private` folder), then flush the CDN cache in hPanel.

`public/.htaccess` holds the redirects from the old WordPress addresses and the 404 page.

## Profile

The professional profile is shown on the site at `/profile` (`src/pages/profile.astro`). It is not offered as a download. `profile-src/` holds a print layout of the same content, kept for making a PDF by hand if one is ever needed.

## Enquiries

The enquiry form in `src/pages/enquire.astro` opens the visitor's own email app with the message filled in (see `src/scripts/enquiry.js`). Nothing is stored or sent by the site itself.
