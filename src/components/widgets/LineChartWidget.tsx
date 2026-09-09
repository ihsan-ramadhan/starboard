import { useMemo } from "react";
import type { CurrencyCode } from "../../types";
import { TREND_KEY, withTrendline, type WideRow } from "../../lib/series";
import {
  ChartFrame,
  baseEChartOption,
  type SeriesLabeller,
  escapeHtml,
} from "./chartParts";
import { EChart } from "./EChart";
import { formatFullValue } from "../../lib/format";
import type { EChartsOption } from "echarts";

export type LineChartWidgetProps = {
  readonly title: string;
  readonly data: readonly WideRow[];
  readonly seriesKeys: readonly string[];
  readonly colors: Record<string, string>;
  readonly labelOf: SeriesLabeller;
  readonly showTrendline?: boolean;
  readonly unit?: string;
  readonly currency?: CurrencyCode;
  readonly reloadNonce?: number;
  readonly note?: string;
  readonly onHideNote?: () => void;
};

export default function LineChartWidget({
  title,
  data,
  seriesKeys,
  colors,
  labelOf,
  showTrendline,
  unit,
  currency,
  reloadNonce,
  note,
  onHideNote,
}: LineChartWidgetProps) {
  const multi = seriesKeys.length > 1;
  const trendable = showTrendline && seriesKeys.length === 1;
  const plotted = useMemo(
    () => (trendable ? withTrendline(data, seriesKeys[0]) : (data as WideRow[])),
    [trendable, data, seriesKeys]
  );

  const withTrendLabel: SeriesLabeller = (series) =>
    series === TREND_KEY ? "Garis tren" : labelOf(series);

  const option = useMemo<EChartsOption>(() => {
    const hasTrend =
      Boolean(trendable) && plotted.some((d) => d[TREND_KEY] != null);
    const hasLegend = Boolean(multi || hasTrend);
    const base = baseEChartOption(hasLegend, currency);
    const categories = plotted.map((d) => String(d.groupKey ?? ""));

    const series: any[] = seriesKeys.map((key, index) => ({
      name: key,
      type: "line" as const,
      smooth: true,
      symbol: "circle",
      symbolSize: 6,
      animationDuration: 850,
      animationEasing: "cubicOut" as const,
      animationDelay: index * 80,
      itemStyle: { color: colors[key] },
      lineStyle: { width: 2, color: colors[key] },
      data: plotted.map((d) => (d[key] !== null ? Number(d[key]) : null)),
      connectNulls: true,
    }));

    if (hasTrend) {
      series.push({
        name: TREND_KEY,
        type: "line" as const,
        smooth: false,
        symbol: "none",
        symbolSize: 0,
        animationDuration: 600,
        animationDelay: 300,
        itemStyle: { color: "#94a3b8" },
        lineStyle: { width: 2, color: "#94a3b8", type: "dashed" },
        data: plotted.map((d) =>
          d[TREND_KEY] == null ? null : Number(d[TREND_KEY])
        ),
        connectNulls: true,
      });
    }

    return {
      ...base,
      xAxis: {
        ...base.xAxis,
        data: categories,
      },
      legend: hasLegend
        ? {
            ...base.legend,
            formatter: (name: string) => withTrendLabel(name),
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
            return (
              `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;line-height:1.6">` +
              `<span>${marker}${escapeHtml(withTrendLabel(p.seriesName))}</span>` +
              `<span style="font-weight:600;font-variant-numeric:tabular-nums">${escapeHtml(formatFullValue(p.value, currency, unit))}</span>` +
              `</div>`
            );
          });
          return header + lines.join("");
        },
      },
      series,
    };
  }, [plotted, seriesKeys, colors, labelOf, showTrendline, unit, currency, multi, trendable]);

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
