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

export type QuickKpi = {
  totalWh: number | null;
  totalCostRp: number | null;
};

export type DatasetDetail = {
  dataset: DatasetRegistry;
  columns: DatasetColumn[];
  totalRows: number;
  sampleRows: any[];
  kpi?: QuickKpi;
};

export type WidgetQueryRequest = {
  datasetId: string;
  metric: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";
  metricColumn?: string;
  groupByColumn?: string;
  limit?: number;
};

export type WidgetQueryResult = {
  scalarValue?: number;
  rows: Array<{ groupKey: string; value: number }>;
};
