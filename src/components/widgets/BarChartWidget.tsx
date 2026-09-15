import { useMemo } from "react";
import type { CurrencyCode, SeriesMode } from "../../types";
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
import { formatAxisValue } from "../../lib/format";
import { useDataLabelsShown } from "../../lib/prefs";
import type { EChartsOption } from "echarts";
import { useLang } from "../../lib/i18n";
import { chartChrome, useResolvedTheme } from "../../lib/theme";

export type BarChartWidgetProps = {
  readonly title: string;
  readonly data: readonly WideRow[];
  readonly seriesKeys: readonly string[];
  readonly colors: Record<string, string>;
  readonly labelOf: SeriesLabeller;
  readonly mode: SeriesMode;
  readonly horizontal?: boolean;
  readonly formatValue: ValueFormatter;
  readonly unit?: string;
  readonly currency?: CurrencyCode;
  readonly reloadNonce?: number;
  readonly note?: string;
  readonly onHideNote?: () => void;
};

export default function BarChartWidget({
  title,
  data,
  seriesKeys,
  colors,
  labelOf,
  mode,
  horizontal = false,
  formatValue,
  unit,
  currency,
  reloadNonce,
  note,
  onHideNote,
}: BarChartWidgetProps) {
  const lang = useLang();
  const theme = useResolvedTheme();
  const labels = useDataLabelsShown();
  const stacked = mode !== "grouped" && seriesKeys.length > 1;
  const isPercent = mode === "stacked100" && seriesKeys.length > 1;
  const multi = seriesKeys.length > 1;

  const option = useMemo<EChartsOption>(() => {
    const base = baseEChartOption(multi, currency, isPercent, {
      theme,
      dataLabels: labels,
    });
    const rows = horizontal ? [...data].reverse() : data;
    const categories = rows.map((d) => String(d.groupKey ?? ""));

    const rowSums = isPercent
      ? rows.map((d) =>
          seriesKeys.reduce((sum, key) => sum + (Number(d[key]) || 0), 0)
        )
      : [];

    const labelSpot = stacked ? "inside" : horizontal ? "right" : "top";
    const labelText = blankWhenEmpty((value) =>
      isPercent
        ? `${Math.round(value * 100)}%`
        : formatAxisValue(value, currency)
    );

    const series = seriesKeys.map((key, index) => {
      const isTop = !stacked || index === seriesKeys.length - 1;
      return {
        name: key,
        type: "bar" as const,
        label: dataLabel(labels, theme, labelSpot, labelText),
        labelLayout: HIDE_OVERLAP,
        stack: stacked ? "total" : undefined,
        animationDuration: 750,
        animationEasing: "cubicOut" as const,
        animationDelay: (idx: number) => idx * 25 + index * 40,
        itemStyle: {
          color: colors[key],
          borderRadius: isTop
            ? ((horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]) as [number, number, number, number])
            : undefined,
        },
        data: rows.map((d, rowIndex) => {
          const raw = Number(d[key]) || 0;
          if (!isPercent) return raw;
          const sum = rowSums[rowIndex] || 0;
          return sum > 0 ? raw / sum : 0;
        }),
      };
    });

    const categoryAxis = {
      ...(base.xAxis as any),
      data: categories,
      axisLabel: horizontal
        ? { color: chartChrome(theme).axis, fontSize: 11, overflow: "truncate", width: 120 }
        : (base.xAxis as any).axisLabel,
    };

    return {
      ...base,
      grid: { ...(base.grid as any), left: horizontal ? 4 : 8 },
      xAxis: horizontal ? base.yAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : base.yAxis,
      legend: multi
        ? {
            ...base.legend,
            formatter: (name: string) => labelOf(name),
          }
        : undefined,
      tooltip: {
        ...base.tooltip,
        formatter: (params: any) => {
          if (!Array.isArray(params)) return "";
          const header = `<div style="font-weight:600;margin-bottom:4px">${escapeHtml(params[0]?.axisValueLabel)}</div>`;
          const lines = params.map((p: any) => {
            const marker = `<span style="display:inline-block;margin-right:6px;border-radius:50%;width:8px;height:8px;background-color:${p.color};"></span>`;
            const val = isPercent
              ? `${Math.round(p.value * 100)}%`
              : formatValue(p.seriesName, p.value);
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
  }, [
    data,
    seriesKeys,
    colors,
    labelOf,
    formatValue,
    mode,
    horizontal,
    unit,
    currency,
    stacked,
    isPercent,
    multi,
    lang,
    theme,
    labels,
  ]);

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
