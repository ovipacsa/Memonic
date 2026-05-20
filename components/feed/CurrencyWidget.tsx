"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  resolveCurrencyZone,
  formatRate,
  formatCrudeOil,
  type CurrencyZone,
  type ExchangeRatePair,
  type CommodityPrice,
} from "@/lib/currency";

type WidgetStatus = "idle" | "loading" | "ready" | "error";
type RowStatus    = "loading" | "ok" | "unavailable";

type CurrencyData = {
  zone:       CurrencyZone;
  pairs:      ExchangeRatePair[];
  pairStatus: RowStatus;
  crude:      CommodityPrice | null;
  crudeStatus: RowStatus;
  lastFetched: number;
  fallbackLabel: string | null;
};

const REFRESH_MS  = 30 * 60 * 1000;
const GEO_TIMEOUT = 8000;

// ─── Coin SVG toggle icon ─────────────────────────────────────────────────────

function CoinIcon({ size = 34, animate = false }: { size?: number; animate?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <circle
        cx="20" cy="20" r="17"
        fill="rgba(0,240,255,0.06)"
        stroke="#00F0FF"
        strokeWidth="1.8"
        style={animate ? { animation: "currency-pulse 3s ease-in-out infinite" } : undefined}
      />
      <circle cx="20" cy="20" r="13" fill="none" stroke="rgba(0,240,255,0.25)" strokeWidth="0.8" />
      {/* Generic currency sign ¤ */}
      <g style={animate ? { animation: "currency-coin-spin 5s ease-in-out infinite 1s" } : undefined}>
        <line x1="20" y1="10" x2="20" y2="30" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="14" x2="28" y2="14" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="20" x2="28" y2="20" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="26" x2="28" y2="26" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ─── Coin Toggle Button ───────────────────────────────────────────────────────

function CoinButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open currency widget"
      title="Currency & commodities"
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
      <CoinIcon size={38} />
    </button>
  );
}

// ─── Rate row ─────────────────────────────────────────────────────────────────

function RateRow({ label, value, status }: { label: string; value: string; status: RowStatus }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "3px" }}>
      <dt className="terminal" style={{ color: "var(--star-soft)", fontSize: "10px", letterSpacing: "0.10em" }}>
        {label}
      </dt>
      <dd className="mono" style={{
        color: status === "ok" ? "var(--magenta)" : "var(--mute)",
        fontSize: status === "ok" ? "11px" : "10px",
        margin: 0,
        textShadow: status === "ok" ? "0 0 5px rgba(255,0,160,0.5)" : "none",
      }}>
        {status === "loading" ? "…" : status === "unavailable" ? "—" : value}
      </dd>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const CURRENCY_CACHE_KEY = "memonic_currency_cache";

function readCurrencyCache(): { data: CurrencyData | null; status: WidgetStatus } {
  try {
    const raw = localStorage.getItem(CURRENCY_CACHE_KEY);
    if (!raw) return { data: null, status: "idle" };
    const d = JSON.parse(raw) as CurrencyData;
    if (Date.now() - d.lastFetched < REFRESH_MS) return { data: d, status: "ready" };
  } catch { /* ignore */ }
  return { data: null, status: "idle" };
}

export default function CurrencyWidget({ initialVisible }: { initialVisible: boolean }) {
  const [visible, setVisible]   = useState(initialVisible);
  const [status, setStatus]     = useState<WidgetStatus>("idle");
  const [data, setData]         = useState<CurrencyData | null>(null);
  const pendingRef = useRef(false);

  const savePreference = useCallback((val: boolean) => {
    fetch("/api/me/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currencyWidgetVisible: val }),
    }).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (pendingRef.current) return;
    if (data && Date.now() - data.lastFetched < REFRESH_MS) return;

    pendingRef.current = true;
    setStatus("loading");

    // Step 1: Geolocation → country code
    let countryCode: string | null = null;
    let fallbackLabel: string | null = null;

    await new Promise<void>((resolve) => {
      if (!navigator.geolocation) {
        fallbackLabel = "Location unavailable — showing EUR rates";
        resolve();
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            const geoRes = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
              { signal: AbortSignal.timeout(5000) }
            );
            if (geoRes.ok) {
              const geoData = await geoRes.json() as { countryCode?: string };
              countryCode = geoData.countryCode ?? null;
            }
          } catch { /* ignore */ }
          resolve();
        },
        () => {
          fallbackLabel = "Location unavailable — showing EUR rates";
          resolve();
        },
        { timeout: GEO_TIMEOUT }
      );
    });

    const zone = resolveCurrencyZone(countryCode);
    if (zone.type === "unknown") {
      fallbackLabel = fallbackLabel ?? "Location unrecognised — showing EUR rates";
    }

    // Step 2: Exchange rates (via server proxy → Frankfurter.app)
    let pairs: ExchangeRatePair[] = [];
    let pairStatus: RowStatus = "loading";

    try {
      const isLocal = zone.type === "local";
      const from    = isLocal ? zone.currencyCode : "EUR";
      const toStr   = isLocal ? "EUR,USD" : "USD,CNY";
      const fxRes   = await fetch(
        `/api/currency/rates?from=${from}&to=${toStr}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (fxRes.ok) {
        const fxData = await fxRes.json() as { pairs?: ExchangeRatePair[] };
        pairs = fxData.pairs ?? [];
        pairStatus = pairs.length > 0 ? "ok" : "unavailable";
      } else {
        pairStatus = "unavailable";
      }
    } catch {
      pairStatus = "unavailable";
    }

    // Step 3: Crude oil (server route)
    let crude: CommodityPrice | null = null;
    let crudeStatus: RowStatus = "loading";

    try {
      const oilRes = await fetch("/api/commodities/crude-oil", { signal: AbortSignal.timeout(9000) });
      if (oilRes.ok) {
        crude = await oilRes.json() as CommodityPrice;
        crudeStatus = "ok";
      } else {
        crudeStatus = "unavailable";
      }
    } catch {
      crudeStatus = "unavailable";
    }

    const newData: CurrencyData = { zone, pairs, pairStatus, crude, crudeStatus, lastFetched: Date.now(), fallbackLabel };
    try { localStorage.setItem(CURRENCY_CACHE_KEY, JSON.stringify(newData)); } catch { /* ignore */ }
    setData(newData);
    setStatus("ready");
    pendingRef.current = false;
  }, [data]);

  const open = useCallback(() => {
    if (pendingRef.current) return;
    setVisible(true);
    savePreference(true);
    if (status === "idle" || (data && Date.now() - data.lastFetched > REFRESH_MS)) {
      fetchData();
    }
  }, [status, data, fetchData, savePreference]);

  const close = useCallback(() => {
    setVisible(false);
    savePreference(false);
  }, [savePreference]);

  // On mount: restore from cache if fresh, otherwise fetch
  useEffect(() => {
    const cached = readCurrencyCache();
    if (cached.data) {
      setData(cached.data);
      setStatus("ready");
    } else if (initialVisible) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh every 30 min while widget is open
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => fetchData(), REFRESH_MS);
    return () => clearInterval(id);
  }, [visible, fetchData]);

  // ── Closed state ─────────────────────────────────────────────────────────────
  // Closed: button pinned to right edge of column, vertically centered — mirrors cloud button
  if (!visible) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", width: "100%", height: "100%", paddingRight: "8px" }}>
      <CoinButton onClick={open} />
    </div>
  );

  // ── Helpers for display ───────────────────────────────────────────────────────
  const isLoading = status === "loading" || status === "idle";

  const pairRows = (() => {
    if (!data || isLoading) {
      const zone = data?.zone;
      if (!zone || zone.type === "unknown" || zone.type === "eur") {
        return [{ label: "EUR → USD", value: "—", status: "loading" as RowStatus },
                { label: "EUR → CNY", value: "—", status: "loading" as RowStatus }];
      }
      return [{ label: `EUR → ${zone.currencyCode}`, value: "—", status: "loading" as RowStatus },
              { label: `USD → ${zone.currencyCode}`, value: "—", status: "loading" as RowStatus }];
    }
    const { zone, pairs, pairStatus } = data;
    if (pairStatus === "unavailable") {
      const tos = zone.type === "local" ? ["EUR", "USD"] : ["USD", "CNY"];
      const loc  = zone.type === "local" ? zone.currencyCode : "EUR";
      return tos.map((q) => ({ label: `${q} → ${loc}`, value: "—", status: "unavailable" as RowStatus }));
    }
    // Invert: fetched pairs are LOCAL→EUR and LOCAL→USD; display as EUR→LOCAL and USD→LOCAL
    return pairs.map((p) => ({
      label: `${p.quote} → ${p.base}`,
      value: formatRate(1 / p.rate),
      status: "ok" as RowStatus,
    }));
  })();

  const lastUpdated = data?.lastFetched
    ? new Date(data.lastFetched).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;

  // ── Open state: centered in column, 15px from top line ──────────────────────
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", width: "100%", paddingTop: "15px" }}>
    <div
      role="region"
      aria-label="Currency & commodities"
      style={{
        background: "var(--midnight)",
        border: "1px solid rgba(0,240,255,0.28)",
        boxShadow: "0 0 18px rgba(0,240,255,0.07), inset 0 0 18px rgba(13,2,33,0.9)",
        borderRadius: "2px",
        padding: "5px 10px 5px 8px",
        width: "200px",
        animation: "fadeSlideIn 0.3s ease both",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
        <div aria-hidden="true" style={{ flexShrink: 0 }}>
          <CoinIcon size={22} animate={isLoading} />
        </div>
        <span
          className="terminal"
          style={{
            color: "var(--cyan)",
            fontSize: "10px",
            letterSpacing: "0.15em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            opacity: 0.85,
          }}
        >
          {isLoading ? "SCANNING…" : "MARKET SIGNAL"}
        </span>
      </div>

      {/* Fallback label */}
      {data?.fallbackLabel && (
        <p className="terminal" style={{
          color: "var(--mute)",
          fontSize: "9px",
          margin: "0 0 4px 0",
          lineHeight: 1.3,
          letterSpacing: "0.06em",
        }}>
          {data.fallbackLabel}
        </p>
      )}

      {/* Exchange rate rows */}
      <dl style={{ margin: 0 }}>
        {pairRows.map((row) => (
          <RateRow
            key={row.label}
            label={row.label}
            value={row.value}
            status={isLoading ? "loading" : row.status}
          />
        ))}

        {/* Divider */}
        <div style={{ borderTop: "1px solid rgba(0,240,255,0.12)", margin: "3px 0" }} />

        {/* Crude oil row */}
        <RateRow
          label="BRENT CRUDE"
          value={data?.crude ? `$${formatCrudeOil(data.crude.valueUsd)}` : "—"}
          status={isLoading ? "loading" : (data?.crudeStatus ?? "unavailable")}
        />

        {/* Crude oil date */}
        {data?.crude?.asOf && !isLoading && (
          <p className="terminal" style={{
            color: "var(--mute)",
            fontSize: "8px",
            margin: "0 0 1px 0",
            textAlign: "right",
            letterSpacing: "0.05em",
          }}>
            as of {data.crude.asOf}
          </p>
        )}
      </dl>

      {/* Footer: indicative note + last updated + close */}
      <div style={{ marginTop: "4px", borderTop: "1px solid rgba(0,240,255,0.08)", paddingTop: "4px" }}>
        <p className="terminal" style={{
          color: "var(--mute)",
          fontSize: "8px",
          margin: "0 0 3px 0",
          letterSpacing: "0.05em",
          opacity: 0.7,
        }}>
          {lastUpdated ? `INDICATIVE · ${lastUpdated}` : "INDICATIVE RATES"}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={close}
            aria-label="Close currency widget"
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
            ✕
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}
