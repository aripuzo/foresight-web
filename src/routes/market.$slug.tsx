import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/header";
import {
  getMarket, getQuote, getWallets, getPortfolio, placeTrade,
} from "@/lib/markets.functions";
import { useMe } from "@/hooks/use-me";
import { formatMinor, toMinor, currencySymbol, type Currency } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/market/$slug")({
  component: MarketDetail,
});

function MarketDetail() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { me } = useMe();

  const getM = useServerFn(getMarket);
  const fetchWallets = useServerFn(getWallets);
  const fetchPortfolio = useServerFn(getPortfolio);
  const fetchQuote = useServerFn(getQuote);
  const trade = useServerFn(placeTrade);

  const marketQ = useQuery({ queryKey: ["market", slug], queryFn: () => getM({ data: { slug } }) });
  const walletsQ = useQuery({
    queryKey: ["wallets", me?.id ?? "anon"],
    queryFn: () => fetchWallets(),
    enabled: !!me,
  });
  const portfolioQ = useQuery({
    queryKey: ["portfolio", me?.id ?? "anon"],
    queryFn: () => fetchPortfolio(),
    enabled: !!me,
  });

  const [outcome, setOutcome] = useState<"yes" | "no">("yes");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState<string>("10");
  const [submitting, setSubmitting] = useState(false);

  const m = marketQ.data;
  const currency = (m?.currency ?? "NGN") as Currency;

  // Position held on the selected outcome (for sells).
  const position = useMemo(
    () => (portfolioQ.data ?? []).find((p) => p.marketSlug === slug && p.outcome === outcome),
    [portfolioQ.data, slug, outcome],
  );
  const heldShares = position?.shares ?? 0;

  const amountNum = Number(amount) || 0;
  const spendMinor = side === "buy" && amountNum > 0 ? toMinor(amountNum, currency) : undefined;
  const shares = side === "sell" && amountNum > 0 ? amountNum : undefined;

  const quoteQ = useQuery({
    queryKey: ["quote", slug, outcome, side, amount],
    queryFn: () => fetchQuote({ data: { slug, outcome, side, spendMinor, shares } }),
    enabled: !!m && m.status === "open" && amountNum > 0 &&
      (side === "buy" || amountNum <= heldShares),
    retry: false,
  });

  if (marketQ.isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-[1100px] px-4 py-10">
          <div className="h-64 animate-pulse rounded-xl bg-surface" />
        </div>
      </div>
    );
  }
  if (!m) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-[1100px] px-4 py-20 text-center">
          <p className="text-muted-foreground">Market not found.</p>
          <Link to="/" className="mt-4 inline-block text-primary hover:underline">
            Back to markets
          </Link>
        </div>
      </div>
    );
  }

  const yesPct = Math.round(m.yesPrice * 100);
  const noPct = 100 - yesPct;
  const quote = quoteQ.data;
  const walletBalance = walletsQ.data?.find((w) => w.currency === currency)?.balanceMinor;

  async function submit() {
    if (!me) {
      navigate({ to: "/auth", search: { mode: "signin" } });
      return;
    }
    if (amountNum <= 0) return;
    if (side === "sell" && amountNum > heldShares) {
      toast.error("You don't hold that many shares");
      return;
    }
    setSubmitting(true);
    try {
      const res = await trade({
        data: {
          slug, outcome, side, spendMinor, shares,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      const verb = side === "buy" ? "Bought" : "Sold";
      toast.success(`${verb} ${res.shares.toFixed(2)} ${outcome.toUpperCase()} shares`);
      qc.invalidateQueries({ queryKey: ["market", slug] });
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      qc.invalidateQueries({ queryKey: ["quote"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Trade failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto grid max-w-[1200px] gap-6 px-4 py-6 md:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>

          <div className="flex items-start gap-4">
            {m.imageUrl && (
              <img src={m.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1">
              {m.categoryName && (
                <div className="text-xs uppercase tracking-widest text-primary">
                  {m.categoryName}
                </div>
              )}
              <h1 className="mt-1 text-2xl font-bold leading-tight md:text-3xl">{m.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span>{formatMinor(m.volumeMinor, currency)} Volume</span>
                <span className="rounded bg-surface px-2 py-0.5 font-medium">{currency}</span>
                {m.closeTime && (
                  <span>Resolves {new Date(m.closeTime).toLocaleDateString()}</span>
                )}
                <span className="rounded bg-surface px-2 py-0.5 uppercase">{m.status}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border bg-card p-6">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Current probability</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-5xl font-bold tabular-nums">{yesPct}%</span>
                  <span className="flex items-center gap-1 text-sm text-yes">
                    <TrendingUp className="h-3.5 w-3.5" />
                    YES
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-sm">
                <div className="rounded-md bg-yes-muted px-4 py-2 font-semibold text-yes">
                  Yes {yesPct}¢
                </div>
                <div className="rounded-md bg-no-muted px-4 py-2 font-semibold text-no">
                  No {noPct}¢
                </div>
              </div>
            </div>

            <div className="mt-6 h-2 overflow-hidden rounded-full bg-no-muted">
              <div className="h-full bg-yes" style={{ width: `${yesPct}%` }} />
            </div>
          </div>

          {m.description && (
            <div className="mt-6 rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                About this market
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {m.description}
              </p>
            </div>
          )}
        </div>

        {/* Trade panel */}
        <aside className="md:sticky md:top-20 md:h-fit">
          <div className="rounded-xl border border-border bg-card p-4">
            {/* Buy / Sell */}
            <div className="mb-3 grid grid-cols-2 gap-1 rounded-md bg-surface p-1">
              {(["buy", "sell"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={
                    "rounded py-1.5 text-sm font-semibold capitalize transition " +
                    (side === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")
                  }
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setOutcome("yes")}
                className={
                  "rounded-md py-2.5 text-sm font-semibold transition " +
                  (outcome === "yes"
                    ? "bg-yes text-yes-foreground"
                    : "bg-yes-muted text-yes hover:opacity-90")
                }
              >
                Yes {yesPct}¢
              </button>
              <button
                onClick={() => setOutcome("no")}
                className={
                  "rounded-md py-2.5 text-sm font-semibold transition " +
                  (outcome === "no"
                    ? "bg-no text-no-foreground"
                    : "bg-no-muted text-no hover:opacity-90")
                }
              >
                No {noPct}¢
              </button>
            </div>

            <div className="mt-4">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                {side === "buy" ? "Amount" : "Shares to sell"}
              </label>
              <div className="mt-1 flex items-center rounded-md border border-border bg-surface px-3">
                <span className="text-muted-foreground">
                  {side === "buy" ? currencySymbol(currency) : "#"}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-transparent py-2.5 pl-1 text-lg font-semibold tabular-nums outline-none"
                />
              </div>
              {side === "sell" && me && (
                <div className="mt-1 text-right text-xs text-muted-foreground">
                  You hold <span className="text-foreground tabular-nums">{heldShares.toFixed(2)}</span> shares
                  <button
                    type="button"
                    onClick={() => setAmount(String(heldShares))}
                    className="ml-2 text-primary hover:underline"
                  >
                    Max
                  </button>
                </div>
              )}
              {side === "buy" && (
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {[10, 50, 100, 500].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAmount(String(v))}
                      className="rounded-md border border-border py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    >
                      {currencySymbol(currency)}{v}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 space-y-1 rounded-md bg-surface p-3 text-xs">
              <Row label="Shares" value={quote ? quote.shares.toFixed(2) : "—"} />
              <Row
                label="Fee"
                value={quote ? formatMinor(quote.feeMinor, currency) : "—"}
              />
              <Row
                label={side === "buy" ? "You pay" : "You receive"}
                value={quote ? formatMinor(quote.totalMinor, currency) : "—"}
                highlight
              />
            </div>

            <Button
              onClick={submit}
              disabled={submitting || amountNum <= 0 || m.status !== "open" ||
                (side === "sell" && amountNum > heldShares)}
              className="mt-4 h-11 w-full text-sm font-semibold"
            >
              {!me
                ? "Log in to trade"
                : submitting
                ? "Placing..."
                : `${side === "buy" ? "Buy" : "Sell"} ${outcome.toUpperCase()}`}
            </Button>

            {me && walletBalance != null && (
              <div className="mt-3 text-center text-xs text-muted-foreground">
                Balance:{" "}
                <span className="tabular-nums text-foreground">
                  {formatMinor(walletBalance, currency)}
                </span>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={"tabular-nums " + (highlight ? "font-semibold text-yes" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}
