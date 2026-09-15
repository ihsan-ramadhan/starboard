import type { ReactNode } from "react";
import type { CurrencyCode } from "../../types";
import { formatAxisValue } from "../../lib/format";
import { chartChrome, type Resolved } from "../../lib/theme";
import type { EChartsOption } from "echarts";
import { useT } from "../../lib/i18n";

export type SeriesLabeller = (series: string) => string;

export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type ChartFrameProps = {
  readonly title: string;
  readonly isEmpty: boolean;
  readonly note?: string;
  readonly onHideNote?: () => void;
  readonly overlay?: ReactNode;
  readonly children: ReactNode;
};

export function ChartFrame({
  title,
  isEmpty,
  note,
  onHideNote,
  overlay,
  children,
}: ChartFrameProps) {
  const t = useT();
  return (
    <div className="chart-wrapper">
      <h4 className="widget-title" title={title}>
        {title}
      </h4>
      {note && !isEmpty && (
        <p className="chart-note">
          <span>{note}</span>
          {onHideNote && (
            <button type="button" className="chart-note-hide" onClick={onHideNote}>
              {t("chart.hideNote")}
            </button>
          )}
        </p>
      )}
      <div className="chart-body">
        {isEmpty ? (
          <div className="widget-empty">{t("chart.noData")}</div>
        ) : (
          children
        )}
        {!isEmpty && overlay}
      </div>
    </div>
  );
}

export type ValueFormatter = (series: string, value: number) => string;

export type SingleFormatter = (value: number) => string;

export function baseEChartOption(
  hasLegend: boolean,
  currency?: CurrencyCode,
  isPercent = false,
  opts: { boundaryGap?: boolean; theme?: Resolved } = {}
): EChartsOption {
  const c = chartChrome(opts.theme ?? "light");
  return {
    animation: true,
    animationDuration: 800,
    animationEasing: "cubicOut",
    animationDurationUpdate: 400,
    animationEasingUpdate: "cubicOut",
    grid: {
      top: 14,
      right: 14,
      bottom: hasLegend ? 32 : 12,
      left: 8,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      appendToBody: true,
      backgroundColor: c.panel,
      borderColor: c.panelBorder,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: c.text, fontSize: 12 },
      extraCssText: `box-shadow: 0 4px 6px -1px ${c.shadow}; border-radius: 6px;`,
      axisPointer: {
        type: "shadow",
        shadowStyle: { color: c.splitArea },
      },
    },
    xAxis: {
      type: "category",
      boundaryGap: opts.boundaryGap ?? true,
      axisLine: { lineStyle: { color: c.axisLine } },
      axisTick: { show: false },
      axisLabel: {
        color: c.axis,
        fontSize: 11,
        rotate: 30,
        interval: "auto",
        overflow: "truncate",
        width: 80,
      },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        lineStyle: { color: c.grid, type: "dashed" },
      },
      axisLabel: {
        color: c.axis,
        fontSize: 11,
        formatter: (val: number) =>
          isPercent ? `${Math.round(val * 100)}%` : formatAxisValue(val, currency),
      },
    },
    legend: hasLegend
      ? {
          bottom: 2,
          icon: "circle",
          itemWidth: 8,
          itemHeight: 8,
          textStyle: { color: c.axis, fontSize: 11 },
        }
      : undefined,
  };
}
