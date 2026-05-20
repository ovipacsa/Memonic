export type CurrencyCode = string;
export type CountryCode  = string;

export type CurrencyZone =
  | { type: "local"; currencyCode: CurrencyCode; countryCode: CountryCode }
  | { type: "eur";   countryCode: CountryCode }
  | { type: "unknown" };

export type ExchangeRatePair = {
  base:  CurrencyCode;
  quote: CurrencyCode;
  rate:  number;
};

export type CommodityPrice = {
  label:    string;
  valueUsd: number;
  unit:     "USD/bbl";
  asOf:     string;
};

// ISO 3166-1 alpha-2 → ISO 4217
export const COUNTRY_CURRENCY: Record<CountryCode, CurrencyCode> = {
  // EUR-zone (20 EU members + de-facto EUR users)
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", PT: "EUR",
  NL: "EUR", BE: "EUR", AT: "EUR", FI: "EUR", IE: "EUR",
  GR: "EUR", LU: "EUR", MT: "EUR", CY: "EUR", EE: "EUR",
  LV: "EUR", LT: "EUR", SK: "EUR", SI: "EUR", HR: "EUR",
  ME: "EUR", XK: "EUR",
  // Non-EUR EU members
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN",
  SE: "SEK", DK: "DKK",
  // Non-EU European
  GB: "GBP", CH: "CHF", NO: "NOK", IS: "ISK",
  RS: "RSD", AL: "ALL", MK: "MKD", MD: "MDL", UA: "UAH",
  BA: "BAM", TR: "TRY",
};

export function resolveCurrencyZone(countryCode: CountryCode | null): CurrencyZone {
  if (!countryCode) return { type: "unknown" };
  const code = COUNTRY_CURRENCY[countryCode.toUpperCase()];
  if (!code) return { type: "unknown" };
  if (code === "EUR") return { type: "eur", countryCode };
  return { type: "local", currencyCode: code, countryCode };
}

export function formatRate(rate: number): string {
  return rate.toFixed(4);
}

export function formatCrudeOil(value: number): string {
  return value.toFixed(2);
}
