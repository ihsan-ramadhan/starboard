import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import ConfirmModal from "./ConfirmModal";
import type { SessionUser } from "../types";

type DatasetTab = { key: string; displayName: string };

const COLLAPSE_KEY = "starboard_sidebar_collapsed";

// Two letters, so names sharing a first word stay apart in the collapsed rail
// ("Produksi Harian" vs "Pemakaian Bahan Bakar").
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function Sidebar({
  user,
  datasets,
  onLogout,
}: {
  user: SessionUser;
  datasets: DatasetTab[];
  onLogout?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1"
  );

  const activeKey = location.pathname.startsWith("/d/")
    ? location.pathname.replace("/d/", "")
    : undefined;

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  }

  async function handleConfirmLogout() {
    setIsLoggingOut(true);
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        await invoke("logout");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
      localStorage.removeItem("starboard_user");
      if (onLogout) onLogout();
      navigate("/login");
    }
  }

  return (
    <>
      <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
        <div className="sidebar-head">
          <div className="brand">
            <span className="brand-mark">★</span>
            <span className="sidebar-hideable"> Starboard</span>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"}
            title={collapsed ? "Buka sidebar" : "Tutup sidebar"}
          >
            <ChevronIcon />
          </button>
        </div>

        <nav className="sidebar-nav">
          {datasets.length === 0 ? (
            <span className="nav-empty sidebar-hideable">No datasets yet</span>
          ) : (
            datasets.map((d) => (
              <Link
                key={d.key}
                to={`/d/${d.key}`}
                className={`nav-link${activeKey === d.key ? " active" : ""}`}
                aria-current={activeKey === d.key ? "page" : undefined}
                aria-label={d.displayName}
                title={d.displayName}
              >
                <span className="nav-initial">{initials(d.displayName)}</span>
                <span className="nav-label sidebar-hideable">{d.displayName}</span>
              </Link>
            ))
          )}

          <Link
            to="/import"
            className={`nav-link import${location.pathname === "/import" ? " active" : ""}`}
            aria-current={location.pathname === "/import" ? "page" : undefined}
            aria-label="Import Dataset"
            title="Import Dataset"
          >
            <span className="nav-initial">+</span>
            <span className="nav-label sidebar-hideable">Import Dataset</span>
          </Link>
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-user">
            <span
              className="dept-badge"
              style={user.deptColor ? { backgroundColor: user.deptColor } : undefined}
              title={collapsed ? user.username : undefined}
            >
              {user.role}
            </span>
            <span className="user-name sidebar-hideable">{user.username}</span>
          </div>
          <button
            type="button"
            className="sidebar-logout"
            onClick={() => setShowLogoutModal(true)}
            aria-label="Logout"
            title={collapsed ? "Logout" : undefined}
          >
            <LogoutIcon />
            <span className="sidebar-hideable">Logout</span>
          </button>
        </div>
      </aside>

      <ConfirmModal
        isOpen={showLogoutModal}
        title="Konfirmasi Logout"
        message="Apakah Anda yakin ingin keluar dari akun Starboard?"
        confirmLabel="Logout"
        cancelLabel="Batal"
        isDestructive={true}
        isLoading={isLoggingOut}
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </>
  );
}
