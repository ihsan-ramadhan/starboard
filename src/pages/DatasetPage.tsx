import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import GridLayout, { bottom, collides, type Layout, type LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useApp } from "../App";
import { api, clearWidgetDataCache } from "../lib/api";
import { fileNameOf, isDesktop, machineName, pickExcelPath } from "../lib/desktop";
import { formatCount } from "../lib/format";
import { useMachineName, type SyncStatus } from "../lib/excelSync";
import PencilIcon from "../assets/icons/pencil.svg?react";
import RefreshIcon from "../assets/icons/refresh.svg?react";
import TrashIcon from "../assets/icons/trash.svg?react";
import ConfirmModal from "../components/ConfirmModal";
import WidgetRender from "../components/widgets/WidgetRender";
import WidgetBuilderSidebar from "../components/widgets/WidgetBuilderSidebar";
import {
  isAdmin,
  type DatasetDetail,
  type WidgetDefinition,
  type WidgetLayout,
  type WidgetType,
} from "../types";

const GRID_COLS = 12;

function formatSyncTime(iso: string | null): string | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  const minutes = Math.floor((Date.now() - at) / 60_000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return new Date(at).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

function toLayoutItem(w: WidgetDefinition): LayoutItem {
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
}

function findFreeSlot(layout: LayoutItem[], w: number, h: number) {
  const maxY = bottom(layout);
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x + w <= GRID_COLS; x++) {
      const slot: LayoutItem = { i: "__probe__", x, y, w, h };
      if (!layout.some((item) => collides(item, slot))) return { x, y };
    }
  }
  return { x: 0, y: maxY };
}

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
  const {
    user,
    datasets,
    refreshDatasets,
    datasetCache,
    fetchDatasetDetail,
    syncStatuses,
    editMode,
    setEditMode,
  } = useApp();
  const admin = isAdmin(user);
  const machine = useMachineName();
  const { key } = useParams<{ key: string }>();


  const [detail, setDetail] = useState<DatasetDetail | null>(() => {
    return key ? datasetCache[key] ?? null : null;
  });

  const [loading, setLoading] = useState(!detail);
  const [widgetToDelete, setWidgetToDelete] = useState<WidgetDefinition | null>(null);
  const [widgets, setWidgets] = useState<WidgetDefinition[]>([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [togglingSync, setTogglingSync] = useState(false);

  const syncStatus = key ? syncStatuses[key] : undefined;

  const registry = datasets.find((d) => d.key === key);
  const registryStamp = registry?.lastSyncedAt ?? null;
  const inRegistry = registry !== undefined;
  const seenStampRef = useRef<string | null>(null);

  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<(() => void) | null>(null);
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
    if (!key) return;

    const datasetKey = key;

    let active = true;
    setWidgets([]);

    async function load() {
      let d: DatasetDetail | null = datasetCache[datasetKey] ?? null;

      if (!d) {
        setLoading(true);
        d = await fetchDatasetDetail(datasetKey, false);
        if (!active) return;
        setDetail(d);
        setLoading(false);
      } else {
        setDetail(d);
        setLoading(false);
      }

      const ds = d?.dataset;
      if (!ds) return;

      try {
        const w = await api.getWidgets(user.role, datasetKey);
        if (!active) return;
        setWidgets(
          w.map((item) => ({
            ...item,
            datasetId: item.datasetId || ds.id,
          }))
        );
      } catch (err) {
        console.error("Failed to load widgets:", err);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [key, user.role]);

  useEffect(() => {
    const mark = `${key}:${registryStamp ?? ""}`;
    const previous = seenStampRef.current;
    seenStampRef.current = mark;

    if (!inRegistry) return;
    if (previous === null || !previous.startsWith(`${key}:`)) return;
    if (previous === mark) return;
    handleRefresh();
  }, [key, registryStamp, inRegistry]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        pendingSaveRef.current?.();
      }
    };
  }, []);

  useEffect(() => {
    if (!editMode) {
      setSelectedWidgetId(null);
    }
  }, [editMode]);

  useEffect(() => {
    if (!selectedWidgetId) return;

    function handleOutsidePointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest(".widget-card") ||
        target.closest(".builder-sidebar") ||
        target.closest("dialog") ||
        target.closest(".ctx-menu")
      ) {
        return;
      }
      setSelectedWidgetId(null);
    }

    window.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => window.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [selectedWidgetId]);

  const editingWidget = selectedWidgetId
    ? widgets.find((w) => w.id === selectedWidgetId) ?? null
    : null;

  async function handleRefresh() {
    if (!key || refreshing) return;
    setRefreshing(true);
    clearWidgetDataCache();
    try {
      const d = await fetchDatasetDetail(key, true);
      if (d) setDetail(d);
      const w = await api.getWidgets(user.role, key);
      setWidgets(
        w.map((item) => ({
          ...item,
          datasetId: item.datasetId || d?.dataset?.id || item.datasetId,
        }))
      );
      setReloadNonce((n) => n + 1);
    } catch (err) {
      toast.error("Gagal memuat ulang data: " + String(err));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleClaimWatch() {
    if (!key || togglingSync) return;
    setTogglingSync(true);
    try {
      const path = await pickExcelPath();
      if (!path) return;
      await api.setSyncEnabled(user.role, key, true, path, await machineName());
      await refreshDatasets();
      const d = await fetchDatasetDetail(key, true);
      if (d) setDetail(d);
      toast.success("Dataset ini sekarang diawasi dari laptop ini.");
    } catch (err) {
      toast.error("Gagal mengambil alih pengawasan: " + String(err));
    } finally {
      setTogglingSync(false);
    }
  }

  async function handleToggleSync() {
    if (!key || togglingSync) return;

    const next = !(registry ?? detail?.dataset)?.syncEnabled;
    setTogglingSync(true);
    try {
      await api.setSyncEnabled(user.role, key, next);
      await refreshDatasets();
      const d = await fetchDatasetDetail(key, true);
      if (d) setDetail(d);
    } catch (err) {
      toast.error("Gagal mengubah sync: " + String(err));
    } finally {
      setTogglingSync(false);
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

  const { dataset, columns, totalRows } = detail;

  function persistWidgets(next: WidgetDefinition[]) {
    if (!key) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    const flush = () => {
      saveTimerRef.current = null;
      pendingSaveRef.current = null;
      api.saveWidgets(user.role, key, next).catch((err) => {
        toast.error("Gagal menyimpan layout widget: " + String(err));
      });
    };
    pendingSaveRef.current = flush;
    saveTimerRef.current = window.setTimeout(flush, 400);
  }

  function handleSaveWidget(widget: WidgetDefinition) {
    setWidgets((prev) => {
      const existing = prev.find((w) => w.id === widget.id);
      const size = defaultLayoutFor(widget.type);
      const layout =
        widget.layout ??
        existing?.layout ??
        { ...size, ...findFreeSlot(prev.map(toLayoutItem), size.w, size.h) };
      const withLayout = { ...widget, layout };
      const next = existing
        ? prev.map((w) => (w.id === widget.id ? withLayout : w))
        : [...prev, withLayout];
      persistWidgets(next);
      return next;
    });
    toast.success(selectedWidgetId ? "Widget berhasil diperbarui" : "Widget berhasil ditambahkan");
    setSelectedWidgetId(null);
  }

  function handleDeleteWidget(id: string) {
    setWidgets((prev) => {
      const next = prev.filter((w) => w.id !== id);
      persistWidgets(next);
      return next;
    });
    if (selectedWidgetId === id) {
      setSelectedWidgetId(null);
    }
    setWidgetToDelete(null);
    toast.success("Widget berhasil dihapus");
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
    setSelectedWidgetId(null);
  }

  function openEditWidget(widget: WidgetDefinition) {
    setSelectedWidgetId(widget.id);
  }

  const gridLayout: LayoutItem[] = widgets.map(toLayoutItem);

  return (
    <div className="dataset-page-layout">
      <main className="content">
        <div className="dataset-header">
        <div className="dataset-heading">
          <h1 className="dataset-title">{dataset.displayName}</h1>
          <p className="dataset-meta">
            Tabel database: <code>{dataset.tableName}</code> · Total baris:{" "}
            <strong>{formatCount(totalRows)}</strong> · Terdeteksi{" "}
            <strong>{columns.length} kolom</strong>
          </p>
          {(registry ?? dataset).sourcePath && (
            <SyncLine
              sourcePath={(registry ?? dataset).sourcePath as string}
              enabled={(registry ?? dataset).syncEnabled}
              lastSyncedAt={(registry ?? dataset).lastSyncedAt}
              watchedBy={(registry ?? dataset).watchedBy}
              machine={machine}
              status={syncStatus}
              canEdit={admin}
              busy={togglingSync}
              onToggle={handleToggleSync}
              onClaim={handleClaimWatch}
            />
          )}
        </div>
        <div className="dataset-actions">
          <button
            type="button"
            className={`btn-ghost btn-icon${refreshing ? " is-spinning" : ""}`}
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Muat ulang data"
            title="Muat ulang data"
          >
            <RefreshIcon width={15} height={15} />
          </button>
        </div>
      </div>

      <div className="dashboard-container">
        {widgets.length === 0 ? (
          <div className="empty-widgets-card">
            <p className="empty-widgets-title">Belum ada widget pada dashboard ini.</p>
            {admin ? (
              <>
                <p className="empty-widgets-desc">
                  Pilih tipe visual di panel kanan untuk menambahkan widget pertama.
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
              </>
            ) : (
              <p className="empty-widgets-desc">
                Admin {user.role} belum menyusun dashboard untuk dataset ini.
              </p>
            )}
          </div>
        ) : (
          <div ref={containerCallbackRef} style={{ width: "100%", minHeight: "200px" }}>
            {containerWidth > 0 && (
              <GridLayout
                className={`charts-grid${editMode ? " edit-mode" : ""}`}
                width={containerWidth}
                layout={gridLayout}
                gridConfig={{
                  cols: GRID_COLS,
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
                {widgets.map((widget) => {
                  const isSelected = editMode && selectedWidgetId === widget.id;
                  return (
                    <div key={widget.id}>
                      <div
                        className={`widget-card wrap${isSelected ? " is-selected" : ""}`}
                        onClick={() => {
                          if (editMode) {
                            openEditWidget(widget);
                          }
                        }}
                      >
                        {editMode && (
                          <div className="widget-toolbar">
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={`Edit widget ${widget.title}`}
                              title="Edit visual di sidebar"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditWidget(widget);
                              }}
                            >
                              <PencilIcon width={15} height={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn danger"
                              aria-label={`Hapus widget ${widget.title}`}
                              title="Hapus widget"
                              onClick={(e) => {
                                e.stopPropagation();
                                openWidgetDeleteConfirm(widget);
                              }}
                            >
                              <TrashIcon width={15} height={15} />
                            </button>
                          </div>
                        )}
                        <WidgetRender widget={widget} reloadNonce={reloadNonce} />
                      </div>
                    </div>
                  );
                })}
              </GridLayout>
            )}
          </div>
        )}
      </div>

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

    {admin && (
      <WidgetBuilderSidebar
        isOpen={editMode}
        columns={columns}
        datasetId={dataset.id}
        editing={editingWidget}
        onSave={handleSaveWidget}
        onDeselect={() => setSelectedWidgetId(null)}
        onDelete={openWidgetDeleteConfirm}
      />
    )}
  </div>
);
}

type SyncLineProps = {
  readonly sourcePath: string;
  readonly enabled: boolean;
  readonly lastSyncedAt: string | null;
  readonly watchedBy: string | null;
  readonly machine: string | null;
  readonly status: SyncStatus | undefined;
  readonly canEdit: boolean;
  readonly busy: boolean;
  readonly onToggle: () => void;
  readonly onClaim: () => void;
};

function SyncLine({
  sourcePath,
  enabled,
  lastSyncedAt,
  watchedBy,
  machine,
  status,
  canEdit,
  busy,
  onToggle,
  onClaim,
}: SyncLineProps) {
  const name = fileNameOf(sourcePath);
  const when = formatSyncTime(lastSyncedAt);
  const mine = !!machine && watchedBy === machine;
  let tone = "paused";
  let text: string;
  let action: { label: string; run: () => void } | null = null;

  if (!enabled) {
    text = `Sync dijeda untuk ${name}`;
    if (canEdit) action = { label: "Aktifkan", run: onToggle };
  } else if (!isDesktop()) {
    text = `${name} diikuti dari aplikasi desktop`;
  } else if (!watchedBy) {
    text = `${name} belum diawasi laptop mana pun`;
    if (canEdit) action = { label: "Awasi dari laptop ini", run: onClaim };
  } else if (!mine) {

    tone = "live";
    text = when
      ? `Diikuti dari ${watchedBy} · diperbarui ${when}`
      : `Diikuti dari ${watchedBy}`;
    if (canEdit) action = { label: "Awasi dari laptop ini", run: onClaim };
  } else if (status?.state === "importing") {
    tone = "busy";
    text = `Membaca perubahan ${name}…`;
  } else if (status?.state === "error") {
    tone = "error";
    text = status.error ? `${name}: ${status.error}` : `${name} tidak terbaca`;
    if (canEdit) action = { label: "Jeda", run: onToggle };
  } else {
    tone = "live";
    text = when ? `Mengikuti ${name} · diperbarui ${when}` : `Mengikuti ${name}`;
    if (canEdit) action = { label: "Jeda", run: onToggle };
  }

  return (
    <p className={`dataset-sync tone-${tone}`}>
      <span className="dataset-sync-dot" aria-hidden="true" />
      <span className="dataset-sync-text" title={status?.error ?? sourcePath}>
        {text}
      </span>
      {action && (
        <button
          type="button"
          className="dataset-sync-toggle"
          onClick={action.run}
          disabled={busy}
        >
          {action.label}
        </button>
      )}
    </p>
  );
}
