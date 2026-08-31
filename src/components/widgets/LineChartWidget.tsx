import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { ChartDataPoint } from "./BarChartWidget";

export type LineChartWidgetProps = {
  title: string;
  data: ChartDataPoint[];
  unit?: string;
  color?: string;
  isCurrency?: boolean;
};

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

export default function LineChartWidget({
  title,
  data,
  unit,
  color = "#2563eb",
  isCurrency = false,
}: LineChartWidgetProps) {
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
            <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="groupKey"
                tick={{ fontSize: 11, fill: "#64748b" }}
                interval={0}
                textAnchor="middle"
                height={30}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(v) => formatVal(v, isCurrency, unit)}
                width={70}
              />
              <Tooltip
                formatter={(v: any) => [formatVal(Number(v), isCurrency, unit), "Total"]}
                labelStyle={{ fontWeight: 600, color: "#0f172a" }}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  borderColor: "#e2e8f0",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                dot={{ r: 4, fill: color }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
