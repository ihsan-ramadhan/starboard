import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  createContext,
  useContext,
} from "react";
import { Routes, Route, Navigate, Outlet, useParams } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import ImportPage from "./pages/ImportPage";
import DatasetPage from "./pages/DatasetPage";
import { Sidebar } from "./components/Sidebar";
import {
  type ImportWizardState,
  initialImportWizardState,
} from "./components/ImportWizard";
import { api, restoreAuthToken, setAuthToken } from "./lib/api";
import { setWindowFullscreen } from "./lib/desktop";
import { useExcelSync, type SyncStatuses } from "./lib/excelSync";
import {
  isAdmin,
  type SessionUser,
  type DatasetRegistry,
  type DatasetDetail,
  type WidgetDefinition,
} from "./types";

type AppContextType = {
  user: SessionUser;
  datasets: DatasetRegistry[];
  datasetsLoaded: boolean;
  datasetCache: Record<string, DatasetDetail>;
  setDatasetCache: React.Dispatch<
    React.SetStateAction<Record<string, DatasetDetail>>
  >;
  widgetCache: Record<string, WidgetDefinition[]>;
  setWidgetCache: React.Dispatch<
    React.SetStateAction<Record<string, WidgetDefinition[]>>
  >;
  fetchDatasetDetail: (
    key: string,
    forceRefresh?: boolean
  ) => Promise<DatasetDetail | null>;
  refreshDatasets: () => Promise<void>;
  onLogout: () => void;
  importState: ImportWizardState;
  setImportState: React.Dispatch<React.SetStateAction<ImportWizardState>>;
  syncStatuses: SyncStatuses;
  editMode: boolean;
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  fullscreen: boolean;
  setFullscreen: (next: boolean) => void;
};

const REGISTRY_POLL_MS = 20_000;

const WIDGET_CACHE_KEY = "starboard_widget_layout";

function readWidgetCache(): Record<string, WidgetDefinition[]> {
  try {
    const raw = localStorage.getItem(WIDGET_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, WidgetDefinition[]>) : {};
  } catch {
    return {};
  }
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppContext");
  return ctx;
}

type ProtectedLayoutProps = {
  readonly user: SessionUser;
  readonly datasets: DatasetRegistry[];
  readonly datasetsLoaded: boolean;
  readonly datasetCache: Record<string, DatasetDetail>;
  readonly setDatasetCache: React.Dispatch<
    React.SetStateAction<Record<string, DatasetDetail>>
  >;
  readonly widgetCache: Record<string, WidgetDefinition[]>;
  readonly setWidgetCache: React.Dispatch<
    React.SetStateAction<Record<string, WidgetDefinition[]>>
  >;
  readonly fetchDatasetDetail: (
    key: string,
    forceRefresh?: boolean
  ) => Promise<DatasetDetail | null>;
  readonly refreshDatasets: () => Promise<void>;
  readonly onLogout: () => void;
  readonly importState: ImportWizardState;
  readonly setImportState: React.Dispatch<React.SetStateAction<ImportWizardState>>;
  readonly editMode: boolean;
  readonly setEditMode: React.Dispatch<React.SetStateAction<boolean>>;
};

function ProtectedLayout({
  user,
  datasets,
  datasetsLoaded,
  datasetCache,
  setDatasetCache,
  widgetCache,
  setWidgetCache,
  fetchDatasetDetail,
  refreshDatasets,
  onLogout,
  importState,
  setImportState,
  editMode,
  setEditMode,
}: ProtectedLayoutProps) {
  const syncStatuses = useExcelSync(datasets, user, refreshDatasets);
  const [fullscreen, setFullscreen] = useState(false);

  const changeFullscreen = useCallback(
    (next: boolean) => {
      setWindowFullscreen(next).catch(() => {});
      setFullscreen(next);
      if (next) setEditMode(false);
    },
    [setEditMode]
  );

  useEffect(() => {
    if (!fullscreen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") changeFullscreen(false);
    }

    function handleNativeExit() {
      if (!document.fullscreenElement) changeFullscreen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleNativeExit);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleNativeExit);
    };
  }, [fullscreen, changeFullscreen]);

  const contextValue = useMemo(
    () => ({
      user,
      datasets,
      datasetsLoaded,
      datasetCache,
      setDatasetCache,
      widgetCache,
      setWidgetCache,
      fetchDatasetDetail,
      refreshDatasets,
      onLogout,
      importState,
      setImportState,
      syncStatuses,
      editMode,
      setEditMode,
      fullscreen,
      setFullscreen: changeFullscreen,
    }),
    [
      user,
      datasets,
      datasetsLoaded,
      datasetCache,
      setDatasetCache,
      widgetCache,
      setWidgetCache,
      fetchDatasetDetail,
      refreshDatasets,
      onLogout,
      importState,
      setImportState,
      syncStatuses,
      editMode,
      setEditMode,
      fullscreen,
      changeFullscreen,
    ]
  );

  return (
    <AppContext.Provider value={contextValue}>
      <div className={`app-shell${fullscreen ? " is-fullscreen" : ""}`}>
        {!fullscreen && (
          <Sidebar user={user} datasets={datasets} onLogout={onLogout} />
        )}
        <Outlet />
      </div>
    </AppContext.Provider>
  );
}

function DatasetRoute() {
  const { key } = useParams<{ key: string }>();
  return <DatasetPage key={key} />;
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(() => {
    const saved = localStorage.getItem("starboard_user");
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved) as SessionUser;

      if (!parsed?.accessLevel) {
        localStorage.removeItem("starboard_user");
        return null;
      }
      return parsed;
    } catch {
      localStorage.removeItem("starboard_user");
      return null;
    }
  });
  const [datasets, setDatasets] = useState<DatasetRegistry[]>([]);
  const [datasetsLoaded, setDatasetsLoaded] = useState(false);
  const [datasetCache, setDatasetCache] = useState<
    Record<string, DatasetDetail>
  >({});
  const [widgetCache, setWidgetCache] = useState<
    Record<string, WidgetDefinition[]>
  >(readWidgetCache);
  const [checking, setChecking] = useState(true);
  const [importState, setImportState] = useState<ImportWizardState>(
    initialImportWizardState
  );
  const [editMode, setEditMode] = useState(false);

  const datasetsSigRef = useRef("");

  function applyDatasets(list: DatasetRegistry[]) {
    const signature = JSON.stringify(list);
    if (signature === datasetsSigRef.current) return false;
    datasetsSigRef.current = signature;
    setDatasets(list);
    return true;
  }

  async function loadDatasets(role: string) {
    try {
      const data = await api.getDatasets(role);
      applyDatasets(data);
    } catch (err: any) {
      if (err?.message?.includes("Unauthorized") || err?.message?.includes("401")) {
        handleLogout();
        return;
      }
      console.error("Failed to load datasets:", err);
    } finally {
      setDatasetsLoaded(true);
    }
  }

  async function fetchDatasetDetail(
    key: string,
    forceRefresh = false
  ): Promise<DatasetDetail | null> {
    if (!user) return null;
    if (!forceRefresh && datasetCache[key]) {
      return datasetCache[key];
    }
    try {
      const res = await api.getDatasetDetail(user.role, key);
      setDatasetCache((prev) => ({ ...prev, [key]: res }));
      return res;
    } catch (err) {
      console.error("Failed to fetch dataset detail:", err);
      return null;
    }
  }

  useEffect(() => {
    try {
      localStorage.setItem(WIDGET_CACHE_KEY, JSON.stringify(widgetCache));
    } catch {
      void 0;
    }
  }, [widgetCache]);

  useEffect(() => {
    const role = user?.role;
    if (!role) return;
    let active = true;
    const id = window.setInterval(async () => {
      try {
        const list = await api.getDatasets(role);
        if (!active) return;
        if (applyDatasets(list)) setDatasetCache({});
      } catch {

      }
    }, REGISTRY_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [user?.role]);

  useEffect(() => {
    async function checkAuth() {
      try {
        restoreAuthToken();
        if (user) {
          await loadDatasets(user.role);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setChecking(false);
      }
    }
    checkAuth();
  }, []);

  function handleLoginSuccess(u: SessionUser) {
    setUser(u);
    setWidgetCache({});
    loadDatasets(u.role);
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      void 0;
    }
    setAuthToken(null);
    setUser(null);
    setEditMode(false);
    applyDatasets([]);
    setDatasetsLoaded(false);
    setDatasetCache({});
    setImportState(initialImportWizardState);
    setWidgetCache({});
    localStorage.removeItem("starboard_user");
    localStorage.removeItem(WIDGET_CACHE_KEY);
  }

  if (checking && !user) {
    return <div className="hint" style={{ padding: 24 }}>Memuat aplikasi…</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          !user ? (
            <LoginPage onLoginSuccess={handleLoginSuccess} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {user ? (
        <Route
          element={
            <ProtectedLayout
              user={user}
              datasets={datasets}
              datasetsLoaded={datasetsLoaded}
              datasetCache={datasetCache}
              setDatasetCache={setDatasetCache}
              widgetCache={widgetCache}
              setWidgetCache={setWidgetCache}
              fetchDatasetDetail={fetchDatasetDetail}
              refreshDatasets={async () => {
                setDatasetCache({});
                await loadDatasets(user.role);
              }}
              onLogout={handleLogout}
              importState={importState}
              setImportState={setImportState}
              editMode={editMode}
              setEditMode={setEditMode}
            />
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route
            path="/import"
            element={isAdmin(user) ? <ImportPage /> : <Navigate to="/" replace />}
          />
          <Route path="/d/:key" element={<DatasetRoute />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}
