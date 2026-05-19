# Feature Specification: Logo Resize & Reposition

**Feature Branch**: `001-logo-resize-reposition`

**Created**: 2026-05-14

**Status**: Draft

**Input**: Resize and reposition the Memonic logo across the application to be smaller, keep it centered, with the cyan circle positioned under the letter O — goal is to recover vertical layout space for future UI features without changing theme or design.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compact Logo on Feed Page (Priority: P1)

A signed-in user lands on the `/feed` page and sees the Memonic wordmark rendered at a reduced size, still horizontally centered in the Masthead, with the pulsing cyan ReturnDot positioned directly beneath the letter "O" of the wordmark.

**Why this priority**: The feed page is the primary authenticated view; recovering vertical space here unlocks the most UI real estate.

**Independent Test**: Open `/feed`, verify the wordmark is visibly smaller than before, centered, and the cyan dot sits under the "O".

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they visit `/feed`, **Then** the Memonic wordmark is displayed at reduced size (visibly smaller than current) and horizontally centered in the Masthead.
2. **Given** the reduced wordmark, **When** inspecting the ReturnDot position, **Then** it is visually anchored directly below the letter "O" in the wordmark.
3. **Given** the resized Masthead, **When** comparing total vertical height to the previous layout, **Then** the Masthead occupies measurably less vertical space.

---

### User Story 2 - Compact Logo on Home / Auth Page (Priority: P2)

A visitor on the `/home` (login/signup) page sees the Memonic wordmark at the same reduced size and centered position as on the feed page, maintaining visual brand consistency across the application.

**Why this priority**: Consistency of the logo treatment across all pages is required; the auth page is the second major surface.

**Independent Test**: Open `/home`, confirm wordmark size and centering match the feed page treatment.

**Acceptance Scenarios**:

1. **Given** a visitor on `/home`, **When** the page loads, **Then** the Memonic wordmark is rendered at the same reduced scale as on `/feed`, horizontally centered.
2. **Given** a visitor on `/home`, **When** comparing to the feed page, **Then** logo size, font weight, and centering are visually identical.

---

### User Story 3 - Compact Logo on Nutrition Page (Priority: P3)

A signed-in user visiting `/nutrition` sees the same compact, centered Memonic wordmark, ensuring a consistent header experience across all authenticated pages.

**Why this priority**: Completes full application coverage; nutrition page uses the same Masthead component.

**Independent Test**: Open `/nutrition`, confirm wordmark matches the reduced size and centering on feed/home pages.

**Acceptance Scenarios**:

1. **Given** a signed-in user on `/nutrition`, **When** the page loads, **Then** the wordmark is reduced in size and centered, matching the other pages.

---

### Edge Cases

- What happens on narrow mobile viewports — does the centered wordmark still fit without wrapping or overflow?
- Does the reduced size remain legible at all supported viewport widths?
- Does reducing the logo affect the scanline/CRT overlay alignment in the Masthead?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Memonic wordmark MUST be reduced in visual size across all pages that display it (`/home`, `/feed`, `/nutrition`).
- **FR-002**: The wordmark MUST remain horizontally centered within the Masthead on every page.
- **FR-003**: The cyan ReturnDot (pulsing circle) on `/feed` MUST be visually positioned directly beneath the letter "O" in the wordmark.
- **FR-004**: The Masthead MUST occupy less total vertical height than the current implementation, freeing space for future UI additions.
- **FR-005**: The existing neon/cyberpunk visual theme, color palette, fonts (Monoton/Audiowide), and scanline aesthetic MUST remain unchanged.
- **FR-006**: The ReturnDot's click-to-logout behavior MUST remain fully functional after repositioning.
- **FR-007**: The wordmark MUST remain legible and not overflow its container at common viewport widths (320 px – 1920 px).

### Key Entities

- **Masthead**: The top header component rendered on all pages; contains the Memonic wordmark, optional subtitle, and (on `/feed`) the ReturnDot.
- **ReturnDot**: The pulsing cyan circle embedded in the Masthead on `/feed`; triggers logout on click.
- **Wordmark**: The styled "Memonic" text rendered using the Monoton/Audiowide display font.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Masthead's vertical height is reduced by at least 20% compared to the current implementation across all pages.
- **SC-002**: The wordmark remains horizontally centered (within ±4 px) at viewport widths of 320 px, 768 px, 1280 px, and 1920 px.
- **SC-003**: The cyan ReturnDot is positioned so that its center point falls within the horizontal bounds of the letter "O" and directly below the wordmark baseline.
- **SC-004**: No existing visual theme properties (colors, fonts, scanlines, vignette) are altered — a visual diff of non-Masthead areas shows zero change.
- **SC-005**: The logout action triggered by the ReturnDot continues to work 100% of the time after repositioning.

## Assumptions

- The change targets the shared `Masthead` component; updating it once propagates to all pages automatically.
- "Smaller" means a proportional scale reduction of the wordmark text — exact pixel size will be determined during planning, targeting maximum space recovery while preserving legibility.
- The cyan circle referenced is the `ReturnDot` component on `/feed`; on other pages no circle is present (none needs to be added).
- Mobile responsiveness is in scope — the reduced logo must not break at small viewports.
- No new colors, fonts, or visual motifs are introduced; this is a layout/size change only.
