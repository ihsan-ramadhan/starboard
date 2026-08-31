import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "../App";
import ConfirmModal from "../components/ConfirmModal";
import type { DatasetDetail, WidgetQueryResult, QuickKpi } from "../types";

export default function DatasetPage() {
  const { user, refreshDatasets, datasetCache, setDatasetCache, fetchDatasetDetail } = useApp();
  const { key } = useParams<{ key: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const imported = searchParams.get("imported");

  const [detail, setDetail] = useState<DatasetDetail | null>(() => {
    return key ? datasetCache[key] ?? null : null;
  });
  const [loading, setLoading] = useState(!detail);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      if (!key) return;
      let d: DatasetDetail | null = datasetCache[key] ?? null;

      if (!d) {
        setLoading(true);
        d = await fetchDatasetDetail(key, !!imported);
        setDetail(d);
        setLoading(false);
      } else {
        setDetail(d);
        setLoading(false);
      }

      if (d?.dataset && !d.kpi) {
        try {
          if ((window as any).__TAURI_INTERNALS__) {
            const whRes = await invoke<WidgetQueryResult>("query_widget_data", {
              req: {
                datasetId: d.dataset.id,
                metric: "SUM",
                metricColumn: "wh",
              },
            });
            const costRes = await invoke<WidgetQueryResult>("query_widget_data", {
              req: {
                datasetId: d.dataset.id,
                metric: "SUM",
                metricColumn: "cost_rp",
              },
            });

            const computedKpi: QuickKpi = {
              totalWh: whRes.scalarValue ?? 0,
              totalCostRp: costRes.scalarValue ?? 0,
            };

            const updated: DatasetDetail = { ...d, kpi: computedKpi };
            setDetail(updated);
            setDatasetCache((prev) => ({ ...prev, [key]: updated }));
          }
        } catch (e) {
          console.error("Failed to fetch quick KPI:", e);
        }
      }
    }
    load();
  }, [key, imported, datasetCache]);

  async function handleDeleteDataset() {
    if (!detail?.dataset) return;
    setIsDeleting(true);
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        await invoke("delete_dataset", {
          datasetId: detail.dataset.id,
        });
      }
      await refreshDatasets();
      setShowDeleteModal(false);
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus dataset: " + String(err));
    } finally {
      setIsDeleting(false);
    }
  }

  if (loading && !detail) {
    return (
      <main className="content">
        <div className="hint">Memuat dataset…</div>
      </main>
    );
  }

  if (!detail || !detail.dataset) {
    return (
      <main className="content">
        <div className="empty-card">
          <h2>Dataset tidak ditemukan</h2>
          <p>Dataset &quot;{key}&quot; belum diimpor untuk {user.role}.</p>
          <Link to="/import" className="btn-primary">
            Import Sekarang
          </Link>
        </div>
      </main>
    );
  }

  const { dataset, columns, totalRows, sampleRows, kpi } = detail;

  return (
    <main className="content">
      <div className="dataset-header">
        <div>
          <h1 className="dataset-title">{dataset.displayName}</h1>
          <p className="dataset-meta">
            Tabel database: <code>{dataset.tableName}</code> · Total baris:{" "}
            <strong>{totalRows.toLocaleString()}</strong> · Terdeteksi{" "}
            <strong>{columns.length} kolom</strong>
          </p>
        </div>
        <div className="dataset-actions">
          <button
            type="button"
            className="btn-danger-outline"
            onClick={() => setShowDeleteModal(true)}
          >
            Hapus Dataset
          </button>
          <Link to="/import" className="btn-ghost">
            + Import File Lain
          </Link>
        </div>
      </div>

      {imported && (
        <div className="success-banner">
          Berhasil membuat tabel <code>{dataset.tableName}</code> dan mengimpor{" "}
          <strong>{Number(imported).toLocaleString()} baris</strong> data!
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">TOTAL WORKING HOURS (WH)</div>
          <div className="kpi-value">
            {kpi?.totalWh !== undefined && kpi.totalWh !== null
              ? kpi.totalWh.toLocaleString(undefined, { maximumFractionDigits: 1 })
              : "..."}
            <span className="kpi-unit"> Jam</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">TOTAL ESTIMASI BIAYA (RP)</div>
          <div className="kpi-value text-accent">
            {kpi?.totalCostRp !== undefined && kpi.totalCostRp !== null
              ? `Rp ${Math.round(kpi.totalCostRp).toLocaleString("id-ID")}`
              : "..."}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">TOTAL REKOR DATA</div>
          <div className="kpi-value">
            {totalRows.toLocaleString("id-ID")}
            <span className="kpi-unit"> Baris</span>
          </div>
        </div>
      </div>

      <div className="section-card">
        <h3>Struktur Skema Terdeteksi (Otomatis)</h3>
        <div className="columns-grid">
          {columns.map((c) => (
            <div key={c.id || c.name} className="column-pill">
              <span className="col-name">{c.label || c.name}</span>
              <span className={`col-type col-${c.type}`}>{c.type}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="section-card" style={{ marginTop: "20px" }}>
        <div className="table-header-row">
          <h3>Pratinjau Data Impor (15 baris pertama)</h3>
          <span className="table-sub">Data aktual dari database Supabase</span>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.id || c.name}>{c.label || c.name}</th>
                ))}
                <th>source_sheet</th>
              </tr>
            </thead>
            <tbody>
              {sampleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    style={{ textAlign: "center", padding: "24px" }}
                  >
                    Belum ada data dalam tabel ini.
                  </td>
                </tr>
              ) : (
                sampleRows.map((row, rIdx) => (
                  <tr key={row.id || rIdx}>
                    {columns.map((c) => {
                      const val = row[c.name];
                      let formatted = val;
                      if (val instanceof Date) {
                        formatted = val.toISOString().split("T")[0];
                      } else if (typeof val === "number") {
                        formatted = val.toLocaleString();
                      } else if (val === null || val === undefined) {
                        formatted = "-";
                      }
                      return <td key={c.id || c.name}>{formatted}</td>;
                    })}
                    <td>
                      <span className="sheet-badge">
                        {row.source_sheet || "-"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Hapus Dataset"
        message={`Dataset "${dataset.displayName}" dan seluruh baris datanya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Dataset"
        cancelLabel="Batal"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteDataset}
        onCancel={() => setShowDeleteModal(false)}
      />
    </main>
  );
}
