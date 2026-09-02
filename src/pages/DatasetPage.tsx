import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { useApp } from "../App";
import { api } from "../lib/api";
import ConfirmModal from "../components/ConfirmModal";
import WidgetRender from "../components/widgets/WidgetRender";
import WidgetBuilderModal from "../components/widgets/WidgetBuilderModal";
import SchemaInspector from "../components/table/SchemaInspector";
import RawTablePreview from "../components/table/RawTablePreview";
import type {
  DatasetDetail,
  WidgetDefinition,
} from "../types";

export default function DatasetPage() {
  const { user, refreshDatasets, datasetCache, fetchDatasetDetail } = useApp();
  const { key } = useParams<{ key: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const imported = searchParams.get("imported");

  const [activeTab, setActiveTab] = useState<"dashboard" | "data">("dashboard");
  const [detail, setDetail] = useState<DatasetDetail | null>(() => {
    return key ? datasetCache[key] ?? null : null;
  });

  const [loading, setLoading] = useState(!detail);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [widgets, setWidgets] = useState<WidgetDefinition[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetDefinition | null>(null);

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
    }
    load();
  }, [key, imported, datasetCache]);

  async function handleDeleteDataset() {
    if (!detail?.dataset) return;
    setIsDeleting(true);
    try {
      await api.deleteDataset(detail.dataset.id);
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

  const { dataset, columns, totalRows, sampleRows } = detail;

  function handleSaveWidget(widget: WidgetDefinition) {
    setWidgets((prev) => {
      const exists = prev.some((w) => w.id === widget.id);
      return exists
        ? prev.map((w) => (w.id === widget.id ? widget : w))
        : [...prev, widget];
    });
    setShowBuilder(false);
    setEditingWidget(null);
  }

  function handleDeleteWidget(id: string) {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }

  function openCreateWidget() {
    setEditingWidget(null);
    setShowBuilder(true);
  }

  function openEditWidget(widget: WidgetDefinition) {
    setEditingWidget(widget);
    setShowBuilder(true);
  }

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
          <div className="view-toggle">
            <button
              type="button"
              className={`toggle-btn${activeTab === "dashboard" ? " active" : ""}`}
              onClick={() => setActiveTab("dashboard")}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`toggle-btn${activeTab === "data" ? " active" : ""}`}
              onClick={() => setActiveTab("data")}
            >
              Tabel Data
            </button>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={openCreateWidget}
          >
            + Tambah Widget
          </button>
          <button
            type="button"
            className="btn-danger-outline"
            onClick={() => setShowDeleteModal(true)}
          >
            Hapus
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

      {activeTab === "dashboard" ? (
        <div className="dashboard-container">
          {widgets.length === 0 ? (
            <div className="empty-widgets-card">
              <p className="empty-widgets-title">Belum ada widget pada dashboard ini.</p>
              <p className="empty-widgets-desc">
                Klik tombol <strong>+ Tambah Widget</strong> di atas untuk membuat KPI Card, Bar Chart, Line Chart, atau Donut Chart dari data Anda.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={openCreateWidget}
              >
                + Tambah Widget Pertama
              </button>
            </div>
          ) : (
            <div className="charts-grid">
              {widgets.map((widget) => (
                <div className="widget-card wrap" key={widget.id}>
                  <div className="widget-toolbar">
                    <button
                      type="button"
                      className="btn-ghost-sm"
                      onClick={() => openEditWidget(widget)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger-outline"
                      onClick={() => handleDeleteWidget(widget.id)}
                    >
                      Hapus
                    </button>
                  </div>
                  <WidgetRender widget={widget} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="data-view-container">
          <SchemaInspector columns={columns} />
          <RawTablePreview columns={columns} sampleRows={sampleRows} />
        </div>
      )}

      <WidgetBuilderModal
        isOpen={showBuilder}
        columns={columns}
        datasetId={dataset.id}
        editing={editingWidget}
        onSave={handleSaveWidget}
        onCancel={() => {
          setShowBuilder(false);
          setEditingWidget(null);
        }}
      />

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
