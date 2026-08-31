import { useState, useEffect, useMemo, createContext, useContext } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import ImportPage from "./pages/ImportPage";
import DatasetPage from "./pages/DatasetPage";
import { Navbar } from "./components/Navbar";
import {
  type ImportWizardState,
  initialImportWizardState,
} from "./components/ImportWizard";
import type { SessionUser, DatasetRegistry, DatasetDetail } from "./types";

type AppContextType = {
  user: SessionUser;
  datasets: DatasetRegistry[];
  datasetCache: Record<string, DatasetDetail>;
  setDatasetCache: React.Dispatch<
    React.SetStateAction<Record<string, DatasetDetail>>
  >;
  fetchDatasetDetail: (
    key: string,
    forceRefresh?: boolean
  ) => Promise<DatasetDetail | null>;
  refreshDatasets: () => Promise<void>;
  onLogout: () => void;
  importState: ImportWizardState;
  setImportState: React.Dispatch<React.SetStateAction<ImportWizardState>>;
};

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppContext");
  return ctx;
}

type ProtectedLayoutProps = {
  readonly user: SessionUser;
  readonly datasets: DatasetRegistry[];
  readonly datasetCache: Record<string, DatasetDetail>;
  readonly setDatasetCache: React.Dispatch<
    React.SetStateAction<Record<string, DatasetDetail>>
  >;
  readonly fetchDatasetDetail: (
    key: string,
    forceRefresh?: boolean
  ) => Promise<DatasetDetail | null>;
  readonly refreshDatasets: () => Promise<void>;
  readonly onLogout: () => void;
  readonly importState: ImportWizardState;
  readonly setImportState: React.Dispatch<React.SetStateAction<ImportWizardState>>;
};

function ProtectedLayout({
  user,
  datasets,
  datasetCache,
  setDatasetCache,
  fetchDatasetDetail,
  refreshDatasets,
  onLogout,
  importState,
  setImportState,
}: ProtectedLayoutProps) {
  const contextValue = useMemo(
    () => ({
      user,
      datasets,
      datasetCache,
      setDatasetCache,
      fetchDatasetDetail,
      refreshDatasets,
      onLogout,
      importState,
      setImportState,
    }),
    [
      user,
      datasets,
      datasetCache,
      setDatasetCache,
      fetchDatasetDetail,
      refreshDatasets,
      onLogout,
      importState,
      setImportState,
    ]
  );

  return (
    <AppContext.Provider value={contextValue}>
      <div className="app-shell">
        <Navbar user={user} datasets={datasets} onLogout={onLogout} />
        <Outlet />
      </div>
    </AppContext.Provider>
  );
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(() => {
    const saved = localStorage.getItem("starboard_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [datasets, setDatasets] = useState<DatasetRegistry[]>([]);
  const [datasetCache, setDatasetCache] = useState<
    Record<string, DatasetDetail>
  >({});
  const [checking, setChecking] = useState(true);
  const [importState, setImportState] = useState<ImportWizardState>(
    initialImportWizardState
  );

  async function loadDatasets(role: string) {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const data = await invoke<DatasetRegistry[]>("get_datasets", {
          dept: role,
        });
        setDatasets(data);
      }
    } catch (err) {
      console.error("Failed to load datasets:", err);
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
      if ((window as any).__TAURI_INTERNALS__) {
        const res = await invoke<DatasetDetail>("get_dataset_detail", {
          dept: user.role,
          key,
        });
        setDatasetCache((prev) => ({ ...prev, [key]: res }));
        return res;
      }
      return null;
    } catch (err) {
      console.error("Failed to fetch dataset detail:", err);
      return null;
    }
  }

  useEffect(() => {
    async function checkAuth() {
      try {
        if ((window as any).__TAURI_INTERNALS__) {
          const u = await invoke<SessionUser | null>("get_current_user");
          if (u) {
            setUser(u);
            localStorage.setItem("starboard_user", JSON.stringify(u));
            await loadDatasets(u.role);
          } else if (user) {
            await loadDatasets(user.role);
          }
        } else if (user) {
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
    loadDatasets(u.role);
  }

  function handleLogout() {
    setUser(null);
    setDatasets([]);
    setDatasetCache({});
    setImportState(initialImportWizardState);
    localStorage.removeItem("starboard_user");
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
              datasetCache={datasetCache}
              setDatasetCache={setDatasetCache}
              fetchDatasetDetail={fetchDatasetDetail}
              refreshDatasets={async () => {
                setDatasetCache({});
                await loadDatasets(user.role);
              }}
              onLogout={handleLogout}
              importState={importState}
              setImportState={setImportState}
            />
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/d/:key" element={<DatasetPage />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}
