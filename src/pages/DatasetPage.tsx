import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import GridLayout, { bottom, collides, type Layout, type LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useApp } from "../App";
import { api, ApiError, clearWidgetDataCache } from "../lib/api";
import {
  canonicalPath,
  fileNameOf,
  isDesktop,
  machineName,
  pickExcelPath,
  readStableSource,
} from "../lib/desktop";
import { useMachineName, type SyncStatus } from "../lib/excelSync";
import RefreshIcon from "../assets/icons/refresh.svg?react";
import PencilIcon from "../assets/icons/pencil.svg?react";
import TrashIcon from "../assets/icons/trash.svg?react";
import ExpandIcon from "../assets/icons/expand.svg?react";
import ShrinkIcon from "../assets/icons/shrink.svg?react";
import SettingsIcon from "../assets/icons/settings.svg?react";
import ConfirmModal from "../components/ConfirmModal";
import DatasetSourceModal, {
  type SourceAction,
} from "../components/DatasetSourceModal";
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
const DESCRIPTION_MAX = 160;

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
    case "date":
      return { ...base, w: 3, h: 3 };
    case "pie":
      return { ...base, w: 4, h: 5 };
    case "table":
      return { ...base, w: 12, h: 7 };
    case "line":
    case "area":
    case "combo":
    case "bar":
    default:
      return { ...base, w: 6, h: 5 };
  }
}

function applyLayout(
  widgets: WidgetDefinition[],
  layout: Layout
): WidgetDefinition[] | null {
  if (widgets.length === 0) return null;

  const pos = new Map(layout.map((l) => [l.i, l]));
  let changed = false;

  const next = widgets.map((w) => {
    const p = pos.get(w.id);
    const cur = w.layout;
    const same =
      cur && cur.x === p?.x && cur.y === p?.y && cur.w === p?.w && cur.h === p?.h;
    if (!p || same) return w;
    changed = true;
    return { ...w, layout: { x: p.x, y: p.y, w: p.w, h: p.h } };
  });

  return changed ? next : null;
}

export default function DatasetPage() {
  const {
    user,
    datasets,
    refreshDatasets,
    datasetCache,
    widgetCache,
    setWidgetCache,
    fetchDatasetDetail,
    syncStatuses,
    editMode,
    setEditMode,
    fullscreen,
    setFullscreen,
  } = useApp();
  const admin = isAdmin(user);
  const machine = useMachineName();
  const { key } = useParams<{ key: string }>();


  const [detail, setDetail] = useState<DatasetDetail | null>(() => {
    return key ? datasetCache[key] ?? null : null;
  });

  const [loading, setLoading] = useState(!detail);
  const [widgetToDelete, setWidgetToDelete] = useState<WidgetDefinition | null>(null);
  const [widgets, setWidgets] = useState<WidgetDefinition[]>(
    () => (key ? widgetCache[key] : undefined) ?? []
  );
  const [widgetsLoaded, setWidgetsLoaded] = useState(
    () => Boolean(key && widgetCache[key])
  );
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [togglingSync, setTogglingSync] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [claimConflict, setClaimConflict] = useState<{
    path: string;
    size: number;
    message: string;
  } | null>(null);

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
      const width = node.getBoundingClientRect().width || node.offsetWidth || node.clientWidth;
      if (width > 0) {
        const next = Math.floor(width);
        setContainerWidth((prev) => (prev === next ? prev : next));
      }

      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const next = Math.floor(entry.contentRect.width);
          if (next > 0) {
            setContainerWidth((prev) => (prev === next ? prev : next));
          }
        }
      });
      ro.observe(node);
      resizeObserverRef.current = ro;
    }
  }, []);

  useEffect(() => {
    if (!key) return;

    const datasetKey = key;

    let active = true;
    const cached = widgetCache[datasetKey];
    setWidgets(cached ?? []);
    setWidgetsLoaded(Boolean(cached));

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
      if (!ds) {
        if (active) setWidgetsLoaded(true);
        return;
      }

      try {
        const w = await api.getWidgets(user.role, datasetKey);
        if (!active) return;
        const loaded = w.map((item) => ({
          ...item,
          datasetId: item.datasetId || ds.id,
        }));
        setWidgets((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(loaded)) return prev;
          return loaded;
        });
        setWidgetCache((prev) => ({ ...prev, [datasetKey]: loaded }));
      } catch (err) {
        console.error("Failed to load widgets:", err);
      } finally {
        if (active) setWidgetsLoaded(true);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [key, user.role]);

  useEffect(() => {
    if (!inRegistry) return;

    const mark = `${key}:${registryStamp ?? ""}`;
    const previous = seenStampRef.current;
    seenStampRef.current = mark;

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
      const loaded = w.map((item) => ({
        ...item,
        datasetId: item.datasetId || d?.dataset?.id || item.datasetId,
      }));
      setWidgets(loaded);
      setWidgetCache((prev) => ({ ...prev, [key]: loaded }));
      setReloadNonce((n) => n + 1);
    } catch (err) {
      toast.error("Gagal memuat ulang data: " + String(err));
    } finally {
      setRefreshing(false);
    }
  }

  async function claimWatch(path: string, size: number, force: boolean) {
    if (!key) return;
    try {
      await api.setSyncEnabled(user.role, key, true, {
        sourcePath: path,
        watchedBy: await machineName(),
        fileName: fileNameOf(path),
        fileSize: size,
        force,
      });
      setClaimConflict(null);
      await refreshDatasets();
      const d = await fetchDatasetDetail(key, true);
      if (d) setDetail(d);
      toast.success("Dataset ini sekarang juga diawasi dari laptop ini.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setClaimConflict({ path, size, message: err.message });
        return;
      }
      toast.error("Gagal mengambil alih pengawasan: " + String(err));
    }
  }

  async function handleClaimWatch() {
    if (!key || togglingSync) return;
    setTogglingSync(true);
    try {
      const path = await pickExcelPath();
      if (!path) return;
      const source = await readStableSource(path);
      if (!source) {
        toast.error("File sedang ditulis aplikasi lain. Coba lagi sebentar.");
        return;
      }
      await claimWatch(await canonicalPath(path), source.bytes.byteLength, false);
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

  async function handleSaveDescription(next: string) {
    if (!key) return;
    try {
      await api.updateDataset(user.role, key, { description: next });
      await refreshDatasets();
      const d = await fetchDatasetDetail(key, true);
      if (d) setDetail(d);
    } catch (err) {
      toast.error("Gagal menyimpan deskripsi: " + String(err));
    }
  }

  async function handleReleaseWatch() {
    if (!key || togglingSync) return;
    setTogglingSync(true);
    try {
      await api.releaseWatch(user.role, key, await machineName());
      await refreshDatasets();
      const d = await fetchDatasetDetail(key, true);
      if (d) setDetail(d);
      toast.success("Laptop ini berhenti mengawasi dataset ini.");
    } catch (err) {
      toast.error("Gagal melepas pengawasan: " + String(err));
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
      <main className="content" aria-busy="true" aria-label={`Memuat dataset ${key}`}>
        <div className="dataset-header">
          <div className="dataset-heading">
            <span className="sk sk-page-title" />
            <span className="sk sk-page-meta" />
          </div>
        </div>
        <div className="sk-page-grid">
          <span className="sk sk-page-card" />
          <span className="sk sk-page-card" />
        </div>
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

  const { dataset, columns } = detail;

  function persistWidgets(next: WidgetDefinition[]) {
    if (!key) return;
    setWidgetCache((prev) => ({ ...prev, [key]: next }));
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
    if (selectedWidgetId) {
      toast.success("Widget berhasil diperbarui");
    } else {
      toast.success("Widget berhasil ditambahkan");
      setSelectedWidgetId(null);
    }
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
      const next = applyLayout(prev, layout);
      if (!next) return prev;
      persistWidgets(next);
      return next;
    });
  }

  function openCreateWidget() {
    setSelectedWidgetId(null);
  }

  function openEditWidget(widget: WidgetDefinition) {
    setSelectedWidgetId(widget.id);
  }

  const gridLayout: LayoutItem[] = widgets.map(toLayoutItem);

  const reg = registry ?? dataset;
  const syncShown = reg.syncEnabled || reg.sourcePath !== null;
  const syncMine = reg.myPath !== null;
  const syncOthers = syncMine ? reg.watcherCount - 1 : reg.watcherCount;
  const syncKnownPath = reg.serverPath ?? reg.myPath ?? reg.sourcePath;
  const syncState = syncShown
    ? syncView({
        name: syncKnownPath ? fileNameOf(syncKnownPath) : reg.sourceName ?? "File sumber",
        when: formatSyncTime(reg.lastSyncedAt),
        enabled: reg.syncEnabled,
        onServer: reg.serverPath !== null,
        mine: syncMine,
        others: syncOthers,
        lastSeenAt: reg.lastSeenAt,
        status: syncStatus,
      })
    : null;

  function runSyncAction(action: SyncAction) {
    setSourceOpen(false);
    if (action === "claim" || action === "change") return handleClaimWatch();
    if (action === "release") return handleReleaseWatch();
    return handleToggleSync();
  }

  const sourceActions: SourceAction[] = admin
    ? (syncState?.actions ?? []).map((action) => ({
        key: action,
        label: SYNC_ACTION_LABEL[action],
        hint: SYNC_ACTION_HINT[action],
        destructive: action === "release",
        run: () => runSyncAction(action),
      }))
    : [];

  let dashboardNotice: ReactNode = null;
  if (!widgetsLoaded) {
    dashboardNotice = (
      <div className="sk-page-grid" aria-busy="true" aria-label="Memuat widget">
        <span className="sk sk-page-card" />
        <span className="sk sk-page-card" />
      </div>
    );
  } else if (widgets.length === 0) {
    dashboardNotice = (
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
    );
  }

  return (
    <div className="dataset-page-layout">
      <main className="content">
        <div className="dataset-header">
        <div className="dataset-heading">
          <h1 className="dataset-title">{dataset.displayName}</h1>
          <DatasetDescription
            value={(registry ?? dataset).description}
            canEdit={admin && editMode}
            onSave={handleSaveDescription}
          />
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
          {syncState && (
            <button
              type="button"
              className={`btn-ghost btn-icon tone-${syncState.tone}`}
              onClick={() => setSourceOpen(true)}
              aria-label={sourceButtonLabel(syncState.tone)}
              title={sourceButtonLabel(syncState.tone)}
            >
              <SettingsIcon width={15} height={15} />
            </button>
          )}
          <button
            type="button"
            className="btn-ghost btn-icon"
            onClick={() => setFullscreen(!fullscreen)}
            aria-pressed={fullscreen}
            aria-label={
              fullscreen ? "Keluar dari layar penuh" : "Tampilkan layar penuh"
            }
            title={
              fullscreen
                ? "Keluar dari layar penuh (Esc)"
                : "Layar penuh, tanpa sidebar"
            }
          >
            {fullscreen ? (
              <ShrinkIcon width={15} height={15} />
            ) : (
              <ExpandIcon width={15} height={15} />
            )}
          </button>
        </div>
      </div>

      <div className="dashboard-container">
        {dashboardNotice ?? (
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
                  bounded: true,
                  handle: ".widget-card",
                  cancel: "button, a, input, select, canvas",
                }}
                resizeConfig={{
                  enabled: editMode,
                  handles: ["s", "e", "se"],
                }}
                onLayoutChange={handleLayoutChange}
              >
                {widgets.map((widget) => {
                  const isSelected = editMode && selectedWidgetId === widget.id;
                  return (
                    <div key={widget.id}>
                      <div
                        className={`widget-card wrap${isSelected ? " is-selected" : ""}`}
                        onPointerDown={() => {
                          if (editMode) {
                            openEditWidget(widget);
                          }
                        }}
                      >
                        {editMode && (
                          <div className="widget-toolbar">
                            <button
                              type="button"
                              className="icon-btn keyboard-only"
                              aria-label={`Edit widget ${widget.title}`}
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
                        <WidgetRender
                          widget={widget}
                          columns={columns}
                          reloadNonce={reloadNonce}
                        />
                      </div>
                    </div>
                  );
                })}
              </GridLayout>
            )}
          </div>
        )}
      </div>

      <DatasetSourceModal
        isOpen={sourceOpen && syncState !== null}
        tone={syncState?.tone ?? "paused"}
        status={syncState?.text ?? ""}
        path={syncKnownPath}
        watchedBy={watcherSummary(reg.serverPath !== null, syncMine, syncOthers)}
        updatedAt={formatSyncTime(reg.lastSyncedAt)}
        error={reg.serverError}
        actions={sourceActions}
        busy={togglingSync}
        onClose={() => setSourceOpen(false)}
      />

      <ConfirmModal
        isOpen={claimConflict !== null}
        title="File sepertinya berbeda"
        message={claimConflict?.message ?? ""}
        confirmLabel="Tetap pakai file ini"
        cancelLabel="Batal"
        isDestructive={true}
        onConfirm={() => {
          if (claimConflict) {
            claimWatch(claimConflict.path, claimConflict.size, true);
          }
        }}
        onCancel={() => setClaimConflict(null)}
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


type SyncAction = "enable" | "claim" | "change" | "release" | "pause";

const SYNC_ACTION_LABEL: Record<SyncAction, string> = {
  enable: "Aktifkan",
  claim: "Awasi dari laptop ini",
  change: "Ganti file",
  release: "Lepas dari laptop ini",
  pause: "Jeda",
};

const SEEN_FRESH_MS = 5 * 60_000;
const SEEN_STALE_MS = 2 * 60 * 60_000;

function ageOf(iso: string | null): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  return Number.isNaN(at) ? null : Date.now() - at;
}

function watcherTone(lastSeenAt: string | null): "live" | "warn" | "error" {
  const age = ageOf(lastSeenAt);
  if (age === null) return "error";
  if (age < SEEN_FRESH_MS) return "live";
  if (age < SEEN_STALE_MS) return "warn";
  return "error";
}

type SyncView = {
  readonly tone: string;
  readonly text: string;
  readonly actions: readonly SyncAction[];
};

type SyncViewInput = {
  readonly name: string;
  readonly when: string | null;
  readonly enabled: boolean;
  readonly onServer: boolean;
  readonly mine: boolean;
  readonly others: number;
  readonly lastSeenAt: string | null;
  readonly status: SyncStatus | undefined;
};

function syncView({
  name,
  when,
  enabled,
  onServer,
  mine,
  others,
  lastSeenAt,
  status,
}: SyncViewInput): SyncView {
  const mineActions: SyncAction[] = ["change", "release", "pause"];

  if (!enabled) {
    return { tone: "paused", text: `Sync dijeda untuk ${name}`, actions: ["enable"] };
  }
  if (onServer) {
    return {
      tone: "live",
      text: when
        ? `${name} · dari server · diperbarui ${when}`
        : `${name} · dari server`,
      actions: ["change", "pause"],
    };
  }
  if (!isDesktop()) {
    return {
      tone: "paused",
      text: `${name} diikuti dari aplikasi desktop`,
      actions: [],
    };
  }
  if (!mine && others === 0) {
    return {
      tone: "warn",
      text: `${name} belum diawasi laptop mana pun`,
      actions: ["claim"],
    };
  }
  if (mine && status?.state === "importing") {
    return { tone: "busy", text: `Membaca perubahan ${name}…`, actions: ["pause"] };
  }
  if (mine && status?.state === "error") {
    return {
      tone: "error",
      text: status.error ? `${name}: ${status.error}` : `${name} tidak terbaca`,
      actions: mineActions,
    };
  }
  if (mine) {
    const shared = others > 0 ? ` · ${others} laptop lain juga` : "";
    return {
      tone: "live",
      text: when
        ? `${name} · dari laptop ini · diperbarui ${when}${shared}`
        : `${name} · dari laptop ini${shared}`,
      actions: mineActions,
    };
  }

  const tone = watcherTone(lastSeenAt);
  const laptops = `${others} laptop lain`;
  if (tone === "live") {
    return {
      tone,
      text: when
        ? `Diikuti dari ${laptops} · diperbarui ${when}`
        : `Diikuti dari ${laptops}`,
      actions: ["claim"],
    };
  }

  const seen = formatSyncTime(lastSeenAt);
  return {
    tone,
    text: seen
      ? `Tidak ada laptop yang memeriksa sejak ${seen} · awasi dari sini agar sync jalan`
      : `${laptops} terdaftar, tapi tidak ada yang memeriksa`,
    actions: ["claim"],
  };
}

const SYNC_ACTION_HINT: Record<SyncAction, string> = {
  enable: "Mulai lagi mengikuti perubahan berkas, untuk semua orang.",
  claim: "Tunjuk berkasnya di laptop ini supaya ikut memeriksa perubahan.",
  change: "Pilih berkas lain untuk diikuti dataset ini.",
  release: "Laptop ini berhenti memeriksa. Laptop lain tidak terpengaruh.",
  pause: "Berhenti mengikuti perubahan berkas, untuk semua orang.",
};

function sourceButtonLabel(tone: string): string {
  if (tone === "warn") return "Sumber data: perlu diperiksa";
  if (tone === "error") return "Sumber data: bermasalah";
  if (tone === "paused") return "Sumber data: dijeda";
  return "Sumber data";
}

function watcherSummary(onServer: boolean, mine: boolean, others: number): string {
  if (onServer) return "Server";
  if (mine && others > 0) return `Laptop ini dan ${others} laptop lain`;
  if (mine) return "Laptop ini";
  if (others > 0) return `${others} laptop lain`;
  return "Belum ada";
}

type DatasetDescriptionProps = {
  readonly value: string | null;
  readonly canEdit: boolean;
  readonly onSave: (next: string) => Promise<void>;
};

function DatasetDescription({ value, canEdit, onSave }: DatasetDescriptionProps) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!canEdit) setEditing(false);
  }, [canEdit]);

  function commit(raw: string) {
    setEditing(false);
    const next = raw.trim();
    if (next === (value ?? "")) return;
    void onSave(next);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="dataset-desc-input"
        defaultValue={value ?? ""}
        maxLength={DESCRIPTION_MAX}
        placeholder="Jelaskan isi dashboard ini dalam satu kalimat"
        aria-label="Deskripsi dashboard"
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.currentTarget.value = value ?? "";
            setEditing(false);
          }
        }}
      />
    );
  }

  if (!value) {
    if (!canEdit) return null;
    return (
      <button
        type="button"
        className="dataset-desc-add"
        onClick={() => setEditing(true)}
      >
        + Tambah deskripsi
      </button>
    );
  }

  if (!canEdit) return <p className="dataset-desc">{value}</p>;

  return (
    <button
      type="button"
      className="dataset-desc"
      onClick={() => setEditing(true)}
      title="Klik untuk mengubah deskripsi"
    >
      {value}
    </button>
  );
}
