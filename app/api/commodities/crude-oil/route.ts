import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import type { CommodityPrice } from "@/lib/currency";

export const runtime = "nodejs";

const CACHE_MS = 30 * 60 * 1000;
let cache: { price: CommodityPrice; expiresAt: number } | null = null;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (cache && Date.now() < cache.expiresAt) {
    return NextResponse.json(cache.price);
  }

  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Commodity data unavailable" }, { status: 503 });
  }

  const url =
    `https://api.eia.gov/v2/petroleum/pri/spt/data/` +
    `?api_key=${apiKey}` +
    `&facets[product][]=EPCBRENT` +
    `&sort[0][column]=period&sort[0][direction]=desc` +
    `&data[0]=value&length=1`;

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    return NextResponse.json({ error: "Commodity data unavailable" }, { status: 503 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: "Commodity data unavailable" }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return NextResponse.json({ error: "Commodity data unavailable" }, { status: 503 });
  }

  const row = (json as { response?: { data?: Array<{ period?: string; value?: string }> } })
    ?.response?.data?.[0];

  if (!row?.value || !row?.period) {
    return NextResponse.json({ error: "Commodity data unavailable" }, { status: 503 });
  }

  const price: CommodityPrice = {
    label:    "Brent Crude",
    valueUsd: parseFloat(row.value),
    unit:     "USD/bbl",
    asOf:     row.period,
  };

  cache = { price, expiresAt: Date.now() + CACHE_MS };
  return NextResponse.json(price);
}
