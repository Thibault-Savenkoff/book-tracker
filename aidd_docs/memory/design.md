# Design

## System

- Direction: "Modern Dark / Light Editorial" — Linear, Readwise Reader and Apple Books as references. The full rules live in `DESIGN_GUIDELINES.md` at the repo root; it is binding, not advisory.
- Styling is Tailwind utility classes inline in the `.svelte` files. There is no component library and no CSS modules.
- `demos/*.html` are the reference mockups. New UI is expected to match their structure and classes.

## Tokens

- Colours and fonts are defined in `tailwind.config.js` under `app.*` (dark), `light.*` (light) and `accent.*` (per category). Default Tailwind palette classes (`bg-gray-100`, `text-blue-500`) are forbidden.
- Custom utilities (`cover-shadow`, `thin-scrollbar`) and the base font live in `src/app.css`.
- The category colour, label and gradient maps used in TypeScript are in `src/lib/bookStyle.ts` — the same values as the Tailwind `accent` tokens, kept in sync by hand.

## Components

- Three type roles: serif (`Instrument Serif`) for book and collection titles, mono (`JetBrains Mono`) for metadata and numbers, sans (`Plus Jakarta Sans`) for the interface.
- Book covers always keep `aspect-[2/3]` with `cover-shadow` and rounded corners.
- Borders are always thin and low-contrast (`border-light-border dark:border-app-border`).

## Theme

- Dark is the default. `src/lib/theme.ts` toggles the `dark` class on `<html>` and persists the choice in `localStorage`. Tailwind runs in `darkMode: 'class'`, so every colour needs its `dark:` counterpart.
