import { useMemo } from "react";
import type { CurrencyCode, SeriesMode } from "../../types";
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

export type AreaChartWidgetProps = {
  readonly title: string;
  readonly data: readonly WideRow[];
  readonly seriesKeys: readonly string[];
  readonly colors: Record<string, string>;
  readonly labelOf: SeriesLabeller;
  readonly mode: SeriesMode;
  readonly unit?: string;
  readonly currency?: CurrencyCode;
  readonly reloadNonce?: number;
  readonly note?: string;
  readonly onHideNote?: () => void;
};

export default function AreaChartWidget({
  title,
  data,
  seriesKeys,
  colors,
  labelOf,
  mode,
  unit,
  currency,
  reloadNonce,
  note,
  onHideNote,
}: AreaChartWidgetProps) {
  const multi = seriesKeys.length > 1;
  const stacked = mode !== "grouped" && multi;
  const isPercent = mode === "stacked100" && multi;

  const option = useMemo<EChartsOption>(() => {
    const base = baseEChartOption(multi, currency, isPercent);
    const categories = data.map((d) => String(d.groupKey ?? ""));

    const rowSums = isPercent
      ? data.map((d) =>
          seriesKeys.reduce((sum, key) => sum + (Number(d[key]) || 0), 0)
        )
      : [];

    const series = seriesKeys.map((key, index) => ({
      name: key,
      type: "line" as const,
      smooth: true,
      symbol: "none",
      stack: stacked ? "total" : undefined,
      animationDuration: 850,
      animationEasing: "cubicOut" as const,
      animationDelay: index * 80,
      itemStyle: { color: colors[key] },
      lineStyle: { width: 2, color: colors[key] },
      areaStyle: {
        color: colors[key],
        opacity: stacked ? 0.85 : 0.2,
      },
      data: data.map((d, rowIndex) => {
        const raw = Number(d[key]) || 0;
        if (!isPercent) return raw;
        const sum = rowSums[rowIndex] || 0;
        return sum > 0 ? raw / sum : 0;
      }),
      connectNulls: true,
    }));

    return {
      ...base,
      xAxis: {
        ...base.xAxis,
        data: categories,
      },
      legend: multi
        ? {
            ...base.legend,
            formatter: (name: string) => labelOf(name),
          }
        : undefined,
      tooltip: {
        ...base.tooltip,
        axisPointer: { type: "line" },
        formatter: (params: any) => {
          if (!Array.isArray(params)) return "";
          const header = `<div style="font-weight:600;margin-bottom:4px">${escapeHtml(params[0]?.axisValueLabel)}</div>`;
          const lines = params.map((p: any) => {
            const marker = `<span style="display:inline-block;margin-right:6px;border-radius:50%;width:8px;height:8px;background-color:${p.color};"></span>`;
            const val = isPercent
              ? `${Math.round(p.value * 100)}%`
              : formatFullValue(p.value, currency, unit);
            return (
              `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;line-height:1.6">` +
              `<span>${marker}${escapeHtml(labelOf(p.seriesName))}</span>` +
              `<span style="font-weight:600;font-variant-numeric:tabular-nums">${escapeHtml(val)}</span>` +
              `</div>`
            );
          });
          return header + lines.join("");
        },
      },
      series,
    };
  }, [data, seriesKeys, colors, labelOf, mode, unit, currency, multi, stacked, isPercent]);

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
