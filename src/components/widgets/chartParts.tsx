import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CurrencyCode } from "../../types";
import { formatCompactValue, formatFullValue } from "../../lib/format";
import { AXIS_COLOR, GRID_COLOR, TOOLTIP_STYLE } from "../../lib/palette";

export type SeriesLabeller = (series: string) => string;

function useElementSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      if (w <= 0 || h <= 0) return;

      setSize((current) =>
        current.w === w && current.h === h ? current : { w, h }
      );
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return size;
}

export const ANIMATION_MS = 600;

export type ChartFrameProps = {
  readonly title: string;
  readonly isEmpty: boolean;
  readonly note?: string;
  readonly onHideNote?: () => void;
  readonly overlay?: ReactNode;
  readonly resetKey?: unknown;
  readonly children: (width: number, height: number, animate: boolean) => ReactNode;
};

export function ChartFrame({
  title,
  isEmpty,
  note,
  onHideNote,
  overlay,
  resetKey,
  children,
}: ChartFrameProps) {
  const box = useRef<HTMLDivElement>(null);
  const size = useElementSize(box);
  const animatedRef = useRef(false);
  const lastResetKey = useRef(resetKey);

  if (lastResetKey.current !== resetKey) {
    lastResetKey.current = resetKey;
    animatedRef.current = false;
  }

  const animate = !animatedRef.current && size.w > 0 && size.h > 0;

  useEffect(() => {
    if (animate) {
      const timer = window.setTimeout(() => {
        animatedRef.current = true;
      }, ANIMATION_MS);
      return () => window.clearTimeout(timer);
    }
  }, [animate]);

  const content =
    size.w === 0 || size.h === 0
      ? null
      : children(size.w, size.h, animate);

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
      <div className="chart-body" ref={box}>
        {isEmpty ? (
          <div className="widget-empty">Tidak ada data untuk ditampilkan</div>
        ) : (
          content
        )}
        {!isEmpty && overlay}
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
