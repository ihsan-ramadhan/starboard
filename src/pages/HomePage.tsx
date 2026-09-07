import { Navigate } from "react-router-dom";
import { useApp } from "../App";
import { isAdmin } from "../types";

export default function HomePage() {
  const { datasets, user } = useApp();

  if (datasets.length > 0) {
    return <Navigate to={`/d/${datasets[0].key}`} replace />;
  }

  if (isAdmin(user)) {
    return <Navigate to="/import" replace />;
  }

  return (
    <main className="content">
      <div className="empty-card">
        <h2>Belum ada dashboard</h2>
        <p>
          Admin {user.role} belum mengimpor dataset apa pun. Dashboard akan
          muncul di sini begitu datanya masuk.
        </p>
      </div>
    </main>
  );
}
