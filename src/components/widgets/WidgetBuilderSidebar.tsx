import { useEffect, useMemo, useState } from "react";
import type {
  CurrencyCode,
  DateMode,
  DatasetColumn,
  FilterOp,
  SeriesMode,
  WidgetDefinition,
  WidgetFilter,
  WidgetType,
} from "../../types";
import {
  CURRENCY_LABEL,
  DATE_MODE_LABEL,
  FILTER_OP_LABEL,
  opsForColumn,
} from "../../types";
import { setScaleWarningHidden, useScaleWarningHidden } from "../../lib/prefs";
import BarChartIcon from "../../assets/icons/chart-bar.svg?react";
import LineChartIcon from "../../assets/icons/chart-line.svg?react";
import AreaChartIcon from "../../assets/icons/chart-area.svg?react";
import ComboChartIcon from "../../assets/icons/chart-combo.svg?react";
import PieChartIcon from "../../assets/icons/chart-pie.svg?react";
import KpiIcon from "../../assets/icons/gauge.svg?react";
import TableIcon from "../../assets/icons/table.svg?react";
import CalendarIcon from "../../assets/icons/calendar-clock.svg?react";
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

const TABLE_PAGE_SIZES = [25, 50, 100];

type Caps = {
  values: "none" | "one" | "many";
  group: boolean;
  series: boolean;
  stack: boolean;
  trend: boolean;
  combo: boolean;
  target: boolean;
  limit: boolean;
  money: boolean;
  unit: boolean;
  table: boolean;
  date: boolean;
  filter: boolean;
};

const NO_CAPS: Caps = {
  values: "none",
  group: false,
  series: false,
  stack: false,
  trend: false,
  combo: false,
  target: false,
  limit: false,
  money: false,
  unit: false,
  table: false,
  date: false,
  filter: false,
};

const CAPS: Record<WidgetType, Caps> = {
  kpi: { ...NO_CAPS, values: "one", target: true, money: true, unit: true, filter: true },
  bar: { ...NO_CAPS, values: "many", group: true, series: true, stack: true, limit: true, money: true, filter: true },
  line: { ...NO_CAPS, values: "many", group: true, series: true, trend: true, limit: true, money: true, filter: true },
  area: { ...NO_CAPS, values: "many", group: true, series: true, stack: true, limit: true, money: true, filter: true },
  combo: { ...NO_CAPS, values: "many", group: true, combo: true, limit: true, money: true, filter: true },
  pie: { ...NO_CAPS, values: "one", group: true, limit: true, money: true, filter: true },
  table: { ...NO_CAPS, table: true, limit: true, filter: true },
  date: { ...NO_CAPS, date: true },
};

const VISUAL_TYPES: {
  type: WidgetType;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}[] = [
  { type: "bar", label: "Bar", icon: BarChartIcon },
  { type: "line", label: "Line", icon: LineChartIcon },
  { type: "area", label: "Area", icon: AreaChartIcon },
  { type: "combo", label: "Combo", icon: ComboChartIcon },
  { type: "pie", label: "Pie", icon: PieChartIcon },
  { type: "kpi", label: "KPI", icon: KpiIcon },
  { type: "table", label: "Tabel", icon: TableIcon },
  { type: "date", label: "Tanggal", icon: CalendarIcon },
];

const SERIES_MODE_LABEL: Record<SeriesMode, string> = {
  grouped: "Berdampingan",
  stacked: "Bertumpuk",
  stacked100: "Bertumpuk 100%",
};

type Draft = {
  type: WidgetType;
  title: string;
  metric: WidgetDefinition["metric"];
  metricColumn: string;
  metricColumns: string[];
  groupByColumn: string;
  seriesColumn: string;
  seriesMode: SeriesMode;
  lineColumn: string;
  targetColumn: string;
  showTrendline: boolean;
  filters: WidgetFilter[];
  tableColumns: string[];
  dateMode: DateMode;
  targetDate: string;
  isCurrency: boolean;
  currency: CurrencyCode;
  unit: string;
  limit: number;
};

const BLANK: Draft = {
  type: "bar",
  title: "",
  metric: "SUM",
  metricColumn: "",
  metricColumns: [],
  groupByColumn: "",
  seriesColumn: "",
  seriesMode: "grouped",
  lineColumn: "",
  targetColumn: "",
  showTrendline: false,
  filters: [],
  tableColumns: [],
  dateMode: "yearRemaining",
  targetDate: "",
  isCurrency: false,
  currency: "IDR",
  unit: "",
  limit: 10,
};

function draftFrom(widget: WidgetDefinition | null): Draft {
  if (!widget) return BLANK;
  return {
    type: widget.type,
    title: widget.title,
    metric: widget.metric,
    metricColumn: widget.metricColumn ?? "",
    metricColumns:
      widget.metricColumns ?? (widget.metricColumn ? [widget.metricColumn] : []),
    groupByColumn: widget.groupByColumn ?? "",
    seriesColumn: widget.seriesColumn ?? "",
    seriesMode: widget.seriesMode ?? "grouped",
    lineColumn: widget.lineColumn ?? "",
    targetColumn: widget.targetColumn ?? "",
    showTrendline: widget.showTrendline ?? false,
    filters: widget.filters ?? [],
    tableColumns: widget.tableColumns ?? [],
    dateMode: widget.dateMode ?? "yearRemaining",
    targetDate: widget.targetDate ?? "",
    isCurrency: widget.isCurrency ?? false,
    currency: widget.currency ?? "IDR",
    unit: widget.unit ?? "",
    limit:
      widget.type === "table"
        ? nearestPageSize(widget.limit ?? 25)
        : widget.limit ?? 10,
  };
}

function nearestPageSize(value: number): number {
  return TABLE_PAGE_SIZES.reduce((best, size) =>
    Math.abs(size - value) < Math.abs(best - value) ? size : best
  );
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
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
  const [draft, setDraft] = useState<Draft>(BLANK);
  const warningHidden = useScaleWarningHidden();

  useEffect(() => {
    setDraft(draftFrom(editing));
  }, [editing]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const caps = CAPS[draft.type];
  const numericCols = useMemo(
    () => columns.filter((c) => c.type === "numeric"),
    [columns]
  );
  const dateCols = useMemo(() => columns.filter((c) => c.type === "date"), [columns]);
  const dimensionCols = useMemo(
    () => columns.filter((c) => c.type !== "numeric"),
    [columns]
  );

  const isCount = draft.metric === "COUNT";
  const picked = draft.metricColumns;
  const multiValue = caps.values === "many" && picked.length > 1;
  const labelOf = (name: string) =>
    columns.find((c) => c.name === name)?.label || name;

  function changeType(next: WidgetType) {
    setDraft((current) => {
      const nextCaps = CAPS[next];
      const keepMetric = columns.find((c) => c.name === current.metricColumn)?.type;
      return {
        ...current,
        type: next,
        metric: next === "pie" && current.metric === "SUM" ? "COUNT" : current.metric,
        metricColumn: keepMetric === "numeric" ? current.metricColumn : "",
        metricColumns: nextCaps.values === "many" ? current.metricColumns : [],
        groupByColumn: nextCaps.group ? current.groupByColumn : "",
        seriesColumn: nextCaps.series ? current.seriesColumn : "",
        targetColumn: nextCaps.target ? current.targetColumn : "",
        lineColumn: nextCaps.combo ? current.lineColumn : "",
        showTrendline: nextCaps.trend ? current.showTrendline : false,
        limit:
          next === "table"
            ? nearestPageSize(current.limit)
            : current.limit > 100
              ? 10
              : current.limit,
      };
    });
  }

  function updateFilter(index: number, patch: Partial<WidgetFilter>) {
    setDraft((current) => ({
      ...current,
      filters: current.filters.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }));
  }

  function changeFilterColumn(index: number, column: string) {
    const type = columns.find((c) => c.name === column)?.type ?? "category";
    const allowed = opsForColumn(type);
    const current = draft.filters[index]?.op;
    updateFilter(index, {
      column,
      op: current && allowed.includes(current) ? current : allowed[0],
      value: "",
    });
  }

  function addFilter() {
    setDraft((current) => ({
      ...current,
      filters: [...current.filters, { column: "", op: "eq", value: "" }],
    }));
  }

  function removeFilter(index: number) {
    setDraft((current) => ({
      ...current,
      filters: current.filters.filter((_, i) => i !== index),
    }));
  }

  function blocked(): string | null {
    if (!draft.title.trim()) return "Judul widget belum diisi.";

    if (caps.values === "one" && !isCount && !draft.metricColumn) {
      return "Kolom nilai belum dipilih.";
    }
    if (caps.values === "many" && !isCount && picked.length === 0) {
      return "Pilih minimal satu kolom nilai.";
    }
    if (caps.group && !draft.groupByColumn) return "Sumbu / kategori belum dipilih.";
    if (caps.combo && picked.length < 2) {
      return "Combo chart butuh minimal dua kolom nilai.";
    }
    if (caps.combo && !picked.includes(draft.lineColumn)) {
      return "Pilih kolom yang tampil sebagai garis.";
    }
    if (caps.table && draft.tableColumns.length === 0) {
      return "Pilih minimal satu kolom tabel.";
    }
    if (caps.date && draft.dateMode === "untilDate" && !draft.targetDate) {
      return "Tanggal target belum diisi.";
    }
    if (caps.date && draft.dateMode === "sinceColumn" && !draft.metricColumn) {
      return "Kolom tanggal belum dipilih.";
    }
    if (draft.filters.some((f) => f.column && f.value === "")) {
      return "Nilai filter belum diisi.";
    }
    return null;
  }

  const problem = blocked();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (problem) return;

    const money = caps.money && draft.isCurrency;
    const cleanFilters = draft.filters.filter((f) => f.column && f.value !== "");

    const widget: WidgetDefinition = {
      id: editing?.id ?? createId(),
      type: draft.type,
      title: draft.title.trim(),
      datasetId: editing?.datasetId ?? datasetId,
      metric: caps.date && draft.dateMode === "sinceColumn" ? "MAX" : draft.metric,
      metricColumn:
        caps.values === "one" && !isCount
          ? draft.metricColumn
          : caps.date && draft.dateMode === "sinceColumn"
            ? draft.metricColumn
            : undefined,
      metricColumns: caps.values === "many" && !isCount && picked.length > 0 ? picked : undefined,
      groupByColumn: caps.group ? draft.groupByColumn : undefined,
      seriesColumn: caps.series && !multiValue ? draft.seriesColumn || undefined : undefined,
      seriesMode: caps.stack ? draft.seriesMode : undefined,
      lineColumn: caps.combo ? draft.lineColumn : undefined,
      targetColumn:
        caps.target && !isCount ? draft.targetColumn || undefined : undefined,
      showTrendline: caps.trend ? draft.showTrendline : undefined,
      filters: caps.filter && cleanFilters.length > 0 ? cleanFilters : undefined,
      tableColumns: caps.table ? draft.tableColumns : undefined,
      dateMode: caps.date ? draft.dateMode : undefined,
      targetDate: caps.date && draft.dateMode === "untilDate" ? draft.targetDate : undefined,
      limit: caps.limit ? draft.limit : undefined,
      isCurrency: money,
      currency: money ? draft.currency : undefined,
      unit: caps.unit && !money ? draft.unit.trim() || undefined : undefined,
      layout: editing?.layout,
    };

    onSave(widget);
  }

  return (
    <aside
      className={`builder-sidebar${isOpen ? "" : " is-hidden"}`}
      aria-label="Panel visualisasi"
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
            <section className="builder-section">
              <span className="builder-section-title">Tipe Visual</span>
              <div className="builder-visual-gallery" role="radiogroup" aria-label="Pilih tipe visual">
                {VISUAL_TYPES.map((visual) => {
                  const Icon = visual.icon;
                  const active = draft.type === visual.type;
                  return (
                    <button
                      key={visual.type}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`visual-tile${active ? " is-active" : ""}`}
                      onClick={() => changeType(visual.type)}
                      title={visual.label}
                    >
                      <span className="visual-tile-icon">
                        <Icon width={16} height={16} />
                      </span>
                      <span className="visual-tile-label">{visual.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="builder-section">
              <span className="builder-section-title">Konfigurasi Data</span>

              <label className="builder-field">
                <span className="builder-label">Judul Widget</span>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Contoh: Produksi vs Rencana"
                  className="builder-input"
                  required
                />
              </label>

              {caps.values !== "none" && (
                <label className="builder-field">
                  <span className="builder-label">Agregasi</span>
                  <select
                    value={draft.metric}
                    onChange={(e) => set("metric", e.target.value as Draft["metric"])}
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

              {caps.values === "one" && !isCount && (
                <label className="builder-field">
                  <span className="builder-label">Kolom Nilai</span>
                  <select
                    value={draft.metricColumn}
                    onChange={(e) => set("metricColumn", e.target.value)}
                    className="builder-input"
                  >
                    <option value="">— Pilih kolom —</option>
                    {numericCols.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.label || c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {caps.values === "many" && !isCount && (
                <div className="builder-field">
                  <span className="builder-label">Kolom Nilai</span>
                  <p className="builder-field-desc">
                    Pilih dua kolom atau lebih untuk membandingkan, misalnya rencana
                    dan realisasi.
                  </p>
                  <div className="builder-checklist">
                    {numericCols.length === 0 ? (
                      <p className="builder-field-desc">Tidak ada kolom numerik.</p>
                    ) : (
                      numericCols.map((c) => (
                        <label key={c.name} className="builder-check">
                          <input
                            type="checkbox"
                            checked={picked.includes(c.name)}
                            onChange={() => {
                              const next = toggle(picked, c.name);
                              set("metricColumns", next);
                              if (draft.lineColumn && !next.includes(draft.lineColumn)) {
                                set("lineColumn", "");
                              }
                            }}
                          />
                          <span>{c.label || c.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              {caps.target && !isCount && (
                <label className="builder-field">
                  <span className="builder-label">Kolom Target (opsional)</span>
                  <select
                    value={draft.targetColumn}
                    onChange={(e) => set("targetColumn", e.target.value)}
                    className="builder-input"
                  >
                    <option value="">— Tanpa target —</option>
                    {numericCols
                      .filter((c) => c.name !== draft.metricColumn)
                      .map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.label || c.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}

              {caps.combo && picked.length > 0 && (
                <label className="builder-field">
                  <span className="builder-label">Tampil sebagai garis</span>
                  <select
                    value={draft.lineColumn}
                    onChange={(e) => set("lineColumn", e.target.value)}
                    className="builder-input"
                  >
                    <option value="">— Pilih kolom —</option>
                    {picked.map((name) => (
                      <option key={name} value={name}>
                        {labelOf(name)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {caps.group && (
                <label className="builder-field">
                  <span className="builder-label">Sumbu / Kategori</span>
                  <select
                    value={draft.groupByColumn}
                    onChange={(e) => set("groupByColumn", e.target.value)}
                    className="builder-input"
                  >
                    <option value="">— Pilih kolom —</option>
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.label || c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {caps.series && (
                <label className="builder-field">
                  <span className="builder-label">Pecah per Seri (opsional)</span>
                  <select
                    value={draft.seriesColumn}
                    onChange={(e) => set("seriesColumn", e.target.value)}
                    className="builder-input"
                    disabled={multiValue}
                  >
                    <option value="">— Satu seri saja —</option>
                    {dimensionCols
                      .filter((c) => c.name !== draft.groupByColumn)
                      .map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.label || c.name}
                        </option>
                      ))}
                  </select>
                  {multiValue && (
                    <p className="builder-field-desc">
                      Nonaktif karena seri sudah datang dari beberapa kolom nilai.
                    </p>
                  )}
                </label>
              )}

              {caps.stack && (
                <label className="builder-field">
                  <span className="builder-label">Susunan Seri</span>
                  <select
                    value={draft.seriesMode}
                    onChange={(e) => set("seriesMode", e.target.value as SeriesMode)}
                    className="builder-input"
                  >
                    {(Object.keys(SERIES_MODE_LABEL) as SeriesMode[]).map((mode) => (
                      <option key={mode} value={mode}>
                        {SERIES_MODE_LABEL[mode]}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {caps.trend && (
                <label className="builder-check">
                  <input
                    type="checkbox"
                    checked={draft.showTrendline}
                    onChange={(e) => set("showTrendline", e.target.checked)}
                  />
                  <span>Tampilkan garis tren</span>
                </label>
              )}


              {caps.table && (
                <div className="builder-field">
                  <span className="builder-label">Kolom yang Ditampilkan</span>
                  <div className="builder-checklist">
                    {columns.map((c) => (
                      <label key={c.name} className="builder-check">
                        <input
                          type="checkbox"
                          checked={draft.tableColumns.includes(c.name)}
                          onChange={() =>
                            set("tableColumns", toggle(draft.tableColumns, c.name))
                          }
                        />
                        <span>{c.label || c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {caps.date && (
                <label className="builder-field">
                  <span className="builder-label">Jenis Hitungan</span>
                  <select
                    value={draft.dateMode}
                    onChange={(e) => set("dateMode", e.target.value as DateMode)}
                    className="builder-input"
                  >
                    {(Object.keys(DATE_MODE_LABEL) as DateMode[]).map((mode) => (
                      <option key={mode} value={mode}>
                        {DATE_MODE_LABEL[mode]}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {caps.date && draft.dateMode === "untilDate" && (
                <label className="builder-field">
                  <span className="builder-label">Tanggal Target</span>
                  <input
                    type="date"
                    value={draft.targetDate}
                    onChange={(e) => set("targetDate", e.target.value)}
                    className="builder-input"
                  />
                </label>
              )}

              {caps.date && draft.dateMode === "sinceColumn" && (
                <label className="builder-field">
                  <span className="builder-label">Kolom Tanggal</span>
                  <select
                    value={draft.metricColumn}
                    onChange={(e) => set("metricColumn", e.target.value)}
                    className="builder-input"
                  >
                    <option value="">— Pilih kolom —</option>
                    {dateCols.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.label || c.name}
                      </option>
                    ))}
                  </select>
                  {dateCols.length === 0 && (
                    <p className="builder-field-desc">
                      Dataset ini tidak punya kolom bertipe tanggal.
                    </p>
                  )}
                </label>
              )}

              {caps.limit && (
                <label className="builder-field">
                  <span className="builder-label">
                    {caps.table ? "Baris per Halaman" : "Batas Kategori"}
                  </span>
                  <select
                    value={draft.limit}
                    onChange={(e) => set("limit", Number(e.target.value))}
                    className="builder-input"
                  >
                    {(caps.table ? TABLE_PAGE_SIZES : [5, 10, 15, 20, 50, 100]).map(
                      (n) => (
                        <option key={n} value={n}>
                          {caps.table ? `${n} baris per halaman` : `Top ${n}`}
                        </option>
                      )
                    )}
                  </select>
                </label>
              )}
            </section>

            {caps.filter && (
              <section className="builder-section">
                <span className="builder-section-title">Filter</span>

                {draft.filters.length === 0 && (
                  <p className="builder-field-desc">
                    Tanpa filter, widget memakai seluruh baris dataset.
                  </p>
                )}

                {draft.filters.map((filter, index) => {
                  const column = columns.find((c) => c.name === filter.column);
                  const allowed = opsForColumn(column?.type ?? "category");
                  const inputType =
                    column?.type === "date"
                      ? "date"
                      : column?.type === "numeric"
                        ? "number"
                        : "text";

                  return (
                    <div key={index} className="builder-filter">
                      <div className="builder-filter-row">
                        <select
                          value={filter.column}
                          onChange={(e) => changeFilterColumn(index, e.target.value)}
                          className="builder-input"
                          aria-label="Kolom filter"
                        >
                          <option value="">— Pilih kolom —</option>
                          {columns.map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.label || c.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="builder-filter-remove"
                          onClick={() => removeFilter(index)}
                          aria-label="Hapus filter ini"
                          title="Hapus filter ini"
                        >
                          <TrashIcon width={13} height={13} />
                        </button>
                      </div>

                      <div className="builder-filter-row">
                        <select
                          value={filter.op}
                          onChange={(e) =>
                            updateFilter(index, { op: e.target.value as FilterOp })
                          }
                          className="builder-input builder-filter-op"
                          disabled={!filter.column}
                          aria-label="Operator filter"
                        >
                          {allowed.map((op) => (
                            <option key={op} value={op}>
                              {FILTER_OP_LABEL[op]}
                            </option>
                          ))}
                        </select>
                        <input
                          type={inputType}
                          value={filter.value}
                          onChange={(e) => updateFilter(index, { value: e.target.value })}
                          className="builder-input"
                          placeholder="Nilai"
                          disabled={!filter.column}
                          aria-label="Nilai filter"
                        />
                      </div>
                    </div>
                  );
                })}

                <button type="button" className="builder-filter-add" onClick={addFilter}>
                  + Tambah filter
                </button>
              </section>
            )}

            {(caps.money || caps.unit) && (
              <section className="builder-section">
                <span className="builder-section-title">Format Tampilan</span>

                {caps.money && (
                  <label className="builder-check">
                    <input
                      type="checkbox"
                      checked={draft.isCurrency}
                      onChange={(e) => set("isCurrency", e.target.checked)}
                    />
                    <span>Format sebagai mata uang</span>
                  </label>
                )}

                {caps.money && draft.isCurrency && (
                  <div className="builder-dependent-field">
                    <label className="builder-field">
                      <span className="builder-label">Mata Uang</span>
                      <select
                        value={draft.currency}
                        onChange={(e) => set("currency", e.target.value as CurrencyCode)}
                        className="builder-input"
                      >
                        {(Object.keys(CURRENCY_LABEL) as CurrencyCode[]).map((code) => (
                          <option key={code} value={code}>
                            {CURRENCY_LABEL[code]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                {caps.unit && !draft.isCurrency && (
                  <label className="builder-field">
                    <span className="builder-label">Satuan (opsional)</span>
                    <input
                      type="text"
                      value={draft.unit}
                      onChange={(e) => set("unit", e.target.value)}
                      placeholder="Contoh: Jam, Ton, Unit"
                      className="builder-input"
                    />
                  </label>
                )}
              </section>
            )}

            <section className="builder-section">
              <span className="builder-section-title">Preferensi Semua Widget</span>
              <label className="builder-check">
                <input
                  type="checkbox"
                  checked={warningHidden}
                  onChange={(e) => setScaleWarningHidden(e.target.checked)}
                />
                <span>Sembunyikan peringatan skala</span>
              </label>
              <p className="builder-field-desc">
                Peringatan muncul saat satu seri terlalu kecil untuk terlihat di sumbu
                bersama. Berlaku untuk seluruh widget dan tersimpan di perangkat ini.
              </p>
            </section>
          </div>

          <div className="builder-sidebar-footer">
            {problem && <p className="builder-problem">{problem}</p>}

            <div className="builder-footer-row">
              <button type="submit" className="btn-primary" disabled={problem !== null}>
                {editing ? "Perbarui Widget" : "+ Tambah Widget"}
              </button>

              <button
                type="button"
                className="btn-ghost"
                onClick={() => setDraft(draftFrom(editing))}
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
