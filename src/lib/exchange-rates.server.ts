export type ExchangeRate = { currency: string; rate: number; updatedAt: number };
type RateTable = { rates: Record<string, number>; updatedAt: number; refreshAt: number };

let cached: RateTable | undefined;
let pending: Promise<RateTable> | undefined;
let retryAfter = 0;
const HOUR = 3_600_000;

async function loadRates(): Promise<RateTable> {
  const response = await fetch("https://open.er-api.com/v6/latest/NGN", {
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error("Exchange rates unavailable");
  const data = await response.json();
  const updatedAt = data.time_last_update_unix * 1000;
  if (
    data.result !== "success" ||
    data.base_code !== "NGN" ||
    !data.rates ||
    data.rates.NGN !== 1 ||
    !Number.isFinite(updatedAt) ||
    updatedAt > Date.now() + HOUR ||
    Date.now() - updatedAt > 48 * HOUR
  ) {
    throw new Error("Invalid or expired exchange rates");
  }
  // Cache one table per server instance and coalesce simultaneous requests.
  return { rates: data.rates, updatedAt, refreshAt: Date.now() + HOUR };
}

export async function getExchangeRate(currency: string): Promise<ExchangeRate | null> {
  if (currency === "NGN") return null;
  if ((!cached || cached.refreshAt <= Date.now()) && Date.now() >= retryAfter) {
    pending ??= loadRates();
    try {
      cached = await pending;
    } catch {
      retryAfter = Date.now() + 5 * 60_000;
    } finally {
      pending = undefined;
    }
  }
  if (!cached || Date.now() - cached.updatedAt > 48 * HOUR) return null;
  const rate = cached.rates[currency];
  return Number.isFinite(rate) && rate > 0 ? { currency, rate, updatedAt: cached.updatedAt } : null;
}
