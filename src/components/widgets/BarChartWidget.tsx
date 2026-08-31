import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export type ChartDataPoint = {
  groupKey: string;
  value: number;
};

export type BarChartWidgetProps = {
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

export default function BarChartWidget({
  title,
  data,
  unit,
  color = "#2563eb",
  isCurrency = false,
}: BarChartWidgetProps) {
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
            <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="groupKey"
                tick={{ fontSize: 11, fill: "#64748b" }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={40}
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
              <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
