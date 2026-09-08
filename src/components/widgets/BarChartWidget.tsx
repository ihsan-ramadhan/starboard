import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import type { CurrencyCode, SeriesMode } from "../../types";
import type { WideRow } from "../../lib/series";
import {
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

export type BarChartWidgetProps = {
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

export default function BarChartWidget({
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
}: BarChartWidgetProps) {
  const stacked = mode !== "grouped" && seriesKeys.length > 1;
  const expanded = mode === "stacked100" && seriesKeys.length > 1;
  const multi = seriesKeys.length > 1;

  return (
    <ChartFrame title={title} isEmpty={data.length === 0} note={note} onHideNote={onHideNote}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data as WideRow[]}
          margin={{ top: 10, right: 10, left: 0, bottom: 8 }}
          barGap={2}
          stackOffset={expanded ? "expand" : undefined}
        >
          <CartesianGrid {...gridProps} />
          <XAxis {...categoryAxisProps} />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={expanded ? percentTick : valueTick(currency)}
            width={valueAxisWidth(currency)}
          />
          <Tooltip
            cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
            {...tooltipProps(labelOf, currency, unit)}
          />
          {multi && <Legend {...legendProps(labelOf)} />}
          {seriesKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              name={key}
              fill={colors[key]}
              stackId={stacked ? "stack" : undefined}
              stroke={stacked ? "#ffffff" : undefined}
              strokeWidth={stacked ? 2 : 0}
              radius={
                !stacked || index === seriesKeys.length - 1
                  ? [4, 4, 0, 0]
                  : undefined
              }
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
