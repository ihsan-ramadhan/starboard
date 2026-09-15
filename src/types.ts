import type { TKey } from "./lib/i18n";

export type SessionUser = {
  id: string;
  username: string;
  email: string;
  role: string;
  deptColor: string | null;

  accessLevel: "admin" | "viewer";
};

export function isAdmin(user: SessionUser) {
  return user.accessLevel === "admin";
}

export type DatasetColumn = {
  id: string;
  name: string;
  label: string | null;
  type: "numeric" | "date" | "category";
  isDimension: boolean;
};

export type DatasetRegistry = {
  id: string;
  dept: string;
  key: string;
  tableName: string;
  displayName: string;
  description: string | null;
  createdAt: string;
  columns?: DatasetColumn[];
  sourcePath: string | null;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  lastSyncedMtime: string | null;

  watchedBy: string | null;
  sortOrder: number | null;
  sourceName: string | null;
  sourceSize: number | null;
  serverPath: string | null;
  serverError: string | null;
  slicers: Slicer[] | null;
  valueLabels: ValueLabelMap | null;
  myPath: string | null;
  watcherCount: number;
  lastSeenAt: string | null;
  iconVersion: number | null;
};

export type ChartDataPoint = {
  groupKey: string;
  value: number;
};

export type DatasetDetail = {
  dataset: DatasetRegistry;
  columns: DatasetColumn[];
  totalRows: number;
  sampleRows: any[];
};

export type WidgetQueryResult = {
  scalarValue?: number;
  scalarText?: string | null;
  rows: Array<{ groupKey: string; series?: string; value: number }>;
};

export type RowsQueryResult = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  total: number;
};

export type WidgetType =
  | "kpi"
  | "gauge"
  | "bar"
  | "barh"
  | "line"
  | "area"
  | "combo"
  | "pie"
  | "treemap"
  | "heatmap"
  | "scatter"
  | "table"
  | "date";

export type SeriesMode = "grouped" | "stacked" | "stacked100";

export type SortBy = "value" | "key";

export const SORT_BY_KEY: Record<SortBy, TKey> = {
  value: "sortBy.value",
  key: "sortBy.key",
};

export function defaultSortBy(type: WidgetType): SortBy {
  return type === "line" || type === "area" || type === "combo" ? "key" : "value";
}

export type FilterOp =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "in";

export type WidgetFilter = {
  column: string;
  op: FilterOp;
  value: string;
  values?: string[];
};

export type SlicerControl = "multi" | "range" | "both";

export type SlicerMode = "multi" | "range";

export type ValueLabelMap = Record<string, Record<string, string>>;

export function labelForValue(
  map: ValueLabelMap | null | undefined,
  column: string,
  raw: string
): string {
  const custom = map?.[column]?.[raw];
  return custom && custom.trim() ? custom : raw;
}

export type Slicer = {
  id: string;
  column: string;
  label: string;
  control: SlicerControl;
};

export type SlicerValue = {
  mode?: SlicerMode;
  values?: string[];
  from?: string;
  to?: string;
};

export function slicerMode(
  slicer: Slicer,
  value: SlicerValue | undefined
): SlicerMode {
  if (slicer.control !== "both") return slicer.control;
  if (value?.mode) return value.mode;
  return value?.values?.length ? "multi" : "range";
}

export function slicerToFilters(
  slicer: Slicer,
  value: SlicerValue | undefined
): WidgetFilter[] {
  if (!value) return [];

  if (slicerMode(slicer, value) === "multi") {
    const picked = value.values ?? [];
    if (picked.length === 0) return [];
    return [{ column: slicer.column, op: "in", value: "", values: picked }];
  }

  const out: WidgetFilter[] = [];
  if (value.from) out.push({ column: slicer.column, op: "gte", value: value.from });
  if (value.to) out.push({ column: slicer.column, op: "lte", value: value.to });
  return out;
}

export function slicerIsActive(
  slicer: Slicer,
  value: SlicerValue | undefined
): boolean {
  return slicerToFilters(slicer, value).length > 0;
}

export const FILTER_OP_KEY: Record<FilterOp, TKey> = {
  in: "filterOp.in",
  eq: "filterOp.eq",
  ne: "filterOp.ne",
  gt: "filterOp.gt",
  gte: "filterOp.gte",
  lt: "filterOp.lt",
  lte: "filterOp.lte",
  contains: "filterOp.contains",
};

const ORDERED_OPS: FilterOp[] = ["eq", "ne", "gt", "gte", "lt", "lte"];
const TEXT_OPS: FilterOp[] = ["eq", "ne", "contains"];

export function opsForColumn(type: DatasetColumn["type"]): FilterOp[] {
  return type === "numeric" || type === "date" ? ORDERED_OPS : TEXT_OPS;
}

export type DateMode =
  | "yearRemaining"
  | "quarterRemaining"
  | "untilDate"
  | "sinceColumn";

export const DATE_MODE_KEY: Record<DateMode, TKey> = {
  yearRemaining: "dateMode.yearRemaining",
  quarterRemaining: "dateMode.quarterRemaining",
  untilDate: "dateMode.untilDate",
  sinceColumn: "dateMode.sinceColumn",
};

export type GoodDirection = "higher" | "lower";

export const GOOD_DIRECTION_KEY: Record<GoodDirection, TKey> = {
  higher: "goodDirection.higher",
  lower: "goodDirection.lower",
};

export type ValueFormat =
  | "general"
  | "whole"
  | "decimal"
  | "currency"
  | "percent"
  | "scientific";

export const VALUE_FORMAT_KEY: Record<ValueFormat, TKey> = {
  general: "valueFormat.general",
  whole: "valueFormat.whole",
  decimal: "valueFormat.decimal",
  currency: "valueFormat.currency",
  percent: "valueFormat.percent",
  scientific: "valueFormat.scientific",
};

export type CurrencyCode = "IDR" | "USD";

export const CURRENCY_KEY: Record<CurrencyCode, TKey> = {
  IDR: "currency.IDR",
  USD: "currency.USD",
};

export const CURRENCY_SHORT_KEY: Record<CurrencyCode, TKey> = {
  IDR: "currency.IDRshort",
  USD: "currency.USDshort",
};

export function resolveFormat(
  widget: Pick<
    WidgetDefinition,
    "valueFormats" | "valueCurrencies" | "isCurrency" | "currency"
  >,
  column: string | undefined
): { format?: ValueFormat; currency?: CurrencyCode } {
  const key = column ?? "";
  const format =
    widget.valueFormats?.[key] ?? (widget.isCurrency ? "currency" : undefined);
  if (format !== "currency") return { format };
  return {
    format,
    currency: widget.valueCurrencies?.[key] ?? widget.currency ?? "IDR",
  };
}

export type WidgetLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type WidgetDefinition = {
  id: string;
  type: WidgetType;
  title: string;
  datasetId: string;
  metric: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";
  metricColumn?: string;
  metricColumns?: string[];
  groupByColumn?: string;
  seriesColumn?: string;
  seriesMode?: SeriesMode;
  sortBy?: SortBy;
  lineColumn?: string;
  lineColumns?: string[];
  targetColumn?: string;
  showTrendline?: boolean;
  goodDirection?: GoodDirection;
  filters?: WidgetFilter[];
  tableColumns?: string[];
  dateMode?: DateMode;
  targetDate?: string;
  limit?: number;
  isCurrency?: boolean;
  valueFormats?: Record<string, ValueFormat>;
  valueCurrencies?: Record<string, CurrencyCode>;
  currency?: CurrencyCode;
  unit?: string;
  layout?: WidgetLayout;
};

export const WIDGET_TYPE_KEY: Record<WidgetType, TKey> = {
  kpi: "widgetType.kpi",
  gauge: "widgetType.gauge",
  bar: "widgetType.bar",
  barh: "widgetType.barh",
  line: "widgetType.line",
  area: "widgetType.area",
  combo: "widgetType.combo",
  pie: "widgetType.pie",
  treemap: "widgetType.treemap",
  heatmap: "widgetType.heatmap",
  scatter: "widgetType.scatter",
  table: "widgetType.table",
  date: "widgetType.date",
};
