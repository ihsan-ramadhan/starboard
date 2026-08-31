import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartDataPoint } from "./BarChartWidget";

export type PieChartWidgetProps = {
  title: string;
  data: ChartDataPoint[];
  unit?: string;
  isCurrency?: boolean;
};

const DEFAULT_COLORS = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#64748b",
];

function formatVal(val: number, isCurrency?: boolean, unit?: string): string {
  if (isCurrency) {
    if (val >= 1_000_000_000) {
      return `Rp ${(val / 1_000_000_000).toFixed(1)} M`;
    }
    if (val >= 1_000_000) {
      return `Rp ${(val / 1_000_000).toFixed(1)} Jt`;
    }
    return `Rp ${Math.round(val).toLocaleString("id-ID")}`;
  }
  return `${val.toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit ? ` ${unit}` : ""}`;
}

export default function PieChartWidget({
  title,
  data,
  unit,
  isCurrency = false,
}: PieChartWidgetProps) {
  return (
    <div className="widget-card">
      <div className="widget-header">
        <h4 className="widget-title">{title}</h4>
      </div>
      <div className="widget-body">
        {data.length === 0 ? (
          <div className="widget-empty">Tidak ada data untuk ditampilkan</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart margin={{ top: 0, bottom: 20, left: 0, right: 0 }}>
              <Tooltip
                formatter={(v: any) => [formatVal(Number(v), isCurrency, unit), "Total"]}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  borderColor: "#e2e8f0",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Legend
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ paddingTop: "10px", fontSize: "11.5px" }}
                formatter={(value) => (
                  <span style={{ color: "#475569" }}>{value}</span>
                )}
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="groupKey"
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
