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
| `src/layouts/Layout.astro` | Shared header, footer and page shell |
| `src/components/kit/` | Sections built from Magic UI components |
| `src/components/ui/` | shadcn/ui and Magic UI components |
| `src/scripts/` | Motion, the 3D hero, the month-end walkthrough, the procedures stack, the enquiry form |
| `src/styles/global.css` | Design tokens and component styles |

## Deploying

The site is live at https://camayankwadhera.com on Hostinger shared hosting. To update it, run `npm run build` and upload the contents of `dist/` to the site's `public_html` folder (keep Hostinger's `.private` folder), then flush the CDN cache in hPanel.

`public/.htaccess` holds the redirects from the old WordPress addresses and the 404 page.

## Profile

The professional profile is shown on the site at `/profile` (`src/pages/profile.astro`). It is not offered as a download. `profile-src/` holds a print layout of the same content, kept for making a PDF by hand if one is ever needed.

## Enquiries

The enquiry form in `src/pages/enquire.astro` opens the visitor's own email app with the message filled in (see `src/scripts/enquiry.js`). Nothing is stored or sent by the site itself.
