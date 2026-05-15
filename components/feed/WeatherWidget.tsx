"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { wmoToCondition, type ConditionCategory } from "@/lib/weather";

type WeatherState = {
  temperatureC: number;
  rainProbabilityPct: number;
  humidityPct: number;
  condition: ConditionCategory;
  cityName: string | null;
  lastFetched: number;
};

type WidgetStatus = "idle" | "loading" | "ready" | "error";

const REFRESH_MS = 30 * 60 * 1000;
const GEO_TIMEOUT_MS = 8000;

// ─── Compact Weather Icons (fits inside masthead height) ──────────────────────

function SunnyIcon({ size = 38 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <g transform="translate(20,20)" style={{ animation: "weather-sun-pulse 3s ease-in-out infinite", transformOrigin: "0 0" }}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <g key={deg} transform={`rotate(${deg})`}>
            <line y1="-11" y2="-15" stroke="#F9F002" strokeWidth="2" strokeLinecap="round" />
          </g>
        ))}
        <circle r="8" fill="#F9F002" />
      </g>
    </svg>
  );
}

function PartlyCloudyIcon({ size = 38 }: { size?: number }) {
  return (
    <svg viewBox="0 0 44 38" width={size} height={size * (38 / 44)} aria-hidden="true">
      <g transform="translate(16,14)" style={{ animation: "weather-sun-pulse 4s ease-in-out infinite", transformOrigin: "0 0" }}>
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <g key={deg} transform={`rotate(${deg})`}>
            <line y1="-8" y2="-11" stroke="#F9F002" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        ))}
        <circle r="6" fill="#F9F002" />
      </g>
      <g style={{ animation: "weather-cloud-float 5s ease-in-out infinite", transformOrigin: "50% 50%" }}>
        <MiniCloud x={16} y={18} w={26} h={14} />
      </g>
    </svg>
  );
}

function OvercastIcon({ size = 38 }: { size?: number }) {
  return (
    <svg viewBox="0 0 44 32" width={size} height={size * (32 / 44)} aria-hidden="true">
      <g style={{ animation: "weather-cloud-float 6s ease-in-out infinite 0.3s", transformOrigin: "50% 50%" }}>
        <MiniCloud x={2} y={2} w={28} h={14} />
      </g>
      <g style={{ animation: "weather-cloud-float 5s ease-in-out infinite", transformOrigin: "50% 50%" }}>
        <MiniCloud x={10} y={14} w={30} h={14} />
      </g>
    </svg>
  );
}

function RainyIcon({ size = 38 }: { size?: number }) {
  return (
    <svg viewBox="0 0 44 40" width={size} height={size * (40 / 44)} aria-hidden="true">
      <g style={{ animation: "weather-cloud-float 5s ease-in-out infinite", transformOrigin: "50% 50%" }}>
        <MiniCloud x={4} y={2} w={36} h={16} />
      </g>
      {[
        { x: 14, delay: "0s" },
        { x: 22, delay: "0.4s" },
        { x: 30, delay: "0.8s" },
      ].map(({ x, delay }) => (
        <line
          key={x}
          x1={x} y1={22} x2={x - 3} y2={32}
          stroke="#00F0FF" strokeWidth="2" strokeLinecap="round"
          style={{ animation: "weather-rain-fall 1.2s linear infinite", animationDelay: delay }}
        />
      ))}
    </svg>
  );
}

function NeutralIcon({ size = 38 }: { size?: number }) {
  return (
    <svg viewBox="0 0 44 28" width={size} height={size * (28 / 44)} aria-hidden="true">
      <MiniCloud x={6} y={6} w={32} h={16} fillOpacity={0.05} strokeOpacity={0.3} />
    </svg>
  );
}

function MiniCloud({
  x, y, w, h,
  fillOpacity = 0.18,
  strokeOpacity = 1,
}: {
  x: number; y: number; w: number; h: number;
  fillOpacity?: number; strokeOpacity?: number;
}) {
  const cx = x + w / 2;
  const r  = h / 2;
  return (
    <g>
      <circle cx={cx - w * 0.2} cy={y + r * 0.55} r={r * 0.72}
        fill={`rgba(157,0,255,${fillOpacity})`} stroke={`rgba(157,0,255,${strokeOpacity})`} strokeWidth="1" />
      <circle cx={cx}           cy={y + r * 0.35} r={r * 0.88}
        fill={`rgba(157,0,255,${fillOpacity})`} stroke={`rgba(157,0,255,${strokeOpacity})`} strokeWidth="1" />
      <circle cx={cx + w * 0.18} cy={y + r * 0.6} r={r * 0.65}
        fill={`rgba(157,0,255,${fillOpacity})`} stroke={`rgba(157,0,255,${strokeOpacity})`} strokeWidth="1" />
      <rect x={x + r * 0.4} y={y + r * 0.7} width={w - r * 0.8} height={r * 1.2} rx={r * 0.5}
        fill={`rgba(157,0,255,${fillOpacity})`} stroke={`rgba(157,0,255,${strokeOpacity})`} strokeWidth="1" />
    </g>
  );
}

// ─── Cloud Toggle Button (shown when widget is CLOSED) ────────────────────────

function CloudButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open weather widget"
      title="Local weather"
      style={{
        background: "transparent",
        border: "none",
        padding: "4px",
        cursor: "pointer",
        lineHeight: 0,
        opacity: 0.65,
        transition: "opacity 200ms ease, filter 200ms ease",
        filter: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "1";
        e.currentTarget.style.filter = "drop-shadow(0 0 6px rgba(0,240,255,0.8))";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "0.65";
        e.currentTarget.style.filter = "none";
      }}
    >
      <svg viewBox="0 0 56 34" width="50" height="30" fill="none" aria-hidden="true">
        <path
          d="M 12 30 C 7 30 3 27 3 23 C 3 19 6 17 9.5 16.5
             C 9.5 10 14.5 5 21 5 C 25.5 5 29.5 7.5 31.5 11
             C 33.5 8.5 37 7 41 7.5 C 47 7.5 52 12 52 18
             C 55 19 57 22 56.5 25 C 56 28 53 30 50 30 Z"
          stroke="#00F0FF"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// ─── Condition icon selector ──────────────────────────────────────────────────

function ConditionIcon({ condition, size }: { condition: ConditionCategory | undefined; size: number }) {
  if (!condition) return <NeutralIcon size={size} />;
  if (condition === "sunny")        return <SunnyIcon size={size} />;
  if (condition === "partly-cloudy") return <PartlyCloudyIcon size={size} />;
  if (condition === "overcast")      return <OvercastIcon size={size} />;
  return <RainyIcon size={size} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WeatherWidget({ initialVisible }: { initialVisible: boolean }) {
  const [visible, setVisible]   = useState(initialVisible);
  const [status, setStatus]     = useState<WidgetStatus>("idle");
  const [weather, setWeather]   = useState<WeatherState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const savePreference = useCallback((val: boolean) => {
    fetch("/api/me/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weatherWidgetVisible: val }),
    }).catch(() => {});
  }, []);

  const fetchWeather = useCallback(() => {
    if (pendingRef.current) return;
    if (weather && Date.now() - weather.lastFetched < REFRESH_MS) return;

    pendingRef.current = true;
    setStatus("loading");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);

          const [weatherRes, geoRes] = await Promise.all([
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code&temperature_unit=celsius`,
              { signal: controller.signal }
            ),
            fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
              { signal: controller.signal, headers: { "Accept-Language": "en" } }
            ),
          ]);
          clearTimeout(tid);

          if (!weatherRes.ok) throw new Error("weather fetch failed");

          const wData = await weatherRes.json();
          const c = wData.current;

          let cityName: string | null = null;
          if (geoRes.ok) {
            const gData = await geoRes.json();
            const addr = gData.address ?? {};
            cityName =
              addr.city      ??
              addr.town      ??
              addr.village   ??
              addr.municipality ??
              addr.county    ??
              null;
          }

          setWeather({
            temperatureC:      Math.round(c.temperature_2m),
            rainProbabilityPct: c.precipitation_probability ?? 0,
            humidityPct:       Math.round(c.relative_humidity_2m),
            condition:         wmoToCondition(c.weather_code),
            cityName,
            lastFetched:       Date.now(),
          });
          setStatus("ready");
          setErrorMsg(null);
        } catch {
          setStatus("error");
          setErrorMsg("Weather data unavailable");
        } finally {
          pendingRef.current = false;
        }
      },
      (err) => {
        pendingRef.current = false;
        setStatus("error");
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMsg("Enable location access to see local weather");
        } else if (err.code === err.TIMEOUT) {
          setErrorMsg("Location request timed out");
        } else {
          setErrorMsg("Location unavailable");
        }
      },
      { timeout: GEO_TIMEOUT_MS }
    );
  }, [weather]);

  const open = useCallback(() => {
    if (pendingRef.current) return;
    setVisible(true);
    savePreference(true);
    if (status === "idle" || (weather && Date.now() - weather.lastFetched > REFRESH_MS)) {
      fetchWeather();
    }
  }, [status, weather, fetchWeather, savePreference]);

  const close = useCallback(() => {
    setVisible(false);
    savePreference(false);
  }, [savePreference]);

  // Fetch on mount if initially visible
  useEffect(() => {
    if (initialVisible && status === "idle") fetchWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Closed state: show cloud button only ─────────────────────────────────────
  if (!visible) {
    return <CloudButton onClick={open} />;
  }

  // ── Open state: show compact widget panel, no cloud button ───────────────────
  return (
    <div
      role="region"
      aria-label="Local weather"
      style={{
        background: "var(--midnight)",
        border: "1px solid rgba(0,240,255,0.28)",
        boxShadow: "0 0 18px rgba(0,240,255,0.07), inset 0 0 18px rgba(13,2,33,0.9)",
        borderRadius: "2px",
        padding: "8px 12px 8px 10px",
        width: "220px",
        animation: "fadeSlideIn 0.3s ease both",
      }}
    >
      {/* Top row: icon + city name */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
        <div aria-hidden="true" style={{ flexShrink: 0 }}>
          {status === "loading" && <NeutralIcon size={32} />}
          {status === "ready"   && <ConditionIcon condition={weather?.condition} size={32} />}
          {status === "error"   && <NeutralIcon size={32} />}
          {status === "idle"    && <NeutralIcon size={32} />}
        </div>
        <span
          className="terminal"
          style={{
            color: "var(--cyan)",
            fontSize: "12px",
            letterSpacing: "0.15em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            opacity: 0.85,
          }}
        >
          {status === "loading" && "SCANNING…"}
          {status === "ready"   && (weather?.cityName?.toUpperCase() ?? "LOCAL SIGNAL")}
          {status === "error"   && "SIGNAL LOST"}
          {status === "idle"    && "LOCAL SIGNAL"}
        </span>
      </div>

      {/* Data rows */}
      {status === "ready" && weather ? (
        <>
          {/* Temperature — main reading */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
            <span className="terminal" style={{ color: "var(--star-soft)", fontSize: "11px", letterSpacing: "0.12em" }}>
              TEMP
            </span>
            <span style={{
              fontFamily: "var(--font-audiowide), sans-serif",
              color: "var(--magenta)",
              fontSize: "20px",
              textShadow: "0 0 8px rgba(255,0,160,0.55)",
              letterSpacing: "0.02em",
            }}>
              {weather.temperatureC}°C
            </span>
          </div>
          {/* Rain + humidity side by side */}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="terminal" style={{ color: "var(--star-soft)", fontSize: "11px" }}>
              RAIN <span className="mono" style={{ color: "var(--cyan)", fontSize: "12px" }}>{weather.rainProbabilityPct}%</span>
            </span>
            <span className="terminal" style={{ color: "var(--star-soft)", fontSize: "11px" }}>
              HUM <span className="mono" style={{ color: "var(--cyan)", fontSize: "12px" }}>{weather.humidityPct}%</span>
            </span>
          </div>
        </>
      ) : status === "error" ? (
        <p className="terminal" style={{ color: "var(--mute)", fontSize: "11px", margin: "2px 0", lineHeight: 1.35 }}>
          {errorMsg}
        </p>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {["TEMP", "RAIN", "HUM"].map((l) => (
            <span key={l} className="terminal" style={{ color: "var(--star-soft)", fontSize: "11px" }}>
              {l} <span className="mono" style={{ color: "var(--mute)", fontSize: "12px" }}>—</span>
            </span>
          ))}
        </div>
      )}

      {/* Close button — bottom right */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
        <button
          type="button"
          onClick={close}
          aria-label="Close weather widget"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--magenta)",
            fontSize: "10px",
            letterSpacing: "0.2em",
            padding: "0",
            fontFamily: "var(--font-space-mono)",
            opacity: 0.7,
            transition: "opacity 120ms ease",
            textTransform: "uppercase",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
        >
          ✕ CLOSE
        </button>
      </div>
    </div>
  );
}
