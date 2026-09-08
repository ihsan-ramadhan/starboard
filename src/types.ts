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
  createdAt: string;
  columns?: DatasetColumn[];
  sourcePath: string | null;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  lastSyncedMtime: string | null;

  watchedBy: string | null;
  sortOrder: number | null;
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
