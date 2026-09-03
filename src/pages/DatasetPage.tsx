import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import GridLayout, { type Layout, type LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
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
  WidgetLayout,
  WidgetType,
} from "../types";

function defaultLayoutFor(type: WidgetType): WidgetLayout {
  const base = { x: 0, y: 0 };
  switch (type) {
    case "kpi":
      return { ...base, w: 3, h: 2 };
    case "pie":
      return { ...base, w: 4, h: 5 };
    case "line":
      return { ...base, w: 6, h: 5 };
    case "bar":
    default:
      return { ...base, w: 6, h: 5 };
  }
}

export default function DatasetPage() {
  const { user, refreshDatasets, datasetCache, fetchDatasetDetail } = useApp();
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"dashboard" | "data">("dashboard");
  // Not persisted: opening a dashboard should always land in the read-only state.
  const [editMode, setEditMode] = useState(false);
  const [detail, setDetail] = useState<DatasetDetail | null>(() => {
    return key ? datasetCache[key] ?? null : null;
  });

  const [loading, setLoading] = useState(!detail);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [widgetToDelete, setWidgetToDelete] = useState<WidgetDefinition | null>(null);
  const [widgets, setWidgets] = useState<WidgetDefinition[]>([]);
  const widgetsLoadedRef = useRef(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetDefinition | null>(null);

  const saveTimerRef = useRef<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }

    if (node) {
      const update = () => {
        const width = node.getBoundingClientRect().width || node.offsetWidth || node.clientWidth;
        if (width > 0) {
          setContainerWidth(Math.floor(width));
        }
      };

      requestAnimationFrame(update);
      const ro = new ResizeObserver(() => {
        update();
      });
      ro.observe(node);
      resizeObserverRef.current = ro;
    }
  }, []);

  useEffect(() => {
    widgetsLoadedRef.current = false;
    setWidgets([]);

    async function load() {
      if (!key) return;
      let d: DatasetDetail | null = datasetCache[key] ?? null;

      if (!d) {
        setLoading(true);
        d = await fetchDatasetDetail(key, false);
        setDetail(d);
        setLoading(false);
      } else {
        setDetail(d);
        setLoading(false);
      }

      if (!widgetsLoadedRef.current && d?.dataset) {
        try {
          const w = await api.getWidgets(user.role, key);
          const sanitized = w.map((item) => ({
            ...item,
            datasetId: item.datasetId || d.dataset.id,
          }));
          setWidgets(sanitized);
        } catch (err) {
          console.error("Failed to load widgets:", err);
        } finally {
          widgetsLoadedRef.current = true;
        }
      }
    }
    load();
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [key, datasetCache]);

  async function handleDeleteDataset() {
    if (!detail?.dataset) return;
    setIsDeleting(true);
    try {
      await api.deleteDataset(detail.dataset.id);
      await refreshDatasets();
      setShowDeleteModal(false);
      toast.success("Dataset berhasil dihapus.");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error("Gagal menghapus dataset: " + String(err));
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

  function persistWidgets(next: WidgetDefinition[]) {
    if (!key) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      api.saveWidgets(user.role, key, next).catch((err) => {
        toast.error("Gagal menyimpan layout widget: " + String(err));
      });
    }, 400);
  }

  function handleSaveWidget(widget: WidgetDefinition) {
    setWidgets((prev) => {
      const exists = prev.some((w) => w.id === widget.id);
      const withLayout = widget.layout
        ? widget
        : { ...widget, layout: defaultLayoutFor(widget.type) };
      const next = exists
        ? prev.map((w) => (w.id === widget.id ? withLayout : w))
        : [...prev, withLayout];
      persistWidgets(next);
      return next;
    });
    setShowBuilder(false);
    setEditingWidget(null);
  }

  function handleDeleteWidget(id: string) {
    setWidgets((prev) => {
      const next = prev.filter((w) => w.id !== id);
      persistWidgets(next);
      return next;
    });
    setWidgetToDelete(null);
  }

  function openWidgetDeleteConfirm(widget: WidgetDefinition) {
    setWidgetToDelete(widget);
  }

  function handleLayoutChange(layout: Layout) {
    setWidgets((prev) => {
      if (prev.length === 0) return prev;
      const pos = new Map(layout.map((l) => [l.i, l]));
      const next = prev.map((w) => {
        const p = pos.get(w.id);
        if (!p) return w;
        const cur = w.layout;
        if (cur && cur.x === p.x && cur.y === p.y && cur.w === p.w && cur.h === p.h) {
          return w;
        }
        return { ...w, layout: { x: p.x, y: p.y, w: p.w, h: p.h } };
      });
      const changed = next.some((w, i) => {
        const a = w.layout;
        const b = prev[i].layout;
        return a !== b && (!a || !b || a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h);
      });
      if (changed) {
        persistWidgets(next);
        return next;
      }
      return prev;
    });
  }

  function openCreateWidget() {
    setEditingWidget(null);
    setShowBuilder(true);
  }

  function openEditWidget(widget: WidgetDefinition) {
    setEditingWidget(widget);
    setShowBuilder(true);
  }

  const gridLayout: LayoutItem[] = widgets.map((w) => {
    const def = defaultLayoutFor(w.type);
    return {
      i: w.id,
      x: w.layout?.x ?? 0,
      y: w.layout?.y ?? 0,
      w: w.layout?.w ?? def.w,
      h: w.layout?.h ?? def.h,
      minW: 2,
      minH: 2,
    };
  });

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
              onClick={() => {
                setActiveTab("data");
                setEditMode(false);
              }}
            >
              Tabel Data
            </button>
          </div>
          {activeTab === "dashboard" && editMode ? (
            <>
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
                Hapus Dataset
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setEditMode(false)}
              >
                Selesai
              </button>
            </>
          ) : (
            <>
              <Link to="/import" className="btn-ghost">
                + Import File Lain
              </Link>
              {activeTab === "dashboard" && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setEditMode(true)}
                >
                  Atur Dashboard
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {activeTab === "dashboard" ? (
        <div className="dashboard-container">
          {widgets.length === 0 ? (
            <div className="empty-widgets-card">
              <p className="empty-widgets-title">Belum ada widget pada dashboard ini.</p>
              <p className="empty-widgets-desc">
                Buat KPI Card, Bar Chart, Line Chart, atau Donut Chart dari data Anda.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setEditMode(true);
                  openCreateWidget();
                }}
              >
                + Tambah Widget Pertama
              </button>
            </div>
          ) : (
            <div ref={containerCallbackRef} style={{ width: "100%", minHeight: "200px" }}>
              {containerWidth > 0 && (
                <GridLayout
                  className={`charts-grid${editMode ? " edit-mode" : ""}`}
                  width={containerWidth}
                  layout={gridLayout}
                  gridConfig={{
                    cols: 12,
                    rowHeight: 60,
                    margin: [16, 16],
                    containerPadding: [0, 0],
                  }}
                  dragConfig={{
                    enabled: editMode,
                    handle: ".widget-card",
                    cancel: "button, a, input, select, .recharts-surface, .recharts-legend-wrapper",
                  }}
                  resizeConfig={{ enabled: editMode }}
                  onLayoutChange={handleLayoutChange}
                >
                  {widgets.map((widget) => (
                    <div key={widget.id}>
                      <div className="widget-card wrap">
                        {editMode && (
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
                              onClick={() => openWidgetDeleteConfirm(widget)}
                            >
                              Hapus
                            </button>
                          </div>
                        )}
                        <WidgetRender widget={widget} />
                      </div>
                    </div>
                  ))}
                </GridLayout>
              )}
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

      <ConfirmModal
        isOpen={widgetToDelete !== null}
        title="Hapus Widget"
        message={`Widget "${widgetToDelete?.title ?? ""}" akan dihapus dari dashboard. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Widget"
        cancelLabel="Batal"
        isDestructive={true}
        onConfirm={() => {
          if (widgetToDelete) {
            handleDeleteWidget(widgetToDelete.id);
          }
        }}
        onCancel={() => setWidgetToDelete(null)}
      />
    </main>
  );
}
