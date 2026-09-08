import { useEffect, useMemo, useState } from "react";
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

function WidgetLoading({ title }: { readonly title: string }) {
  return (
    <div className="chart-wrapper">
      <h4 className="widget-title">{title}</h4>
      <div className="chart-body">
        <div className="widget-empty">Memuat data…</div>
      </div>
    </div>
  );
}

function valueColumns(widget: WidgetDefinition): string[] | undefined {
  if (widget.type === "kpi") {
    if (widget.metricColumn && widget.targetColumn) {
      return [widget.metricColumn, widget.targetColumn];
    }
    return undefined;
  }
  const picked = widget.metricColumns ?? [];
  return picked.length > 1 ? picked : undefined;
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

  const multi = valueColumns(widget);
  return {
    datasetId: widget.datasetId,
    metric: widget.metric,
    metricColumn: multi ? undefined : widget.metricColumn,
    metricColumns: multi,
    groupByColumn: widget.groupByColumn,
    seriesColumn: multi ? undefined : widget.seriesColumn,
    limit: widget.limit ?? 10,
    orderByKey: widget.type === "line" || widget.type === "area",
  };
}

export default function WidgetRender({
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

  useEffect(() => {
    if (!query) return;

    const cached = peekWidgetData(query);
    if (cached) {
      setResult(cached);
      return;
    }

    let active = true;
    setResult(null);
    api
      .queryWidgetData(query)
      .then((res) => {
        if (active) setResult(res);
      })
      .catch((e) => {
        console.error("Failed to load widget:", e);
        if (active) setResult({ rows: [] });
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

  if (widget.type === "table") {
    return (
      <TableWidget
        title={widget.title}
        datasetId={widget.datasetId}
        columns={columns}
        selected={widget.tableColumns}
        limit={widget.limit ?? 100}
        reloadNonce={reloadNonce}
      />
    );
  }

  if (widget.type === "date") {
    const mode = widget.dateMode ?? "yearRemaining";
    if (mode !== "sinceColumn") {
      return <DateCard label={widget.title} mode={mode} targetDate={widget.targetDate} />;
    }
    if (query && !result) return <WidgetLoading title={widget.title} />;
    return (
      <DateCard
        label={widget.title}
        mode="sinceColumn"
        sinceDate={result?.scalarText ?? null}
      />
    );
  }

  if (!result) {
    return <WidgetLoading title={widget.title} />;
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
      />
    );
  }

  if (widget.type === "pie") {
    const slices = foldOthers(result.rows as ChartDataPoint[], MAX_PIE_SLICES);
    return (
      <PieChartWidget
        title={widget.title}
        data={slices}
        colors={buildColorMap(slices.map((s) => s.groupKey))}
        unit={widget.unit}
        currency={currency}
      />
    );
  }

  const stacking = widget.seriesMode ?? "grouped";
  const { seriesKeys, data } = pivotSeries(result.rows, widget.type !== "line");
  const colors = buildColorMap(seriesKeys);

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
        note={note}
        onHideNote={hideWarning}
      />
    );
  }

  if (widget.type === "combo") {
    const lineKeys = widget.lineColumn ? [widget.lineColumn] : [];
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
      note={note}
      onHideNote={hideWarning}
    />
  );
}
