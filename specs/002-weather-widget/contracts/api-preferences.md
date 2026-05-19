# API Contract: PATCH /api/me/preferences

**New route** — `app/api/me/preferences/route.ts`

---

## Authentication
Required. Reads session from `memonic_session` httpOnly cookie via `getSession()`. Returns `401` if no valid session.

## Request

```
PATCH /api/me/preferences
Content-Type: application/json
```

**Body schema** (zod-validated):
```json
{
  "weatherWidgetVisible": true
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `weatherWidgetVisible` | boolean | yes | Desired widget visibility state to persist |

## Responses

### 200 OK
```json
{ "ok": true }
```

### 400 Bad Request
```json
{ "error": "Invalid body" }
```
Returned when the body fails zod validation.

### 401 Unauthorized
```json
{ "error": "Unauthorized" }
```

### 500 Internal Server Error
```json
{ "error": "Failed to update preferences" }
```

---

## Updated GET /api/me Response

The existing `GET /api/me` route must include `weatherWidgetVisible` in its response payload so client components can read the preference without an extra round-trip.

**Addition to response body**:
```json
{
  "id": "...",
  "email": "...",
  "display_name": "...",
  "weatherWidgetVisible": false
}
```

---

## External API Contract: Open-Meteo (client-side)

This call originates from the browser — no server route involved.

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}
  &longitude={lon}
  &current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code
  &temperature_unit=celsius
```

**Expected response shape** (relevant fields only):
```json
{
  "current": {
    "temperature_2m": 18.5,
    "relative_humidity_2m": 72,
    "precipitation_probability": 20,
    "weather_code": 2
  }
}
```

**Timeout**: 8 seconds. On timeout or non-2xx response, the widget transitions to the ERROR state.
