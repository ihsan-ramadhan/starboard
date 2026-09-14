import { useMemo } from "react";
import type { CurrencyCode } from "../../types";
import type { WideRow } from "../../lib/series";
import { ChartFrame, escapeHtml, type SeriesLabeller } from "./chartParts";
import { EChart } from "./EChart";
import { formatFullValue } from "../../lib/format";
import type { EChartsOption } from "echarts";
import { useLang } from "../../lib/i18n";

export type HeatmapWidgetProps = {
  readonly title: string;
  readonly data: readonly WideRow[];
  readonly seriesKeys: readonly string[];
  readonly labelOf: SeriesLabeller;
  readonly unit?: string;
  readonly currency?: CurrencyCode;
  readonly reloadNonce?: number;
};

const RAMP = ["#eff6ff", "#bfdbfe", "#60a5fa", "#2563eb", "#1e3a8a"];

export default function HeatmapWidget({
  title,
  data,
  seriesKeys,
  labelOf,
  unit,
  currency,
  reloadNonce,
}: HeatmapWidgetProps) {
  const lang = useLang();

  const option = useMemo<EChartsOption>(() => {
    const columns = data.map((d) => String(d.groupKey ?? ""));
    const rows = [...seriesKeys].reverse();

    const cells: [number, number, number][] = [];
    let max = 0;
    data.forEach((row, x) => {
      rows.forEach((key, y) => {
        const value = Number(row[key]) || 0;
        if (value > max) max = value;
        cells.push([x, y, value]);
      });
    });

    return {
      animation: true,
      animationDuration: 600,
      grid: { top: 12, right: 14, bottom: 56, left: 8, containLabel: true },
      tooltip: {
        trigger: "item",
        appendToBody: true,
        backgroundColor: "#ffffff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: "#0f172a", fontSize: 12 },
        extraCssText:
          "box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08); border-radius: 6px;",
        formatter: (p: any) => {
          const [x, y, value] = p.value as [number, number, number];
          return (
            `<div style="font-weight:600;margin-bottom:4px">${escapeHtml(
              labelOf(rows[y])
            )}</div>` +
            `<div style="display:flex;justify-content:space-between;gap:12px">` +
            `<span>${escapeHtml(columns[x])}</span>` +
            `<span style="font-weight:600;font-variant-numeric:tabular-nums">${escapeHtml(
              formatFullValue(value, currency, unit)
            )}</span></div>`
          );
        },
      },
      xAxis: {
        type: "category",
        data: columns,
        splitArea: { show: true },
        axisLine: { lineStyle: { color: "#e2e8f0" } },
        axisTick: { show: false },
        axisLabel: {
          color: "#64748b",
          fontSize: 11,
          rotate: 30,
          overflow: "truncate",
          width: 80,
        },
      },
      yAxis: {
        type: "category",
        data: rows.map((key) => labelOf(key)),
        splitArea: { show: true },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#64748b",
          fontSize: 11,
          overflow: "truncate",
          width: 110,
        },
      },
      visualMap: {
        min: 0,
        max: max || 1,
        calculable: false,
        orient: "horizontal",
        left: "center",
        bottom: 2,
        itemWidth: 10,
        itemHeight: 90,
        textStyle: { color: "#64748b", fontSize: 11 },
        inRange: { color: RAMP },
      },
      series: [
        {
          type: "heatmap",
          data: cells,
          progressive: 0,
          itemStyle: { borderColor: "#ffffff", borderWidth: 1 },
          emphasis: {
            itemStyle: { borderColor: "#0f172a", borderWidth: 1 },
          },
        },
      ],
    };
  }, [data, seriesKeys, labelOf, unit, currency, lang]);

  return (
    <ChartFrame title={title} isEmpty={data.length === 0 || seriesKeys.length === 0}>
      <EChart option={option} reloadNonce={reloadNonce} />
    </ChartFrame>
  );
}
