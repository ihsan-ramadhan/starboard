import { useMemo } from "react";
import type { CurrencyCode } from "../../types";
import type { WideRow } from "../../lib/series";
import { ChartFrame, escapeHtml, type SeriesLabeller } from "./chartParts";
import { EChart } from "./EChart";
import { formatCompactValue, formatFullValue } from "../../lib/format";
import { SINGLE_SERIES_COLOR } from "../../lib/palette";
import type { EChartsOption } from "echarts";
import { useLang, useT } from "../../lib/i18n";

export type ScatterWidgetProps = {
  readonly title: string;
  readonly data: readonly WideRow[];
  readonly seriesKeys: readonly string[];
  readonly labelOf: SeriesLabeller;
  readonly unit?: string;
  readonly currency?: CurrencyCode;
  readonly reloadNonce?: number;
};

export default function ScatterWidget({
  title,
  data,
  seriesKeys,
  labelOf,
  unit,
  currency,
  reloadNonce,
}: ScatterWidgetProps) {
  const lang = useLang();
  const t = useT();
  const [xKey, yKey] = seriesKeys;
  const ready = Boolean(xKey && yKey);

  const option = useMemo<EChartsOption>(() => {
    const points = data.map((row) => ({
      name: String(row.groupKey ?? ""),
      value: [Number(row[xKey]) || 0, Number(row[yKey]) || 0],
    }));

    const axisLabel = {
      color: "#64748b",
      fontSize: 11,
      formatter: (val: number) => formatCompactValue(val, currency),
    };

    return {
      animation: true,
      animationDuration: 600,
      grid: { top: 30, right: 18, bottom: 40, left: 8, containLabel: true },
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
          const [x, y] = p.value as [number, number];
          const row = (label: string, value: string) =>
            `<div style="display:flex;justify-content:space-between;gap:12px;line-height:1.6">` +
            `<span>${escapeHtml(label)}</span>` +
            `<span style="font-weight:600;font-variant-numeric:tabular-nums">${escapeHtml(
              value
            )}</span></div>`;
          return (
            `<div style="font-weight:600;margin-bottom:4px">${escapeHtml(p.name)}</div>` +
            row(labelOf(xKey), formatFullValue(x, currency, unit)) +
            row(labelOf(yKey), formatFullValue(y, currency, unit))
          );
        },
      },
      xAxis: {
        type: "value",
        name: labelOf(xKey),
        nameLocation: "middle",
        nameGap: 26,
        nameTextStyle: { color: "#475569", fontSize: 11 },
        axisLine: { lineStyle: { color: "#e2e8f0" } },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
        axisLabel,
      },
      yAxis: {
        type: "value",
        name: labelOf(yKey),
        nameTextStyle: { color: "#475569", fontSize: 11, align: "left" },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
        axisLabel,
      },
      series: [
        {
          type: "scatter",
          data: points,
          symbolSize: 12,
          itemStyle: { color: SINGLE_SERIES_COLOR, opacity: 0.8 },
          emphasis: { itemStyle: { opacity: 1, borderColor: "#0f172a", borderWidth: 1 } },
        },
      ],
    };
  }, [data, xKey, yKey, labelOf, unit, currency, lang]);

  if (!ready) {
    return (
      <ChartFrame title={title} isEmpty={false}>
        <div className="widget-empty">{t("chart.noAxisPair")}</div>
      </ChartFrame>
    );
  }

  return (
    <ChartFrame title={title} isEmpty={data.length === 0}>
      <EChart option={option} reloadNonce={reloadNonce} />
    </ChartFrame>
  );
}
