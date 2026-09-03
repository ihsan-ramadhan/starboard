export type KpiCardProps = {
  readonly label: string;
  readonly value: number | string | null;
  readonly unit?: string;
  readonly accent?: boolean;
};

export default function KpiCard({
  label,
  value,
  unit,
  accent = false,
}: KpiCardProps) {
  return (
    <div className="kpi-wrapper">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${accent ? " text-accent" : ""}`}>
        {value ?? "..."}
        {unit && <span className="kpi-unit"> {unit}</span>}
      </div>
    </div>
  );
}
