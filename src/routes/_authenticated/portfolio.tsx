import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/header";
import { getPortfolio, getWallets, type PortfolioPosition } from "@/lib/markets.functions";
import type { Currency } from "@/lib/money";
import { Money } from "@/components/local-currency";
import { Wallet } from "lucide-react";
import { useMe } from "@/hooks/use-me";

export const Route = createFileRoute("/_authenticated/portfolio")({
  component: Portfolio,
});

function Portfolio() {
  const { me } = useMe();
  const fetchPositions = useServerFn(getPortfolio);
  const fetchWallets = useServerFn(getWallets);
  const { data: positions, isLoading } = useQuery({
    queryKey: ["portfolio", me?.id ?? "anon"],
    queryFn: () => fetchPositions(),
  });
  const { data: wallets } = useQuery({
    queryKey: ["wallets", me?.id ?? "anon"],
    queryFn: () => fetchWallets(),
  });

  // Position value (major units) per currency, from live prices.
  const byCurrency = new Map<Currency, { value: number; pnl: number }>();
  for (const p of positions ?? []) {
    const value = p.shares * p.currentPrice;
    const pnl = p.shares * (p.currentPrice - p.avgPrice);
    const acc = byCurrency.get(p.currency) ?? { value: 0, pnl: 0 };
    acc.value += value;
    acc.pnl += pnl;
    byCurrency.set(p.currency, acc);
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[1100px] px-4 py-8">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/15 text-primary">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Portfolio</h1>
            <p className="text-sm text-muted-foreground">@{me?.username ?? "..."}</p>
          </div>
        </div>

        {/* Per-currency summary */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(wallets ?? []).map((w) => {
            const agg = byCurrency.get(w.currency) ?? { value: 0, pnl: 0 };
            const cash = Number(BigInt(w.balanceMinor)) / 10 ** w.decimals;
            return (
              <div key={w.currency} className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {w.currency}
                </div>
                <div className="mt-1 text-xl font-bold tabular-nums">
                  <Money major={cash + agg.value} currency={w.currency} />
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>Cash <Money minor={w.balanceMinor} currency={w.currency} /></span>
                  <span className={agg.pnl >= 0 ? "text-yes" : "text-no"}>
                    {agg.pnl >= 0 ? "+" : ""}<Money major={agg.pnl} currency={w.currency} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Open positions
        </h2>

        {isLoading ? (
          <div className="mt-3 h-24 animate-pulse rounded-xl bg-surface" />
        ) : (positions ?? []).length === 0 ? (
          <div className="mt-3 rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">You don't have any positions yet.</p>
            <Link
              to="/"
              className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Browse markets
            </Link>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Market</th>
                  <th className="p-3 text-left">Side</th>
                  <th className="p-3 text-right">Shares</th>
                  <th className="p-3 text-right">Avg</th>
                  <th className="p-3 text-right">Now</th>
                  <th className="p-3 text-right">Value</th>
                  <th className="p-3 text-right">P/L</th>
                </tr>
              </thead>
              <tbody>
                {(positions ?? []).map((p: PortfolioPosition) => {
                  const value = p.shares * p.currentPrice;
                  const pnl = p.shares * (p.currentPrice - p.avgPrice);
                  return (
                    <tr key={`${p.marketId}-${p.outcome}`} className="border-t border-border">
                      <td className="p-3">
                        <Link to="/market/$slug" params={{ slug: p.marketSlug }} className="hover:text-primary">
                          {p.marketTitle}
                        </Link>
                      </td>
                      <td className="p-3">
                        <span
                          className={
                            "rounded px-2 py-0.5 text-xs font-semibold " +
                            (p.outcome === "yes" ? "bg-yes-muted text-yes" : "bg-no-muted text-no")
                          }
                        >
                          {p.outcome.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-right tabular-nums">{p.shares.toFixed(2)}</td>
                      <td className="p-3 text-right tabular-nums"><Money major={p.avgPrice} currency={p.currency} /></td>
                      <td className="p-3 text-right tabular-nums"><Money major={p.currentPrice} currency={p.currency} /></td>
                      <td className="p-3 text-right tabular-nums"><Money major={value} currency={p.currency} /></td>
                      <td
                        className={"p-3 text-right tabular-nums " + (pnl >= 0 ? "text-yes" : "text-no")}
                      >
                        {pnl >= 0 ? "+" : ""}<Money major={pnl} currency={p.currency} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
