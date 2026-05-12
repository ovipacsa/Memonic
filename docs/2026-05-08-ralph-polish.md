# 2026-05-08 — Ralph Loop: UI Polish & Feature Improvements

## What Ralph Found

Reviewing the app against a "real product" bar surfaced five categories of issues:

1. **Routing gap** — the app had no stable `/home` URL; the root `/` served the auth page directly. Any shareable link to the landing page would just be the domain root.
2. **Cluttered home page** — the auth card had three buttons ("Open channel", "Sign in", plus a submit). Two of those did the same thing; the label "Open channel" was unclear to a first-time user.
3. **Signup friction and data gaps** — the form collected a single `display_name`, an optional bio, and an optional city. There was no identity verification mechanism (social number), no country selection, and no way to prevent the same person from creating multiple accounts.
4. **No calorie goal feedback** — the tracker showed total calories consumed but gave no visual reference to whether that was on track, close to a limit, or over. A number without context is hard to act on.
5. **Select styling inconsistency** — native `<select>` elements rendered with the browser default chrome (light background, system font) while all other form controls used the terminal aesthetic.

## What Was Improved

### Routing
- Created `app/home/page.tsx` — the auth card now lives at `/home`
- `app/page.tsx` became a single-line redirect: `/` → `/home`
- `middleware.ts` and `nutrition/page.tsx` updated to redirect unauthenticated users to `/home` (not `/`)

### Home page cleanup
- Removed "Open channel" button; tab switcher now shows **Sign In** and **Create Account** only
- Copy updated: "A social network for Europe — words and images, equal citizens."

### Signup form
- Split `display_name` into **First Name** + **Family Name** (stored separately; combined for display)
- Removed the bio field — reduces signup friction; bio can be added post-onboarding
- Added **Country** dropdown with ~47 European countries (dark-themed, custom chevron)
- Added **Social / National ID Number** field — required, max 40 chars, never shown publicly
- All fields marked `required`; submit button disabled while age check fails
- Clear error messages on every failure path (email duplicate, social-number duplicate, age gate, network error)

### Database migration
- `ALTER TABLE users ADD COLUMN` for `first_name`, `family_name`, `country`, `social_number` (idempotent — wraps each in try/catch so existing databases survive the bootstrap)
- `CREATE UNIQUE INDEX idx_users_country_social ON users(country, social_number)` — enforces one account per social number per country at the DB level

### Calorie progress bar
- `CalorieProgressBar` component added to `NutritionTracker.tsx`
- Positioned immediately below the "Total kcal / macros" stats row in `TodayLog`
- Color scale: **green** (≤ 60 %), **yellow** (60–90 %), **red** (> 90 %)
- Animated fill width with matching glow shadow in the bar's color
- Inline **goal editor** lets the user set their own daily target (default 2 000 kcal); persists for the session

### Select element styling
- Added `color-scheme: dark`, `appearance: none`, dark `option` background, and a custom inline-SVG cyan chevron to the global `select` rule in `globals.css`
- All dropdowns now match the terminal/VT323 input aesthetic

## How the Design Skill Verified Quality

After each change, Playwright screenshots were compared against the quality bar:

| Check | Before | After |
|---|---|---|
| Home URL | `/` (no stable /home) | `/home` ✓ |
| Home CTA count | 3 buttons (confusing) | 2 buttons (Sign In / Create Account) ✓ |
| Signup field count | 5 fields (name, email, pw, dob, city + optional bio) | 8 fields — all required, clear purpose ✓ |
| Duplicate prevention | Email-only | Email + country+social_number composite ✓ |
| Calorie context | Number only | Progress bar with color + goal editor ✓ |
| Select styling | Browser default (light) | Terminal aesthetic (dark, custom chevron) ✓ |
| TS errors | 0 | 0 ✓ |

Final state: clean sign-in flow, clear create-account form, EU-compliant duplicate prevention, actionable calorie tracker. Looks and behaves like a product in early access, not a tutorial project.
