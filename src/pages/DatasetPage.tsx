import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "../App";
import ConfirmModal from "../components/ConfirmModal";
import KpiCard from "../components/widgets/KpiCard";
import SchemaInspector from "../components/table/SchemaInspector";
import RawTablePreview from "../components/table/RawTablePreview";
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
        <KpiCard
          label="TOTAL WORKING HOURS (WH)"
          value={
            kpi?.totalWh !== undefined && kpi.totalWh !== null
              ? kpi.totalWh.toLocaleString(undefined, { maximumFractionDigits: 1 })
              : null
          }
          unit="Jam"
        />
        <KpiCard
          label="TOTAL ESTIMASI BIAYA (RP)"
          value={
            kpi?.totalCostRp !== undefined && kpi.totalCostRp !== null
              ? `Rp ${Math.round(kpi.totalCostRp).toLocaleString("id-ID")}`
              : null
          }
          accent
        />
        <KpiCard
          label="TOTAL REKOR DATA"
          value={totalRows.toLocaleString("id-ID")}
          unit="Baris"
        />
      </div>

      <SchemaInspector columns={columns} />
      <RawTablePreview columns={columns} sampleRows={sampleRows} />

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
