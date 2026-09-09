import { useMemo } from "react";
import type { CurrencyCode } from "../../types";
import type { WideRow } from "../../lib/series";
import {
  ChartFrame,
  baseEChartOption,
  type SeriesLabeller,
  escapeHtml,
} from "./chartParts";
import { EChart } from "./EChart";
import { formatFullValue } from "../../lib/format";
import type { EChartsOption } from "echarts";

export type ComboChartWidgetProps = {
  readonly title: string;
  readonly data: readonly WideRow[];
  readonly seriesKeys: readonly string[];
  readonly lineKeys: readonly string[];
  readonly colors: Record<string, string>;
  readonly labelOf: SeriesLabeller;
  readonly unit?: string;
  readonly currency?: CurrencyCode;
  readonly reloadNonce?: number;
  readonly note?: string;
  readonly onHideNote?: () => void;
};

export default function ComboChartWidget({
  title,
  data,
  seriesKeys,
  lineKeys,
  colors,
  labelOf,
  unit,
  currency,
  reloadNonce,
  note,
  onHideNote,
}: ComboChartWidgetProps) {
  const barKeys = seriesKeys.filter((key) => !lineKeys.includes(key));

  const option = useMemo<EChartsOption>(() => {
    const base = baseEChartOption(true, currency);
    const categories = data.map((d) => String(d.groupKey ?? ""));

    const barSeries = barKeys.map((key, index) => ({
      name: key,
      type: "bar" as const,
      animationDuration: 750,
      animationEasing: "cubicOut" as const,
      animationDelay: (idx: number) => idx * 25 + index * 40,
      itemStyle: {
        color: colors[key],
        borderRadius: [3, 3, 0, 0] as [number, number, number, number],
      },
      data: data.map((d) => (d[key] !== null ? Number(d[key]) : null)),
    }));

    const lineSeries = lineKeys.map((key, index) => ({
      name: key,
      type: "line" as const,
      smooth: true,
      symbol: "circle",
      symbolSize: 6,
      animationDuration: 850,
      animationEasing: "cubicOut" as const,
      animationDelay: index * 80 + 150,
      itemStyle: { color: colors[key] },
      lineStyle: { width: 2, color: colors[key] },
      data: data.map((d) => (d[key] !== null ? Number(d[key]) : null)),
      connectNulls: true,
    }));

    return {
      ...base,
      xAxis: {
        ...base.xAxis,
        data: categories,
      },
      legend: {
        ...base.legend,
        formatter: (name: string) => labelOf(name),
      },
      tooltip: {
        ...base.tooltip,
        formatter: (params: any) => {
          if (!Array.isArray(params)) return "";
          const header = `<div style="font-weight:600;margin-bottom:4px">${escapeHtml(params[0]?.axisValueLabel)}</div>`;
          const lines = params.map((p: any) => {
            const marker = `<span style="display:inline-block;margin-right:6px;border-radius:50%;width:8px;height:8px;background-color:${p.color};"></span>`;
            return (
              `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;line-height:1.6">` +
              `<span>${marker}${escapeHtml(labelOf(p.seriesName))}</span>` +
              `<span style="font-weight:600;font-variant-numeric:tabular-nums">${escapeHtml(formatFullValue(p.value, currency, unit))}</span>` +
              `</div>`
            );
          });
          return header + lines.join("");
        },
      },
      series: [...barSeries, ...lineSeries],
    };
  }, [data, seriesKeys, lineKeys, colors, labelOf, unit, currency]);

  return (
    <ChartFrame
      title={title}
      isEmpty={data.length === 0}
      note={note}
      onHideNote={onHideNote}
    >
      <EChart option={option} reloadNonce={reloadNonce} />
    </ChartFrame>
  );
}
