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
| `src/pages/` | One file per page (`index`, `about`, `ventures`, `work`, `insights`, `work-with-me`, `ca4cpa`, `sop`, `enquire`, `privacy`, `404`) |
| `src/layouts/Layout.astro` | Shared header, footer and page shell |
| `src/components/kit/` | Sections built from Magic UI components |
| `src/components/ui/` | shadcn/ui and Magic UI components |
| `src/scripts/` | Motion, the 3D hero, the month-end walkthrough, the procedures stack, the enquiry form |
| `src/styles/global.css` | Design tokens and component styles |

## Deploying

The site is live at https://camayankwadhera.com on Hostinger shared hosting. To update it, run `npm run build` and upload the contents of `dist/` to the site's `public_html` folder (keep Hostinger's `.private` folder), then flush the CDN cache in hPanel.

`public/.htaccess` holds the redirects from the old WordPress addresses and the 404 page.

## Profile PDF

`public/Mayank-Wadhera-Professional-Profile.pdf` is generated from `profile-src/profile.html`. Edit that file and print it to PDF at A4 with backgrounds on to regenerate it.

## Enquiries

The enquiry form in `src/pages/enquire.astro` opens the visitor's own email app with the message filled in (see `src/scripts/enquiry.js`). Nothing is stored or sent by the site itself.
