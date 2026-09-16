import type { CurrencyCode, ValueFormat } from "../types";
import { numberLocale, t, type TKey } from "./i18n";

const SCALES: ReadonlyArray<readonly [number, TKey]> = [
  [1e9, "scale.billion"],
  [1e6, "scale.million"],
];

const OPTIONS = {
  plain: { maximumFractionDigits: 2 },
  exact: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  whole: { maximumFractionDigits: 0 },
  percent: { style: "percent", maximumFractionDigits: 1 },
  IDR: {
    style: "currency",
    currency: "IDR",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  IDRaxis: {
    style: "currency",
    currency: "IDR",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  },
  USDaxis: {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  },
  USD: {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
} as const satisfies Record<string, Intl.NumberFormatOptions>;

const cache = new Map<string, Intl.NumberFormat>();

function nf(kind: keyof typeof OPTIONS): Intl.NumberFormat {
  const locale = numberLocale();
  const key = `${locale}:${kind}`;
  let formatter = cache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, OPTIONS[kind]);
    cache.set(key, formatter);
  }
  return formatter;
}

export function formatCount(val: number): string {
  return nf("whole").format(val);
}

export function formatFullValue(
  val: number,
  currency?: CurrencyCode,
  unit?: string
): string {
  if (currency) return nf(currency).format(val);
  const formatted = nf("plain").format(val);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatCompactValue(
  val: number,
  currency?: CurrencyCode,
  unit?: string
): string {
  for (const [step, suffixKey] of SCALES) {
    if (Math.abs(val) < step) continue;
    const scaled = val / step;
    const suffix = t(suffixKey);
    if (currency) return `${nf(currency).format(scaled)}${suffix}`;
    const formatted = `${nf("exact").format(scaled)}${suffix}`;
    return unit ? `${formatted} ${unit}` : formatted;
  }
  return formatFullValue(val, currency, unit);
}

export function formatCell(val: unknown): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "string") return val;
  if (typeof val === "number") return nf("plain").format(val);
  if (val instanceof Date) return val.toISOString().split("T")[0];
  if (typeof val === "boolean" || typeof val === "bigint") return val.toString();
  return JSON.stringify(val) ?? "";
}

export function formatValueAs(
  val: number,
  format: ValueFormat | undefined,
  currency?: CurrencyCode,
  unit?: string
): string {
  const withUnit = (text: string) => (unit ? `${text} ${unit}` : text);

  switch (format) {
    case "whole":
      return withUnit(nf("whole").format(val));
    case "decimal":
      return withUnit(nf("exact").format(val));
    case "currency":
      return nf(currency ?? "IDR").format(val);
    case "percent":
      return nf("percent").format(val);
    case "scientific":
      return withUnit(val.toExponential(2));
    default:
      return formatFullValue(val, currency, unit);
  }
}

export function compactValueAs(
  val: number,
  format: ValueFormat | undefined,
  currency?: CurrencyCode,
  unit?: string
): string {
  if (format && format !== "general" && format !== "currency") {
    return formatValueAs(val, format, currency, unit);
  }
  return formatCompactValue(val, format === "currency" ? currency ?? "IDR" : currency, unit);
}

export function formatAxisValue(val: number, currency?: CurrencyCode): string {
  for (const [step, suffixKey] of SCALES) {
    if (Math.abs(val) < step) continue;
    const scaled = val / step;
    const suffix = t(suffixKey);
    const scaledText = currency
      ? nf(`${currency}axis`).format(scaled)
      : nf("plain").format(scaled);
    return `${scaledText}${suffix}`;
  }
  return currency ? nf(`${currency}axis`).format(val) : nf("plain").format(val);
}
