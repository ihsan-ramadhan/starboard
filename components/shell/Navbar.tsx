import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/auth";

type DatasetTab = { key: string; displayName: string };

export function Navbar({
  user,
  datasets,
  activeKey,
}: {
  user: SessionUser;
  datasets: DatasetTab[];
  activeKey?: string;
}) {
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
        <form action={logoutAction}>
          <button type="submit" className="btn-ghost">
            Logout
          </button>
        </form>
      </div>

      <nav className="navbar-bar2">
        {datasets.length === 0 ? (
          <span className="nav-empty">No datasets yet</span>
        ) : (
          datasets.map((d) => (
            <Link
              key={d.key}
              href={`/d/${d.key}`}
              className={`nav-tab${activeKey === d.key ? " active" : ""}`}
            >
              {d.displayName}
            </Link>
          ))
        )}
        <Link href="/import" className="nav-tab import">
          + Import Dataset
        </Link>
      </nav>
    </header>
  );
}
