import { useEffect, useMemo, useState } from "react";
import { api, peekWidgetData, type WidgetQuery } from "../../lib/api";
import type {
  WidgetDefinition,
  WidgetQueryResult,
} from "../../types";
import KpiCard from "./KpiCard";
import { formatCompactValue } from "../../lib/format";
import BarChartWidget from "./BarChartWidget";
import LineChartWidget from "./LineChartWidget";
import PieChartWidget from "./PieChartWidget";

export type WidgetRenderProps = {
  readonly widget: WidgetDefinition;

  readonly reloadNonce?: number;
};

export default function WidgetRender({ widget, reloadNonce = 0 }: WidgetRenderProps) {

  const query = useMemo<WidgetQuery>(
    () => ({
      datasetId: widget.datasetId,
      metric: widget.metric,
      metricColumn: widget.metricColumn,
      groupByColumn: widget.groupByColumn,
      limit: widget.limit ?? 10,
      orderByKey: widget.type === "line",
    }),
    [
      widget.datasetId,
      widget.metric,
      widget.metricColumn,
      widget.groupByColumn,
      widget.limit,
      widget.type,
      reloadNonce,
    ]
  );

  const [result, setResult] = useState<WidgetQueryResult | null>(
    () => peekWidgetData(query) ?? null
  );

  useEffect(() => {
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

  const data = result?.rows ?? [];
  const scalar = result?.scalarValue ?? null;
  const currency = widget.isCurrency ? widget.currency ?? "IDR" : undefined;

  if (!result) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <h4 className="widget-title">{widget.title}</h4>
        </div>
        <div className="widget-body widget-loading">Memuat data…</div>
      </div>
    );
  }

  if (widget.type === "kpi") {
    return (
      <KpiCard
        label={widget.title}
        value={formatCompactValue(scalar ?? 0, currency)}
        unit={currency ? undefined : widget.unit}
      />
    );
  }

  if (widget.type === "bar") {
    return (
      <BarChartWidget
        title={widget.title}
        data={data}
        currency={currency}
      />
    );
  }

  if (widget.type === "line") {
    return (
      <LineChartWidget
        title={widget.title}
        data={data}
        unit={widget.unit}
        currency={currency}
      />
    );
  }

  return (
    <PieChartWidget
      title={widget.title}
      data={data}
      unit={widget.unit}
      currency={currency}
    />
  );
}
