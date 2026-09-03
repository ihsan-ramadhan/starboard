import { useState, useEffect, useRef } from "react";
import type { DatasetColumn, WidgetDefinition, WidgetType } from "../../types";
import { WIDGET_TYPE_LABEL } from "../../types";
export type WidgetBuilderModalProps = {
  readonly isOpen: boolean;
  readonly columns: readonly DatasetColumn[];
  readonly datasetId: string;
  readonly onSave: (widget: WidgetDefinition) => void;
  readonly onCancel: () => void;
  readonly editing?: WidgetDefinition | null;
};

const METRICS = ["SUM", "AVG", "COUNT", "MIN", "MAX"] as const;

function metricColumnFilter(widgetType: WidgetType): (col: DatasetColumn) => boolean {
  if (widgetType === "kpi" || widgetType === "bar" || widgetType === "line") {
    return (col) => col.type === "numeric";
  }
  return () => true;
}

function groupColumnFilter(widgetType: WidgetType): (col: DatasetColumn) => boolean {
  if (widgetType === "kpi") {
    return () => false;
  }
  return (col) => col.type === "category" || col.type === "date" || col.type === "numeric";
}

function createId(): string {
  return `w_${crypto.randomUUID()}`;
}

export default function WidgetBuilderModal({
  isOpen,
  columns,
  datasetId,
  onSave,
  onCancel,
  editing = null,
}: WidgetBuilderModalProps) {
  const [widgetType, setWidgetType] = useState<WidgetType>("kpi");
  const [title, setTitle] = useState("");
  const [metric, setMetric] = useState<WidgetDefinition["metric"]>("SUM");
  const [metricColumn, setMetricColumn] = useState("");
  const [groupByColumn, setGroupByColumn] = useState("");
  const [isCurrency, setIsCurrency] = useState(false);
  const [unit, setUnit] = useState("");
  const [limit, setLimit] = useState<number>(10);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && isOpen && !dialog.open) {
      dialog.showModal();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (editing) {
        setWidgetType(editing.type);
        setTitle(editing.title);
        setMetric(editing.metric);
        setMetricColumn(editing.metricColumn ?? "");
        setGroupByColumn(editing.groupByColumn ?? "");
        setIsCurrency(editing.isCurrency ?? false);
        setUnit(editing.unit ?? "");
        setLimit(editing.limit ?? 10);
      } else {
        setWidgetType("kpi");
        setTitle("");
        setMetric("SUM");
        setMetricColumn("");
        setGroupByColumn("");
        setIsCurrency(false);
        setUnit("");
        setLimit(10);
      }
    }
  }, [isOpen, editing]);

  if (!isOpen) return null;

  const metricCols = columns.filter(metricColumnFilter(widgetType));
  const groupCols = columns.filter(groupColumnFilter(widgetType));
  const needsMetricColumn = widgetType === "kpi" || widgetType === "bar" || widgetType === "line";
  const needsGroup = widgetType === "bar" || widgetType === "line" || widgetType === "pie";
  const isCurrencyRelevant = widgetType === "kpi" || widgetType === "bar" || widgetType === "line";
  const noMetricOption = metric === "COUNT" || widgetType === "pie";

  function resetSelectionsForType(nextType: WidgetType) {
    const needNewMetric =
      (nextType === "kpi" || nextType === "bar" || nextType === "line");
    const needNewGroup = nextType === "bar" || nextType === "line" || nextType === "pie";

    if (nextType === "pie") {
      setMetric("COUNT");
    }
    if (needNewMetric && metricColumn) {
      const col = columns.find((c) => c.name === metricColumn);
      if (col?.type !== "numeric") {
        setMetricColumn("");
      }
    }
    if (!needNewMetric) {
      setMetricColumn("");
    }
    if (!needNewGroup) {
      setGroupByColumn("");
    }
    if (metric === "COUNT" && !needNewMetric) {
      setMetric("SUM");
    }
  }

  function handleTypeChange(nextType: WidgetType) {
    setWidgetType(nextType);
    resetSelectionsForType(nextType);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (needsMetricColumn && !noMetricOption && !metricColumn) return;
    if (needsGroup && !groupByColumn) return;

    const widget: WidgetDefinition = {
      id: editing?.id ?? createId(),
      type: widgetType,
      title: title.trim(),
      datasetId: editing?.datasetId ?? datasetId,
      metric,
      metricColumn: noMetricOption ? undefined : metricColumn || undefined,
      groupByColumn: needsGroup ? groupByColumn || undefined : undefined,
      limit: widgetType === "kpi" ? undefined : limit,
      isCurrency: isCurrencyRelevant ? isCurrency : false,
      unit: unit || undefined,
    };

    onSave(widget);
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal-native builder-modal"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <form
        className="modal-card"
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <h3 className="modal-title">
            {editing ? "Ubah Widget" : "Tambah Widget Baru"}
          </h3>
        </div>

        <div className="builder-body">
          <label className="builder-field">
            <span className="builder-label">Tipe Widget</span>
            <select
              value={widgetType}
              onChange={(e) => handleTypeChange(e.target.value as WidgetType)}
              className="builder-input"
            >
              {(Object.keys(WIDGET_TYPE_LABEL) as WidgetType[]).map((type) => (
                <option key={type} value={type}>
                  {WIDGET_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </label>

          <label className="builder-field">
            <span className="builder-label">Judul Widget</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Total Biaya per Aktivitas"
              className="builder-input"
              required
              autoFocus
            />
          </label>

          {needsMetricColumn && (
            <label className="builder-field">
              <span className="builder-label">Agregasi</span>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as WidgetDefinition["metric"])}
                className="builder-input"
              >
                {METRICS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          )}

          {needsMetricColumn && metric !== "COUNT" && (
            <label className="builder-field">
              <span className="builder-label">Kolom Metrik (Numeric)</span>
              <select
                value={metricColumn}
                onChange={(e) => setMetricColumn(e.target.value)}
                className="builder-input"
                required
              >
                <option value="">— Pilih kolom —</option>
                {metricCols.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.label || c.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {needsGroup && (
            <label className="builder-field">
              <span className="builder-label">Grup Berdasarkan</span>
              <select
                value={groupByColumn}
                onChange={(e) => setGroupByColumn(e.target.value)}
                className="builder-input"
                required
              >
                <option value="">— Pilih kolom —</option>
                {groupCols.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.label || c.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {needsGroup && (
            <label className="builder-field">
              <span className="builder-label">Jumlah Maksimal Data (Limit)</span>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="builder-input"
              >
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
                <option value={15}>Top 15</option>
                <option value={20}>Top 20</option>
                <option value={50}>Top 50</option>
                <option value={100}>Semua (Max 100)</option>
              </select>
            </label>
          )}

          {isCurrencyRelevant && (
            <label className="builder-check">
              <input
                type="checkbox"
                checked={isCurrency}
                onChange={(e) => setIsCurrency(e.target.checked)}
              />
              <span>Format sebagai mata uang (Rp)</span>
            </label>
          )}

          {widgetType === "kpi" && !isCurrency && (
            <label className="builder-field">
              <span className="builder-label">Satuan (opsional)</span>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Contoh: Jam"
                className="builder-input"
              />
            </label>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-ghost-sm" onClick={onCancel}>
            Batal
          </button>
          <button
            type="submit"
            className="btn-primary"
          >
            {editing ? "Simpan Perubahan" : "Tambah Widget"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
