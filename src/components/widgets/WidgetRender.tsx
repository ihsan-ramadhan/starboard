import { memo, useEffect, useMemo, useState } from "react";
import { api, peekWidgetData, type WidgetQuery } from "../../lib/api";
import type {
  ChartDataPoint,
  DatasetColumn,
  WidgetDefinition,
  WidgetQueryResult,
} from "../../types";
import { buildColorMap } from "../../lib/palette";
import { setScaleWarningHidden, useScaleWarningHidden } from "../../lib/prefs";
import { formatCount } from "../../lib/format";
import { foldOthers, pivotSeries, scaleMismatch, seriesLabeller } from "../../lib/series";
import KpiCard from "./KpiCard";
import WidgetSkeleton from "./WidgetSkeleton";
import DateCard from "./DateCard";
import TableWidget from "./TableWidget";
import BarChartWidget from "./BarChartWidget";
import LineChartWidget from "./LineChartWidget";
import AreaChartWidget from "./AreaChartWidget";
import ComboChartWidget from "./ComboChartWidget";
import PieChartWidget from "./PieChartWidget";

export type WidgetRenderProps = {
  readonly widget: WidgetDefinition;
  readonly columns: readonly DatasetColumn[];
  readonly reloadNonce?: number;
};

const MAX_PIE_SLICES = 8;

const SCALE_MISMATCH_RATIO = 200;

const EMPTY_PIVOT = pivotSeries([], true);



function valueColumns(widget: WidgetDefinition): string[] | undefined {
  if (widget.type === "kpi") {
    if (widget.metricColumn && widget.targetColumn) {
      return [widget.metricColumn, widget.targetColumn];
    }
    return widget.metricColumn ? [widget.metricColumn] : undefined;
  }
  const picked = widget.metricColumns ?? [];
  if (picked.length > 0) return picked;
  return widget.metricColumn ? [widget.metricColumn] : undefined;
}

function usableFilters(widget: WidgetDefinition) {
  const active = (widget.filters ?? []).filter((f) => f.column && f.value !== "");
  return active.length > 0 ? active : undefined;
}

function buildQuery(widget: WidgetDefinition): WidgetQuery | null {
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
    orderByKey: widget.type === "line" || widget.type === "area",
    filters: usableFilters(widget),
  };
}

function WidgetRender({
  widget,
  columns,
  reloadNonce = 0,
}: WidgetRenderProps) {
  const spec = buildQuery(widget);
  const specKey = spec ? JSON.stringify(spec) : "";
  const query = useMemo(() => spec, [specKey, reloadNonce]);

  const [result, setResult] = useState<WidgetQueryResult | null>(() =>
    query ? peekWidgetData(query) ?? null : null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) return;

    const cached = peekWidgetData(query);
    if (cached) {
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

  const warningHidden = useScaleWarningHidden();
  const currency = widget.isCurrency ? widget.currency ?? "IDR" : undefined;

  const columnLabel = useMemo(() => seriesLabeller(columns), [columns]);
  const labelOf = useMemo(
    () => (series: string) => (series === "value" ? "Nilai" : columnLabel(series)),
    [columnLabel]
  );

  const isSeriesChart =
    widget.type === "bar" ||
    widget.type === "area" ||
    widget.type === "combo" ||
    widget.type === "line";

  const pivot = useMemo(
    () =>
      result && isSeriesChart
        ? pivotSeries(result.rows, widget.type !== "line")
        : null,
    [result, isSeriesChart, widget.type]
  );

  const seriesColors = useMemo(
    () => buildColorMap(pivot?.seriesKeys ?? []),
    [pivot]
  );

  const slices = useMemo(
    () =>
      result && widget.type === "pie"
        ? foldOthers(result.rows as ChartDataPoint[], MAX_PIE_SLICES)
        : null,
    [result, widget.type]
  );

  const sliceColors = useMemo(
    () => buildColorMap((slices ?? []).map((s) => s.groupKey)),
    [slices]
  );

  const lineKeys = useMemo(
    () => (widget.lineColumn ? [widget.lineColumn] : []),
    [widget.lineColumn]
  );

  if (widget.type === "table") {
    return (
      <TableWidget
        title={widget.title}
        datasetId={widget.datasetId}
        columns={columns}
        selected={widget.tableColumns}
        filters={usableFilters(widget)}
        limit={widget.limit ?? 25}
        reloadNonce={reloadNonce}
      />
    );
  }

  if (widget.type === "date") {
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
    if (query && !result) return <WidgetSkeleton widget={widget} />;
    return (
      <DateCard
        label={widget.title}
        mode="sinceColumn"
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
    const target = widget.targetColumn
      ? result.rows.find((r) => r.series === widget.targetColumn)?.value ?? null
      : null;
    const actual = widget.targetColumn
      ? result.rows.find((r) => r.series === widget.metricColumn)?.value ?? null
      : result.scalarValue ?? null;

    return (
      <KpiCard
        label={widget.title}
        value={actual}
        target={target}
        targetLabel={widget.targetColumn ? columnLabel(widget.targetColumn) : undefined}
        unit={widget.unit}
        currency={currency}
        reloadNonce={reloadNonce}
      />
    );
  }

  if (widget.type === "pie") {
    return (
      <PieChartWidget
        title={widget.title}
        data={slices ?? []}
        colors={sliceColors}
        unit={widget.unit}
        currency={currency}
        reloadNonce={reloadNonce}
      />
    );
  }

  const stacking = widget.seriesMode ?? "grouped";
  const { seriesKeys, data } = pivot ?? EMPTY_PIVOT;
  const colors = seriesColors;

  const mismatch =
    warningHidden || stacking === "stacked100"
      ? null
      : scaleMismatch(data, seriesKeys, SCALE_MISMATCH_RATIO);
  const hideWarning = () => setScaleWarningHidden(true);
  const note = mismatch
    ? `${labelOf(mismatch.small)} nyaris tak terlihat: skalanya ${formatCount(
        Math.round(mismatch.ratio)
      )}× lebih kecil dari ${labelOf(mismatch.large)}. Tampilkan di chart terpisah.`
    : undefined;

  if (widget.type === "bar") {
    return (
      <BarChartWidget
        title={widget.title}
        data={data}
        seriesKeys={seriesKeys}
        colors={colors}
        labelOf={labelOf}
        mode={stacking}
        unit={widget.unit}
        currency={currency}
        reloadNonce={reloadNonce}
        note={note}
        onHideNote={hideWarning}
      />
    );
  }

  if (widget.type === "area") {
    return (
      <AreaChartWidget
        title={widget.title}
        data={data}
        seriesKeys={seriesKeys}
        colors={colors}
        labelOf={labelOf}
        mode={stacking}
        unit={widget.unit}
        currency={currency}
        reloadNonce={reloadNonce}
        note={note}
        onHideNote={hideWarning}
      />
    );
  }

  if (widget.type === "combo") {
    return (
      <ComboChartWidget
        title={widget.title}
        data={data}
        seriesKeys={seriesKeys}
        lineKeys={lineKeys}
        colors={colors}
        labelOf={labelOf}
        unit={widget.unit}
        currency={currency}
        reloadNonce={reloadNonce}
        note={note}
        onHideNote={hideWarning}
      />
    );
  }

  return (
    <LineChartWidget
      title={widget.title}
      data={data}
      seriesKeys={seriesKeys}
      colors={colors}
      labelOf={labelOf}
      showTrendline={widget.showTrendline}
      unit={widget.unit}
      currency={currency}
      reloadNonce={reloadNonce}
      note={note}
      onHideNote={hideWarning}
    />
  );
}

export default memo(WidgetRender);
