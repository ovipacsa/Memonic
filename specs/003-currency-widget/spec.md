# Feature Specification: Currency & Commodities Widget

**Feature Branch**: `003-currency-widget`

**Created**: 2026-05-20

**Status**: Draft

**Input**: User description: "on the left side of the Memonic logo, opposite where we have the weather widget create a currency widget. The widget should have the same mnemonic style and same alignment. The widget should find based on location the local currency if still exists and show the exchange rate against EUR. Second should show the exchange rate of the local currency against USD. If the country does not have a local currency and it uses EUR the widget will show the exchange rate between EUR and USD and between EUR and YUAN. Also the widget will show the price of crude oil."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — View Local Currency Exchange Rates (Priority: P1)

A signed-in user on the feed page is in a country with its own national currency (e.g., Poland — PLN, Sweden — SEK, UK — GBP). The currency widget is visible on the left side of the Masthead, mirroring the weather widget on the right. Without any interaction, the widget automatically detects their country from browser geolocation, identifies the local currency, and displays two exchange rates: local currency vs EUR, and local currency vs USD.

**Why this priority**: This is the core use case. Every other story is a variant or edge case of this one.

**Independent Test**: Load `/feed` from a country with a non-EUR currency, grant geolocation permission, and verify the widget shows the correct currency code with both EUR and USD rates.

**Acceptance Scenarios**:

1. **Given** a signed-in user is on `/feed` in a country with its own currency, **When** the page loads and location permission is granted, **Then** the widget displays the local currency code, its rate against EUR, and its rate against USD — all within 3 seconds.
2. **Given** the widget is displaying rates, **Then** rates are shown to at least 4 decimal places for precision (e.g., PLN/EUR: 0.2341).
3. **Given** the widget is visible, **Then** the currency code and flag or abbreviation of the country is shown alongside the rates for clarity.

---

### User Story 2 — EUR-Zone User View (Priority: P1)

A signed-in user whose country uses EUR as its national currency (e.g., Germany, France, Italy, Spain) sees a meaningful alternative: the EUR/USD exchange rate and the EUR/CNY (Chinese Yuan) exchange rate, since those are the two globally significant currency pairs for a EUR-based user. The crude oil price is also always displayed.

**Why this priority**: Equal priority to Story 1 — together they cover 100% of the expected European user base. Neither story is a subset of the other.

**Independent Test**: Load `/feed` from a EUR-zone country, verify the widget shows EUR/USD and EUR/CNY pairs (not a local-vs-EUR pair).

**Acceptance Scenarios**:

1. **Given** a signed-in user is in a EUR-zone country, **When** location is detected, **Then** the widget shows EUR/USD and EUR/CNY exchange rates (not a local currency row).
2. **Given** the EUR/CNY pair is displayed, **Then** the label clearly reads "EUR → CNY" or equivalent to avoid ambiguity.

---

### User Story 3 — Crude Oil Price (Priority: P1)

Regardless of the user's currency zone, the widget always displays the current price of Brent crude oil in USD per barrel. This row is always present below the currency exchange rows.

**Why this priority**: Always-on commodity data is part of the widget's core value proposition — it applies to every user regardless of location.

**Independent Test**: Load `/feed` from any country and verify the crude oil price row is present, labelled, and shows a plausible USD/barrel value.

**Acceptance Scenarios**:

1. **Given** any signed-in user loads `/feed`, **Then** the widget always contains a crude oil price row labelled "Brent Crude" (or equivalent) showing price in USD per barrel.
2. **Given** the crude oil data cannot be fetched, **Then** the row shows "—" with a "data unavailable" label, without hiding or breaking the currency rows.

---

### User Story 4 — Location Permission Denied (Priority: P2)

A user who declines the browser location permission cannot have their currency auto-detected. The widget must degrade gracefully.

**Why this priority**: Maintains trust and usability even without geolocation access.

**Independent Test**: Deny geolocation prompt, verify the widget shows a neutral fallback (e.g., EUR/USD and EUR/CNY as default pair) with a label explaining that location is unavailable.

**Acceptance Scenarios**:

1. **Given** the user denies geolocation, **When** the widget loads, **Then** it falls back to displaying EUR/USD and EUR/CNY as the default pair, with a visible label stating "Location unavailable — showing EUR rates".
2. **Given** location is denied, **Then** the crude oil price row still loads and displays normally.
3. **Given** location is denied, **Then** no unhandled errors appear in the browser console.

---

### User Story 5 — Data Staleness and Refresh (Priority: P3)

Exchange rates and commodity prices change throughout the trading day. The widget should surface reasonably current data without hammering the data source on every page interaction.

**Why this priority**: Important for data quality but not for initial launch viability; cached rates from the same session are acceptable.

**Independent Test**: Load the page, note displayed rates, wait 30 minutes without reloading, then reload — verify data is refreshed.

**Acceptance Scenarios**:

1. **Given** the widget has loaded rates, **When** the page is reloaded more than 30 minutes later, **Then** fresh rates are fetched from the data source.
2. **Given** the widget was loaded less than 30 minutes ago, **When** the user navigates away and returns, **Then** the previously cached rates may be reused without a fresh network request.
3. **Given** the widget shows rates, **Then** a "last updated" timestamp is displayed indicating when the data was last fetched.

---

### Edge Cases

- What if the detected country has no currency mapping (unrecognised territory, VPN location mismatch)? → Fall back to EUR/USD + EUR/CNY as the default pair with "Location unrecognised — showing EUR rates".
- What if exchange rate data is unavailable (API down, network error)? → Show "—" for each rate field with an "Update failed" label; crude oil row behaves independently.
- What if crude oil pricing data is unavailable independently of currency data? → Show "—" only in the crude oil row; currency rows are unaffected.
- What if the user is in a country that recently adopted EUR (e.g., Croatia in 2023)? → The currency mapping should reflect current status — Croatia is EUR-zone; show EUR/USD + EUR/CNY.
- What if the exchange rate API returns stale data (e.g., weekend/bank holiday)? → Display the most recent available rate with a "as of [date]" label.
- What happens if the widget and the weather widget both request geolocation simultaneously? → A single shared geolocation result should be reused; duplicate permission prompts must not appear.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The currency widget MUST be positioned in the left area of the Masthead, horizontally opposite to the weather widget, and vertically aligned with it.
- **FR-001b**: A toggle button (styled as a currency/coin symbol) MUST be permanently visible in the upper-left area of the feed page, mirroring the weather widget's cloud toggle button on the upper-right.
- **FR-001c**: Clicking the toggle button MUST show the widget (if hidden) or hide it (if visible), with a ~300 ms fade animation — identical behaviour to the weather widget toggle.
- **FR-001d**: The widget MUST include a close (X) button anchored to the bottom-right corner of the widget panel, identical in position and behaviour to the weather widget's X button.
- **FR-001e**: The user's widget visibility preference (shown/hidden) MUST be persisted in the database against their user record so the preference is consistent across devices and sessions.
- **FR-002**: The widget MUST visually conform to the Mnemonic Studio neon/cyberpunk aesthetic — same typography (Space Mono / VT323), same colour palette (midnight background, magenta/cyan/yellow accents), same scanline-compatible styling as the weather widget.
- **FR-003**: The widget MUST use the browser Geolocation API to determine the user's country on page load.
- **FR-004**: The system MUST map the detected country to its current official national currency.
- **FR-005**: If the detected country's currency is NOT EUR, the widget MUST display: (a) local currency / EUR exchange rate, and (b) local currency / USD exchange rate.
- **FR-006**: If the detected country uses EUR as its currency, the widget MUST display: (a) EUR / USD exchange rate, and (b) EUR / CNY (Chinese Yuan) exchange rate.
- **FR-007**: The widget MUST always display the current Brent crude oil price in USD per barrel, regardless of the user's currency zone.
- **FR-008**: Exchange rates MUST be displayed to at least 4 decimal places.
- **FR-009**: The crude oil price MUST be displayed to 2 decimal places with a USD/bbl label.
- **FR-010**: The widget MUST show a "last updated" timestamp for the financial data.
- **FR-011**: The widget MUST display a graceful fallback (EUR/USD + EUR/CNY) when geolocation is unavailable, denied, or returns an unrecognised country, with an explanatory label.
- **FR-012**: The widget MUST display "—" for any individual rate that cannot be fetched, without hiding other rows that loaded successfully.
- **FR-013**: Financial data MUST be cached for a minimum of 30 minutes per session to avoid excessive API requests.
- **FR-014**: The widget MUST NOT reuse Gemini API quota for currency or commodity data retrieval.
- **FR-015**: If the weather widget has already obtained a geolocation result, the currency widget MUST reuse that result rather than issuing a second geolocation prompt.
- **FR-016**: The widget MUST use a free, publicly accessible financial data source that does not require user-facing API key configuration (no key stored client-side in plaintext or exposed in browser network requests in an insecure manner).

### Key Entities *(include if feature involves data)*

- **CurrencyZone**: Represents the user's detected financial context — country code, local currency code (ISO 4217), whether the country uses EUR, and the fallback display mode.
- **ExchangeRateSnapshot**: A pair of currency rates fetched at a point in time — base currency, quote currency, rate value, timestamp of fetch.
- **CommodityPrice**: Represents the current price of Brent crude oil — value in USD, unit (per barrel), source label, timestamp of fetch.
- **CurrencyWidgetState**: The combined display state — CurrencyZone, list of ExchangeRateSnapshots, CommodityPrice, loading status per row, error status per row, last-updated timestamp.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Exchange rate data appears in the widget within 3 seconds of location permission being granted on a standard broadband connection.
- **SC-002**: The widget correctly identifies the local currency for 100% of EU member states and major European non-EU countries (UK, Switzerland, Norway, Sweden, Poland, Czech Republic, Hungary, Romania).
- **SC-003**: EUR-zone detection is accurate for 100% of current eurozone member states (as of 2024: 20 EU countries + territories).
- **SC-004**: The crude oil price row is present and populated in 100% of widget loads where the commodity data source is reachable.
- **SC-005**: When any single data row fails to load, the remaining rows display correctly — zero cases where one failure collapses the entire widget.
- **SC-006**: No duplicate geolocation permission prompts appear when both the weather widget and the currency widget are active on the same page load.
- **SC-007**: Gemini API call count is unchanged after this feature is deployed — zero additional Gemini requests attributable to the currency widget.
- **SC-008**: The widget does not overlap or obscure any feed content, the Memonic wordmark, or the weather widget at any standard viewport width (≥ 320 px).

---

## Assumptions

- Browser Geolocation API will be used for country detection, consistent with the approach already established by the weather widget.
- A free, key-free public financial data API exists and is suitable for this use case (e.g., Frankfurter.app for ECB-published EUR exchange rates; a commodity data source for crude oil).
- Crude oil price will use Brent crude as the reference benchmark, as it is the European/international standard (WTI is the North American benchmark).
- The widget uses a toggle mechanism identical in behaviour to the weather widget: a dedicated toggle button is visible in the upper-left area of the feed; clicking it shows or hides the widget with a fade animation.
- The toggle button shape should be thematically distinct from the weather widget's cloud button — a currency symbol (e.g., a stylised "¤" or coin outline) is appropriate.
- The user's widget visibility preference (shown/hidden) is persisted in the database against their user record, consistent with the weather widget persistence pattern.
- Exchange rates are indicative mid-market rates, not live trading rates. A disclaimer "indicative rates only" is acceptable in the widget footer.
- The widget shares the geolocation result already obtained by the weather widget via a shared client-side state, avoiding duplicate permission prompts.
- Currency data is fetched client-side; no server-side proxy is required unless CORS restrictions on the chosen API make client-side requests impossible.
