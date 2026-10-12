import { createServerFn } from "@tanstack/react-start";
import { apiPublic, apiAuthed, ApiError } from "./api.server";
import type { Currency } from "./money";

export type Category = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
};

export type Market = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  currency: Currency;
  yesPrice: number;
  volumeMinor: string;
  status: string;
  outcome: string | null;
  closeTime: string | null;
  createdAt: string;
};

export type Quote = {
  shares: number;
  costMinor: string;
  feeMinor: string;
  totalMinor: string;
  priceBefore: number;
  priceAfter: number;
};

export type Wallet = { currency: Currency; balanceMinor: string; decimals: number };

export type PortfolioPosition = {
  marketId: string;
  marketSlug: string;
  marketTitle: string;
  currency: Currency;
  outcome: "yes" | "no";
  shares: number;
  avgPrice: number;
  currentPrice: number;
  status: string;
  marketOutcome: string | null;
};

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const res = await apiPublic("/v1/categories");
  return (res.categories ?? []) as Category[];
});

export const listMarkets = createServerFn({ method: "GET" })
  .validator((d: { category?: string; search?: string; currency?: string } | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const params = new URLSearchParams();
    if (data.category) params.set("category", data.category);
    if (data.search) params.set("search", data.search);
    if (data.currency) params.set("currency", data.currency);
    const qs = params.toString();
    const res = await apiPublic(`/v1/markets${qs ? `?${qs}` : ""}`);
    return (res.markets ?? []) as Market[];
  });

export const getMarket = createServerFn({ method: "GET" })
  .validator((d: { slug: string }) => d)
  .handler(async ({ data }): Promise<Market | null> => {
    try {
      return (await apiPublic(`/v1/markets/${data.slug}`)) as Market;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  });

export const getQuote = createServerFn({ method: "GET" })
  .validator((d: {
    slug: string; outcome: "yes" | "no"; side: "buy" | "sell";
    spendMinor?: string; shares?: number;
  }) => d)
  .handler(async ({ data }): Promise<Quote> => {
    const params = new URLSearchParams({ outcome: data.outcome, side: data.side });
    if (data.spendMinor != null) params.set("spend", data.spendMinor);
    if (data.shares != null) params.set("shares", String(data.shares));
    return (await apiPublic(`/v1/markets/${data.slug}/quote?${params.toString()}`)) as Quote;
  });

export const placeTrade = createServerFn({ method: "POST" })
  .validator((d: {
    slug: string; outcome: "yes" | "no"; side: "buy" | "sell";
    spendMinor?: string; shares?: number; idempotencyKey: string;
  }) => d)
  .handler(async ({ data }) => {
    const { slug, ...body } = data;
    return await apiAuthed(`/v1/markets/${slug}/trades`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  });

export const getWallets = createServerFn({ method: "GET" }).handler(async (): Promise<Wallet[]> => {
  const res = await apiAuthed("/v1/wallets");
  return (res.wallets ?? []) as Wallet[];
});

export const getPortfolio = createServerFn({ method: "GET" }).handler(async () => {
  const res = await apiAuthed("/v1/portfolio");
  return (res.positions ?? []) as PortfolioPosition[];
});
