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
import CopyIcon from "../assets/icons/copy.svg?react";
import ExpandIcon from "../assets/icons/expand.svg?react";
import ShrinkIcon from "../assets/icons/shrink.svg?react";
import SettingsIcon from "../assets/icons/settings.svg?react";
import ConfirmModal from "../components/ConfirmModal";
import DatasetSourceModal, {
  type SourceAction,
} from "../components/DatasetSourceModal";
import WidgetRender from "../components/widgets/WidgetRender";
import { WidgetDescriptionProvider } from "../components/widgets/chartParts";
import { buildQuery } from "../components/widgets/WidgetRender";
import WidgetFocusModal from "../components/WidgetFocusModal";
import WidgetMenu from "../components/WidgetMenu";
import {
  DataLabelsProvider,
  setDataLabelsOverride,
  useDataLabelsOverrides,
  useGlobalDataLabels,
} from "../lib/prefs";
import WidgetSkeleton from "../components/widgets/WidgetSkeleton";
import { useSeenInView } from "../lib/useInView";
import WidgetBuilderSidebar from "../components/widgets/WidgetBuilderSidebar";
import SlicerBar from "../components/SlicerBar";
import { dateLocale, t, useT, type TKey, type Translate } from "../lib/i18n";
import {
  isAdmin,
  slicerToFilters,
  type Slicer,
  type SlicerValue,
  type ValueLabelMap,
  type WidgetFilter,
  type DatasetDetail,
  type WidgetDefinition,
  type WidgetLayout,
  type WidgetType,
} from "../types";

const GRID_COLS = 12;

const HAS_CANVAS = new Set<WidgetType>([
  "bar",
  "barh",
  "line",
  "area",
  "combo",
  "pie",
  "treemap",
  "heatmap",
  "scatter",
  "gauge",
]);
const DESCRIPTION_MAX = 160;

function formatSyncTime(iso: string | null): string | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  const minutes = Math.floor((Date.now() - at) / 60_000);
  if (minutes < 1) return t("time.justNow");
  if (minutes < 60) return t("time.minutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hoursAgo", { n: hours });
  return new Date(at).toLocaleDateString(dateLocale(), {
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
    case "gauge":
      return { ...base, w: 3, h: 4 };
    case "pie":
    case "treemap":
      return { ...base, w: 4, h: 5 };
    case "barh":
    case "heatmap":
      return { ...base, w: 6, h: 6 };
    case "table":
      return { ...base, w: 12, h: 7 };
    case "section":
      return { ...base, w: 12, h: 1 };
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
  const t = useT();
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
  const [focusWidget, setFocusWidget] = useState<WidgetDefinition | null>(null);
  const globalDataLabels = useGlobalDataLabels();
  const labelOverrides = useDataLabelsOverrides();
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
  const [slicerValues, setSlicerValues] = useState<Record<string, SlicerValue>>({});
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
      toast.error(t("ds.reloadFailed") + String(err));
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
      toast.success(t("ds.alsoWatched"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setClaimConflict({ path, size, message: err.message });
        return;
      }
      toast.error(t("ds.claimFailed") + String(err));
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
        toast.error(t("ds.fileBusy"));
        return;
      }
      await claimWatch(await canonicalPath(path), source.bytes.byteLength, false);
      await refreshDatasets();
      const d = await fetchDatasetDetail(key, true);
      if (d) setDetail(d);
      toast.success(t("ds.nowWatched"));
    } catch (err) {
      toast.error(t("ds.claimFailed") + String(err));
    } finally {
      setTogglingSync(false);
    }
  }

  async function handleSaveSlicers(next: Slicer[]) {
    if (!key) return;
    try {
      await api.updateDataset(user.role, key, { slicers: next });
      await refreshDatasets();
      const d = await fetchDatasetDetail(key, true);
      if (d) setDetail(d);
    } catch (err) {
      toast.error(t("ds.saveSlicersFailed") + String(err));
    }
  }

  async function handleSaveValueLabels(next: ValueLabelMap) {
    if (!key) return;
    try {
      await api.updateDataset(user.role, key, { valueLabels: next });
      await refreshDatasets();
      const d = await fetchDatasetDetail(key, true);
      if (d) setDetail(d);
    } catch (err) {
      toast.error(t("ds.saveLabelsFailed") + String(err));
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
      toast.error(t("ds.saveDescFailed") + String(err));
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
      toast.success(t("ds.released"));
    } catch (err) {
      toast.error(t("ds.releaseFailed") + String(err));
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
      toast.error(t("ds.syncToggleFailed") + String(err));
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
          <h2>{t("ds.notFound")}</h2>
          <p>{t("ds.notImported", { key: key ?? "", dept: user.role })}</p>
          <Link to="/import" className="btn-primary">
            {t("ds.importNow")}
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
        toast.error(t("ds.layoutFailed") + String(err));
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
      toast.success(t("ds.widgetUpdated"));
    } else {
      toast.success(t("ds.widgetAdded"));
      setSelectedWidgetId(null);
    }
  }

  function toggleDataLabels(id: string) {
    const effective = labelOverrides[id] ?? globalDataLabels;
    const next = !effective;
    setDataLabelsOverride(id, next === globalDataLabels ? undefined : next);
  }

  async function copyWidgetImage(widget: WidgetDefinition) {
    const card = document.querySelector(`[data-widget-id="${widget.id}"]`);
    const source = card?.querySelector("canvas");
    const shell = card?.querySelector(".widget-card");
    if (!source || !shell) {
      toast.error(t("widget.copyImageUnsupported"));
      return;
    }

    const dpr = source.width / Math.max(source.clientWidth, 1);
    const pad = Math.round(16 * dpr);
    const titleBand = Math.round(30 * dpr);
    const out = document.createElement("canvas");
    out.width = source.width + pad * 2;
    out.height = source.height + pad * 2 + titleBand;

    const ctx = out.getContext("2d");
    if (!ctx) {
      toast.error(t("widget.copyImageFailed"));
      return;
    }

    const shellStyle = getComputedStyle(shell);
    ctx.fillStyle = shellStyle.backgroundColor;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.fillStyle = shellStyle.color;
    ctx.font = `600 ${Math.round(14 * dpr)}px ${shellStyle.fontFamily}`;
    ctx.textBaseline = "top";
    ctx.fillText(widget.title, pad, pad);
    ctx.drawImage(source, pad, pad + titleBand);

    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("encode failed");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success(t("widget.imageCopied"));
    } catch {
      toast.error(t("widget.copyImageFailed"));
    }
  }

  async function copyWidgetData(widget: WidgetDefinition) {
    const query = buildQuery(widget, globalFilters);
    if (!query) {
      toast.error(t("widget.copyUnsupported"));
      return;
    }
    try {
      const res = await api.queryWidgetData(query);
      const rows = res.rows as Record<string, unknown>[];
      if (rows.length === 0) {
        if (res.scalarValue === undefined && !res.scalarText) {
          toast.error(t("chart.noData"));
          return;
        }
        await navigator.clipboard.writeText(
          String(res.scalarText ?? res.scalarValue)
        );
        toast.success(t("widget.copied", { n: 1 }));
        return;
      }
      const headers = Object.keys(rows[0]);
      const body = rows
        .map((row) => headers.map((h) => String(row[h] ?? "")).join("\t"))
        .join("\n");
      await navigator.clipboard.writeText(`${headers.join("\t")}\n${body}`);
      toast.success(t("widget.copied", { n: rows.length }));
    } catch {
      toast.error(t("widget.copyFailed"));
    }
  }

  function handleDuplicateWidget(widget: WidgetDefinition) {
    const size = widget.layout ?? defaultLayoutFor(widget.type);
    const copy: WidgetDefinition = {
      ...widget,
      id: `w_${crypto.randomUUID()}`,
      title: t("ds.copySuffix", { title: widget.title }),
      layout: {
        ...size,
        ...findFreeSlot(widgets.map(toLayoutItem), size.w, size.h),
      },
    };
    const next = [...widgets, copy];
    setWidgets(next);
    persistWidgets(next);
    toast.success(t("ds.widgetDuplicated"));
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
    toast.success(t("ds.widgetDeleted"));
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
  const slicers: Slicer[] = reg.slicers ?? [];
  const valueLabels: ValueLabelMap | null = reg.valueLabels ?? null;
  const globalFilters: WidgetFilter[] = slicers.flatMap((slicer) =>
    slicerToFilters(slicer, slicerValues[slicer.id])
  );
  const syncShown = reg.syncEnabled || reg.sourcePath !== null;
  const syncMine = reg.myPath !== null;
  const syncOthers = syncMine ? reg.watcherCount - 1 : reg.watcherCount;
  const syncKnownPath = reg.serverPath ?? reg.myPath ?? reg.sourcePath;
  const syncState = syncShown
    ? syncView({
        name: syncKnownPath ? fileNameOf(syncKnownPath) : reg.sourceName ?? t("ds.sourceFile"),
        when: formatSyncTime(reg.lastSyncedAt),
        enabled: reg.syncEnabled,
        onServer: reg.serverPath !== null,
        mine: syncMine,
        others: syncOthers,
        lastSeenAt: reg.lastSeenAt,
        status: syncStatus,
        t,
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
        label: t(SYNC_ACTION_KEY[action]),
        hint: t(SYNC_HINT_KEY[action]),
        destructive: action === "release",
        run: () => runSyncAction(action),
      }))
    : [];

  let dashboardNotice: ReactNode = null;
  if (!widgetsLoaded) {
    dashboardNotice = (
      <div className="sk-page-grid" aria-busy="true" aria-label={t("ds.loadingWidgets")}>
        <span className="sk sk-page-card" />
        <span className="sk sk-page-card" />
      </div>
    );
  } else if (widgets.length === 0) {
    dashboardNotice = (
      <div className="empty-widgets-card">
        <p className="empty-widgets-title">{t("ds.noWidgets")}</p>
        {admin ? (
          <>
            <p className="empty-widgets-desc">
              {t("ds.firstWidgetHint")}
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
            {t("ds.noDashboard", { dept: user.role })}
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
          <SlicerBar
            datasetId={dataset.id}
            slicers={slicers}
            columns={columns}
            selection={slicerValues}
            onChange={(id, value) =>
              setSlicerValues((prev) => ({ ...prev, [id]: value }))
            }
            onReset={() => setSlicerValues({})}
            editing={admin && editMode}
            onSlicersChange={handleSaveSlicers}
            valueLabels={valueLabels}
            onValueLabelsChange={handleSaveValueLabels}
          />
          <button
            type="button"
            className={`btn-ghost btn-icon${refreshing ? " is-spinning" : ""}`}
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={t("ds.reload")}
            title={t("ds.reload")}
          >
            <RefreshIcon width={15} height={15} />
          </button>
          {syncState && (
            <button
              type="button"
              className={`btn-ghost btn-icon tone-${syncState.tone}`}
              onClick={() => setSourceOpen(true)}
              aria-label={sourceButtonLabel(t, syncState.tone)}
              title={sourceButtonLabel(t, syncState.tone)}
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
              fullscreen ? t("ds.exitFullscreen") : t("ds.enterFullscreen")
            }
            title={
              fullscreen
                ? t("ds.exitFullscreenHint")
                : t("ds.enterFullscreenHint")
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
                  const actions = editMode ? (
                    <div className="widget-toolbar">
                      <button
                              type="button"
                              className="icon-btn keyboard-only"
                              aria-label={t("widget.editAria", { title: widget.title })}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditWidget(widget);
                              }}
                            >
                              <PencilIcon width={15} height={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={t("widget.duplicateAria", { title: widget.title })}
                              title={t("ds.duplicateWidget")}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateWidget(widget);
                              }}
                            >
                              <CopyIcon width={15} height={15} />
                            </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        aria-label={t("widget.deleteAria", { title: widget.title })}
                        title={t("ds.deleteWidget")}
                        onClick={(e) => {
                          e.stopPropagation();
                          openWidgetDeleteConfirm(widget);
                        }}
                      >
                        <TrashIcon width={15} height={15} />
                      </button>
                    </div>
                  ) : widget.type === "section" ? null : (
                    <div className="widget-toolbar">
                      <WidgetMenu
                        label={widget.title}
                        dataLabels={
                          labelOverrides[widget.id] ?? globalDataLabels
                        }
                        onFocus={() => setFocusWidget(widget)}
                        onCopyData={() => copyWidgetData(widget)}
                        canCopyImage={HAS_CANVAS.has(widget.type)}
                        onCopyImage={() => copyWidgetImage(widget)}
                        onToggleDataLabels={() => toggleDataLabels(widget.id)}
                      />
                    </div>
                  );

                  if (widget.type === "section") {
                    return (
                      <div key={widget.id}>
                        <div
                          className={`widget-card is-bare${isSelected ? " is-selected" : ""}`}
                          onPointerDown={() => {
                            if (editMode) openEditWidget(widget);
                          }}
                        >
                          {actions}
                          <h3 className="section-heading">{widget.title}</h3>
                          {widget.description && (
                            <p className="widget-subtitle" title={widget.description}>
                              {widget.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={widget.id} data-widget-id={widget.id}>
                      <WidgetCard
                        selected={isSelected}
                        onPointerDown={() => {
                          if (editMode) {
                            openEditWidget(widget);
                          }
                        }}
                        skeleton={<WidgetSkeleton widget={widget} />}
                      >
                        {actions}
                        <WidgetDescriptionProvider value={widget.description}>
                          <DataLabelsProvider value={labelOverrides[widget.id]}>
                          <WidgetRender
                            widget={widget}
                            columns={columns}
                            reloadNonce={reloadNonce}
                            globalFilters={globalFilters}
                            valueLabels={valueLabels}
                          />
                          </DataLabelsProvider>
                        </WidgetDescriptionProvider>
                      </WidgetCard>
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
        watchedBy={watcherSummary(t, reg.serverPath !== null, syncMine, syncOthers)}
        updatedAt={formatSyncTime(reg.lastSyncedAt)}
        error={reg.serverError}
        actions={sourceActions}
        busy={togglingSync}
        onClose={() => setSourceOpen(false)}
      />

      <ConfirmModal
        isOpen={claimConflict !== null}
        title={t("ds.claimConflictTitle")}
        message={claimConflict?.message ?? ""}
        confirmLabel={t("ds.claimConflictConfirm")}
        cancelLabel={t("common.cancel")}
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
        title={t("ds.deleteWidgetTitle")}
        message={t("widget.deleteMessage", { title: widgetToDelete?.title ?? "" })}
        confirmLabel={t("ds.deleteWidgetTitle")}
        cancelLabel={t("common.cancel")}
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

    <WidgetFocusModal
      widget={focusWidget}
      dataLabels={focusWidget ? labelOverrides[focusWidget.id] : undefined}
      columns={columns}
      globalFilters={globalFilters}
      valueLabels={valueLabels}
      onClose={() => setFocusWidget(null)}
    />
  </div>
);
}


type SyncAction = "enable" | "claim" | "change" | "release" | "pause";

const SYNC_ACTION_KEY: Record<SyncAction, TKey> = {
  enable: "syncAction.enable",
  claim: "syncAction.claim",
  change: "syncAction.change",
  release: "syncAction.release",
  pause: "syncAction.pause",
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
  readonly t: Translate;
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
  t,
}: SyncViewInput): SyncView {
  const mineActions: SyncAction[] = ["change", "release", "pause"];

  if (!enabled) {
    return {
      tone: "paused",
      text: t("sync.paused", { name }),
      actions: ["enable"],
    };
  }
  if (onServer) {
    return {
      tone: "live",
      text: when
        ? t("sync.serverWhen", { name, when })
        : t("sync.server", { name }),
      actions: ["change", "pause"],
    };
  }
  if (!isDesktop()) {
    return {
      tone: "paused",
      text: t("sync.desktopOnly", { name }),
      actions: [],
    };
  }
  if (!mine && others === 0) {
    return {
      tone: "warn",
      text: t("sync.unwatched", { name }),
      actions: ["claim"],
    };
  }
  if (mine && status?.state === "importing") {
    return {
      tone: "busy",
      text: t("sync.reading", { name }),
      actions: ["pause"],
    };
  }
  if (mine && status?.state === "error") {
    return {
      tone: "error",
      text: status.error
        ? t("sync.errorWith", { name, error: status.error })
        : t("sync.unreadable", { name }),
      actions: mineActions,
    };
  }
  if (mine) {
    const shared = others > 0 ? t("sync.sharedSuffix", { n: others }) : "";
    return {
      tone: "live",
      text: when
        ? t("sync.mineWhen", { name, when, shared })
        : t("sync.mine", { name, shared }),
      actions: mineActions,
    };
  }

  const tone = watcherTone(lastSeenAt);
  if (tone === "live") {
    return {
      tone,
      text: when
        ? t("sync.othersWhen", { n: others, when })
        : t("sync.others", { n: others }),
      actions: ["claim"],
    };
  }

  const seen = formatSyncTime(lastSeenAt);
  return {
    tone,
    text: seen
      ? t("sync.staleSince", { when: seen })
      : t("sync.staleNone", { n: others }),
    actions: ["claim"],
  };
}

const SYNC_HINT_KEY: Record<SyncAction, TKey> = {
  enable: "syncHint.enable",
  claim: "syncHint.claim",
  change: "syncHint.change",
  release: "syncHint.release",
  pause: "syncHint.pause",
};

function sourceButtonLabel(t: Translate, tone: string): string {
  if (tone === "warn") return t("source.buttonWarn");
  if (tone === "error") return t("source.buttonError");
  if (tone === "paused") return t("source.buttonPaused");
  return t("source.button");
}

function watcherSummary(
  t: Translate,
  onServer: boolean,
  mine: boolean,
  others: number
): string {
  if (onServer) return t("watcher.server");
  if (mine && others > 0) return t("watcher.thisAndOthers", { n: others });
  if (mine) return t("watcher.thisLaptop");
  if (others > 0) return t("watcher.others", { n: others });
  return t("watcher.none");
}

type DatasetDescriptionProps = {
  readonly value: string | null;
  readonly canEdit: boolean;
  readonly onSave: (next: string) => Promise<void>;
};

type WidgetCardProps = {
  readonly selected: boolean;
  readonly onPointerDown: () => void;
  readonly skeleton: ReactNode;
  readonly children: ReactNode;
};

function WidgetCard({ selected, onPointerDown, skeleton, children }: WidgetCardProps) {
  const { ref, seen } = useSeenInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`widget-card wrap${selected ? " is-selected" : ""}`}
      onPointerDown={onPointerDown}
    >
      {seen ? children : skeleton}
    </div>
  );
}

function DatasetDescription({ value, canEdit, onSave }: DatasetDescriptionProps) {
  const t = useT();
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
        placeholder={t("ds.descPlaceholder")}
        aria-label={t("ds.descAria")}
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
      title={t("ds.descEditHint")}
    >
      {value}
    </button>
  );
}
