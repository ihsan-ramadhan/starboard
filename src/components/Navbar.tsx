import { Link, useLocation, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import type { SessionUser } from "../types";

type DatasetTab = { key: string; displayName: string };

export function Navbar({
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
  const activeKey = location.pathname.startsWith("/d/")
    ? location.pathname.replace("/d/", "")
    : undefined;

  async function handleLogout() {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        await invoke("logout");
      }
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem("starboard_user");
    if (onLogout) onLogout();
    navigate("/login");
  }

  return (
    <header className="navbar">
      <div className="navbar-bar1">
        <div className="brand">
          <span className="brand-mark">★</span> Starboard
        </div>
        <span
          className="dept-badge"
          style={user.deptColor ? { backgroundColor: user.deptColor } : undefined}
        >
          {user.role}
        </span>
        <div className="navbar-spacer" />
        <span className="user-name">{user.username}</span>
        <button type="button" className="btn-ghost" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <nav className="navbar-bar2">
        {datasets.length === 0 ? (
          <span className="nav-empty">No datasets yet</span>
        ) : (
          datasets.map((d) => (
            <Link
              key={d.key}
              to={`/d/${d.key}`}
              className={`nav-tab${activeKey === d.key ? " active" : ""}`}
            >
              {d.displayName}
            </Link>
          ))
        )}
        <Link
          to="/import"
          className={`nav-tab import${location.pathname === "/import" ? " active" : ""}`}
        >
          + Import Dataset
        </Link>
      </nav>
    </header>
  );
}
