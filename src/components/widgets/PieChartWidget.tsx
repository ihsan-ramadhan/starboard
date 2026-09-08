import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import type { ChartDataPoint, CurrencyCode } from "../../types";
import { formatFullValue } from "../../lib/format";
import { ANIMATION_MS, ChartFrame, legendProps, tooltipProps } from "./chartParts";

export type PieChartWidgetProps = {
  readonly title: string;
  readonly data: readonly ChartDataPoint[];
  readonly colors: Record<string, string>;
  readonly unit?: string;
  readonly currency?: CurrencyCode;
};

export default function PieChartWidget({
  title,
  data,
  colors,
  unit,
  currency,
}: PieChartWidgetProps) {
  const total = data.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);

  return (
    <ChartFrame
      title={title}
      isEmpty={data.length === 0}
      resetKey={data}
      overlay={
        <div className="donut-center">
          <span className="donut-center-label">Total</span>
          <span className="donut-center-value">
            {formatFullValue(total, currency, unit)}
          </span>
        </div>
      }
    >
      {(chartWidth, chartHeight, animate) => (
        <PieChart
          width={chartWidth}
          height={chartHeight}
          margin={{ top: 0, bottom: 5, left: 0, right: 0 }}
        >
            <Tooltip {...tooltipProps((name) => name, currency, unit)} />
            <Legend {...legendProps((name) => name)} />
            <Pie
              data={data as ChartDataPoint[]}
              dataKey="value"
              nameKey="groupKey"
              cx="50%"
              cy="45%"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={2}
              isAnimationActive={animate}
              animationBegin={0}
              animationDuration={ANIMATION_MS}
              animationEasing="ease-out"
              stroke="#ffffff"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.groupKey} fill={colors[entry.groupKey]} />
              ))}
            </Pie>
        </PieChart>
      )}
    </ChartFrame>
  );
}
