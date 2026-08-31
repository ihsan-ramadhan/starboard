import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { ChartDataPoint } from "../../types";
import { formatChartValue } from "./widgetUtils";

export type LineChartWidgetProps = {
  readonly title: string;
  readonly data: ChartDataPoint[];
  readonly unit?: string;
  readonly color?: string;
  readonly isCurrency?: boolean;
};

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
                tickFormatter={(v) => formatChartValue(v, isCurrency, unit)}
                width={70}
              />
              <Tooltip
                formatter={(v: any) => [formatChartValue(Number(v), isCurrency, unit), "Total"]}
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
