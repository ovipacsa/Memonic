import { z } from "zod";

export type AssetId = "silver" | "gold" | "spacex";

export type AssetSpec = {
  id: AssetId;
  label: "Silver" | "Gold" | "SpaceX";
  symbol: "SI=F" | "GC=F" | "SPCX";
  market: "COMEX" | "NASDAQ";
  currency: "EUR";
  priceDecimals: 2 | 3;
};

export const ASSETS: Readonly<Record<AssetId, AssetSpec>> = {
  silver: { id: "silver", label: "Silver", symbol: "SI=F", market: "COMEX",  currency: "EUR", priceDecimals: 3 },
  gold:   { id: "gold",   label: "Gold",   symbol: "GC=F", market: "COMEX",  currency: "EUR", priceDecimals: 2 },
  spacex: { id: "spacex", label: "SpaceX", symbol: "SPCX", market: "NASDAQ", currency: "EUR", priceDecimals: 2 },
};

export const DEFAULT_ASSET: AssetId = "silver";

export const ALLOWED_SYMBOLS = ["SI=F", "GC=F", "SPCX"] as const;
export type AllowedSymbol = (typeof ALLOWED_SYMBOLS)[number];

export function isAllowedSymbol(s: string): s is AllowedSymbol {
  return (ALLOWED_SYMBOLS as readonly string[]).includes(s);
}

export function assetFromSymbol(sym: AllowedSymbol): AssetSpec {
  if (sym === "SI=F") return ASSETS.silver;
  if (sym === "GC=F") return ASSETS.gold;
  return ASSETS.spacex;
}

export type MarketStatus = "open" | "closed";

export type MarketSession = {
  tz: "America/New_York";
  openEpoch: number;
  closeEpoch: number;
};

export type PricePoint = { t: number; price: number };

export type IntradaySeries = {
  asset: AssetId;
  symbol: AllowedSymbol;
  latest: number;
  previousClose: number;
  status: MarketStatus;
  session: MarketSession;
  points: PricePoint[];
  fetchedAt: number;
};

const yahooMetaSchema = z.object({
  regularMarketPrice: z.number().finite(),
  regularMarketTime: z.number().finite().optional(),
  previousClose: z.number().finite().optional(),
  chartPreviousClose: z.number().finite().optional(),
  currentTradingPeriod: z
    .object({
      regular: z.object({
        start: z.number().finite(),
        end: z.number().finite(),
      }),
    })
    .optional(),
});

const yahooResultSchema = z.object({
  meta: yahooMetaSchema,
  timestamp: z.array(z.number().finite()).optional().default([]),
  indicators: z.object({
    quote: z
      .array(
        z.object({
          close: z.array(z.number().nullable()).optional().default([]),
        })
      )
      .min(1),
  }),
});

export const yahooChartSchema = z.object({
  chart: z.object({
    result: z.array(yahooResultSchema).nullable().optional(),
    error: z
      .object({ code: z.string(), description: z.string() })
      .nullable()
      .optional(),
  }),
});

export type YahooChartResponse = z.infer<typeof yahooChartSchema>;

const pricePointSchema = z.object({
  t: z.number().finite(),
  price: z.number().finite().positive(),
});

export const intradaySeriesSchema = z.object({
  asset: z.enum(["silver", "gold", "spacex"]),
  symbol: z.enum(["SI=F", "GC=F", "SPCX"]),
  latest: z.number().finite().positive(),
  previousClose: z.number().finite().positive(),
  status: z.enum(["open", "closed"]),
  session: z.object({
    tz: z.literal("America/New_York"),
    openEpoch: z.number().finite(),
    closeEpoch: z.number().finite(),
  }),
  points: z.array(pricePointSchema).min(1),
  fetchedAt: z.number().finite(),
});

export function downsampleTo(points: PricePoint[], maxPoints: number): PricePoint[] {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const out: PricePoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(points[Math.floor(i * step)]);
  }
  // Always include the very last point so the chart reaches the latest price.
  const last = points[points.length - 1];
  if (out[out.length - 1].t !== last.t) out.push(last);
  return out;
}

export function normalizeYahooResponse(
  raw: YahooChartResponse,
  symbol: AllowedSymbol,
  nowEpoch: number
): IntradaySeries {
  const result = raw.chart.result?.[0];
  if (!result) throw new Error("upstream: empty result");

  const meta = result.meta;
  const previousClose = meta.chartPreviousClose ?? meta.previousClose;
  if (previousClose == null || previousClose <= 0) {
    throw new Error("upstream: missing previousClose");
  }

  const timestamps = result.timestamp ?? [];
  const closes = result.indicators.quote[0].close ?? [];
  const rawPoints: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    const c = closes[i];
    if (typeof t === "number" && typeof c === "number" && Number.isFinite(c) && c > 0) {
      rawPoints.push({ t, price: c });
    }
  }
  if (rawPoints.length === 0) {
    // Synthesize a single point so the chart isn't empty when only meta is returned
    // (Yahoo sometimes does this on partially-closed exchanges).
    rawPoints.push({ t: meta.regularMarketTime ?? nowEpoch, price: meta.regularMarketPrice });
  }

  const openEpoch =
    meta.currentTradingPeriod?.regular.start ?? rawPoints[0].t;
  const closeEpoch =
    meta.currentTradingPeriod?.regular.end ?? rawPoints[rawPoints.length - 1].t;

  const asset = assetFromSymbol(symbol);
  const latest = meta.regularMarketPrice;
  const regularMarketTime = meta.regularMarketTime ?? nowEpoch;

  const inWindow = nowEpoch >= openEpoch && nowEpoch <= closeEpoch;
  const liveTick = regularMarketTime >= openEpoch;
  const status: MarketStatus = inWindow && liveTick ? "open" : "closed";

  const points = downsampleTo(rawPoints, 240);

  return {
    asset: asset.id,
    symbol,
    latest,
    previousClose,
    status,
    session: { tz: "America/New_York", openEpoch, closeEpoch },
    points,
    fetchedAt: nowEpoch,
  };
}

export type Delta = {
  abs: number;
  pct: number;
  direction: "up" | "down" | "flat";
};

export function computeDelta(series: Pick<IntradaySeries, "latest" | "previousClose">): Delta {
  const abs = series.latest - series.previousClose;
  const pct = (abs / series.previousClose) * 100;
  let direction: Delta["direction"] = "flat";
  if (abs > 0) direction = "up";
  else if (abs < 0) direction = "down";
  return { abs, pct, direction };
}

export function applyFxRate(series: IntradaySeries, usdToEur: number): IntradaySeries {
  if (!(usdToEur > 0) || !Number.isFinite(usdToEur)) return series;
  return {
    ...series,
    latest: series.latest * usdToEur,
    previousClose: series.previousClose * usdToEur,
    points: series.points.map((p) => ({ t: p.t, price: p.price * usdToEur })),
  };
}

export function bisectNearest(points: PricePoint[], t: number): number {
  if (points.length === 0) return -1;
  let lo = 0;
  let hi = points.length - 1;
  if (t <= points[lo].t) return lo;
  if (t >= points[hi].t) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t === t) return mid;
    if (points[mid].t < t) lo = mid;
    else hi = mid;
  }
  return t - points[lo].t <= points[hi].t - t ? lo : hi;
}

export function formatPrice(p: number, decimals: number): string {
  return p.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatLocalTime(epochSec: number): string {
  return new Date(epochSec * 1000).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
