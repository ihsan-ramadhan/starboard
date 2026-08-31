import { Navigate } from "react-router-dom";
import { useApp } from "../App";
import ImportPage from "./ImportPage";

export default function HomePage() {
  const { datasets } = useApp();

  if (datasets.length > 0) {
    return <Navigate to={`/d/${datasets[0].key}`} replace />;
  }

  return <ImportPage />;
}
