# Research: Logo Resize & Reposition

**Date**: 2026-05-14 | **Branch**: `001-logo-resize-reposition`

## Finding 1 — "O" is the exact centre character of "Memonic"

**Decision**: Position the dot by centering it horizontally within the container.

**Rationale**: "Memonic" has 7 characters (M-e-m-o-n-i-c). The letter "o" is character 4 — the mathematical midpoint. Because the wordmark uses `text-center` it is always horizontally centered in its container. The centre of the container therefore coincides with the centre of the "o". Placing the dot with `margin: 0 auto` or `justify-center` in a flex column achieves sub-pixel accuracy without any absolute-position offset calculations or font-metric hacks.

**Alternatives considered**: Absolute positioning with a calculated left-offset based on character width — rejected because Monoton glyph metrics vary across operating systems and zoom levels; centering is robust across all environments.

---

## Finding 2 — Correct size target for ≥20% Masthead height reduction

**Decision**: Reduce wordmark `clamp` from `clamp(40px, 13vw, 168px)` to `clamp(24px, 7.5vw, 96px)` and trim header spacing.

**Rationale**:

Current Masthead vertical budget (approximate, desktop 1280 px viewport):
- Top chrome bar + `pb-3`: ~32 px
- `mt-7` before wordmark: 28 px
- Wordmark line-height (line-height 0.95 × ~168 px cap): ~160 px
- `mt-3` before subtitle: 12 px
- Subtitle line: ~22 px
- `pb-6` after content: 24 px
- Total: ≈278 px

After change (same viewport):
- Top chrome bar: 32 px
- `mt-3` (reduced): 12 px
- Wordmark at new cap ~96 px × 0.95: ~91 px
- `mt-2` before subtitle: 8 px
- Subtitle line: ~22 px
- `pb-3` (reduced): 12 px
- Total: ≈177 px → **≈36% reduction** (exceeds SC-001's ≥20% requirement)

**Alternatives considered**: Reducing only the font size without touching spacing — tested mentally; savings would be ~25% which passes SC-001 but leaves unused whitespace above and below the wordmark. Combined size + spacing reduction is cleaner.

---

## Finding 3 — Dot placement in restructured h1

**Decision**: Convert the `h1` to a `flex flex-col items-center` container; wrap the "Memonic" text string in a `<span>`; render the dot (both `<ReturnDot />` and `<span className="dot" />`) as a direct child of the `h1` below the text span.

**Rationale**: The current markup puts the dot inline with the text, relying on `vertical-align: middle`. Moving to a flex column is the simplest semantic change — both children (text span and dot) share the same parent, the `h1` keeps its landmark role, and no CSS-in-JS or absolute positioning is required. `items-center` horizontally centers the dot, aligning it under the "O".

**Dot sizing**: At the new smaller font size the existing `.dot` dimensions (`width: calc(0.4em - 6px)`, `height: calc(0.4em - 6px)`) scale proportionally because they are expressed in `em`. No CSS change to the dot dimensions is needed; only the `vertical-align: middle` rule should be removed (it was for inline placement and is irrelevant in a flex-col context).

**ReturnDot inline style**: The `verticalAlign: "middle"` inline style in `ReturnDot.tsx` should be removed; `display: "inline-flex"` and `alignItems: "center"` are not needed either — in the new flex-col layout the button itself just needs to render normally. The `.dot` span inside the button already handles its own sizing. The `display: "inline-block"` on the button can stay to preserve click-target area.

---

## Finding 4 — Spacing tokens to adjust

| Property | Current Tailwind token | New Tailwind token | Δ px (desktop) |
|---|---|---|---|
| `h1` top margin (`mt-*`) | `mt-7` (28 px) | `mt-3` (12 px) | −16 px |
| subtitle top margin (`mt-*`) | `mt-3` (12 px) | `mt-2` (8 px) | −4 px |
| header bottom padding (`pb-*`) | `pb-6` (24 px) | `pb-3` (12 px) | −12 px |
| header bottom margin (`mb-*`) | `mb-10` (40 px) | `mb-6` (24 px) | −16 px |

Combined spacing savings: ~48 px + wordmark height reduction ~64 px = ~112 px total at desktop cap.

---

## Summary — No NEEDS CLARIFICATION Markers Remain

All research questions are resolved. Implementation can proceed directly to Phase 1 design.
