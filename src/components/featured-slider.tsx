import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bookmark, CalendarClock, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import type { Market } from "@/lib/markets.functions";
import { formatMinor } from "@/lib/money";
import { useMe } from "@/hooks/use-me";
import { openAuthModal } from "@/lib/auth-modal";

import politicsImg from "@/assets/featured/politics.jpg";
import cryptoImg from "@/assets/featured/crypto.jpg";
import sportsImg from "@/assets/featured/sports.jpg";
import techImg from "@/assets/featured/tech.jpg";
import economyImg from "@/assets/featured/economy.jpg";
import weatherImg from "@/assets/featured/weather.jpg";
import cultureImg from "@/assets/featured/culture.jpg";
import electionsImg from "@/assets/featured/elections.jpg";

const CATEGORY_IMAGES: Record<string, string> = {
  politics: politicsImg,
  crypto: cryptoImg,
  sports: sportsImg,
  tech: techImg,
  economy: economyImg,
  weather: weatherImg,
  culture: cultureImg,
  elections: electionsImg,
};

const FALLBACK_ORDER = [
  politicsImg,
  cryptoImg,
  sportsImg,
  techImg,
  economyImg,
  weatherImg,
  cultureImg,
  electionsImg,
];

export function FeaturedSlider({ markets }: { markets: Market[] }) {
  const { me: user } = useMe();
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  const [emblaRef, embla] = useEmblaCarousel(
    { loop: true, align: "start", dragFree: false },
    [Autoplay({ delay: 4500, stopOnInteraction: false, stopOnMouseEnter: true })],
  );
  const [selected, setSelected] = useState(0);
  const [snaps, setSnaps] = useState<number[]>([]);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setSelected(embla.selectedScrollSnap());
    setSnaps(embla.scrollSnapList());
    embla.on("select", onSelect);
    embla.on("reInit", () => setSnaps(embla.scrollSnapList()));
    onSelect();
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla]);

  const slides = markets.slice(0, 8).map((m, i) => ({
    market: m,
    image: (m.categorySlug && CATEGORY_IMAGES[m.categorySlug]) || FALLBACK_ORDER[i % FALLBACK_ORDER.length],
  }));

  if (slides.length === 0) return null;

  return (
    <div className="relative">
      <div className="mb-3 flex items-end justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Featured markets
          </h2>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => embla?.scrollPrev()}
            className="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface text-muted-foreground transition hover:text-foreground"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => embla?.scrollNext()}
            className="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface text-muted-foreground transition hover:text-foreground"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
        <div className="flex">
          {slides.map(({ market, image }) => {
            const pct = Math.round(market.yesPrice * 100);
            const bookmarked = bookmarks.has(market.id);
            const endsLabel = formatEnds(market.closeTime);

            function requireAuth(action: () => void) {
              if (!user) {
                openAuthModal("signup");
                return;
              }
              action();
            }

            function onBookmark(e: React.MouseEvent) {
              e.preventDefault();
              e.stopPropagation();
              requireAuth(() => {
                setBookmarks((prev) => {
                  const next = new Set(prev);
                  if (next.has(market.id)) {
                    next.delete(market.id);
                    toast("Removed from your watchlist");
                  } else {
                    next.add(market.id);
                    toast.success("Saved to your watchlist");
                  }
                  return next;
                });
              });
            }

            function onEndsClick(e: React.MouseEvent) {
              e.preventDefault();
              e.stopPropagation();
              requireAuth(() => toast.success("You'll be notified when this market resolves"));
            }

            return (
              <div
                key={market.id}
                className="relative min-w-0 flex-[0_0_100%] md:flex-[0_0_66%] lg:flex-[0_0_50%] pr-3"
              >
                <Link
                  to="/market/$slug"
                  params={{ slug: market.slug }}
                  className="group relative block h-64 overflow-hidden rounded-2xl border border-border/60 md:h-80"
                >
                  <img
                    src={image}
                    alt=""
                    loading="lazy"
                    width={1200}
                    height={800}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />

                  <button
                    type="button"
                    onClick={onBookmark}
                    aria-label={bookmarked ? "Remove bookmark" : "Bookmark market"}
                    aria-pressed={bookmarked}
                    className={
                      "absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border backdrop-blur transition " +
                      (bookmarked
                        ? "border-primary/60 bg-primary/20 text-primary"
                        : "border-border/60 bg-background/60 text-foreground hover:bg-background/80")
                    }
                  >
                    <Bookmark
                      className="h-4 w-4"
                      fill={bookmarked ? "currentColor" : "none"}
                    />
                  </button>

                  <div className="absolute left-3 top-3 flex items-center gap-2">
                    {endsLabel && (
                      <button
                        type="button"
                        onClick={onEndsClick}
                        className="flex items-center gap-1.5 rounded-full border border-border/80 bg-background/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground shadow-sm backdrop-blur transition hover:border-primary/60 hover:text-primary"
                      >
                        <CalendarClock className="h-3.5 w-3.5 text-primary" />
                        {endsLabel}
                      </button>
                    )}
                  </div>

                  <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5 md:p-6">
                    <div>
                      {market.categoryName && (
                        <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground backdrop-blur">
                          {market.categoryName}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold leading-tight text-foreground md:text-2xl">
                      {market.title}
                    </h3>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Yes chance
                        </div>
                        <div className="font-mono text-3xl font-bold text-primary tabular-nums md:text-4xl">
                          {pct}%
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Volume
                        </div>
                        <div className="font-mono text-sm tabular-nums text-foreground">
                          {formatMinor(market.volumeMinor, market.currency)}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-1.5">
        {snaps.map((_, i) => (
          <button
            key={i}
            onClick={() => embla?.scrollTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={
              "h-1.5 rounded-full transition-all " +
              (i === selected ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground")
            }
          />
        ))}
      </div>
    </div>
  );
}

function formatEnds(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = Date.now();
  const diff = d.getTime() - now;
  if (diff <= 0) return "Ended";
  const days = Math.round(diff / 86_400_000);
  if (days < 1) return "Ends today";
  if (days === 1) return "Ends tomorrow";
  if (days < 30) return `Ends in ${days}d`;
  return `Ends ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}
