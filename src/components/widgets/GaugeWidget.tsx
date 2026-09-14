import { useMemo } from "react";
import type { CurrencyCode, GoodDirection } from "../../types";
import { ChartFrame } from "./chartParts";
import { EChart } from "./EChart";
import { formatCompactValue } from "../../lib/format";
import type { EChartsOption } from "echarts";
import { useLang } from "../../lib/i18n";

export type GaugeWidgetProps = {
  readonly title: string;
  readonly value: number | null;
  readonly max: number | null;
  readonly goodDirection?: GoodDirection;
  readonly unit?: string;
  readonly currency?: CurrencyCode;
  readonly reloadNonce?: number;
};

const GOOD = "#15803d";
const BAD = "#b91c1c";
const TRACK = "#e2e8f0";

export default function GaugeWidget({
  title,
  value,
  max,
  goodDirection = "higher",
  unit,
  currency,
  reloadNonce,
}: GaugeWidgetProps) {
  const lang = useLang();

  const option = useMemo<EChartsOption>(() => {
    const ceiling = max && max > 0 ? max : Math.max(value ?? 0, 1);
    const current = value ?? 0;
    const reached = current >= ceiling;
    const good = goodDirection === "lower" ? !reached : reached;

    return {
      animation: true,
      animationDuration: 900,
      animationEasing: "cubicOut",
      series: [
        {
          type: "gauge",
          min: 0,
          max: ceiling,
          startAngle: 210,
          endAngle: -30,
          radius: "92%",
          center: ["50%", "62%"],
          progress: {
            show: true,
            width: 14,
            roundCap: true,
            itemStyle: { color: good ? GOOD : BAD },
          },
          axisLine: {
            roundCap: true,
            lineStyle: { width: 14, color: [[1, TRACK]] },
          },
          pointer: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          anchor: { show: false },
          title: { show: false },
          detail: {
            offsetCenter: [0, "-2%"],
            fontSize: 26,
            fontWeight: 700,
            color: "#0f172a",
            formatter: () => formatCompactValue(current, currency, unit),
          },
          data: [{ value: Math.min(current, ceiling) }],
        },
      ],
    };
  }, [value, max, goodDirection, unit, currency, lang]);

  return (
    <ChartFrame title={title} isEmpty={value === null}>
      <EChart option={option} reloadNonce={reloadNonce} />
    </ChartFrame>
  );
}
