import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, setAuthToken } from "../lib/api";
import ConfirmModal from "./ConfirmModal";
import ChevronIcon from "../assets/icons/chevron-left.svg?react";
import LogoutIcon from "../assets/icons/log-out.svg?react";
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
      await api.logout();
    } catch {
      void 0;
    } finally {
      setIsLoggingOut(false);
      setAuthToken(null);
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
            <ChevronIcon width={16} height={16} />
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
            <LogoutIcon width={15} height={15} />
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
