import type { CurrencyCode } from "../types";

const LOCALE = "id-ID";

const SCALES: ReadonlyArray<readonly [number, string]> = [
  [1e9, " M"],
  [1e6, " Jt"],
];

const plain = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });

const plainExact = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const whole = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

const money: Record<CurrencyCode, Intl.NumberFormat> = {
  IDR: new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  USD: new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

export function formatCount(val: number): string {
  return whole.format(val);
}

export function formatFullValue(
  val: number,
  currency?: CurrencyCode,
  unit?: string
): string {
  if (currency) return money[currency].format(val);
  const formatted = plain.format(val);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatCompactValue(
  val: number,
  currency?: CurrencyCode,
  unit?: string
): string {
  for (const [step, suffix] of SCALES) {
    if (Math.abs(val) < step) continue;
    const scaled = val / step;
    if (currency) return `${money[currency].format(scaled)}${suffix}`;
    const formatted = `${plainExact.format(scaled)}${suffix}`;
    return unit ? `${formatted} ${unit}` : formatted;
  }
  return formatFullValue(val, currency, unit);
}

export function formatCell(val: unknown): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "string") return val;
  if (typeof val === "number") return plain.format(val);
  if (val instanceof Date) return val.toISOString().split("T")[0];
  if (typeof val === "boolean" || typeof val === "bigint") return val.toString();
  return JSON.stringify(val) ?? "";
}
