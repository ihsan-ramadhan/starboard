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
  CURRENCY_SHORT_KEY,
  DATE_MODE_KEY,
  FILTER_OP_KEY,
  GOOD_DIRECTION_KEY,
  defaultSortBy,
  opsForColumn,
  SORT_BY_KEY,
  VALUE_FORMAT_KEY,
  type GoodDirection,
  type SortBy,
  type ValueFormat,
} from "../../types";
import { useT, type TKey } from "../../lib/i18n";
import BarChartIcon from "../../assets/icons/chart-bar.svg?react";
import LineChartIcon from "../../assets/icons/chart-line.svg?react";
import AreaChartIcon from "../../assets/icons/chart-area.svg?react";
import ComboChartIcon from "../../assets/icons/chart-combo.svg?react";
import PieChartIcon from "../../assets/icons/chart-pie.svg?react";
import KpiIcon from "../../assets/icons/chart-kpi.svg?react";
import GaugeIcon from "../../assets/icons/gauge.svg?react";
import BarHChartIcon from "../../assets/icons/chart-bar-h.svg?react";
import HeatmapIcon from "../../assets/icons/chart-heatmap.svg?react";
import ScatterIcon from "../../assets/icons/chart-scatter.svg?react";
import TreemapIcon from "../../assets/icons/chart-treemap.svg?react";
import TableIcon from "../../assets/icons/table.svg?react";
import CalendarIcon from "../../assets/icons/calendar-clock.svg?react";
import HeadingIcon from "../../assets/icons/heading.svg?react";
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
  gauge: { ...NO_CAPS, values: "one", target: true, money: true, unit: true, filter: true },
  bar: { ...NO_CAPS, values: "many", group: true, series: true, stack: true, limit: true, money: true, filter: true },
  barh: { ...NO_CAPS, values: "many", group: true, series: true, stack: true, limit: true, money: true, filter: true },
  line: { ...NO_CAPS, values: "many", group: true, series: true, trend: true, limit: true, money: true, filter: true },
  area: { ...NO_CAPS, values: "many", group: true, series: true, stack: true, limit: true, money: true, filter: true },
  combo: { ...NO_CAPS, values: "many", group: true, combo: true, limit: true, money: true, filter: true },
  pie: { ...NO_CAPS, values: "one", group: true, limit: true, money: true, filter: true },
  treemap: { ...NO_CAPS, values: "one", group: true, limit: true, money: true, unit: true, filter: true },
  heatmap: { ...NO_CAPS, values: "one", group: true, series: true, limit: true, money: true, unit: true, filter: true },
  scatter: { ...NO_CAPS, values: "many", group: true, limit: true, money: true, unit: true, filter: true },
  table: { ...NO_CAPS, table: true, limit: true, filter: true },
  date: { ...NO_CAPS, date: true },
  section: { ...NO_CAPS },
};

const VISUAL_TYPES: {
  type: WidgetType;
  labelKey: TKey;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}[] = [
  { type: "bar", labelKey: "visual.bar", icon: BarChartIcon },
  { type: "barh", labelKey: "visual.barh", icon: BarHChartIcon },
  { type: "line", labelKey: "visual.line", icon: LineChartIcon },
  { type: "area", labelKey: "visual.area", icon: AreaChartIcon },
  { type: "combo", labelKey: "visual.combo", icon: ComboChartIcon },
  { type: "pie", labelKey: "visual.pie", icon: PieChartIcon },
  { type: "treemap", labelKey: "visual.treemap", icon: TreemapIcon },
  { type: "heatmap", labelKey: "visual.heatmap", icon: HeatmapIcon },
  { type: "scatter", labelKey: "visual.scatter", icon: ScatterIcon },
  { type: "kpi", labelKey: "visual.kpi", icon: KpiIcon },
  { type: "gauge", labelKey: "visual.gauge", icon: GaugeIcon },
  { type: "table", labelKey: "visual.table", icon: TableIcon },
  { type: "date", labelKey: "visual.date", icon: CalendarIcon },
  { type: "section", labelKey: "visual.section", icon: HeadingIcon },
];

const SERIES_MODE_KEY: Record<SeriesMode, TKey> = {
  grouped: "seriesMode.grouped",
  stacked: "seriesMode.stacked",
  stacked100: "seriesMode.stacked100",
};

type DraftFilter = WidgetFilter & { readonly id: string };

type Draft = {
  type: WidgetType;
  title: string;
  description: string;
  metric: WidgetDefinition["metric"];
  metricColumn: string;
  metricColumns: string[];
  groupByColumn: string;
  seriesColumn: string;
  seriesMode: SeriesMode;
  sortBy: SortBy;
  lineColumns: string[];
  valueFormats: Record<string, ValueFormat>;
  valueCurrencies: Record<string, CurrencyCode>;
  targetColumn: string;
  goodDirection: GoodDirection;
  showTrendline: boolean;
  filters: DraftFilter[];
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
  description: "",
  metric: "SUM",
  metricColumn: "",
  metricColumns: [],
  groupByColumn: "",
  seriesColumn: "",
  seriesMode: "grouped",
  sortBy: "value",
  lineColumns: [],
  valueFormats: {},
  valueCurrencies: {},
  targetColumn: "",
  goodDirection: "higher",
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

function legacyFormats(w: WidgetDefinition): Record<string, ValueFormat> {
  const column = w.metricColumn ?? w.metricColumns?.[0];
  if (!w.isCurrency || !column) return {};
  return { [column]: "currency" };
}

function legacyCurrencies(w: WidgetDefinition): Record<string, CurrencyCode> {
  const column = w.metricColumn ?? w.metricColumns?.[0];
  if (!w.isCurrency || !column) return {};
  return { [column]: w.currency ?? "IDR" };
}

function draftFrom(widget: WidgetDefinition | null): Draft {
  if (!widget) return BLANK;
  return {
    type: widget.type,
    title: widget.title,
    description: widget.description ?? "",
    metric: widget.metric,
    metricColumn: widget.metricColumn ?? "",
    metricColumns:
      widget.metricColumns ?? (widget.metricColumn ? [widget.metricColumn] : []),
    groupByColumn: widget.groupByColumn ?? "",
    seriesColumn: widget.seriesColumn ?? "",
    seriesMode: widget.seriesMode ?? "grouped",
    sortBy: widget.sortBy ?? defaultSortBy(widget.type),
    lineColumns:
      widget.lineColumns ?? (widget.lineColumn ? [widget.lineColumn] : []),
    valueFormats: widget.valueFormats ?? legacyFormats(widget),
    valueCurrencies: widget.valueCurrencies ?? legacyCurrencies(widget),
    targetColumn: widget.targetColumn ?? "",
    goodDirection: widget.goodDirection ?? "higher",
    showTrendline: widget.showTrendline ?? false,
    filters: (widget.filters ?? []).map((f) => ({ ...f, id: createId() })),
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

function limitFor(type: WidgetType, current: number): number {
  if (type === "table") return nearestPageSize(current);
  return current > 100 ? 10 : current;
}

function nearestPageSize(value: number): number {
  return TABLE_PAGE_SIZES.reduce(
    (best, size) => (Math.abs(size - value) < Math.abs(best - value) ? size : best),
    TABLE_PAGE_SIZES[0]
  );
}

function filterInputType(type: DatasetColumn["type"] | undefined): string {
  if (type === "date") return "date";
  if (type === "numeric") return "number";
  return "text";
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function createId(): string {
  return `w_${crypto.randomUUID()}`;
}

type BuildContext = {
  readonly draft: Draft;
  readonly caps: Caps;
  readonly isCount: boolean;
  readonly picked: string[];
  readonly multiValue: boolean;
};

type ValidationRule = {
  readonly fails: (ctx: BuildContext) => boolean;
  readonly messageKey: TKey;
};

const VALIDATION_RULES: readonly ValidationRule[] = [
  {
    fails: ({ draft }) => !draft.title.trim(),
    messageKey: "validate.title",
  },
  {
    fails: ({ draft, caps, isCount }) =>
      caps.values === "one" && !isCount && !draft.metricColumn,
    messageKey: "validate.valueColumn",
  },
  {
    fails: ({ draft }) =>
      draft.type === "heatmap" && (!draft.groupByColumn || !draft.seriesColumn),
    messageKey: "validate.heatmapSeries",
  },
  {
    fails: ({ draft, isCount, picked }) =>
      draft.type === "scatter" && !isCount && picked.length !== 2,
    messageKey: "validate.scatterTwo",
  },
  {
    fails: ({ caps, isCount, picked }) =>
      caps.values === "many" && !isCount && picked.length === 0,
    messageKey: "validate.atLeastOneValue",
  },
  {
    fails: ({ draft, caps }) => caps.group && !draft.groupByColumn,
    messageKey: "validate.axis",
  },
  {
    fails: ({ caps, picked }) => caps.combo && picked.length < 2,
    messageKey: "validate.comboTwoValues",
  },
  {
    fails: ({ draft, caps, picked }) =>
      caps.combo &&
      (draft.lineColumns.filter((c) => picked.includes(c)).length === 0 ||
        picked.every((c) => draft.lineColumns.includes(c))),
    messageKey: "validate.lineColumns",
  },
  {
    fails: ({ draft, caps }) => caps.table && draft.tableColumns.length === 0,
    messageKey: "validate.tableColumn",
  },
  {
    fails: ({ draft, caps }) =>
      caps.date && draft.dateMode === "untilDate" && !draft.targetDate,
    messageKey: "validate.targetDate",
  },
  {
    fails: ({ draft, caps }) =>
      caps.date && draft.dateMode === "sinceColumn" && !draft.metricColumn,
    messageKey: "validate.dateColumn",
  },
  {
    fails: ({ draft }) => draft.filters.some((f) => f.column && f.value === ""),
    messageKey: "validate.filterValue",
  },
];

function metricFields(
  ctx: BuildContext
): Pick<WidgetDefinition, "metric" | "metricColumn" | "metricColumns"> {
  const { draft, caps, isCount, picked } = ctx;
  const sinceColumn = caps.date && draft.dateMode === "sinceColumn";
  const usesMetricColumn = (caps.values === "one" && !isCount) || sinceColumn;
  return {
    metric: sinceColumn ? "MAX" : draft.metric,
    metricColumn: usesMetricColumn ? draft.metricColumn : undefined,
    metricColumns:
      caps.values === "many" && !isCount && picked.length > 0 ? picked : undefined,
  };
}

function axisFields(
  ctx: BuildContext
): Pick<
  WidgetDefinition,
  | "groupByColumn"
  | "seriesColumn"
  | "seriesMode"
  | "sortBy"
  | "lineColumns"
  | "valueFormats"
  | "valueCurrencies"
  | "targetColumn"
  | "goodDirection"
  | "showTrendline"
> {
  const { draft, caps, isCount, multiValue } = ctx;
  const series = caps.series && !multiValue;
  const target = caps.target && !isCount;
  return {
    groupByColumn: caps.group ? draft.groupByColumn : undefined,
    seriesColumn: series ? draft.seriesColumn || undefined : undefined,
    seriesMode: caps.stack ? draft.seriesMode : undefined,
    sortBy: caps.group ? draft.sortBy : undefined,
    lineColumns: caps.combo ? draft.lineColumns : undefined,
    valueFormats:
      Object.keys(draft.valueFormats).length > 0 ? draft.valueFormats : undefined,
    valueCurrencies:
      Object.keys(draft.valueCurrencies).length > 0
        ? draft.valueCurrencies
        : undefined,
    targetColumn: target ? draft.targetColumn || undefined : undefined,
    goodDirection:
      target && draft.targetColumn ? draft.goodDirection : undefined,
    showTrendline: caps.trend ? draft.showTrendline : undefined,
  };
}

function contentFields(
  ctx: BuildContext,
  filters: WidgetFilter[]
): Pick<
  WidgetDefinition,
  | "filters"
  | "tableColumns"
  | "dateMode"
  | "targetDate"
  | "limit"
  | "isCurrency"
  | "currency"
  | "unit"
> {
  const { draft, caps } = ctx;
  const untilDate = caps.date && draft.dateMode === "untilDate";
  return {
    filters: caps.filter && filters.length > 0 ? filters : undefined,
    tableColumns: caps.table ? draft.tableColumns : undefined,
    dateMode: caps.date ? draft.dateMode : undefined,
    targetDate: untilDate ? draft.targetDate : undefined,
    limit: caps.limit ? draft.limit : undefined,
    isCurrency: undefined,
    currency: undefined,
    unit: caps.unit ? draft.unit.trim() || undefined : undefined,
  };
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
  const t = useT();
  const [draft, setDraft] = useState<Draft>(BLANK);

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
        goodDirection: nextCaps.target ? current.goodDirection : "higher",
        lineColumns: nextCaps.combo ? current.lineColumns : [],
        sortBy: defaultSortBy(next),
        showTrendline: nextCaps.trend ? current.showTrendline : false,
        limit: limitFor(next, current.limit),
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
      filters: [
        ...current.filters,
        { id: createId(), column: "", op: "eq", value: "" },
      ],
    }));
  }

  function removeFilter(index: number) {
    setDraft((current) => ({
      ...current,
      filters: current.filters.filter((_, i) => i !== index),
    }));
  }

  const buildContext: BuildContext = { draft, caps, isCount, picked, multiValue };

  const formatTargets = useMemo(() => {
    const names = picked.length > 0 ? picked : [draft.metricColumn];
    const extra = draft.targetColumn ? [draft.targetColumn] : [];
    return [...new Set([...names, ...extra])].filter(Boolean) as string[];
  }, [picked, draft.metricColumn, draft.targetColumn]);

  const problem =
    VALIDATION_RULES.find((rule) => rule.fails(buildContext))?.messageKey ?? null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (problem) return;

    const cleanFilters: WidgetFilter[] = draft.filters
      .filter((f) => f.column && f.value !== "")
      .map(({ column, op, value }) => ({ column, op, value }));

    onSave({
      id: editing?.id ?? createId(),
      type: draft.type,
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      datasetId: editing?.datasetId ?? datasetId,
      ...metricFields(buildContext),
      ...axisFields(buildContext),
      ...contentFields(buildContext, cleanFilters),
      layout: editing?.layout,
    });
  }

  return (
    <aside
      className={`builder-sidebar${isOpen ? "" : " is-hidden"}`}
      aria-label={t("builder.visualPanel")}
      aria-hidden={!isOpen}
    >
      <div className="builder-sidebar-inner">
        <div className="builder-sidebar-header">
          <div className="builder-sidebar-title-group">
            <h2 className="builder-sidebar-title">{t("builder.visualisation")}</h2>
          </div>

          {editing && (
            <div className="builder-sidebar-header-actions">
              <button
                type="button"
                className="builder-sidebar-text-btn"
                onClick={onDeselect}
                title={t("builder.newWidgetHint")}
              >
                + Buat Baru
              </button>
            </div>
          )}
        </div>

        <form className="builder-sidebar-form" onSubmit={handleSubmit}>
          <div className="builder-sidebar-body">
            <section className="builder-section">
              <span className="builder-section-title">{t("builder.visualType")}</span>
              <div className="builder-visual-gallery" role="radiogroup" aria-label={t("builder.pickVisualType")}>
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
                      title={t(visual.labelKey)}
                    >
                      <span className="visual-tile-icon">
                        <Icon width={16} height={16} />
                      </span>
                      <span className="visual-tile-label">{t(visual.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="builder-section">
              <span className="builder-section-title">{t("builder.dataConfig")}</span>

              <label className="builder-field">
                <span className="builder-label">{t("builder.widgetTitle")}</span>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder={t("builder.titlePlaceholder")}
                  className="builder-input"
                  required
                />
              </label>

              <label className="builder-field">
                <span className="builder-label">{t("builder.widgetDescription")}</span>
                <textarea
                  value={draft.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder={t("builder.descriptionPlaceholder")}
                  className="builder-input builder-textarea"
                  rows={2}
                  maxLength={280}
                />
                <p className="builder-field-desc">{t("builder.descriptionHint")}</p>
              </label>

              {caps.values !== "none" && (
                <label className="builder-field">
                  <span className="builder-label">{t("builder.aggregation")}</span>
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
                  <span className="builder-label">{t("builder.valueColumn")}</span>
                  <select
                    value={draft.metricColumn}
                    onChange={(e) => set("metricColumn", e.target.value)}
                    className="builder-input"
                  >
                    <option value="">{t("builder.pickColumn")}</option>
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
                  <span className="builder-label">{t("builder.valueColumn")}</span>
                  <p className="builder-field-desc">
                    {t("builder.multiValueDesc")}
                  </p>
                  <div className="builder-checklist">
                    {numericCols.length === 0 ? (
                      <p className="builder-field-desc">{t("builder.noNumericColumn")}</p>
                    ) : (
                      numericCols.map((c) => (
                        <label key={c.name} className="builder-check">
                          <input
                            type="checkbox"
                            checked={picked.includes(c.name)}
                            onChange={() => {
                              const next = toggle(picked, c.name);
                              set("metricColumns", next);
                              set(
                                "lineColumns",
                                draft.lineColumns.filter((n) => next.includes(n))
                              );
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
                  <span className="builder-label">{t("builder.targetColumn")}</span>
                  <select
                    value={draft.targetColumn}
                    onChange={(e) => set("targetColumn", e.target.value)}
                    className="builder-input"
                  >
                    <option value="">{t("builder.noTarget")}</option>
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

              {caps.target && !isCount && draft.targetColumn && (
                <label className="builder-field">
                  <span className="builder-label">{t("builder.goodDirection")}</span>
                  <select
                    value={draft.goodDirection}
                    onChange={(e) =>
                      set("goodDirection", e.target.value as GoodDirection)
                    }
                    className="builder-input"
                  >
                    <option value="higher">{t(GOOD_DIRECTION_KEY.higher)}</option>
                    <option value="lower">{t(GOOD_DIRECTION_KEY.lower)}</option>
                  </select>
                </label>
              )}

              {caps.combo && picked.length > 0 && (
                <div className="builder-field">
                  <span className="builder-label">{t("builder.asLines")}</span>
                  <p className="builder-field-desc">{t("builder.asLinesDesc")}</p>
                  <div className="builder-checklist">
                    {picked.map((name) => (
                      <label key={name} className="builder-check">
                        <input
                          type="checkbox"
                          checked={draft.lineColumns.includes(name)}
                          onChange={() =>
                            set("lineColumns", toggle(draft.lineColumns, name))
                          }
                        />
                        <span>{labelOf(name)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {caps.group && draft.groupByColumn && (
                <label className="builder-field">
                  <span className="builder-label">{t("builder.sortBy")}</span>
                  <select
                    value={draft.sortBy}
                    onChange={(e) => set("sortBy", e.target.value as SortBy)}
                    className="builder-input"
                  >
                    {(Object.keys(SORT_BY_KEY) as SortBy[]).map((k) => (
                      <option key={k} value={k}>
                        {t(SORT_BY_KEY[k])}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {caps.group && (
                <label className="builder-field">
                  <span className="builder-label">{t("builder.axisCategory")}</span>
                  <select
                    value={draft.groupByColumn}
                    onChange={(e) => set("groupByColumn", e.target.value)}
                    className="builder-input"
                  >
                    <option value="">{t("builder.pickColumn")}</option>
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
                  <span className="builder-label">{t("builder.splitSeries")}</span>
                  <select
                    value={draft.seriesColumn}
                    onChange={(e) => set("seriesColumn", e.target.value)}
                    className="builder-input"
                    disabled={multiValue}
                  >
                    <option value="">{t("builder.oneSeries")}</option>
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
                      {t("builder.seriesDisabled")}
                    </p>
                  )}
                </label>
              )}

              {caps.stack && (
                <label className="builder-field">
                  <span className="builder-label">{t("builder.seriesLayout")}</span>
                  <select
                    value={draft.seriesMode}
                    onChange={(e) => set("seriesMode", e.target.value as SeriesMode)}
                    className="builder-input"
                  >
                    {(Object.keys(SERIES_MODE_KEY) as SeriesMode[]).map((mode) => (
                      <option key={mode} value={mode}>
                        {t(SERIES_MODE_KEY[mode])}
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
                  <span>{t("builder.showTrendline")}</span>
                </label>
              )}


              {caps.table && (
                <div className="builder-field">
                  <span className="builder-label">{t("builder.shownColumns")}</span>
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
                  <span className="builder-label">{t("builder.countKind")}</span>
                  <select
                    value={draft.dateMode}
                    onChange={(e) => set("dateMode", e.target.value as DateMode)}
                    className="builder-input"
                  >
                    {(Object.keys(DATE_MODE_KEY) as DateMode[]).map((mode) => (
                      <option key={mode} value={mode}>
                        {t(DATE_MODE_KEY[mode])}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {caps.date && draft.dateMode === "untilDate" && (
                <label className="builder-field">
                  <span className="builder-label">{t("builder.targetDate")}</span>
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
                  <span className="builder-label">{t("builder.dateColumn")}</span>
                  <select
                    value={draft.metricColumn}
                    onChange={(e) => set("metricColumn", e.target.value)}
                    className="builder-input"
                  >
                    <option value="">{t("builder.pickColumn")}</option>
                    {dateCols.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.label || c.name}
                      </option>
                    ))}
                  </select>
                  {dateCols.length === 0 && (
                    <p className="builder-field-desc">
                      {t("builder.noDateColumn")}
                    </p>
                  )}
                </label>
              )}

              {caps.limit && (
                <label className="builder-field">
                  <span className="builder-label">
                    {caps.table ? t("builder.rowsPerPage") : t("builder.categoryLimit")}
                  </span>
                  <select
                    value={draft.limit}
                    onChange={(e) => set("limit", Number(e.target.value))}
                    className="builder-input"
                  >
                    {(caps.table ? TABLE_PAGE_SIZES : [5, 10, 15, 20, 50, 100]).map(
                      (n) => (
                        <option key={n} value={n}>
                          {caps.table ? t("builder.rowsPerPageOption", { n }) : t("builder.topN", { n })}
                        </option>
                      )
                    )}
                  </select>
                </label>
              )}
            </section>

            {caps.filter && (
              <section className="builder-section">
                <span className="builder-section-title">{t("builder.filters")}</span>

                {draft.filters.length === 0 && (
                  <p className="builder-field-desc">
                    {t("builder.noFilterDesc")}
                  </p>
                )}

                {draft.filters.map((filter, index) => {
                  const column = columns.find((c) => c.name === filter.column);
                  const allowed = opsForColumn(column?.type ?? "category");
                  const inputType = filterInputType(column?.type);

                  return (
                    <div key={filter.id} className="builder-filter">
                      <div className="builder-filter-row">
                        <select
                          value={filter.column}
                          onChange={(e) => changeFilterColumn(index, e.target.value)}
                          className="builder-input"
                          aria-label={t("builder.filterColumn")}
                        >
                          <option value="">{t("builder.pickColumn")}</option>
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
                          aria-label={t("builder.removeFilter")}
                          title={t("builder.removeFilter")}
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
                          aria-label={t("builder.filterOperator")}
                        >
                          {allowed.map((op) => (
                            <option key={op} value={op}>
                              {t(FILTER_OP_KEY[op])}
                            </option>
                          ))}
                        </select>
                        <input
                          type={inputType}
                          value={filter.value}
                          onChange={(e) => updateFilter(index, { value: e.target.value })}
                          className="builder-input"
                          placeholder={t("builder.valuePlaceholder")}
                          disabled={!filter.column}
                          aria-label={t("builder.filterValue")}
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
                <span className="builder-section-title">{t("builder.displayFormat")}</span>

                {caps.values !== "none" && !isCount && formatTargets.length > 0 && (
                  <div className="builder-field">
                    <span className="builder-label">{t("builder.dataFormat")}</span>
                    <ul className="builder-formats">
                      {formatTargets.map((name) => {
                        const fmt = draft.valueFormats[name] ?? "general";
                        return (
                          <li key={name}>
                            <div className="builder-format-row">
                              <span className="builder-format-col" title={labelOf(name)}>
                                {labelOf(name)}
                              </span>
                              <select
                              className="builder-input"
                              value={fmt}
                              aria-label={`${t("builder.dataFormat")} ${labelOf(name)}`}
                              onChange={(e) => {
                                const next = { ...draft.valueFormats };
                                if (e.target.value === "general") delete next[name];
                                else next[name] = e.target.value as ValueFormat;
                                set("valueFormats", next);
                              }}
                            >
                              {(Object.keys(VALUE_FORMAT_KEY) as ValueFormat[]).map((f) => (
                                <option key={f} value={f}>
                                  {t(VALUE_FORMAT_KEY[f])}
                                </option>
                              ))}
                              </select>
                            </div>
                            {fmt === "currency" && (
                              <select
                                className="builder-input builder-format-currency"
                                value={draft.valueCurrencies[name] ?? "IDR"}
                                aria-label={t("builder.currencyFor", {
                                  name: labelOf(name),
                                })}
                                onChange={(e) =>
                                  set("valueCurrencies", {
                                    ...draft.valueCurrencies,
                                    [name]: e.target.value as CurrencyCode,
                                  })
                                }
                              >
                                {(Object.keys(CURRENCY_SHORT_KEY) as CurrencyCode[]).map(
                                  (code) => (
                                    <option key={code} value={code}>
                                      {t(CURRENCY_SHORT_KEY[code])}
                                    </option>
                                  )
                                )}
                              </select>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {caps.unit && (
                  <label className="builder-field">
                    <span className="builder-label">{t("builder.unit")}</span>
                    <input
                      type="text"
                      value={draft.unit}
                      onChange={(e) => set("unit", e.target.value)}
                      placeholder={t("builder.unitPlaceholder")}
                      className="builder-input"
                    />
                  </label>
                )}
              </section>
            )}
          </div>

          <div className="builder-sidebar-footer">
            {problem && <p className="builder-problem">{t(problem)}</p>}

            <div className="builder-footer-row">
              <button type="submit" className="btn-primary" disabled={problem !== null}>
                {editing ? t("builder.updateWidget") : t("builder.addWidget")}
              </button>

              <button
                type="button"
                className="btn-ghost"
                onClick={() => setDraft(draftFrom(editing))}
                title={editing ? t("builder.resetToSaved") : t("builder.clearForm")}
              >
                Reset
              </button>

              {editing && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={onDeselect}
                  title={t("builder.cancelEdit")}
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
                {t("builder.deleteWidget")}
              </button>
            )}
          </div>
        </form>
      </div>
    </aside>
  );
}
