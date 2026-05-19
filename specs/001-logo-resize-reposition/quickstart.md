# Quickstart: Logo Resize & Reposition

**Branch**: `001-logo-resize-reposition`

## What changes

Three files. No new dependencies.

| File | What changes |
|---|---|
| `components/feed/Masthead.tsx` | Smaller clamp on `h1`; `h1` becomes `flex flex-col items-center`; "Memonic" text wrapped in `<span>`; dot moved below text |
| `components/feed/ReturnDot.tsx` | Remove `verticalAlign: "middle"` from inline style |
| `app/globals.css` | Remove `vertical-align: middle` from `.wordmark .dot` rule |

## Run locally

```bash
npm run dev
# visit http://localhost:3000/home  (logo — auth page)
# visit http://localhost:3000/feed  (logo + ReturnDot — main page)
# visit http://localhost:3000/nutrition  (logo — nutrition page)
```

## Verify

1. Wordmark visibly smaller on all three pages.
2. Wordmark horizontally centered on all three pages.
3. Cyan dot appears **below** the wordmark, centered (aligns under the "O").
4. Clicking the dot on `/feed` → logs out → redirects to `/home`. ✓
5. No colour, font, or scanline change visible anywhere.
6. Resize browser from 320 px to 1920 px — wordmark does not overflow at any width.

## Build check

```bash
npm run lint && npm run build
```

Both must pass with zero errors.
