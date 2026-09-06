import type {
  SessionUser,
  DatasetRegistry,
  DatasetDetail,
  WidgetQueryResult,
  WidgetDefinition,
} from "../types";
import type { DetectedSheet } from "../components/ImportWizard";

const API_BASE = import.meta.env.VITE_API_BASE;
let authToken: string | null = null;

const AUTH_STORAGE_KEY = "starboard_token";

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
    const message = await readErrorMessage(res);
    throw new Error(message);
  }
  return res.json() as Promise<T>;
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
  groupByColumn?: string;
  limit?: number;
  orderByKey?: boolean;
};

const WIDGET_CACHE_TTL_MS = 30_000;
const widgetDataCache = new Map<string, { at: number; value: WidgetQueryResult }>();

function widgetDataKey(q: WidgetQuery) {
  return [
    q.datasetId,
    q.metric,
    q.metricColumn,
    q.groupByColumn,
    q.limit,
    q.orderByKey,
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

  getDatasets(dept: string) {
    return request<DatasetRegistry[]>(`/api/datasets?dept=${encodeURIComponent(dept)}`);
  },

  getDatasetDetail(dept: string, key: string) {
    return request<DatasetDetail>(`/api/datasets/${encodeURIComponent(key)}?dept=${encodeURIComponent(dept)}`);
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

  deleteDataset(datasetId: string) {
    return request<boolean>(`/api/datasets/${encodeURIComponent(datasetId)}`, {
      method: "DELETE",
    });
  },

  analyzeExcel(fileBytes: number[], datasetKey: string) {
    return request<DetectedSheet[]>("/api/excel/analyze", {
      method: "POST",
      body: JSON.stringify({ fileBytes, datasetKey }),
    });
  },

  async importExcel(payload: {
    dept: string;
    fileBytes: number[];
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
    payload: { fileBytes: number[]; sourceMtime: string }
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

  setSyncEnabled(
    dept: string,
    key: string,
    enabled: boolean,
    sourcePath?: string,
    watchedBy?: string
  ) {
    return request<boolean>(
      `/api/datasets/${encodeURIComponent(key)}/sync`,
      {
        method: "PUT",
        body: JSON.stringify({ dept, enabled, sourcePath, watchedBy }),
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
};
