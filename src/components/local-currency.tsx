import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLocalCurrency } from "@/lib/local-currency.functions";
import { DISPLAY_CURRENCIES, formatEstimate } from "@/lib/local-currency";
import { formatMajor, formatMinor, toMajor, type Currency } from "@/lib/money";
import type { ExchangeRate } from "@/lib/exchange-rates.server";

const LocalCurrencyContext = createContext<{ exchange: ExchangeRate | null; locale?: string }>({
  exchange: null,
});

export function LocalCurrencyProvider({ children }: { children: ReactNode }) {
  const [browser, setBrowser] = useState<{ timeZone?: string; locale?: string }>();
  const [currency, setCurrency] = useState("");
  const fetchLocal = useServerFn(getLocalCurrency);
  useEffect(() => {
    setBrowser({
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language,
    });
    try {
      const saved = localStorage.getItem("fs_display_currency");
      if (saved && DISPLAY_CURRENCIES.includes(saved)) setCurrency(saved);
    } catch {
      /* Storage may be disabled. Detection still works. */
    }
  }, []);
  const local = useQuery({
    queryKey: ["local-currency", browser?.timeZone, browser?.locale, currency],
    queryFn: () => fetchLocal({ data: { ...browser, currency: currency || undefined } }),
    enabled: !!browser,
    staleTime: 3_600_000,
    refetchInterval: 3_600_000,
    retry: false,
  });
  const exchange = local.data?.exchange ?? null;

  return (
    <LocalCurrencyContext.Provider value={{ exchange, locale: browser?.locale }}>
      {children}
      <footer className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 py-5 text-xs text-muted-foreground">
        <label className="flex items-center gap-2">
          Local estimates
          <select
            aria-label="Currency for local estimates"
            className="rounded border border-border bg-background px-2 py-1 text-foreground"
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
              try {
                localStorage.setItem("fs_display_currency", e.target.value);
              } catch {
                /* Optional preference. */
              }
            }}
          >
            <option value="">
              Auto{local.data?.detectedCurrency ? ` (${local.data.detectedCurrency})` : ""}
            </option>
            {DISPLAY_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <span>Trades settle in NGN.</span>
        {exchange ? (
          <span>
            Estimates as of {new Date(exchange.updatedAt).toLocaleDateString(browser?.locale)}.{" "}
            <a
              className="underline"
              href="https://www.exchangerate-api.com"
              target="_blank"
              rel="noreferrer"
            >
              Rates by ExchangeRate-API
            </a>
          </span>
        ) : local.isFetched && local.data?.currency !== "NGN" ? (
          <span>Local estimates unavailable.</span>
        ) : null}
      </footer>
    </LocalCurrencyContext.Provider>
  );
}

type MoneyProps = { currency: Currency } & (
  { major: number; minor?: never } | { minor: string | bigint; major?: never }
);

export function Money(props: MoneyProps) {
  const { exchange, locale } = useContext(LocalCurrencyContext);
  const major = props.major ?? toMajor(props.minor!, props.currency);
  const native =
    props.major != null
      ? formatMajor(props.major, props.currency)
      : formatMinor(props.minor!, props.currency);
  const estimate =
    exchange && props.currency === "NGN" && exchange.currency !== props.currency
      ? formatEstimate(major * exchange.rate, exchange.currency, locale)
      : null;
  return (
    <span className="inline-flex flex-col align-middle">
      <span>{native}</span>
      {estimate && (
        <span
          className="text-[0.8em] font-normal opacity-75"
          title="Approximate local value; trades settle in NGN"
        >
          ≈ {estimate}
        </span>
      )}
    </span>
  );
}
