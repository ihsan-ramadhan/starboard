import { useMemo } from "react";
import type { CurrencyCode } from "../../types";
import type { WideRow } from "../../lib/series";
import {
  ChartFrame,
  escapeHtml,
  type SeriesLabeller,
  type ValueFormatter,
} from "./chartParts";
import { EChart } from "./EChart";
import { formatAxisValue } from "../../lib/format";
import { singleSeriesColor } from "../../lib/palette";
import type { EChartsOption } from "echarts";
import { useLang, useT } from "../../lib/i18n";
import { chartChrome, useResolvedTheme } from "../../lib/theme";

export type ScatterWidgetProps = {
  readonly title: string;
  readonly data: readonly WideRow[];
  readonly seriesKeys: readonly string[];
  readonly labelOf: SeriesLabeller;
  readonly formatValue: ValueFormatter;
  readonly unit?: string;
  readonly currency?: CurrencyCode;
  readonly reloadNonce?: number;
};

export default function ScatterWidget({
  title,
  data,
  seriesKeys,
  labelOf,
  formatValue,
  unit,
  currency,
  reloadNonce,
}: ScatterWidgetProps) {
  const lang = useLang();
  const theme = useResolvedTheme();
  const c = chartChrome(theme);
  const t = useT();
  const [xKey, yKey] = seriesKeys;
  const ready = Boolean(xKey && yKey);

  const option = useMemo<EChartsOption>(() => {
    const points = data.map((row) => ({
      name: String(row.groupKey ?? ""),
      value: [Number(row[xKey]) || 0, Number(row[yKey]) || 0],
    }));

    const axisLabel = {
      color: c.axis,
      fontSize: 11,
      formatter: (val: number) => formatAxisValue(val, currency),
    };

    return {
      animation: true,
      animationDuration: 600,
      grid: { top: 30, right: 18, bottom: 40, left: 8, containLabel: true },
      tooltip: {
        trigger: "item",
        appendToBody: true,
        backgroundColor: c.panel,
        borderColor: c.panelBorder,
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: c.text, fontSize: 12 },
        extraCssText:
          `box-shadow: 0 4px 6px -1px ${c.shadow}; border-radius: 6px;`,
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
            row(labelOf(xKey), formatValue(xKey, x)) +
            row(labelOf(yKey), formatValue(yKey, y))
          );
        },
      },
      xAxis: {
        type: "value",
        name: labelOf(xKey),
        nameLocation: "middle",
        nameGap: 26,
        nameTextStyle: { color: c.axis, fontSize: 11 },
        axisLine: { lineStyle: { color: c.panelBorder } },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: c.grid, type: "dashed" } },
        axisLabel,
      },
      yAxis: {
        type: "value",
        name: labelOf(yKey),
        nameTextStyle: { color: c.axis, fontSize: 11, align: "left" },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: c.grid, type: "dashed" } },
        axisLabel,
      },
      series: [
        {
          type: "scatter",
          data: points,
          symbolSize: 12,
          itemStyle: { color: singleSeriesColor(theme), opacity: 0.8 },
          emphasis: { itemStyle: { opacity: 1, borderColor: c.text, borderWidth: 1 } },
        },
      ],
    };
  }, [data, xKey, yKey, labelOf, formatValue, unit, currency, lang, theme]);

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
