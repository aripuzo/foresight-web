import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { detectDisplayCurrency, DISPLAY_CURRENCIES } from "./local-currency";
import { getExchangeRate } from "./exchange-rates.server";

const input = z.object({
  timeZone: z.string().max(100).optional(),
  locale: z.string().max(100).optional(),
  currency: z
    .string()
    .refine((c) => DISPLAY_CURRENCIES.includes(c))
    .optional(),
});

export const getLocalCurrency = createServerFn({ method: "GET" })
  .validator((data: z.input<typeof input>) => input.parse(data))
  .handler(async ({ data }) => {
    const country = getRequestHeader("x-vercel-ip-country") ?? getRequestHeader("cf-ipcountry");
    const detectedCurrency = detectDisplayCurrency(country, data.timeZone, data.locale);
    const currency = data.currency ?? detectedCurrency;
    return {
      currency,
      detectedCurrency,
      exchange: currency ? await getExchangeRate(currency) : null,
    };
  });
