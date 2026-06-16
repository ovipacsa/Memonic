# Feature Specification: Assets Price Widget (Silver / Gold / SpaceX)

**Feature Branch**: `005-assets-widget`

**Created**: 2026-06-16

**Status**: Draft

## Clarifications

### Session 2026-06-16

- Q: Which data series should the "SpaceX" button track? → A: NASDAQ-listed SPCX (Space Exploration Technologies Corp) as the direct SpaceX ticker.
- Q: Which external price data source should the widget use? → A: Yahoo Finance unofficial chart endpoints (SPCX for SpaceX; `SI=F` and `GC=F` futures for Silver and Gold). No API key; acceptable for v1 prototype; revisit before public/multi-user release.
- Q: What defines the "current trading day" for the graph and gain/loss? → A: Each asset's own exchange-local trading session (America/New_York for both SPCX on NASDAQ and Silver/Gold on COMEX). The user's local time zone is used only to display times in tooltips.
- Q: What loading / refresh / error UX should the widget use? → A: Skeleton placeholder on first load; silent in-place refresh (no spinner flicker) on subsequent ticks; inline error chip with a retry action when a fetch fails or when displayed data exceeds 60 seconds of staleness.
- Q: What should the 10-second polling do when the tab is hidden? → A: Pause polling while `document.visibilityState === 'hidden'`; resume on focus with an immediate fetch so the user sees current data on return.

**Input**: User description: "Below the calories box, a new box showing intraday price evolution and current price for Silver, Gold, and SpaceX. Three buttons (Silver, Gold, SpaceX) switch the active asset; Silver is default. Updates every 10 seconds. Graph shows the current trading day; current value in the top-right. Mouse hover reveals price at the hovered point. When the market is closed, the box shows the last close price and the gain/loss vs the previous day. When the market is open, the box shows the live current price and gain/loss vs previous close, with the graph drawing as the day progresses."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Track silver intraday price at a glance (Priority: P1)

A user opens the nutrition page and, below the calories box, sees an asset widget showing today's silver price evolution as a graph with the current price prominently displayed in the top-right corner. The user can see at a glance whether silver is up or down for the day.

**Why this priority**: This is the core value of the widget — passive tracking of the default asset (silver) without any interaction required. It delivers the full experience for one asset, which is itself a viable MVP.

**Independent Test**: Load the page; verify the widget appears below the calories box, defaults to silver, displays today's intraday line chart, shows the current price top-right, and shows a gain/loss indicator versus previous close.

**Acceptance Scenarios**:

1. **Given** the user is on the nutrition page during market hours, **When** the widget loads, **Then** silver is the active asset, the graph plots today's price points, and the current silver price is shown in the top-right.
2. **Given** the widget is active, **When** 10 seconds pass, **Then** the displayed current price and graph are refreshed with the latest available data.
3. **Given** the widget is showing a live price, **When** the price has moved versus the previous day's close, **Then** the gain/loss is displayed (absolute and/or percentage) and visually distinguished as positive or negative.

---

### User Story 2 - Switch between Silver, Gold, and SpaceX (Priority: P2)

The user clicks one of the three buttons below the chart (Silver, Gold, SpaceX) to switch which asset is displayed. The widget immediately updates to show the selected asset's intraday graph, current price, and gain/loss.

**Why this priority**: Adds breadth (multi-asset tracking) on top of the P1 single-asset baseline. The widget is still useful without this, but switching is the primary differentiator from a single-asset widget.

**Independent Test**: Click each of the three buttons; verify the active button is visually indicated, and the graph, current price, and gain/loss update to reflect the selected asset within a short, perceivable delay.

**Acceptance Scenarios**:

1. **Given** silver is active, **When** the user clicks "Gold", **Then** the widget switches to gold (graph, current price, gain/loss all reflect gold) and the Gold button is shown as active.
2. **Given** any asset is active, **When** the user clicks the button for the already-active asset, **Then** the widget remains on that asset with no disruptive reload.
3. **Given** the user switches assets, **When** the 10-second refresh fires, **Then** only the currently selected asset's data is refreshed.

---

### User Story 3 - Inspect historical points on the intraday graph (Priority: P3)

The user moves the mouse over the graph to inspect the price at a specific moment in the trading day. A tooltip or marker reveals the price (and time) at the hovered point.

**Why this priority**: Enhances analysis but is not required for the at-a-glance use case. Hover inspection is a polish feature on top of the live graph.

**Independent Test**: Hover the mouse across the graph; verify a marker/tooltip follows the cursor and shows the price at the hovered point. Move off the graph; verify the indicator disappears.

**Acceptance Scenarios**:

1. **Given** the intraday graph is displayed, **When** the user hovers over a point on the line, **Then** a tooltip or readout shows the price (and time) at that point.
2. **Given** the user is hovering the graph, **When** the mouse leaves the graph area, **Then** the hover indicator is dismissed and the top-right reverts to the current/last price.

---

### User Story 4 - Closed-market fallback (Priority: P2)

When the market for the selected asset is closed, the widget shows the most recent close price and the gain/loss versus the prior day's close, instead of a live-updating graph.

**Why this priority**: Without this, the widget would appear broken outside market hours. Required for usability across the day, but it's a fallback rather than the primary live experience.

**Independent Test**: View the widget outside the market's open hours; verify it shows the last close price, the day-over-day gain/loss, and a clear indication that the market is closed.

**Acceptance Scenarios**:

1. **Given** the market for the selected asset is closed, **When** the widget renders, **Then** it shows the last close price, the gain/loss vs the previous day's close, and a "market closed" indicator.
2. **Given** the widget is in closed-market mode, **When** the market opens, **Then** the widget transitions to live mode within one refresh cycle and begins plotting intraday points.
3. **Given** the market is closed, **When** the 10-second refresh fires, **Then** the widget does not need to update the current price (or updates only if a newer close becomes available).

### Edge Cases

- The asset's market data feed is temporarily unavailable: the widget should show an unobtrusive error state for that asset without breaking the rest of the page or the other two assets.
- A trading day has just started and there is only one or two price points yet: the graph should render gracefully (single point shown, or partial line) without empty-axis errors.
- The user switches assets in the middle of a 10-second refresh cycle: the previous asset's pending update is discarded; the newly selected asset is fetched immediately.
- SpaceX is tracked via the NASDAQ ticker SPCX; its market schedule (regular NASDAQ hours) governs open/closed state for that asset.
- Silver and Gold trade on commodity markets that operate nearly 24/5; the "market closed" logic must reflect the actual schedule of the chosen reference market.
- The hover tooltip should never overlap or hide the current-price readout in the top-right corner.
- The widget must not push the rest of the page off-screen on narrow viewports; it should reflow or scale.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The widget MUST be displayed directly below the calories box on the nutrition page, visually consistent with the existing Mnemonic Studio aesthetic.
- **FR-002**: The widget MUST support exactly three assets: Silver, Gold, and SpaceX, selectable via three buttons labelled "Silver", "Gold", and "SpaceX" placed below the chart area.
- **FR-003**: The widget MUST default to Silver on initial render.
- **FR-004**: The currently selected asset's button MUST be visually distinguished as active.
- **FR-005**: The widget MUST display only one asset's data at a time (graph, current price, gain/loss).
- **FR-006**: When the asset's market is open, the widget MUST display an intraday line graph reflecting the current trading day's price evolution, where "current trading day" is defined by the asset's own exchange-local session (America/New_York for SPCX on NASDAQ and for Silver/Gold on COMEX).
- **FR-007**: The current (or latest) price of the selected asset MUST be displayed in the top-right corner of the widget.
- **FR-008**: The widget MUST display the gain or loss versus the previous day's close, in both absolute and percentage form, with a clear positive/negative visual indication.
- **FR-009**: The widget MUST refresh the displayed data (current price and graph) every 10 seconds while the market is open AND the page tab is visible. When the tab becomes hidden, polling MUST pause; when it becomes visible again, the widget MUST issue an immediate fetch and resume the 10-second cadence.
- **FR-010**: Users MUST be able to hover the mouse over the graph and see the asset's price (and corresponding time) at the hovered point via a tooltip or inline readout. Times in tooltips MUST be shown in the user's local time zone.
- **FR-011**: When the market for the selected asset is closed, the widget MUST display the last available close price, the day-over-day gain/loss, and a clear "market closed" indicator instead of a live intraday graph.
- **FR-012**: Switching the active asset MUST update the graph, current price, gain/loss, and active-button state without a full page reload.
- **FR-013**: The widget MUST track SpaceX via the NASDAQ-listed ticker **SPCX** (Space Exploration Technologies Corp). The displayed series, market schedule, current price, and previous close all derive from SPCX's regular NASDAQ trading session.
- **FR-014**: The widget MUST handle data-source failures gracefully by showing an inline error chip with a retry control for the affected asset, without impacting the other two assets or the rest of the page. If displayed data becomes more than 60 seconds stale, the same error/retry state MUST be shown.
- **FR-016**: On first load (or after switching assets), the widget MUST show a skeleton placeholder for the chart, current price, and gain/loss until the first response arrives.
- **FR-017**: Subsequent 10-second refreshes MUST update the displayed values in place without a spinner, loading overlay, or visible flicker.
- **FR-015**: The widget MUST remember the user's selected asset only for the duration of the current session/page view (no persistent preference required for v1).

### Key Entities *(include if feature involves data)*

- **Asset**: A tradable instrument the widget tracks. Attributes: identifier, display name (Silver / Gold / SpaceX), reference market, market schedule, previous-day close price.
- **Price Point**: A single observation of an asset's price at a moment in time. Attributes: asset reference, timestamp, price value.
- **Intraday Series**: The ordered set of price points for an asset for the current trading day; the basis for the graph.
- **Market Status**: Open / closed indicator for an asset's reference market at the current moment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a user opens the nutrition page during silver market hours, the widget displays silver's intraday graph and a current price within 3 seconds of page load on a typical broadband connection.
- **SC-002**: While the widget is open during market hours, the displayed current price and graph reflect data no more than 15 seconds old at any time (10-second refresh plus reasonable jitter).
- **SC-003**: A user can switch between any two of the three assets and see the new asset fully rendered (graph + current price + gain/loss) within 2 seconds of clicking the button on a typical broadband connection.
- **SC-004**: When the user hovers any point on the graph, the corresponding price is displayed within 200 ms of the cursor stopping.
- **SC-005**: Outside market hours, 100% of widget loads show a clearly labelled "market closed" state with the last close price and day-over-day gain/loss (no blank or live-style charts).
- **SC-006**: When a data source for one asset is unavailable, the other two assets remain usable in at least 95% of cases.

## Assumptions

- The widget is added only to the nutrition page (`/feed/nutrition` flow), directly below the existing calories box; it is not added to other pages in v1.
- Silver and Gold are tracked via COMEX futures (`SI=F` for silver, `GC=F` for gold) sourced from Yahoo Finance; the COMEX session governs open/closed state for both metals.
- All three assets' price data is sourced from Yahoo Finance's unofficial chart endpoints (no API key required). This is acceptable for the v1 single-user prototype and should be re-evaluated before any wider release.
- SpaceX is tracked directly via the NASDAQ-listed ticker **SPCX** (Space Exploration Technologies Corp); its previous-day close and market schedule come from the regular NASDAQ session.
- "Previous day" means the previous trading day for that asset's reference market, not a calendar day.
- A 10-second refresh interval is acceptable from a rate-limit/cost perspective for the chosen data sources.
- All three buttons and the chart fit within the existing nutrition page layout without requiring a layout redesign.
- No persistence of asset selection across sessions is required for v1.
- The widget is read-only; no trading, alerts, or watchlist features are in scope for v1.
