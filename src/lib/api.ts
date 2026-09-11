import type {
  SessionUser,
  DatasetRegistry,
  DatasetDetail,
  WidgetQueryResult,
  RowsQueryResult,
  WidgetDefinition,
  WidgetFilter,
} from "../types";
import type { DetectedSheet } from "../components/ImportWizard";

const API_BASE = import.meta.env.VITE_API_BASE;
let authToken: string | null = null;

const AUTH_STORAGE_KEY = "starboard_token";

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem(AUTH_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export function restoreAuthToken() {
  authToken = localStorage.getItem(AUTH_STORAGE_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE belum diset di file .env");
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string>) },
    });
  } catch {
    throw new Error(
      "Tidak dapat terhubung ke server. Pastikan aplikasi Starboard Server berjalan."
    );
  }
  if (!res.ok) {
    throw new ApiError(await readErrorMessage(res), res.status);
  }
  return res.json() as Promise<T>;
}

async function upload(bytes: ArrayBuffer): Promise<string> {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE belum diset di file .env");
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/uploads`, {
      method: "POST",
      headers,
      body: bytes,
    });
  } catch {
    throw new Error(
      "Tidak dapat terhubung ke server. Pastikan aplikasi Starboard Server berjalan."
    );
  }
  if (!res.ok) throw new ApiError(await readErrorMessage(res), res.status);
  const parsed = (await res.json()) as { uploadId: string };
  return parsed.uploadId;
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return `Request failed: ${res.status}`;
  try {
    const parsed = JSON.parse(text);
    return parsed?.error ?? parsed?.message ?? text;
  } catch {
    return text;
  }
}

export type WidgetQuery = {
  datasetId: string;
  metric: string;
  metricColumn?: string;
  metricColumns?: string[];
  groupByColumn?: string;
  seriesColumn?: string;
  limit?: number;
  orderByKey?: boolean;
  filters?: WidgetFilter[];
};

export type RowsQuery = {
  datasetId: string;
  columns?: string[];
  limit?: number;
  offset?: number;
  sortColumn?: string;
  sortDir?: "asc" | "desc";
  filters?: WidgetFilter[];
};

const WIDGET_CACHE_TTL_MS = 30_000;
const widgetDataCache = new Map<string, { at: number; value: WidgetQueryResult }>();

function widgetDataKey(q: WidgetQuery) {
  return [
    q.datasetId,
    q.metric,
    q.metricColumn,
    q.metricColumns?.join(","),
    q.groupByColumn,
    q.seriesColumn,
    q.limit,
    q.orderByKey,
    q.filters?.map((f) => `${f.column}${f.op}${f.value}`).join(","),
  ].join("|");
}

export function peekWidgetData(q: WidgetQuery) {
  const entry = widgetDataCache.get(widgetDataKey(q));
  if (!entry) return undefined;
  if (Date.now() - entry.at > WIDGET_CACHE_TTL_MS) {
    widgetDataCache.delete(widgetDataKey(q));
    return undefined;
  }
  return entry.value;
}

export function clearWidgetDataCache() {
  widgetDataCache.clear();
}

function machineParam(machine?: string | null) {
  return machine ? `&machine=${encodeURIComponent(machine)}` : "";
}

export const api = {
  login(identifier: string, password: string) {
    return request<{ user: SessionUser; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
  },

  logout() {
    return request<boolean>("/api/auth/logout", {
      method: "POST",
    });
  },

  getDatasets(dept: string, machine?: string | null) {
    return request<DatasetRegistry[]>(
      `/api/datasets?dept=${encodeURIComponent(dept)}${machineParam(machine)}`
    );
  },

  getDatasetDetail(dept: string, key: string, machine?: string | null) {
    return request<DatasetDetail>(
      `/api/datasets/${encodeURIComponent(key)}?dept=${encodeURIComponent(dept)}${machineParam(machine)}`
    );
  },

  uploadFile(bytes: ArrayBuffer) {
    return upload(bytes);
  },

  heartbeat(dept: string, machine: string) {
    return request<boolean>("/api/sync/heartbeat", {
      method: "POST",
      body: JSON.stringify({ dept, machine }),
    });
  },

  getWidgets(dept: string, key: string) {
    return request<WidgetDefinition[]>(`/api/datasets/${encodeURIComponent(key)}/widgets?dept=${encodeURIComponent(dept)}`);
  },

  saveWidgets(dept: string, key: string, widgets: WidgetDefinition[]) {
    return request<boolean>(`/api/datasets/${encodeURIComponent(key)}/widgets?dept=${encodeURIComponent(dept)}`, {
      method: "PUT",
      body: JSON.stringify(widgets),
    });
  },

  updateDataset(
    dept: string,
    key: string,
    patch: { displayName?: string; description?: string }
  ) {
    return request<boolean>(`/api/datasets/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ dept, ...patch }),
    });
  },

  reorderDatasets(dept: string, keys: string[]) {
    return request<boolean>("/api/datasets", {
      method: "PUT",
      body: JSON.stringify({ dept, keys }),
    });
  },

  deleteDataset(datasetId: string) {
    return request<boolean>(`/api/datasets/${encodeURIComponent(datasetId)}`, {
      method: "DELETE",
    });
  },

  analyzeExcel(uploadId: string, datasetKey: string) {
    return request<DetectedSheet[]>("/api/excel/analyze", {
      method: "POST",
      body: JSON.stringify({ uploadId, datasetKey }),
    });
  },

  async importExcel(payload: {
    dept: string;
    uploadId: string;
    displayName: string;
    baseKey: string;
    selectedSheets: string[];
    selectedColumns: Record<string, string[]>;
    sourcePath?: string;
    sourceMtime?: string;
    watchedBy?: string;
  }) {
    const res = await request<{ primaryKey: string; totalImported: number }>(
      "/api/excel/import",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    clearWidgetDataCache();
    return res;
  },

  async syncDataset(
    dept: string,
    key: string,
    payload: { uploadId: string; sourceMtime: string }
  ) {
    const res = await request<{
      primaryKey: string;
      totalImported: number;
      skipped: boolean;
    }>(`/api/datasets/${encodeURIComponent(key)}/sync`, {
      method: "POST",
      body: JSON.stringify({ dept, ...payload }),
    });

    if (!res.skipped) clearWidgetDataCache();
    return res;
  },

  releaseWatch(dept: string, key: string, machine: string) {
    return request<boolean>(
      `/api/datasets/${encodeURIComponent(key)}/sync?dept=${encodeURIComponent(dept)}&machine=${encodeURIComponent(machine)}`,
      { method: "DELETE" }
    );
  },

  setSyncEnabled(
    dept: string,
    key: string,
    enabled: boolean,
    source?: {
      sourcePath: string;
      watchedBy: string;
      fileName: string;
      fileSize: number;
      force?: boolean;
    }
  ) {
    return request<boolean>(
      `/api/datasets/${encodeURIComponent(key)}/sync`,
      {
        method: "PUT",
        body: JSON.stringify({ dept, enabled, ...source }),
      }
    );
  },

  async queryWidgetData(q: WidgetQuery) {
    const key = widgetDataKey(q);
    const fresh = peekWidgetData(q);
    if (fresh) return fresh;
    const res = await request<WidgetQueryResult>("/api/analytics/query", {
      method: "POST",
      body: JSON.stringify(q),
    });
    widgetDataCache.set(key, { at: Date.now(), value: res });
    return res;
  },

  queryRows(q: RowsQuery) {
    return request<RowsQueryResult>("/api/analytics/rows", {
      method: "POST",
      body: JSON.stringify(q),
    });
  },
};
