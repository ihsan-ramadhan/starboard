export function formatChartValue(
  val: number,
  isCurrency?: boolean,
  unit?: string
): string {
  if (isCurrency) {
    if (val >= 1_000_000_000) {
      return `Rp ${(val / 1_000_000_000).toFixed(1)} M`;
    }
    if (val >= 1_000_000) {
      return `Rp ${(val / 1_000_000).toFixed(1)} Jt`;
    }
    return `Rp ${Math.round(val).toLocaleString("id-ID")}`;
  }
  const formatted = val.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return unit ? `${formatted} ${unit}` : formatted;
}
