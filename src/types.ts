export type SessionUser = {
  id: string;
  username: string;
  email: string;
  role: string;
  deptColor: string | null;
};

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
  rows: Array<{ groupKey: string; value: number }>;
};

export type WidgetType = "kpi" | "bar" | "line" | "pie";

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
  groupByColumn?: string;
  limit?: number;
  isCurrency?: boolean;
  unit?: string;
  layout?: WidgetLayout;
};

export const WIDGET_TYPE_LABEL: Record<WidgetType, string> = {
  kpi: "KPI Card",
  bar: "Bar Chart",
  line: "Line Chart",
  pie: "Pie / Donut Chart",
};
