import { Link } from "react-router-dom";
import { useApp } from "../App";

export default function HomePage() {
  const { user, datasets } = useApp();

  return (
    <main className="content">
      {datasets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-card">
            <h2>Dashboard belum punya dataset</h2>
            <p>
              Departemen <strong>{user.role}</strong> belum punya dataset.
              Import data Excel pertama untuk mulai menyusun dashboard.
            </p>
            <Link to="/import" className="btn-primary">
              + Import Dataset
            </Link>
          </div>
        </div>
      ) : (
        <div className="hint">
          Pilih dataset di atas, atau <Link to="/import">import dataset baru</Link>.
        </div>
      )}
    </main>
  );
}
