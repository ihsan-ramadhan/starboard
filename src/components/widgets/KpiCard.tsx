export type KpiCardProps = {
  label: string;
  value: number | string | null;
  unit?: string;
  accent?: boolean;
};

export default function KpiCard({
  label,
  value,
  unit,
  accent = false,
}: KpiCardProps) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${accent ? " text-accent" : ""}`}>
        {value !== null && value !== undefined ? value : "..."}
        {unit && <span className="kpi-unit"> {unit}</span>}
      </div>
    </div>
  );
}
