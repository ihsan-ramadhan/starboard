import { Navigate } from "react-router-dom";
import { useApp } from "../App";
import { isAdmin } from "../types";
import { useT } from "../lib/i18n";

export default function HomePage() {
  const t = useT();
  const { datasets, datasetsLoaded, user } = useApp();

  if (!datasetsLoaded) {
    return (
      <main className="content">
        <p className="hint">{t("home.loading")}</p>
      </main>
    );
  }

  if (datasets.length > 0) {
    return <Navigate to={`/d/${datasets[0].key}`} replace />;
  }

  if (isAdmin(user)) {
    return <Navigate to="/import" replace />;
  }

  return (
    <main className="content">
      <div className="empty-card">
        <h2>{t("home.empty")}</h2>
        <p>
          {t("home.emptyDesc", { dept: user.role })}
        </p>
      </div>
    </main>
  );
}
