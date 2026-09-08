import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import type { CurrencyCode } from "../../types";
import { TREND_KEY, withTrendline, type WideRow } from "../../lib/series";
import {
  ANIMATION_MS,
  ChartFrame,
  categoryAxisProps,
  gridProps,
  legendProps,
  tooltipProps,
  valueTick,
  valueAxisWidth,
  type SeriesLabeller,
} from "./chartParts";

export type LineChartWidgetProps = {
  readonly title: string;
  readonly data: readonly WideRow[];
  readonly seriesKeys: readonly string[];
  readonly colors: Record<string, string>;
  readonly labelOf: SeriesLabeller;
  readonly showTrendline?: boolean;
  readonly unit?: string;
  readonly currency?: CurrencyCode;
  readonly note?: string;
  readonly onHideNote?: () => void;
};

export default function LineChartWidget({
  title,
  data,
  seriesKeys,
  colors,
  labelOf,
  showTrendline,
  unit,
  currency,
  note,
  onHideNote,
}: LineChartWidgetProps) {
  const multi = seriesKeys.length > 1;
  const trendable = showTrendline && seriesKeys.length === 1;
  const plotted = trendable
    ? withTrendline(data, seriesKeys[0])
    : (data as WideRow[]);

  const withTrendLabel: SeriesLabeller = (series) =>
    series === TREND_KEY ? "Garis tren" : labelOf(series);

  return (
    <ChartFrame
      title={title}
      isEmpty={data.length === 0}
      note={note}
      onHideNote={onHideNote}
      resetKey={data}
    >
      {(chartWidth, chartHeight, animate) => (
        <LineChart
          width={chartWidth}
          height={chartHeight}
          data={plotted}
          margin={{ top: 10, right: 15, left: 0, bottom: 8 }}
        >
          <CartesianGrid {...gridProps} />
          <XAxis {...categoryAxisProps} />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={valueTick(currency)}
            width={valueAxisWidth(currency)}
          />
          <Tooltip {...tooltipProps(withTrendLabel, currency, unit)} />
          {(multi || trendable) && <Legend {...legendProps(withTrendLabel)} />}
          {seriesKeys.map((key) => (
            <Line
              key={key}
              isAnimationActive={animate}
              animationDuration={ANIMATION_MS}
              animationEasing="ease-out"
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
          {trendable && (
            <Line
              isAnimationActive={animate}
              animationDuration={ANIMATION_MS}
              animationEasing="ease-out"
              type="linear"
              dataKey={TREND_KEY}
              name={TREND_KEY}
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
            />
          )}
        </LineChart>
      )}
    </ChartFrame>
  );
}
