import { useEffect, useMemo, useState } from "react";
import type { ChartDataPoint, CurrencyCode } from "../../types";
import { formatFullValue } from "../../lib/format";
import { ChartFrame, escapeHtml } from "./chartParts";
import { EChart } from "./EChart";
import type { EChartsOption } from "echarts";

export type PieChartWidgetProps = {
  readonly title: string;
  readonly data: readonly ChartDataPoint[];
  readonly colors: Record<string, string>;
  readonly unit?: string;
  readonly currency?: CurrencyCode;
  readonly reloadNonce?: number;
};

export default function PieChartWidget({
  title,
  data,
  colors,
  unit,
  currency,
  reloadNonce,
}: PieChartWidgetProps) {
  const [selected, setSelected] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [data]);

  const shown = selected
    ? data.filter((entry) => selected[entry.groupKey] !== false)
    : data;
  const total = shown.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);

  const option = useMemo<EChartsOption>(
    () => ({
      animation: true,
      animationType: "scale",
      animationDuration: 800,
      animationEasing: "cubicOut",
      tooltip: {
        trigger: "item",
        backgroundColor: "#ffffff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: "#0f172a", fontSize: 12 },
        extraCssText:
          "box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08); border-radius: 6px;",
        formatter: (p: any) => {
          const marker = `<span style="display:inline-block;margin-right:6px;border-radius:50%;width:8px;height:8px;background-color:${p.color};"></span>`;
          return (
            `<div>` +
            `<div style="font-weight:600;margin-bottom:2px">${marker}${escapeHtml(p.name)}</div>` +
            `<div style="font-variant-numeric:tabular-nums">${escapeHtml(formatFullValue(p.value, currency, unit))} (${p.percent}%)</div>` +
            `</div>`
          );
        },
      },
      legend: {
        bottom: 2,
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: "#475569", fontSize: 11 },
      },
      series: [
        {
          type: "pie",
          radius: ["52%", "78%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: true,
          animationType: "scale",
          animationDuration: 850,
          animationEasing: "cubicOut",
          itemStyle: {
            borderRadius: 3,
            borderColor: "#ffffff",
            borderWidth: 2,
          },
          label: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 5,
          },
          data: data.map((d) => ({
            name: d.groupKey,
            value: d.value,
            itemStyle: { color: colors[d.groupKey] },
          })),
        },
      ],
    }),
    [data, colors, currency, unit]
  );

  return (
    <ChartFrame
      title={title}
      isEmpty={data.length === 0}
      overlay={
        <div className="donut-center">
          <span className="donut-center-label">Total</span>
          <span className="donut-center-value">
            {formatFullValue(total, currency, unit)}
          </span>
        </div>
      }
    >
      <EChart
        option={option}
        reloadNonce={reloadNonce}
        onLegendSelect={setSelected}
      />
    </ChartFrame>
  );
}
