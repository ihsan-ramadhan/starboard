export type KpiCardProps = {
  readonly label: string;
  readonly value: number | string | null;
  readonly unit?: string;
};

export default function KpiCard({ label, value, unit }: KpiCardProps) {
  return (
    <div className="kpi-wrapper">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value ?? "..."}
        {unit && <span className="kpi-unit"> {unit}</span>}
      </div>
    </div>
  );
}
