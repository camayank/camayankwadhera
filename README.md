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
| `src/pages/` | One file per page (`index`, `about`, `ventures`, `work`, `work/log`, `insights`, `work-with-me`, `ca4cpa`, `sop`, `enquire`, `privacy`) |
| `src/content/work-log/` | Published work entries, one Markdown file each (see `work-desk/`) |
| `work-desk/` | The enquiry intake script and how work flows from the site to the register and back |
| `src/layouts/Layout.astro` | Shared header, footer and page shell |
| `src/components/kit/` | Sections built from Magic UI components |
| `src/components/ui/` | shadcn/ui and Magic UI components |
| `src/scripts/` | Motion, the 3D hero, the month-end walkthrough, the procedures stack, the enquiry form |
| `src/styles/global.css` | Design tokens and component styles |

## Before going live

- Amber dashed "To add" / "To confirm" notes mark content that still has to be supplied or verified. Remove each one as it is resolved.
- The enquiry form is not connected until `PUBLIC_ENQUIRY_ENDPOINT` is set on the host: follow `work-desk/README.md`, step 1.
- `src/pages/privacy.astro` is a draft outline, not a reviewed privacy notice.
