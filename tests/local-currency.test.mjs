import test from "node:test";
import assert from "node:assert/strict";
import { detectDisplayCurrency, formatEstimate } from "../src/lib/local-currency.ts";

const HOUR = 3_600_000;
const table = (overrides = {}) => ({
  result: "success",
  base_code: "NGN",
  time_last_update_unix: Math.floor(Date.now() / 1000),
  rates: { NGN: 1, GHS: 0.01, USD: 0.0006 },
  ...overrides,
});
let moduleId = 0;
const freshRates = () => import(`../src/lib/exchange-rates.server.ts?test=${moduleId++}`);

test("hosting country takes precedence over browser hints", () => {
  assert.equal(detectDisplayCurrency("NG", "Africa/Accra", "en-US"), "NGN");
  assert.equal(detectDisplayCurrency("gh", "Africa/Lagos", "en-NG"), "GHS");
  assert.equal(detectDisplayCurrency("US", "Africa/Lagos", "en-NG"), "USD");
});

test("missing hosting location falls back to time zone, then explicit locale region", () => {
  assert.equal(detectDisplayCurrency(undefined, "Africa/Lagos", "en-US"), "NGN");
  assert.equal(detectDisplayCurrency("XX", "Africa/Accra", "en-US"), "GHS");
  assert.equal(detectDisplayCurrency(undefined, "Etc/UTC", "en-GB"), "GBP");
  assert.equal(detectDisplayCurrency(undefined, "Etc/UTC", "en"), null);
  assert.equal(detectDisplayCurrency(undefined, undefined, "invalid_locale"), null);
});

test("small converted share prices remain nonzero and identify currency explicitly", () => {
  assert.match(formatEstimate(0.0003, "USD", "en-US"), /USD.*0\.0003/);
  assert.match(formatEstimate(-0.0003, "USD", "en-US"), /-USD.*0\.0003/);
  assert.match(formatEstimate(0, "GHS", "en-GH"), /GHS.*0\.00/);
  assert.match(formatEstimate(1500.5, "USD", "en-US"), /USD.*1,500\.50/);
});

test("rate requests are coalesced and cached across display currencies", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    calls++;
    assert.equal(url, "https://open.er-api.com/v6/latest/NGN");
    return Response.json(table());
  });
  const { getExchangeRate } = await freshRates();
  const [usd, ghs] = await Promise.all([getExchangeRate("USD"), getExchangeRate("GHS")]);
  assert.equal(usd.rate, 0.0006);
  assert.equal(ghs.rate, 0.01);
  await getExchangeRate("USD");
  assert.equal(calls, 1);
  assert.equal(await getExchangeRate("UNKNOWN"), null);
});

test("NGN needs no exchange-rate request", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => {
    throw new Error("unexpected fetch");
  });
  const { getExchangeRate } = await freshRates();
  assert.equal(await getExchangeRate("NGN"), null);
  assert.equal(fetch.mock.callCount(), 0);
});

test("unavailable provider hides estimates and backs off retries", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("offline");
  });
  const { getExchangeRate } = await freshRates();
  assert.equal(await getExchangeRate("USD"), null);
  assert.equal(await getExchangeRate("GHS"), null);
  assert.equal(fetch.mock.callCount(), 1);
});

test("invalid bases, expired rates and nonpositive conversion rates are rejected", async (t) => {
  for (const overrides of [
    { base_code: "USD" },
    { result: "error" },
    { rates: { NGN: 100, USD: 1 } },
    { time_last_update_unix: (Date.now() - 49 * HOUR) / 1000 },
    { time_last_update_unix: (Date.now() + 2 * HOUR) / 1000 },
    { rates: { NGN: 1, USD: -1 } },
    { rates: { NGN: 1, USD: "0.5" } },
  ]) {
    const fetch = t.mock.method(globalThis, "fetch", async () => Response.json(table(overrides)));
    const { getExchangeRate } = await freshRates();
    assert.equal(await getExchangeRate("USD"), null);
    fetch.mock.restore();
  }
});

test("a cached rate expires even when a refresh fails", async (t) => {
  const now = Date.now();
  t.mock.method(Date, "now", () => now);
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json(table()));
  const { getExchangeRate } = await freshRates();
  assert.equal((await getExchangeRate("USD")).rate, 0.0006);
  fetch.mock.mockImplementation(async () => {
    throw new Error("offline");
  });
  Date.now.mock.mockImplementation(() => now + 2 * HOUR);
  assert.equal((await getExchangeRate("USD")).rate, 0.0006);
  Date.now.mock.mockImplementation(() => now + 49 * HOUR);
  assert.equal(await getExchangeRate("USD"), null);
});
