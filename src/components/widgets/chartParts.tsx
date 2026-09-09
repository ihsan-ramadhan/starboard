import type { ReactNode } from "react";
import type { CurrencyCode } from "../../types";
import { formatCompactValue } from "../../lib/format";
import type { EChartsOption } from "echarts";

export type SeriesLabeller = (series: string) => string;

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
              Sembunyikan
            </button>
          )}
        </p>
      )}
      <div className="chart-body">
        {isEmpty ? (
          <div className="widget-empty">Tidak ada data untuk ditampilkan</div>
        ) : (
          children
        )}
        {!isEmpty && overlay}
      </div>
    </div>
  );
}

export function baseEChartOption(
  hasLegend: boolean,
  currency?: CurrencyCode,
  isPercent = false
): EChartsOption {
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
      backgroundColor: "#ffffff",
      borderColor: "#e2e8f0",
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: "#0f172a", fontSize: 12 },
      extraCssText: "box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08); border-radius: 6px;",
      axisPointer: {
        type: "shadow",
        shadowStyle: { color: "rgba(148, 163, 184, 0.12)" },
      },
    },
    xAxis: {
      type: "category",
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
      axisLabel: {
        color: "#64748b",
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
        lineStyle: { color: "#f1f5f9", type: "dashed" },
      },
      axisLabel: {
        color: "#64748b",
        fontSize: 11,
        formatter: (val: number) =>
          isPercent ? `${Math.round(val * 100)}%` : formatCompactValue(val, currency),
      },
    },
    legend: hasLegend
      ? {
          bottom: 2,
          icon: "circle",
          itemWidth: 8,
          itemHeight: 8,
          textStyle: { color: "#475569", fontSize: 11 },
        }
      : undefined,
  };
}
