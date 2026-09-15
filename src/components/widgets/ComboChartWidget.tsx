import { useMemo } from "react";
import type { CurrencyCode } from "../../types";
import type { WideRow } from "../../lib/series";
import {
  ChartFrame,
  baseEChartOption,
  dataLabel,
  blankWhenEmpty,
  HIDE_OVERLAP,
  type SeriesLabeller,
  type ValueFormatter,
  escapeHtml,
} from "./chartParts";
import { EChart } from "./EChart";
import { formatAxisValue, formatFullValue } from "../../lib/format";
import { useDataLabelsShown } from "../../lib/prefs";
import type { EChartsOption } from "echarts";
import { useLang } from "../../lib/i18n";
import { useResolvedTheme } from "../../lib/theme";

export type ComboChartWidgetProps = {
  readonly title: string;
  readonly data: readonly WideRow[];
  readonly seriesKeys: readonly string[];
  readonly lineKeys: readonly string[];
  readonly colors: Record<string, string>;
  readonly labelOf: SeriesLabeller;
  readonly formatValue: ValueFormatter;
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
  formatValue,
  unit,
  currency,
  reloadNonce,
  note,
  onHideNote,
}: ComboChartWidgetProps) {
  const lang = useLang();
  const theme = useResolvedTheme();
  const labels = useDataLabelsShown();
  const barKeys = seriesKeys.filter((key) => !lineKeys.includes(key));

  const option = useMemo<EChartsOption>(() => {
    const base = baseEChartOption(true, currency, false, {
      theme,
      dataLabels: labels,
    });
    const categories = data.map((d) => String(d.groupKey ?? ""));

    const labelText = blankWhenEmpty((value) => formatAxisValue(value, currency));

    const barSeries = barKeys.map((key, index) => ({
      name: key,
      type: "bar" as const,
      label: dataLabel(labels, theme, "top", labelText),
      labelLayout: HIDE_OVERLAP,
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
      label: dataLabel(labels, theme, "top", labelText),
      labelLayout: HIDE_OVERLAP,
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
              `<span style="font-weight:600;font-variant-numeric:tabular-nums">${escapeHtml(formatValue(p.seriesName, p.value))}</span>` +
              `</div>`
            );
          });
          return header + lines.join("");
        },
      },
      series: [...barSeries, ...lineSeries],
    };
  }, [data, seriesKeys, lineKeys, colors, labelOf, formatValue, unit, currency, lang, theme, labels]);

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
