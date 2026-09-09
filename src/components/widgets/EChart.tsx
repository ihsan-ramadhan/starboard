import { useEffect, useRef } from "react";
import { init, use, type EChartsType } from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  AxisPointerComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

use([
  BarChart,
  LineChart,
  PieChart,
  AxisPointerComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const RESIZE_ANIMATION_MS = 200;

export type EChartProps = {
  readonly option: EChartsOption;
  readonly reloadNonce?: number;
  readonly className?: string;
  readonly style?: React.CSSProperties;
};

export function EChart({
  option,
  reloadNonce = 0,
  className,
  style,
}: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const initialOption = useRef(option);
  const settled = useRef(false);
  const lastNonce = useRef(reloadNonce);
  const replayPending = useRef(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const chart = init(node, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    chart.setOption(initialOption.current);

    let prevWidth = Math.round(node.clientWidth);
    let prevHeight = Math.round(node.clientHeight);

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width <= 0 || height <= 0) return;
      if (width === prevWidth && height === prevHeight) return;
      prevWidth = width;
      prevHeight = height;
      chart.resize({
        animation: { duration: RESIZE_ANIMATION_MS, easing: "cubicOut" },
      });
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
      settled.current = false;
    };
  }, []);

  useEffect(() => {
    if (lastNonce.current === reloadNonce) return;
    lastNonce.current = reloadNonce;
    replayPending.current = true;
  }, [reloadNonce]);

  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    const chart = chartRef.current;
    if (!chart) return;
    if (replayPending.current) {
      replayPending.current = false;
      chart.clear();
    }
    chart.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
}
