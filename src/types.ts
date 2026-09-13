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
  myPath: string | null;
  watcherCount: number;
  lastSeenAt: string | null;
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
  | "bar"
  | "line"
  | "area"
  | "combo"
  | "pie"
  | "table"
  | "date";

export type SeriesMode = "grouped" | "stacked" | "stacked100";

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

export type SlicerControl = "multi" | "range";

export type Slicer = {
  id: string;
  column: string;
  label: string;
  control: SlicerControl;
};

export type SlicerValue = {
  values?: string[];
  from?: string;
  to?: string;
};

export function slicerToFilters(
  slicer: Slicer,
  value: SlicerValue | undefined
): WidgetFilter[] {
  if (!value) return [];

  if (slicer.control === "multi") {
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

export const FILTER_OP_LABEL: Record<FilterOp, string> = {
  in: "salah satu dari",
  eq: "sama dengan",
  ne: "tidak sama",
  gt: "lebih dari",
  gte: "minimal",
  lt: "kurang dari",
  lte: "maksimal",
  contains: "mengandung",
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

export const DATE_MODE_LABEL: Record<DateMode, string> = {
  yearRemaining: "Sisa hari tahun ini",
  quarterRemaining: "Sisa hari kuartal ini",
  untilDate: "Hitung mundur ke tanggal",
  sinceColumn: "Hari sejak tanggal terakhir",
};

export type CurrencyCode = "IDR" | "USD";

export const CURRENCY_LABEL: Record<CurrencyCode, string> = {
  IDR: "Rupiah (Rp)",
  USD: "Dolar AS ($)",
};

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
  lineColumn?: string;
  targetColumn?: string;
  showTrendline?: boolean;
  filters?: WidgetFilter[];
  tableColumns?: string[];
  dateMode?: DateMode;
  targetDate?: string;
  limit?: number;
  isCurrency?: boolean;
  currency?: CurrencyCode;
  unit?: string;
  layout?: WidgetLayout;
};

export const WIDGET_TYPE_LABEL: Record<WidgetType, string> = {
  kpi: "KPI Card",
  bar: "Bar Chart",
  line: "Line Chart",
  area: "Area Chart",
  combo: "Combo Chart",
  pie: "Pie / Donut Chart",
  table: "Tabel",
  date: "KPI Tanggal",
};
