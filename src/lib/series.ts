import { OTHER_SERIES } from "./palette";

export type LongRow = {
  groupKey: string;
  series?: string;
  value: number;
};

export type WideRow = Record<string, string | number | null>;

export type PivotResult = {
  seriesKeys: string[];
  data: WideRow[];
};

export const TREND_KEY = "__trend";

export function pivotSeries(
  rows: readonly LongRow[],
  fillZero: boolean
): PivotResult {
  const seriesSet = new Set<string>();
  const order: string[] = [];
  const byGroup = new Map<string, WideRow>();

  for (const row of rows) {
    const series = row.series ?? "value";
    seriesSet.add(series);

    let entry = byGroup.get(row.groupKey);
    if (!entry) {
      entry = { groupKey: row.groupKey };
      byGroup.set(row.groupKey, entry);
      order.push(row.groupKey);
    }
    entry[series] = row.value;
  }

  const seriesKeys = [...seriesSet].sort((a, b) => {
    if (a === OTHER_SERIES) return 1;
    if (b === OTHER_SERIES) return -1;
    return a.localeCompare(b, "id-ID");
  });

  const data = order.map((key) => {
    const entry = byGroup.get(key) as WideRow;
    for (const series of seriesKeys) {
      if (entry[series] === undefined) entry[series] = fillZero ? 0 : null;
    }
    return entry;
  });

  return { seriesKeys, data };
}

export function withTrendline(data: readonly WideRow[], key: string): WideRow[] {
  const points: Array<[number, number]> = [];
  data.forEach((row, index) => {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      points.push([index, value]);
    }
  });

  if (points.length < 2) return data as WideRow[];

  const n = points.length;
  const sumX = points.reduce((acc, [x]) => acc + x, 0);
  const sumY = points.reduce((acc, [, y]) => acc + y, 0);
  const sumXY = points.reduce((acc, [x, y]) => acc + x * y, 0);
  const sumXX = points.reduce((acc, [x]) => acc + x * x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return data as WideRow[];

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return data.map((row, index) => ({
    ...row,
    [TREND_KEY]: slope * index + intercept,
  }));
}

export function seriesLabeller(
  columns: ReadonlyArray<{ name: string; label: string | null }>
) {
  const map = new Map(columns.map((c) => [c.name, c.label || c.name]));
  return (series: string) => map.get(series) ?? series;
}

export function foldOthers(
  rows: ReadonlyArray<{ groupKey: string; value: number }>,
  max: number
): Array<{ groupKey: string; value: number }> {
  if (rows.length <= max) return rows as Array<{ groupKey: string; value: number }>;

  const kept = rows.slice(0, max - 1);
  const rest = rows.slice(max - 1);
  const total = rest.reduce((sum, row) => sum + row.value, 0);
  return [...kept, { groupKey: OTHER_SERIES, value: total }];
}

export type ScaleMismatch = {
  small: string;
  large: string;
  ratio: number;
};

export function scaleMismatch(
  data: readonly WideRow[],
  seriesKeys: readonly string[],
  threshold: number
): ScaleMismatch | null {
  if (seriesKeys.length < 2) return null;

  const peaks = seriesKeys.map((key) => {
    let peak = 0;
    for (const row of data) {
      const value = row[key];
      if (typeof value === "number") peak = Math.max(peak, Math.abs(value));
    }
    return { key, peak };
  });

  const large = peaks.reduce((a, b) => (b.peak > a.peak ? b : a));
  const small = peaks.reduce((a, b) => (b.peak < a.peak ? b : a));
  if (small.peak === 0 || large.peak === 0) return null;

  const ratio = large.peak / small.peak;
  if (ratio < threshold) return null;

  return { small: small.key, large: large.key, ratio };
}
