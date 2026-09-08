import type { CurrencyCode } from "../../types";
import { formatCompactValue, formatFullValue } from "../../lib/format";

export type KpiCardProps = {
  readonly label: string;
  readonly value: number | null;
  readonly target?: number | null;
  readonly targetLabel?: string;
  readonly unit?: string;
  readonly currency?: CurrencyCode;
};

export default function KpiCard({
  label,
  value,
  target,
  targetLabel = "Target",
  unit,
  currency,
}: KpiCardProps) {
  const hasTarget =
    typeof value === "number" && typeof target === "number" && target !== 0;
  const ratio = hasTarget ? (value as number) / (target as number) : 0;
  const gap = hasTarget ? (value as number) - (target as number) : 0;
  const reached = gap >= 0;

  return (
    <div className="kpi-wrapper">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value === null ? "…" : formatCompactValue(value, currency)}
        {unit && !currency && <span className="kpi-unit"> {unit}</span>}
      </div>

      {hasTarget && (
        <div className="kpi-target">
          <div
            className="kpi-meter"
            role="meter"
            aria-valuenow={Math.round(ratio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Pencapaian terhadap ${targetLabel}`}
          >
            <span
              className={`kpi-meter-fill${reached ? " is-reached" : ""}`}
              style={{ width: `${Math.min(Math.max(ratio, 0), 1) * 100}%` }}
            />
          </div>
          <div className="kpi-target-row">
            <span className="kpi-target-text">
              {targetLabel} {formatCompactValue(target as number, currency)}
            </span>
            <span
              className={`kpi-delta${reached ? " is-up" : " is-down"}`}
              title={formatFullValue(Math.abs(gap), currency, unit)}
            >
              {reached ? "▲" : "▼"} {Math.round(ratio * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
