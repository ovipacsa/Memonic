# Feature Specification: Weather Widget — Feed Right Rail

**Feature Branch**: `002-weather-widget`

**Created**: 2026-05-15

**Status**: Ready for Planning

**Input**: User description: "In the right side of the feed page after the C from Memonic and align with the Europeans users scroll view I want a weather report panel, like a widget. The widget should show the present local temperature, change of rain and level of humidity. The widget will extract the data either from the Gemini API or the device operating system. Compute and analyze which path is more robust efficient and faster and more so which way is less on resources consumption. Also as design elements should show the sun when is full sunny or clouds with rain when it is raining or just clouds when is cloudy or the sun covered by clouds depending on the weather situation. The user will also be able to activate or deactivate the widget from the UI. Adding or removing the weather widget will be done via a button shaped as the contour of a cloud that will be visible in the upper right side of the page where also the widget will pop when the button is clicked. The widget will appear to fade in when the cloud button is clicked and the fade out when the close button is clicked. The close button should be a X on the bottom right of the widget."

---

## Data Source Analysis — Technical Decision

### Option A: Gemini API
Gemini is a large-language model optimised for text generation and understanding. It does not serve real-time weather data from a live feed. Any weather information it returns is either hallucinated from training-data statistics or requires it to call an external service on the user's behalf — neither path is reliable or efficient for a live widget.

**Assessment**:
- Latency: 1–5 s per request (LLM inference overhead)
- Accuracy: Non-deterministic; no guarantee of current conditions
- Cost: Consumes Gemini API quota on every update cycle
- Resource burden: High (LLM call, tokenisation, network round-trip)
- Verdict: **Not suitable** for real-time weather display

### Option B: Browser Geolocation + Dedicated Weather API (Open-Meteo)
The browser's `navigator.geolocation` API provides the device's GPS/WiFi-triangulated coordinates with sub-second latency. Open-Meteo is a free, open-source weather API (no API key required) that returns current conditions, hourly forecasts, and precipitation probabilities from ECMWF and DWD numerical models — purpose-built exactly for this use case.

**Assessment**:
- Latency: ~150–400 ms total (geolocation + API call)
- Accuracy: Real-time meteorological data updated every 15 minutes
- Cost: Zero — Open-Meteo is free for non-commercial use with no key
- Resource burden: Minimal — a single lightweight JSON HTTP request
- Verdict: **Strongly preferred**

### Decision
**The widget MUST use the browser Geolocation API combined with a dedicated weather data service (Open-Meteo or equivalent).** Gemini is excluded from the weather data path as it is architecturally unsuited to real-time data retrieval. Gemini's existing project quota is preserved for the nutrition AI feature where it genuinely excels.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — View Local Weather Conditions (Priority: P1)

A signed-in user on the feed page wants to glance at the current weather for their physical location without leaving the page. They click the cloud-shaped toggle button in the upper-right area of the feed. A weather widget fades in, showing temperature, chance of rain, humidity, and an animated weather illustration matching the current sky conditions. They read the data and click the X to dismiss.

**Why this priority**: Core value of the feature. All other stories depend on the widget being visible and populated.

**Independent Test**: Can be tested end-to-end by loading `/feed`, clicking the cloud toggle, granting location permission, and verifying weather data appears with the correct illustration.

**Acceptance Scenarios**:

1. **Given** a signed-in user is on `/feed`, **When** they click the cloud-shaped toggle button, **Then** the weather widget fades in over ~300 ms and displays temperature, rain probability, and humidity within 2 seconds of location permission being granted.
2. **Given** the widget is visible, **When** the user clicks the X button on the bottom-right of the widget, **Then** the widget fades out over ~300 ms and disappears without a page reload.
3. **Given** the widget is visible with weather data, **Then** the illustration shown matches the condition category: full sun for clear skies, sun-behind-cloud for partly cloudy, clouds-only for overcast, clouds-with-rain for rainy conditions.

---

### User Story 2 — Toggle Widget Persistence Across Sessions (Priority: P2)

A user who always wants (or never wants) the weather widget visible does not want to re-toggle it every time they open the feed. Their preference should survive a page reload, browser restart, and device switch — because it is stored in the database against their user record.

**Why this priority**: Quality-of-life improvement. P1 delivers the widget without persistence; P2 makes it sticky.

**Independent Test**: Toggle widget on, reload page, confirm it auto-opens. Toggle widget off, reload, confirm it stays closed.

**Acceptance Scenarios**:

1. **Given** a user has previously opened the weather widget and closed the feed, **When** they return to `/feed`, **Then** the widget appears visible (or hidden) matching their last-set preference.
2. **Given** a first-time visitor with no stored preference, **When** they load `/feed`, **Then** the widget is hidden by default (closed state).

---

### User Story 3 — Location Permission Denied (Priority: P3)

A user who declines the browser's location permission prompt should receive a graceful fallback rather than a broken or empty widget.

**Why this priority**: Edge case but important for trust and non-breakage. The feed must remain fully usable even if weather data is unavailable.

**Independent Test**: Open the widget, deny the geolocation prompt, verify the widget shows a friendly "Location unavailable" message rather than an error or empty state.

**Acceptance Scenarios**:

1. **Given** the user clicks the cloud toggle button, **When** they deny the browser location permission, **Then** the widget displays a message indicating location is needed and offers a prompt to enable permissions, with no console errors surfaced to the UI.
2. **Given** location is unavailable (timeout or denial), **When** the widget is open, **Then** the illustration area shows a neutral placeholder (no weather-state icon) and data fields show "—".

---

### User Story 4 — Weather Illustration Accuracy (Priority: P2)

A user expects the visual illustration inside the widget to accurately reflect current sky conditions, reinforcing at a glance whether to grab an umbrella or enjoy the day.

**Why this priority**: This is the primary differentiator from a plain text readout — the visual condition mapping is core to the widget's identity and Mnemonic aesthetic.

**Independent Test**: Simulate different WMO weather codes and verify each maps to the correct illustration variant.

**Acceptance Scenarios**:

1. **Given** weather code indicates clear sky (WMO 0), **Then** the sun illustration is shown (full glow, no clouds).
2. **Given** weather code indicates partly cloudy (WMO 1–2), **Then** the sun-behind-cloud illustration is shown.
3. **Given** weather code indicates overcast (WMO 3), **Then** the clouds-only illustration is shown.
4. **Given** weather code indicates rain, drizzle, or showers (WMO 51–82), **Then** the clouds-with-rain illustration is shown.
5. **Given** weather code indicates snow or thunderstorm, **Then** the clouds-with-rain illustration (or variant) is shown as a fallback.

---

### Edge Cases

- What happens when the weather API is unreachable (network offline, API down)? → Widget shows stale data with a "last updated" timestamp, or a "weather unavailable" message if no prior data exists.
- What happens if geolocation takes longer than 5 seconds? → Widget shows a loading state; auto-dismisses to "unavailable" state after 8 seconds.
- What if the user rapidly clicks the cloud toggle button? → Debounce the toggle to prevent multiple concurrent animation states.
- What if the browser does not support `navigator.geolocation`? → Widget shows "Location API not supported" and remains openable but non-functional.
- Temperature unit display: Celsius only — no unit toggle is provided. This is consistent with EU regional standards and keeps the widget UI uncluttered.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display a cloud-shaped toggle button in the upper-right area of the `/feed` page, positioned above the right-side rail and visible at all times.
- **FR-002**: The system MUST show the weather widget when the cloud toggle is clicked (if hidden), and MUST hide it when clicked again (if visible).
- **FR-003**: The weather widget MUST fade in over approximately 300 ms when shown, and fade out over approximately 300 ms when hidden.
- **FR-004**: The widget MUST include a close (X) button anchored to the bottom-right corner of the widget panel.
- **FR-005**: The widget MUST request the user's device location via the browser Geolocation API upon first opening.
- **FR-006**: The widget MUST fetch current weather data from a dedicated weather data service using the obtained coordinates.
- **FR-007**: The widget MUST display current local temperature in degrees Celsius.
- **FR-008**: The widget MUST display the probability of precipitation (rain chance) as a percentage.
- **FR-009**: The widget MUST display current relative humidity as a percentage.
- **FR-010**: The widget MUST render an animated weather illustration matching the current condition: clear/sunny, partly cloudy (sun behind cloud), overcast (clouds only), or rainy (clouds with rain drops).
- **FR-011**: The widget MUST be positioned in the right column of the feed layout, vertically aligned with the top of the European Users (Signal Members) rail, appearing below or adjacent to the "C" letterform of the Memonic masthead.
- **FR-012**: The widget MUST display a graceful fallback state (message + neutral illustration) when location permission is denied or unavailable.
- **FR-013**: The widget MUST display a graceful fallback state when weather data cannot be fetched.
- **FR-014**: The user's widget visibility preference (shown/hidden) MUST be persisted in the database against their user record, so the preference is consistent across all devices and sessions.
- **FR-015**: The widget MUST NOT consume Gemini API quota for weather data retrieval.
- **FR-016**: The cloud toggle button MUST remain visually accessible and not overlap core feed content.

### Key Entities *(include if feature involves data)*

- **WeatherState**: Represents a snapshot of current conditions — temperature (°C), rain probability (%), humidity (%), WMO weather code, condition category (sunny / partly-cloudy / overcast / rainy), last-fetched timestamp.
- **WidgetPreference**: Represents the user's persisted toggle state — visible (boolean), stored in the database on the user record. Follows the user across all devices.
- **ConditionCategory**: Enumeration of four visual states — `sunny`, `partly-cloudy`, `overcast`, `rainy` — derived from WMO weather codes returned by the weather service.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Weather data (temperature, rain chance, humidity) appears in the widget within 2 seconds of the user granting location permission on a standard broadband connection.
- **SC-002**: The widget toggle animation (fade-in / fade-out) completes within 350 ms to feel instantaneous.
- **SC-003**: The weather illustration accurately reflects the WMO condition category for 100% of the defined four condition categories (sunny, partly cloudy, overcast, rainy).
- **SC-004**: Gemini API call count is unchanged after this feature is deployed — zero additional Gemini requests attributable to the weather widget.
- **SC-005**: When location permission is denied, zero unhandled errors appear in the browser console and the widget remains dismissible.
- **SC-006**: The widget's visible/hidden state is correctly restored on page reload in 100% of test scenarios where a preference was previously set.
- **SC-007**: The cloud toggle button does not overlap or obscure any feed content or navigation elements at any standard viewport width (≥ 320 px).

---

## Assumptions

- Users are accessing Memonic from a browser that supports `navigator.geolocation` (all modern browsers including Chrome, Firefox, Safari, Edge).
- The Open-Meteo API (or equivalent free weather service) is accessible from the client's browser without CORS restrictions — Open-Meteo explicitly supports browser-side requests.
- Temperature will be displayed in Celsius exclusively, consistent with EU regional standards.
- Weather data will be fetched on widget open and refreshed at most once per 30 minutes to conserve bandwidth; stale data from a previous open in the same session can be reused if within the refresh window.
- The widget is a client-side component only — no server-side proxy for weather data is required.
- Animated weather illustrations will be implemented as SVG or CSS animations consistent with the Mnemonic Studio neon/cyberpunk aesthetic (cyan glow for rain, magenta/yellow for sun, midnight black backgrounds).
- This feature requires a database schema change: a `weather_widget_visible` boolean column (default `false`) added to the `users` table to persist the toggle preference server-side.
