import { useEffect, useMemo, useState } from "react";
import { api, peekWidgetData, type WidgetQuery } from "../../lib/api";
import type {
  WidgetDefinition,
  WidgetQueryResult,
} from "../../types";
import KpiCard from "./KpiCard";
import BarChartWidget from "./BarChartWidget";
import LineChartWidget from "./LineChartWidget";
import PieChartWidget from "./PieChartWidget";

export type WidgetRenderProps = {
  readonly widget: WidgetDefinition;
};

export default function WidgetRender({ widget }: WidgetRenderProps) {
  // Only these fields reach the server. Depending on the whole widget object
  // meant every drag and resize handed this effect a fresh identity and
  // refetched data that had not changed.
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
    const formattedVal = widget.isCurrency
      ? formatRp(scalar ?? 0)
      : (scalar ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 });

    return (
      <KpiCard
        label={widget.title}
        value={formattedVal}
        unit={widget.isCurrency ? undefined : widget.unit}
      />
    );
  }

  if (widget.type === "bar") {
    return (
      <BarChartWidget
        title={widget.title}
        data={data}
        isCurrency={widget.isCurrency}
      />
    );
  }

  if (widget.type === "line") {
    return (
      <LineChartWidget
        title={widget.title}
        data={data}
        unit={widget.unit}
        isCurrency={widget.isCurrency}
      />
    );
  }

  return (
    <PieChartWidget
      title={widget.title}
      data={data}
      unit={widget.unit}
      isCurrency={widget.isCurrency}
    />
  );
}

function formatRp(val: number): string {
  if (val >= 1_000_000_000) {
    return `Rp ${(val / 1_000_000_000).toFixed(1)} M`;
  }
  if (val >= 1_000_000) {
    return `Rp ${(val / 1_000_000).toFixed(1)} Jt`;
  }
  return `Rp ${Math.round(val).toLocaleString("id-ID")}`;
}
