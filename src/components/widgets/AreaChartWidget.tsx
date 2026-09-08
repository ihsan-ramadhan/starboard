import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import type { CurrencyCode, SeriesMode } from "../../types";
import type { WideRow } from "../../lib/series";
import {
  ANIMATION_MS,
  ChartFrame,
  categoryAxisProps,
  gridProps,
  legendProps,
  percentTick,
  tooltipProps,
  valueTick,
  valueAxisWidth,
  type SeriesLabeller,
} from "./chartParts";

export type AreaChartWidgetProps = {
  readonly title: string;
  readonly data: readonly WideRow[];
  readonly seriesKeys: readonly string[];
  readonly colors: Record<string, string>;
  readonly labelOf: SeriesLabeller;
  readonly mode: SeriesMode;
  readonly unit?: string;
  readonly currency?: CurrencyCode;
  readonly note?: string;
  readonly onHideNote?: () => void;
};

export default function AreaChartWidget({
  title,
  data,
  seriesKeys,
  colors,
  labelOf,
  mode,
  unit,
  currency,
  note,
  onHideNote,
}: AreaChartWidgetProps) {
  const multi = seriesKeys.length > 1;
  const stacked = mode !== "grouped" && multi;
  const expanded = mode === "stacked100" && multi;

  return (
    <ChartFrame
      title={title}
      isEmpty={data.length === 0}
      note={note}
      onHideNote={onHideNote}
      resetKey={data}
    >
      {(chartWidth, chartHeight, animate) => (
        <AreaChart
          width={chartWidth}
          height={chartHeight}
          data={data as WideRow[]}
          margin={{ top: 10, right: 15, left: 0, bottom: 8 }}
          stackOffset={expanded ? "expand" : undefined}
        >
          <CartesianGrid {...gridProps} />
          <XAxis {...categoryAxisProps} />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={expanded ? percentTick : valueTick(currency)}
            width={valueAxisWidth(currency)}
          />
          <Tooltip {...tooltipProps(labelOf, currency, unit)} />
          {multi && <Legend {...legendProps(labelOf)} />}
          {seriesKeys.map((key) => (
            <Area
              key={key}
              isAnimationActive={animate}
              animationDuration={ANIMATION_MS}
              animationEasing="ease-out"
              type="monotone"
              dataKey={key}
              name={key}
              stackId={stacked ? "stack" : undefined}
              stroke={colors[key]}
              strokeWidth={2}
              fill={colors[key]}
              fillOpacity={stacked ? 0.85 : 0.18}
              connectNulls
            />
          ))}
        </AreaChart>
      )}
    </ChartFrame>
  );
}
