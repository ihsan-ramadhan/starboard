import {
  lazy,
  memo,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, peekWidgetData, type WidgetQuery } from "../../lib/api";
import { defaultSortBy, resolveFormat } from "../../types";
import type {
  ChartDataPoint,
  CurrencyCode,
  DatasetColumn,
  SeriesMode,
  ValueFormat,
  ValueLabelMap,
  WidgetDefinition,
  WidgetFilter,
  WidgetQueryResult,
} from "../../types";
import type { WideRow } from "../../lib/series";
import type { SeriesLabeller, ValueFormatter } from "./chartParts";
import { buildColorMap } from "../../lib/palette";
import { setScaleWarningHidden, useScaleWarningHidden } from "../../lib/prefs";
import { formatCount, formatValueAs } from "../../lib/format";
import { foldOthers, pivotSeries, scaleMismatch, seriesLabeller } from "../../lib/series";
import KpiCard from "./KpiCard";
import WidgetSkeleton from "./WidgetSkeleton";
import DateCard from "./DateCard";
import TableWidget from "./TableWidget";
import { useLang, useT } from "../../lib/i18n";
import { useResolvedTheme } from "../../lib/theme";
const BarChartWidget = lazy(() => import("./BarChartWidget"));
const LineChartWidget = lazy(() => import("./LineChartWidget"));
const AreaChartWidget = lazy(() => import("./AreaChartWidget"));
const ComboChartWidget = lazy(() => import("./ComboChartWidget"));
const PieChartWidget = lazy(() => import("./PieChartWidget"));
const TreemapWidget = lazy(() => import("./TreemapWidget"));
const HeatmapWidget = lazy(() => import("./HeatmapWidget"));
const ScatterWidget = lazy(() => import("./ScatterWidget"));
const GaugeWidget = lazy(() => import("./GaugeWidget"));

export type WidgetRenderProps = {
  readonly widget: WidgetDefinition;
  readonly columns: readonly DatasetColumn[];
  readonly reloadNonce?: number;
  readonly globalFilters?: readonly WidgetFilter[];
  readonly valueLabels?: ValueLabelMap | null;
};

const MAX_PIE_SLICES = 8;

const SCALE_MISMATCH_RATIO = 200;

const EMPTY_PIVOT = pivotSeries([], true);



function valueColumns(widget: WidgetDefinition): string[] | undefined {
  if (widget.type === "kpi" || widget.type === "gauge") {
    if (widget.metricColumn && widget.targetColumn) {
      return [widget.metricColumn, widget.targetColumn];
    }
    return widget.metricColumn ? [widget.metricColumn] : undefined;
  }
  const picked = widget.metricColumns ?? [];
  if (picked.length > 0) return picked;
  return widget.metricColumn ? [widget.metricColumn] : undefined;
}

function usableFilters(
  widget: WidgetDefinition,
  global: readonly WidgetFilter[]
): WidgetFilter[] | undefined {
  const own = (widget.filters ?? []).filter((f) => f.column && f.value !== "");
  const all = [...own, ...global];
  return all.length > 0 ? all : undefined;
}

function buildQuery(
  widget: WidgetDefinition,
  global: readonly WidgetFilter[]
): WidgetQuery | null {
  if (widget.type === "table") return null;

  if (widget.type === "date") {
    if (widget.dateMode !== "sinceColumn" || !widget.metricColumn) return null;
    return {
      datasetId: widget.datasetId,
      metric: "MAX_DATE",
      metricColumn: widget.metricColumn,
    };
  }

  const values = valueColumns(widget);
  const multi = (values?.length ?? 0) > 1;
  return {
    datasetId: widget.datasetId,
    metric: widget.metric,
    metricColumn: !multi && values ? values[0] : undefined,
    metricColumns: multi ? values : undefined,
    groupByColumn: widget.groupByColumn,
    seriesColumn: multi ? undefined : widget.seriesColumn,
    limit: widget.limit ?? 10,
    orderByKey: (widget.sortBy ?? defaultSortBy(widget.type)) === "key",
    filters: usableFilters(widget, global),
  };
}

type DateWidgetProps = {
  readonly widget: WidgetDefinition;
  readonly pending: boolean;
  readonly sinceDate: string | null;
  readonly reloadNonce: number;
};

function DateWidgetView({
  widget,
  pending,
  sinceDate,
  reloadNonce,
}: DateWidgetProps) {
  const mode = widget.dateMode ?? "yearRemaining";
  if (mode !== "sinceColumn") {
    return (
      <DateCard
        label={widget.title}
        mode={mode}
        targetDate={widget.targetDate}
        reloadNonce={reloadNonce}
      />
    );
  }
  if (pending) return <WidgetSkeleton widget={widget} />;
  return (
    <DateCard
      label={widget.title}
      mode="sinceColumn"
      sinceDate={sinceDate}
      reloadNonce={reloadNonce}
    />
  );
}

type KpiWidgetProps = {
  readonly widget: WidgetDefinition;
  readonly result: WidgetQueryResult;
  readonly columnLabel: SeriesLabeller;
  readonly currency?: CurrencyCode;
  readonly format?: ValueFormat;
  readonly reloadNonce: number;
};

function KpiWidgetView({
  widget,
  result,
  columnLabel,
  currency,
  format,
  reloadNonce,
}: KpiWidgetProps) {
  const targetColumn = widget.targetColumn;
  const valueOf = (column?: string) =>
    result.rows.find((r) => r.series === column)?.value ?? null;

  return (
    <KpiCard
      label={widget.title}
      value={targetColumn ? valueOf(widget.metricColumn) : result.scalarValue ?? null}
      target={targetColumn ? valueOf(targetColumn) : null}
      targetLabel={targetColumn ? columnLabel(targetColumn) : undefined}
      unit={widget.unit}
      currency={currency}
      format={format}
      goodDirection={widget.goodDirection}
      reloadNonce={reloadNonce}
    />
  );
}

type SeriesChartProps = {
  readonly widget: WidgetDefinition;
  readonly data: readonly WideRow[];
  readonly seriesKeys: readonly string[];
  readonly lineKeys: readonly string[];
  readonly colors: Record<string, string>;
  readonly labelOf: SeriesLabeller;
  readonly formatValue: ValueFormatter;
  readonly stacking: SeriesMode;
  readonly currency?: CurrencyCode;
  readonly reloadNonce: number;
  readonly note?: string;
  readonly onHideNote: () => void;
};

function SeriesChart({
  widget,
  data,
  seriesKeys,
  lineKeys,
  colors,
  labelOf,
  formatValue,
  stacking,
  currency,
  reloadNonce,
  note,
  onHideNote,
}: SeriesChartProps) {
  const shared = {
    title: widget.title,
    data,
    seriesKeys,
    colors,
    labelOf,
    formatValue,
    unit: widget.unit,
    currency,
    reloadNonce,
    note,
    onHideNote,
  };

  if (widget.type === "bar") return <BarChartWidget {...shared} mode={stacking} />;
  if (widget.type === "barh") {
    return <BarChartWidget {...shared} mode={stacking} horizontal />;
  }
  if (widget.type === "area") return <AreaChartWidget {...shared} mode={stacking} />;
  if (widget.type === "combo") {
    return <ComboChartWidget {...shared} lineKeys={lineKeys} />;
  }
  return <LineChartWidget {...shared} showTrendline={widget.showTrendline} />;
}

function WidgetRender({
  widget,
  columns,
  reloadNonce = 0,
  globalFilters = [],
  valueLabels,
}: WidgetRenderProps) {
  const t = useT();
  const lang = useLang();
  const theme = useResolvedTheme();
  const spec = buildQuery(widget, globalFilters);
  const specKey = spec ? JSON.stringify(spec) : "";
  const query = useMemo(() => spec, [specKey, reloadNonce]);

  const [raw, setResult] = useState<WidgetQueryResult | null>(() =>
    query ? peekWidgetData(query) ?? null : null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) return;

    const cached = peekWidgetData(query);
    if (cached) {
      setError(null);
      setResult(cached);
      return;
    }

    let active = true;
    setResult(null);
    setError(null);
    api
      .queryWidgetData(query)
      .then((res) => {
        if (active) setResult(res);
      })
      .catch((e) => {
        console.error("Failed to load widget:", e);
        if (!active) return;
        setError(String(e instanceof Error ? e.message : e));
        setResult({ rows: [] });
      });

    return () => {
      active = false;
    };
  }, [query]);

  const groupLabels = widget.groupByColumn
    ? valueLabels?.[widget.groupByColumn]
    : undefined;

  const result = useMemo(() => {
    if (!raw || !groupLabels) return raw;
    return {
      ...raw,
      rows: raw.rows.map((row) =>
        row.groupKey in groupLabels
          ? { ...row, groupKey: groupLabels[row.groupKey] || row.groupKey }
          : row
      ),
    };
  }, [raw, groupLabels]);

  const warningHidden = useScaleWarningHidden();

  const primaryColumn = widget.metricColumn ?? widget.metricColumns?.[0];
  const primary = resolveFormat(widget, primaryColumn);
  const metricFormat = primary.format;
  const currency = primary.currency;

  const formatValue = useMemo(() => {
    return (series: string, value: number) => {
      const { format, currency: cur } = resolveFormat(widget, series);
      return formatValueAs(value, format, cur, widget.unit);
    };
  }, [
    widget.valueFormats,
    widget.valueCurrencies,
    widget.isCurrency,
    widget.currency,
    widget.unit,
    lang,
  ]);

  const columnLabel = useMemo(() => seriesLabeller(columns), [columns]);
  const labelOf = useMemo(
    () => (series: string) => (series === "value" ? t("widget.valueSeries") : columnLabel(series)),
    [columnLabel, t]
  );

  const isSeriesChart =
    widget.type === "bar" ||
    widget.type === "barh" ||
    widget.type === "area" ||
    widget.type === "combo" ||
    widget.type === "line" ||
    widget.type === "heatmap" ||
    widget.type === "scatter";

  const pivot = useMemo(
    () =>
      result && isSeriesChart
        ? pivotSeries(result.rows, widget.type !== "line")
        : null,
    [result, isSeriesChart, widget.type]
  );

  const seriesColors = useMemo(
    () => buildColorMap(pivot?.seriesKeys ?? [], theme),
    [pivot, theme]
  );

  const slices = useMemo(
    () =>
      result && (widget.type === "pie" || widget.type === "treemap")
        ? foldOthers(result.rows as ChartDataPoint[], MAX_PIE_SLICES)
        : null,
    [result, widget.type]
  );

  const sliceColors = useMemo(
    () => buildColorMap((slices ?? []).map((s) => s.groupKey), theme),
    [slices, theme]
  );

  const lineKeys = useMemo(
    () =>
      widget.lineColumns?.length
        ? widget.lineColumns
        : widget.lineColumn
          ? [widget.lineColumn]
          : [],
    [widget.lineColumns, widget.lineColumn]
  );

  const suspend = (node: ReactNode) => (
    <Suspense fallback={<WidgetSkeleton widget={widget} />}>{node}</Suspense>
  );

  if (widget.type === "table") {
    return (
      <TableWidget
        title={widget.title}
        datasetId={widget.datasetId}
        columns={columns}
        selected={widget.tableColumns}
        filters={usableFilters(widget, globalFilters)}
        limit={widget.limit ?? 25}
        reloadNonce={reloadNonce}
        valueLabels={valueLabels}
      />
    );
  }

  if (widget.type === "date") {
    return (
      <DateWidgetView
        widget={widget}
        pending={Boolean(query) && !result}
        sinceDate={result?.scalarText ?? null}
        reloadNonce={reloadNonce}
      />
    );
  }

  if (error) {
    return (
      <div className="chart-wrapper">
        <h4 className="widget-title" title={widget.title}>
          {widget.title}
        </h4>
        <div className="chart-body">
          <div className="widget-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!result) {
    return <WidgetSkeleton widget={widget} />;
  }

  if (widget.type === "kpi") {
    return (
      <KpiWidgetView
        widget={widget}
        result={result}
        columnLabel={columnLabel}
        currency={currency}
        format={metricFormat}
        reloadNonce={reloadNonce}
      />
    );
  }

  if (widget.type === "pie") {
    return suspend(
      <PieChartWidget
        title={widget.title}
        format={metricFormat}
        data={slices ?? []}
        colors={sliceColors}
        unit={widget.unit}
        currency={currency}
        reloadNonce={reloadNonce}
      />
    );
  }

  if (widget.type === "treemap") {
    return suspend(
      <TreemapWidget
        title={widget.title}
        format={metricFormat}
        data={slices ?? []}
        colors={sliceColors}
        unit={widget.unit}
        currency={currency}
        reloadNonce={reloadNonce}
      />
    );
  }

  if (widget.type === "gauge") {
    const valueOf = (column?: string) =>
      result.rows.find((r) => r.series === column)?.value ?? null;
    const hasMax = Boolean(widget.targetColumn);
    return suspend(
      <GaugeWidget
        title={widget.title}
        value={hasMax ? valueOf(widget.metricColumn) : result.scalarValue ?? null}
        max={hasMax ? valueOf(widget.targetColumn) : null}
        goodDirection={widget.goodDirection}
        unit={widget.unit}
        currency={currency}
        format={metricFormat}
        reloadNonce={reloadNonce}
      />
    );
  }

  const stacking = widget.seriesMode ?? "grouped";
  const { seriesKeys, data } = pivot ?? EMPTY_PIVOT;
  const colors = seriesColors;

  if (widget.type === "heatmap") {
    return suspend(
      <HeatmapWidget
        title={widget.title}
        format={metricFormat}
        data={data}
        seriesKeys={seriesKeys}
        labelOf={labelOf}
        unit={widget.unit}
        currency={currency}
        reloadNonce={reloadNonce}
      />
    );
  }

  if (widget.type === "scatter") {
    const axisPair = (widget.metricColumns ?? seriesKeys).filter((name) =>
      seriesKeys.includes(name)
    );
    return suspend(
      <ScatterWidget
        title={widget.title}
        data={data}
        seriesKeys={axisPair.length === 2 ? axisPair : seriesKeys}
        labelOf={labelOf}
        formatValue={formatValue}
        unit={widget.unit}
        currency={currency}
        reloadNonce={reloadNonce}
      />
    );
  }

  const mismatch =
    warningHidden || stacking === "stacked100"
      ? null
      : scaleMismatch(data, seriesKeys, SCALE_MISMATCH_RATIO);
  const hideWarning = () => setScaleWarningHidden(true);
  const note = mismatch
    ? t("chart.scaleNote", {
        small: labelOf(mismatch.small),
        ratio: formatCount(Math.round(mismatch.ratio)),
        large: labelOf(mismatch.large),
      })
    : undefined;

  return suspend(
    <SeriesChart
      widget={widget}
      data={data}
      seriesKeys={seriesKeys}
      lineKeys={lineKeys}
      colors={colors}
      labelOf={labelOf}
      formatValue={formatValue}
      stacking={stacking}
      currency={currency}
      reloadNonce={reloadNonce}
      note={note}
      onHideNote={hideWarning}
    />
  );
}

export default memo(WidgetRender);
