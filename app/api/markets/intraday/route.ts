import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  applyFxRate,
  isAllowedSymbol,
  normalizeYahooResponse,
  yahooChartSchema,
  type AllowedSymbol,
  type IntradaySeries,
} from "@/lib/markets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 5_000;
const FETCH_TIMEOUT_MS = 6_000;

const cache = new Map<AllowedSymbol, { fetchedAt: number; payload: IntradaySeries }>();

const FX_TTL_MS = 60_000;
let fxCache: { fetchedAt: number; rate: number } | null = null;

async function getUsdToEur(): Promise<number> {
  const now = Date.now();
  if (fxCache && now - fxCache.fetchedAt < FX_TTL_MS) return fxCache.rate;
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1m&range=1d",
      {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; MemonicAssetsWidget/1.0; +https://memonic.local)",
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) throw new Error("fx upstream");
    const json = (await res.json()) as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
    };
    const eurUsd = json.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (!eurUsd || eurUsd <= 0) throw new Error("fx missing");
    const usdToEur = 1 / eurUsd;
    fxCache = { fetchedAt: now, rate: usdToEur };
    return usdToEur;
  } catch {
    // Fall back to last known rate if available; otherwise neutral 1:1 so payload is still valid.
    return fxCache?.rate ?? 1;
  }
}

function err(status: number, code: string) {
  return NextResponse.json({ error: code }, { status });
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return err(401, "unauthorized");

  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") ?? "";
  if (!isAllowedSymbol(symbol)) {
    return err(400, "unknown_symbol");
  }

  const now = Date.now();
  const cached = cache.get(symbol);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached.payload, {
      headers: { "Cache-Control": "private, max-age=5" },
    });
  }

  const yahooUrl =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1m&range=1d`;

  let res: Response;
  try {
    res = await fetch(yahooUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Yahoo's edge sometimes rejects requests without a UA.
        "User-Agent":
          "Mozilla/5.0 (compatible; MemonicAssetsWidget/1.0; +https://memonic.local)",
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (e) {
    const isTimeout = e instanceof Error && e.name === "TimeoutError";
    return err(isTimeout ? 504 : 502, isTimeout ? "timeout" : "upstream");
  }

  if (!res.ok) return err(502, "upstream");

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return err(502, "schema");
  }

  const parsed = yahooChartSchema.safeParse(json);
  if (!parsed.success) return err(502, "schema");

  if (parsed.data.chart.error) return err(502, "upstream");

  let payload: IntradaySeries;
  try {
    payload = normalizeYahooResponse(parsed.data, symbol, Math.floor(Date.now() / 1000));
  } catch {
    return err(502, "schema");
  }

  const usdToEur = await getUsdToEur();
  payload = applyFxRate(payload, usdToEur);

  cache.set(symbol, { fetchedAt: now, payload });

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=5" },
  });
}
