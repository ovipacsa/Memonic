import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import type { ExchangeRatePair } from "@/lib/currency";

export const runtime = "nodejs";

const CACHE_MS = 30 * 60 * 1000;
const rateCache = new Map<string, { pairs: ExchangeRatePair[]; date: string; expiresAt: number }>();

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Missing from or to params" }, { status: 400 });
  }

  const cacheKey = `${from}:${to}`;
  const cached   = rateCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({ pairs: cached.pairs, date: cached.date });
  }

  let res: Response;
  try {
    res = await fetch(
      `https://api.frankfurter.app/latest?from=${from}&to=${to}`,
      { signal: AbortSignal.timeout(6000) }
    );
  } catch {
    return NextResponse.json({ error: "Exchange rate data unavailable" }, { status: 503 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: "Exchange rate data unavailable" }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return NextResponse.json({ error: "Exchange rate data unavailable" }, { status: 503 });
  }

  const data = json as { base?: string; rates?: Record<string, number>; date?: string };
  if (!data.rates || !data.base) {
    return NextResponse.json({ error: "Exchange rate data unavailable" }, { status: 503 });
  }

  const pairs: ExchangeRatePair[] = Object.entries(data.rates).map(([quote, rate]) => ({
    base: data.base!,
    quote,
    rate,
  }));

  const date = data.date ?? new Date().toISOString().split("T")[0];
  rateCache.set(cacheKey, { pairs, date, expiresAt: Date.now() + CACHE_MS });

  return NextResponse.json({ pairs, date });
}
