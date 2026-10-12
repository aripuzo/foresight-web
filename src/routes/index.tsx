import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Header } from "@/components/header";
import { MarketCard } from "@/components/market-card";
import { FeaturedSlider } from "@/components/featured-slider";
import { listCategories, listMarkets } from "@/lib/markets.functions";
import { Flame } from "lucide-react";

const searchSchema = z.object({
  cat: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  component: HomePage,
});

function HomePage() {
  const { cat, q } = Route.useSearch();
  const cats = useServerFn(listCategories);
  const markets = useServerFn(listMarkets);

  const categoriesQ = useQuery({ queryKey: ["categories"], queryFn: () => cats() });
  const marketsQ = useQuery({
    queryKey: ["markets", cat ?? "trending", q ?? ""],
    queryFn: () => markets({ data: { category: cat, search: q } }),
  });

  const activeCat = cat ?? "trending";
  // Backend has no synthetic "trending" category; prepend one client-side.
  const tabs = [
    { id: "trending", slug: "trending", name: "Trending" },
    ...(categoriesQ.data ?? []),
  ];

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="border-b border-border/50">
        <div className="mx-auto max-w-[1400px] px-4 py-10 md:py-14">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
            <Flame className="h-3.5 w-3.5" /> Live markets
          </div>
          <h1 className="mt-2 max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Trade on the outcome of anything that matters.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Real-time odds on elections, sports, crypto, tech, and the economy; priced by the crowd,
            settled on the truth.
          </p>

          <div className="mt-8">
            <FeaturedSlider markets={marketsQ.data ?? []} />
          </div>
        </div>
      </section>

      {/* Category strip */}
      <div className="sticky top-14 z-30 border-b border-border/50 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 py-2 no-scrollbar">
          {tabs.map((c) => {
            const active = activeCat === c.slug;
            return (
              <Link
                key={c.id}
                to="/"
                search={{ cat: c.slug === "trending" ? undefined : c.slug, q }}
                className={
                  "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition " +
                  (active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground")
                }
              >
                {c.name}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        {marketsQ.isLoading && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        )}
        {marketsQ.data && marketsQ.data.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            No markets match your search.
          </div>
        )}
        {marketsQ.data && marketsQ.data.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {marketsQ.data.map((m) => (
              <MarketCard key={m.id} market={m} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
