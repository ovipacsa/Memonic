"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ASSETS,
  DEFAULT_ASSET,
  bisectNearest,
  computeDelta,
  formatLocalTime,
  formatPrice,
  type AssetId,
  type AssetSpec,
  type IntradaySeries,
} from "@/lib/markets";

const REFRESH_MS = 10_000;
const STALE_LIMIT_MS = 60_000;

type ErrorReason = "network" | "schema" | "stale";

type WidgetState =
  | { kind: "loading"; asset: AssetId }
  | { kind: "ready"; asset: AssetId; series: IntradaySeries; hoverIndex: number | null }
  | { kind: "error"; asset: AssetId; reason: ErrorReason };

const ASSET_ORDER: AssetId[] = ["silver", "gold", "spacex"];

async function fetchSeries(asset: AssetSpec, signal: AbortSignal): Promise<IntradaySeries> {
  const res = await fetch(`/api/markets/intraday?symbol=${encodeURIComponent(asset.symbol)}`, {
    signal,
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = (body as { error?: string }).error ?? "upstream";
    const reason: ErrorReason = code === "schema" ? "schema" : "network";
    throw Object.assign(new Error(code), { reason });
  }
  return (await res.json()) as IntradaySeries;
}

function arrow(direction: "up" | "down" | "flat") {
  if (direction === "up") return "\u25B2";
  if (direction === "down") return "\u25BC";
  return "\u25C6";
}

function ChartSvg({
  series,
  width,
  height,
  hoverIndex,
  onHoverIndex,
}: {
  series: IntradaySeries;
  width: number;
  height: number;
  hoverIndex: number | null;
  onHoverIndex: (idx: number | null) => void;
}) {
  const padding = { top: 10, right: 10, bottom: 10, left: 10 };
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);

  const { points } = series;
  const xs = useMemo(() => points.map((p) => p.t), [points]);
  const ys = useMemo(() => points.map((p) => p.price), [points]);
  const tMin = xs[0];
  const tMax = xs[xs.length - 1];
  const tSpan = Math.max(1, tMax - tMin);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const ySpan = Math.max(1e-9, yMax - yMin);

  const pad = ySpan * 0.08;
  const yLo = yMin - pad;
  const yHi = yMax + pad;
  const ySpanPad = yHi - yLo;

  const toX = (t: number) => padding.left + ((t - tMin) / tSpan) * innerW;
  const toY = (p: number) => padding.top + innerH - ((p - yLo) / ySpanPad) * innerH;

  const polyline = points.map((p) => `${toX(p.t).toFixed(1)},${toY(p.price).toFixed(1)}`).join(" ");

  const lineColor = series.status === "open" ? "#FF00A0" : "#9D00FF";
  const fillColor = series.status === "open" ? "rgba(255,0,160,0.12)" : "rgba(157,0,255,0.12)";

  const areaPath =
    `M ${toX(points[0].t).toFixed(1)},${(padding.top + innerH).toFixed(1)} ` +
    points.map((p) => `L ${toX(p.t).toFixed(1)},${toY(p.price).toFixed(1)}`).join(" ") +
    ` L ${toX(points[points.length - 1].t).toFixed(1)},${(padding.top + innerH).toFixed(1)} Z`;

  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const xPx = e.clientX - rect.left;
      const xRatio = Math.max(0, Math.min(1, (xPx - padding.left) / innerW));
      const t = tMin + xRatio * tSpan;
      const idx = bisectNearest(points, t);
      onHoverIndex(idx);
    },
    [innerW, points, tMin, tSpan, onHoverIndex, padding.left]
  );

  const handleLeave = useCallback(() => onHoverIndex(null), [onHoverIndex]);

  const hoverPoint = hoverIndex != null ? points[hoverIndex] : null;
  const hoverX = hoverPoint ? toX(hoverPoint.t) : 0;
  const hoverY = hoverPoint ? toY(hoverPoint.price) : 0;

  const delta = computeDelta(series);
  const ariaLabel =
    `${ASSETS[series.asset].label} intraday: €${formatPrice(series.latest, ASSETS[series.asset].priceDecimals)}, ` +
    `${delta.direction === "up" ? "up" : delta.direction === "down" ? "down" : "flat"} ` +
    `€${formatPrice(Math.abs(delta.abs), ASSETS[series.asset].priceDecimals)} ` +
    `(${delta.pct.toFixed(2)}%) versus previous close.`;

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={{ display: "block", touchAction: "none" }}
    >
      {/* baseline (previous close) */}
      {(() => {
        const baseY = toY(series.previousClose);
        if (baseY < padding.top || baseY > padding.top + innerH) return null;
        return (
          <line
            x1={padding.left}
            x2={padding.left + innerW}
            y1={baseY}
            y2={baseY}
            stroke="#00F0FF"
            strokeOpacity={0.35}
            strokeDasharray="3 4"
            strokeWidth={1}
          />
        );
      })()}

      <path d={areaPath} fill={fillColor} />
      <polyline
        fill="none"
        stroke={lineColor}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={polyline}
      />

      {hoverPoint && (
        <g>
          <line
            x1={hoverX}
            x2={hoverX}
            y1={padding.top}
            y2={padding.top + innerH}
            stroke="#00F0FF"
            strokeOpacity={0.5}
            strokeWidth={1}
          />
          <circle cx={hoverX} cy={hoverY} r={4} fill="#F9F002" stroke="#0D0221" strokeWidth={1.5} />
        </g>
      )}
    </svg>
  );
}

function HoverTooltip({
  series,
  hoverIndex,
  containerWidth,
}: {
  series: IntradaySeries;
  hoverIndex: number;
  containerWidth: number;
}) {
  const point = series.points[hoverIndex];
  if (!point) return null;
  const spec = ASSETS[series.asset];
  const xRatio =
    (point.t - series.points[0].t) /
    Math.max(1, series.points[series.points.length - 1].t - series.points[0].t);

  const flip = xRatio > 0.7;
  const left = `calc(${(xRatio * 100).toFixed(2)}% + ${flip ? "-110px" : "10px"})`;

  return (
    <div
      className="pointer-events-none absolute top-3 z-10 rounded border px-2 py-1"
      style={{
        left,
        borderColor: "rgba(0,240,255,0.5)",
        background: "rgba(13,2,33,0.92)",
        minWidth: 92,
        maxWidth: Math.min(140, containerWidth - 20),
      }}
    >
      <div className="mono text-[9px] uppercase tracking-widest" style={{ color: "#00F0FF" }}>
        {formatLocalTime(point.t)}
      </div>
      <div className="terminal text-[16px] leading-none" style={{ color: "#F9F002" }}>
        €{formatPrice(point.price, spec.priceDecimals)}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div
      className="animate-pulse rounded-md"
      style={{ height: 200, background: "rgba(0,240,255,0.06)", border: "1px dashed rgba(0,240,255,0.2)" }}
      aria-hidden="true"
    />
  );
}

function ErrorChip({ reason, onRetry }: { reason: ErrorReason; onRetry: () => void }) {
  const msg =
    reason === "network"
      ? "Couldn't reach the market feed."
      : reason === "schema"
      ? "Unexpected feed response."
      : "Data went stale.";
  return (
    <div
      className="flex items-center justify-between gap-3 rounded border px-3 py-2"
      role="alert"
      style={{ borderColor: "rgba(255,0,160,0.5)", background: "rgba(255,0,160,0.08)" }}
    >
      <span className="mono text-[11px]" style={{ color: "#FF00A0" }}>
        {msg}
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="mono text-[10px] uppercase tracking-widest rounded border px-2 py-1 transition-colors"
        style={{ borderColor: "#00F0FF", color: "#00F0FF" }}
      >
        Retry
      </button>
    </div>
  );
}

export default function AssetsWidget() {
  const [state, setState] = useState<WidgetState>({ kind: "loading", asset: DEFAULT_ASSET });
  const [containerWidth, setContainerWidth] = useState(640);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSuccessRef = useRef<number>(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const clearPoll = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const refresh = useCallback(async (asset: AssetId) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const series = await fetchSeries(ASSETS[asset], ctrl.signal);
      lastSuccessRef.current = Date.now();
      setState((prev) => {
        // Ignore late responses for a different asset
        if (prev.asset !== asset) return prev;
        return { kind: "ready", asset, series, hoverIndex: null };
      });
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      const reason = ((e as { reason?: ErrorReason }).reason ?? "network") as ErrorReason;
      setState((prev) => (prev.asset !== asset ? prev : { kind: "error", asset, reason }));
    }
  }, []);

  const startPolling = useCallback(
    (asset: AssetId) => {
      clearPoll();
      intervalRef.current = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
        const cur = stateRef.current;
        if (cur.kind === "ready" && cur.series.status !== "open") {
          clearPoll();
          return;
        }
        // Stale guard
        if (lastSuccessRef.current && Date.now() - lastSuccessRef.current > STALE_LIMIT_MS) {
          setState((prev) =>
            prev.asset === asset && prev.kind !== "error"
              ? { kind: "error", asset, reason: "stale" }
              : prev
          );
        }
        void refresh(asset);
      }, REFRESH_MS);
    },
    [clearPoll, refresh]
  );

  // Mount + asset switching
  useEffect(() => {
    void refresh(state.asset).then(() => {
      const cur = stateRef.current;
      if (cur.kind === "ready" && cur.series.status === "open") {
        startPolling(cur.asset);
      } else {
        clearPoll();
      }
    });
    return () => {
      abortRef.current?.abort();
      clearPoll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.asset]);

  // Visibility gating
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      const cur = stateRef.current;
      if (document.visibilityState === "hidden") {
        clearPoll();
        abortRef.current?.abort();
      } else {
        void refresh(cur.asset).then(() => {
          const next = stateRef.current;
          if (next.kind === "ready" && next.series.status === "open") {
            startPolling(next.asset);
          }
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [clearPoll, refresh, startPolling]);

  // Track container width for the SVG
  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(Math.max(280, Math.floor(w)));
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const onSelect = useCallback(
    (asset: AssetId) => {
      if (asset === state.asset) return;
      setState({ kind: "loading", asset });
    },
    [state.asset]
  );

  const activeAsset = state.asset;
  const spec = ASSETS[activeAsset];

  const series = state.kind === "ready" ? state.series : null;
  const hoverIndex = state.kind === "ready" ? state.hoverIndex : null;
  const delta = series ? computeDelta(series) : null;

  const liveValue =
    series && hoverIndex != null ? series.points[hoverIndex].price : series?.latest ?? null;

  const deltaColor =
    delta?.direction === "up" ? "#F9F002" : delta?.direction === "down" ? "#9D00FF" : "#00F0FF";

  const chartHeight = 200;

  return (
    <section
      className="mt-6 rounded-lg border p-4 sm:p-5"
      aria-label="Assets price widget"
      style={{ borderColor: "rgba(0,240,255,0.25)", background: "rgba(13,2,33,0.55)" }}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <div
            className="text-[11px] uppercase tracking-[0.3em]"
            style={{ fontFamily: "var(--font-audiowide), system-ui", color: "#00F0FF" }}
          >
            Assets
          </div>
          <h3
            className="terminal mt-1 text-[22px] leading-none"
            style={{ color: "#F9F002" }}
          >
            {spec.label}
            {series?.status === "closed" && (
              <span
                className="mono ml-2 align-middle text-[9px] uppercase tracking-widest rounded px-1.5 py-0.5"
                style={{ background: "rgba(157,0,255,0.18)", color: "#9D00FF", border: "1px solid rgba(157,0,255,0.5)" }}
              >
                Market closed
              </span>
            )}
          </h3>
        </div>

        <div className="text-right">
          <div
            className="terminal text-[26px] leading-none"
            style={{ color: "#F9F002" }}
            aria-live="polite"
          >
            {liveValue != null ? `€${formatPrice(liveValue, spec.priceDecimals)}` : "—"}
          </div>
          {delta && (
            <div
              className="mono mt-1 text-[12px]"
              style={{ color: deltaColor }}
            >
              {arrow(delta.direction)} {delta.abs >= 0 ? "+" : ""}
              {formatPrice(delta.abs, spec.priceDecimals)} ({delta.pct >= 0 ? "+" : ""}
              {delta.pct.toFixed(2)}%)
            </div>
          )}
        </div>
      </header>

      <div ref={containerRef} className="relative mt-4">
        {state.kind === "loading" && <Skeleton />}
        {state.kind === "error" && (
          <ErrorChip
            reason={state.reason}
            onRetry={() => {
              setState({ kind: "loading", asset: state.asset });
            }}
          />
        )}
        {state.kind === "ready" && (
          <>
            <ChartSvg
              series={state.series}
              width={containerWidth}
              height={chartHeight}
              hoverIndex={state.hoverIndex}
              onHoverIndex={(idx) =>
                setState((prev) =>
                  prev.kind === "ready" ? { ...prev, hoverIndex: idx } : prev
                )
              }
            />
            {state.hoverIndex != null && (
              <HoverTooltip
                series={state.series}
                hoverIndex={state.hoverIndex}
                containerWidth={containerWidth}
              />
            )}
          </>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {ASSET_ORDER.map((id) => {
          const isActive = id === activeAsset;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(id)}
              className="mono flex-1 rounded border px-3 py-2 text-[11px] uppercase tracking-widest transition-colors focus:outline-none focus:ring-2"
              style={{
                borderColor: isActive ? "#FF00A0" : "rgba(0,240,255,0.4)",
                background: isActive ? "#FF00A0" : "transparent",
                color: isActive ? "#0D0221" : "#00F0FF",
              }}
            >
              {ASSETS[id].label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
