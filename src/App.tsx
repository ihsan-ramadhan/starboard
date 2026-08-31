import { useState, useEffect, createContext, useContext } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import ImportPage from "./pages/ImportPage";
import DatasetPage from "./pages/DatasetPage";
import { Navbar } from "./components/Navbar";
import type { SessionUser, DatasetRegistry } from "./types";

type AppContextType = {
  user: SessionUser;
  datasets: DatasetRegistry[];
  refreshDatasets: () => Promise<void>;
  onLogout: () => void;
};

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppContext");
  return ctx;
}

function ProtectedLayout({
  user,
  datasets,
  refreshDatasets,
  onLogout,
}: AppContextType) {
  return (
    <AppContext.Provider value={{ user, datasets, refreshDatasets, onLogout }}>
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
  const [checking, setChecking] = useState(true);

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
              refreshDatasets={() => loadDatasets(user.role)}
              onLogout={handleLogout}
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
