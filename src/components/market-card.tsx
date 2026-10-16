import { Link } from "@tanstack/react-router";
import type { Market } from "@/lib/markets.functions";
import { Money } from "@/components/local-currency";

export function MarketCard({ market }: { market: Market }) {
  const yesPct = Math.round(market.yesPrice * 100);
  return (
    <Link
      to="/market/$slug"
      params={{ slug: market.slug }}
      className="group flex flex-col rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-surface-hover"
    >
      <div className="flex items-start gap-3">
        {market.imageUrl ? (
          <img
            src={market.imageUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-md object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-md bg-surface" />
        )}
        <h3 className="line-clamp-3 text-sm font-semibold leading-snug group-hover:text-primary">
          {market.title}
        </h3>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums text-foreground">{yesPct}%</span>
          <span className="text-xs text-muted-foreground">chance</span>
        </div>
        <span className="rounded bg-surface px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {market.currency}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-yes-muted px-3 py-1.5 text-center text-xs font-semibold text-yes">
          Yes <Money major={market.yesPrice} currency={market.currency} />
        </div>
        <div className="rounded-md bg-no-muted px-3 py-1.5 text-center text-xs font-semibold text-no">
          No <Money major={1 - market.yesPrice} currency={market.currency} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span><Money minor={market.volumeMinor} currency={market.currency} /> Vol.</span>
        {market.categoryName && (
          <span className="rounded bg-surface px-1.5 py-0.5">{market.categoryName}</span>
        )}
      </div>
    </Link>
  );
}
