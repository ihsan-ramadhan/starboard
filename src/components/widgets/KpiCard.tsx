import type { CurrencyCode, GoodDirection, ValueFormat } from "../../types";
import { compactValueAs, formatValueAs } from "../../lib/format";
import { useT } from "../../lib/i18n";
import { WidgetSubtitle } from "./chartParts";

export type KpiCardProps = {
  readonly label: string;
  readonly value: number | null;
  readonly target?: number | null;
  readonly targetLabel?: string;
  readonly unit?: string;
  readonly currency?: CurrencyCode;
  readonly format?: ValueFormat;
  readonly goodDirection?: GoodDirection;
  readonly reloadNonce?: number;
};

export default function KpiCard({
  label,
  value,
  target,
  targetLabel = "Target",
  unit,
  currency,
  format,
  goodDirection = "higher",
  reloadNonce = 0,
}: KpiCardProps) {
  const t = useT();
  const hasTarget =
    typeof value === "number" && typeof target === "number" && target !== 0;
  const ratio = hasTarget ? (value as number) / (target as number) : 0;
  const gap = hasTarget ? (value as number) - (target as number) : 0;
  const above = gap >= 0;
  const good = goodDirection === "lower" ? gap <= 0 : gap >= 0;
  const targetWidth = `${Math.min(Math.max(ratio, 0), 1) * 100}%`;

  return (
    <div className="kpi-wrapper">
      <div className="kpi-label">{label}</div>
      <WidgetSubtitle />
      <div className="kpi-value">
        {value === null ? "…" : compactValueAs(value, format, currency)}
        {unit && !currency && <span className="kpi-unit"> {unit}</span>}
      </div>

      {hasTarget && (
        <div className="kpi-target">
          <div className="kpi-meter" aria-hidden="true">
            <span
              key={reloadNonce}
              className={`kpi-meter-fill${good ? " is-good" : " is-bad"}`}
              style={{ width: targetWidth }}
            />
          </div>
          <div className="kpi-target-row">
            <span className="kpi-target-text">
              {targetLabel} {compactValueAs(target as number, format, currency, unit)}
            </span>
            <span
              className={`kpi-delta${good ? " is-good" : " is-bad"}`}
              title={t("kpi.deltaTitle", {
                dir: t(above ? "kpi.above" : "kpi.below"),
                label: targetLabel.toLowerCase(),
                amount: formatValueAs(Math.abs(gap), format, currency, unit),
              })}
            >
              {above ? "▲" : "▼"} {Math.round(ratio * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
