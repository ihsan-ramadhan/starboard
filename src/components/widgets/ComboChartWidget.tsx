import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import type { CurrencyCode } from "../../types";
import type { WideRow } from "../../lib/series";
import {
  ChartFrame,
  categoryAxisProps,
  gridProps,
  legendProps,
  tooltipProps,
  valueTick,
  valueAxisWidth,
  type SeriesLabeller,
} from "./chartParts";

export type ComboChartWidgetProps = {
  readonly title: string;
  readonly data: readonly WideRow[];
  readonly seriesKeys: readonly string[];
  readonly lineKeys: readonly string[];
  readonly colors: Record<string, string>;
  readonly labelOf: SeriesLabeller;
  readonly unit?: string;
  readonly currency?: CurrencyCode;
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
  unit,
  currency,
  note,
  onHideNote,
}: ComboChartWidgetProps) {
  const barKeys = seriesKeys.filter((key) => !lineKeys.includes(key));

  return (
    <ChartFrame title={title} isEmpty={data.length === 0} note={note} onHideNote={onHideNote}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data as WideRow[]}
          margin={{ top: 10, right: 15, left: 0, bottom: 8 }}
          barGap={2}
        >
          <CartesianGrid {...gridProps} />
          <XAxis {...categoryAxisProps} />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={valueTick(currency)}
            width={valueAxisWidth(currency)}
          />
          <Tooltip
            cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
            {...tooltipProps(labelOf, currency, unit)}
          />
          <Legend {...legendProps(labelOf)} />
          {barKeys.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              name={key}
              fill={colors[key]}
              radius={[4, 4, 0, 0]}
            />
          ))}
          {lineKeys.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={key}
              stroke={colors[key]}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: colors[key] }}
              activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2 }}
              connectNulls
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
