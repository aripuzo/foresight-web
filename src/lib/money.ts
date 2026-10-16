// Currency-aware money formatting. Backend sends minor-unit strings; never floats.
export type Currency = "NGN";

export const DECIMALS: Record<Currency, number> = { NGN: 2 };

export function toMajor(minor: string | bigint, c: Currency): number {
  return Number(BigInt(minor)) / 10 ** DECIMALS[c];
}

export function toMinor(major: number, c: Currency): string {
  return BigInt(Math.round(major * 10 ** DECIMALS[c])).toString();
}

export function formatMinor(minor: string | bigint, c: Currency): string {
  const v = toMajor(minor, c).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return c === "NGN" ? `₦${v}` : `${v} ${c}`;
}

export function formatMajor(major: number, c: Currency): string {
  const v = major.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return c === "NGN" ? `₦${v}` : `${v} ${c}`;
}

export const currencySymbol = (c: Currency): string => (c === "NGN" ? "₦" : c);
