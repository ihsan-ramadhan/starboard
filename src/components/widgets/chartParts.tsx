import type { ReactNode } from "react";
import type { CurrencyCode } from "../../types";
import { formatCompactValue, formatFullValue } from "../../lib/format";
import { AXIS_COLOR, GRID_COLOR, TOOLTIP_STYLE } from "../../lib/palette";

export type SeriesLabeller = (series: string) => string;

export type ChartFrameProps = {
  readonly title: string;
  readonly isEmpty: boolean;
  readonly note?: string;
  readonly onHideNote?: () => void;
  readonly children: ReactNode;
};

export function ChartFrame({
  title,
  isEmpty,
  note,
  onHideNote,
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
      </div>
    </div>
  );
}

export const axisTick = { fontSize: 11, fill: AXIS_COLOR };

export const gridProps = {
  strokeDasharray: "3 3",
  vertical: false,
  stroke: GRID_COLOR,
} as const;

const MAX_TICK_CHARS = 12;

function truncateTick(value: unknown): string {
  const text = String(value ?? "");
  if (text.length <= MAX_TICK_CHARS) return text;
  return `${text.slice(0, MAX_TICK_CHARS - 1).trimEnd()}…`;
}

export const categoryAxisProps = {
  dataKey: "groupKey",
  tick: axisTick,
  interval: "preserveStartEnd",
  angle: -35,
  textAnchor: "end",
  height: 62,
  tickFormatter: truncateTick,
} as const;

export function valueAxisWidth(currency?: CurrencyCode) {
  return currency ? 86 : 65;
}

export function valueTick(currency?: CurrencyCode) {
  return (value: number) => formatCompactValue(value, currency);
}

export function percentTick(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function tooltipProps(
  labelOf: SeriesLabeller,
  currency?: CurrencyCode,
  unit?: string
) {
  return {
    contentStyle: TOOLTIP_STYLE,
    labelFormatter: (label: unknown) => String(label ?? ""),
    formatter: (value: unknown, name: unknown) => [
      formatFullValue(Number(value), currency, unit),
      labelOf(String(name)),
    ],
  };
}

export function legendProps(labelOf: SeriesLabeller) {
  return {
    verticalAlign: "bottom" as const,
    height: 30,
    wrapperStyle: { fontSize: "11px" },
    formatter: (value: string) => (
      <span style={{ color: "#475569", fontSize: "11px" }}>{labelOf(value)}</span>
    ),
  };
}
