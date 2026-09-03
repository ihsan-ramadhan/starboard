import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type {
  ChartDataPoint,
  WidgetDefinition,
} from "../../types";
import KpiCard from "./KpiCard";
import BarChartWidget from "./BarChartWidget";
import LineChartWidget from "./LineChartWidget";
import PieChartWidget from "./PieChartWidget";

export type WidgetRenderProps = {
  readonly widget: WidgetDefinition;
};

export default function WidgetRender({ widget }: WidgetRenderProps) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [scalar, setScalar] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const res = await api.queryWidgetData({
          datasetId: widget.datasetId,
          metric: widget.metric,
          metricColumn: widget.metricColumn,
          groupByColumn: widget.groupByColumn,
          limit: widget.limit ?? 10,
          orderByKey: widget.type === "line",
        });
        if (!active) return;
        setScalar(res.scalarValue ?? null);
        setData(res.rows || []);
      } catch (e) {
        console.error("Failed to load widget:", e);
        if (active) {
          setData([]);
          setScalar(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [widget]);

  if (loading) {
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
        accent={widget.isCurrency}
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
