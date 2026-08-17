# @orbital/landing

The marketing site for Orbital, served at [example.com](https://example.com).

Astro 6, static output, plain scoped CSS. Deployed as a Cloudflare Worker with
static assets (`wrangler.jsonc`).

## Commands

Run from the repo root:

```bash
bun run dev:landing      # local dev server on :4321
bun run build:landing    # static build into dist/
bun run deploy:landing   # build, then wrangler deploy
```

`bun run typecheck` (root) covers this package via `astro check`.

## Layout

- `src/pages/` — `index.astro` (landing), `privacy.astro`, `404.astro`
- `src/components/` — page sections; `FeatureSection.astro` is reused for each
  screenshot row
- `src/assets/screens/` — app screenshots, copied from `ops/assets/play-phone/`
  and optimized at build time by `astro:assets`. `ops/` is excluded from the
  public mirror, so these must live here rather than being referenced in place.
- `src/styles/global.css` — design tokens and the shared section type scale
- `public/og.png` — social preview image, copied from the Play feature graphic
