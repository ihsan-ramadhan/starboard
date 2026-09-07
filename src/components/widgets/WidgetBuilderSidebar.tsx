import { useState, useEffect } from "react";
import type {
  CurrencyCode,
  DatasetColumn,
  WidgetDefinition,
  WidgetType,
} from "../../types";
import { CURRENCY_LABEL } from "../../types";
import BarChartIcon from "../../assets/icons/chart-bar.svg?react";
import LineChartIcon from "../../assets/icons/chart-line.svg?react";
import PieChartIcon from "../../assets/icons/chart-pie.svg?react";
import KpiIcon from "../../assets/icons/chart-kpi.svg?react";
import TrashIcon from "../../assets/icons/trash.svg?react";

export type WidgetBuilderSidebarProps = {
  readonly isOpen: boolean;
  readonly columns: readonly DatasetColumn[];
  readonly datasetId: string;
  readonly editing: WidgetDefinition | null;
  readonly onSave: (widget: WidgetDefinition) => void;
  readonly onDeselect: () => void;
  readonly onDelete?: (widget: WidgetDefinition) => void;
};

const METRICS = ["SUM", "AVG", "COUNT", "MIN", "MAX"] as const;

// ponytail: 4 core chart types cover operational dashboards; add combo/scatter when requested.
const VISUAL_TYPES: {
  type: WidgetType;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}[] = [
  { type: "bar", label: "Bar Chart", icon: BarChartIcon },
  { type: "line", label: "Line Chart", icon: LineChartIcon },
  { type: "pie", label: "Pie Chart", icon: PieChartIcon },
  { type: "kpi", label: "KPI Card", icon: KpiIcon },
];

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

export default function WidgetBuilderSidebar({
  isOpen,
  columns,
  datasetId,
  editing,
  onSave,
  onDeselect,
  onDelete,
}: WidgetBuilderSidebarProps) {
  const [widgetType, setWidgetType] = useState<WidgetType>("bar");
  const [title, setTitle] = useState("");
  const [metric, setMetric] = useState<WidgetDefinition["metric"]>("SUM");
  const [metricColumn, setMetricColumn] = useState("");
  const [groupByColumn, setGroupByColumn] = useState("");
  const [isCurrency, setIsCurrency] = useState(false);
  const [currency, setCurrency] = useState<CurrencyCode>("IDR");
  const [unit, setUnit] = useState("");
  const [limit, setLimit] = useState<number>(10);

  useEffect(() => {
    if (editing) {
      setWidgetType(editing.type);
      setTitle(editing.title);
      setMetric(editing.metric);
      setMetricColumn(editing.metricColumn ?? "");
      setGroupByColumn(editing.groupByColumn ?? "");
      setIsCurrency(editing.isCurrency ?? false);
      setCurrency(editing.currency ?? "IDR");
      setUnit(editing.unit ?? "");
      setLimit(editing.limit ?? 10);
    } else {
      setWidgetType("bar");
      setTitle("");
      setMetric("SUM");
      setMetricColumn("");
      setGroupByColumn("");
      setIsCurrency(false);
      setCurrency("IDR");
      setUnit("");
      setLimit(10);
    }
  }, [editing]);

  const metricCols = columns.filter(metricColumnFilter(widgetType));
  const groupCols = columns.filter(groupColumnFilter(widgetType));
  const needsMetricColumn = widgetType === "kpi" || widgetType === "bar" || widgetType === "line";
  const needsGroup = widgetType === "bar" || widgetType === "line" || widgetType === "pie";
  const isCurrencyRelevant = widgetType === "kpi" || widgetType === "bar" || widgetType === "line";
  const noMetricOption = metric === "COUNT" || widgetType === "pie";

  function handleTypeChange(nextType: WidgetType) {
    setWidgetType(nextType);
    const needNewMetric = nextType === "kpi" || nextType === "bar" || nextType === "line";
    const needNewGroup = nextType === "bar" || nextType === "line" || nextType === "pie";

    if (nextType === "pie") {
      setMetric("COUNT");
    } else if (metric === "COUNT") {
      setMetric("SUM");
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
  }

  function handleReset() {
    if (editing) {
      setWidgetType(editing.type);
      setTitle(editing.title);
      setMetric(editing.metric);
      setMetricColumn(editing.metricColumn ?? "");
      setGroupByColumn(editing.groupByColumn ?? "");
      setIsCurrency(editing.isCurrency ?? false);
      setCurrency(editing.currency ?? "IDR");
      setUnit(editing.unit ?? "");
      setLimit(editing.limit ?? 10);
    } else {
      setWidgetType("bar");
      setTitle("");
      setMetric("SUM");
      setMetricColumn("");
      setGroupByColumn("");
      setIsCurrency(false);
      setCurrency("IDR");
      setUnit("");
      setLimit(10);
    }
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
      currency: isCurrencyRelevant && isCurrency ? currency : undefined,
      unit: widgetType === "kpi" && !isCurrency ? unit.trim() || undefined : undefined,
      layout: editing?.layout,
    };

    onSave(widget);
  }

  return (
    <aside
      className={`builder-sidebar${isOpen ? "" : " is-hidden"}`}
      aria-label="Panel Visualisasi Power BI"
      aria-hidden={!isOpen}
    >
      <div className="builder-sidebar-inner">
        <div className="builder-sidebar-header">
          <div className="builder-sidebar-title-group">
            <h2 className="builder-sidebar-title">Visualisasi</h2>
          </div>

          {editing && (
            <div className="builder-sidebar-header-actions">
              <button
                type="button"
                className="builder-sidebar-text-btn"
                onClick={onDeselect}
                title="Batalkan pilihan dan buat widget baru"
              >
                + Buat Baru
              </button>
            </div>
          )}
        </div>

        <form className="builder-sidebar-form" onSubmit={handleSubmit}>
        <div className="builder-sidebar-body">
          {/* Section: Visual Gallery */}
          <section className="builder-section">
            <span className="builder-section-title">Tipe Visual</span>
            <div className="builder-visual-gallery" role="radiogroup" aria-label="Pilih tipe chart">
              {VISUAL_TYPES.map((v) => {
                const Icon = v.icon;
                const active = widgetType === v.type;
                return (
                  <button
                    key={v.type}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`visual-tile${active ? " is-active" : ""}`}
                    onClick={() => handleTypeChange(v.type)}
                    title={v.label}
                  >
                    <span className="visual-tile-icon">
                      <Icon width={16} height={16} />
                    </span>
                    <span className="visual-tile-label">{v.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section: Data Configuration */}
          <section className="builder-section">
            <span className="builder-section-title">Konfigurasi Data</span>

            <label className="builder-field">
              <span className="builder-label">Judul Widget</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Total Biaya Operasional"
                className="builder-input"
                required
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
                <span className="builder-label">Kolom Nilai (Numerik)</span>
                <select
                  value={metricColumn}
                  onChange={(e) => setMetricColumn(e.target.value)}
                  className="builder-input"
                  required
                >
                  {metricCols.length === 0 ? (
                    <option value="" disabled>
                      — Tidak ada kolom numerik —
                    </option>
                  ) : (
                    <>
                      <option value="">— Pilih kolom —</option>
                      {metricCols.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.label || c.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </label>
            )}

            {needsGroup && (
              <label className="builder-field">
                <span className="builder-label">Sumbu / Kategori</span>
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
                <span className="builder-label">Batas Baris (Limit)</span>
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
                  <option value={100}>Semua (Maks 100)</option>
                </select>
              </label>
            )}
          </section>

          {/* Section: Display formatting */}
          <section className="builder-section">
            <span className="builder-section-title">Format Tampilan</span>

            {isCurrencyRelevant && (
              <label className="builder-check">
                <input
                  type="checkbox"
                  checked={isCurrency}
                  onChange={(e) => setIsCurrency(e.target.checked)}
                />
                <span>Format sebagai mata uang</span>
              </label>
            )}

            {isCurrencyRelevant && isCurrency && (
              <label className="builder-field">
                <span className="builder-label">Mata Uang</span>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className="builder-input"
                >
                  {(Object.keys(CURRENCY_LABEL) as CurrencyCode[]).map((code) => (
                    <option key={code} value={code}>
                      {CURRENCY_LABEL[code]}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {widgetType === "kpi" && !isCurrency && (
              <label className="builder-field">
                <span className="builder-label">Satuan (opsional)</span>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Contoh: Jam, Ton, Unit"
                  className="builder-input"
                />
              </label>
            )}

            {!isCurrencyRelevant && (
              <p className="builder-field-desc">
                Tipe visual ini otomatis menampilkan proporsi data dan tidak memerlukan format mata uang.
              </p>
            )}
          </section>
        </div>

        {/* Sticky footer actions */}
        <div className="builder-sidebar-footer">
          <div className="builder-footer-row">
            <button
              type="submit"
              className="btn-primary"
            >
              {editing ? "Perbarui Widget" : "+ Tambah Widget"}
            </button>

            <button
              type="button"
              className="btn-ghost"
              onClick={handleReset}
              title={editing ? "Kembalikan ke pengaturan awal widget" : "Bersihkan formulir"}
            >
              Reset
            </button>

            {editing && (
              <button
                type="button"
                className="btn-ghost"
                onClick={onDeselect}
                title="Batal mengubah widget"
              >
                Batal
              </button>
            )}
          </div>

          {editing && onDelete && (
            <button
              type="button"
              className="btn-danger-outline btn-sidebar-delete"
              onClick={() => onDelete(editing)}
            >
              <TrashIcon width={14} height={14} />
              Hapus Widget
            </button>
          )}
        </div>
      </form>
      </div>
    </aside>
  );
}
