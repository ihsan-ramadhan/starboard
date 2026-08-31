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
