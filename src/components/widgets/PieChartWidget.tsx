import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartDataPoint } from "../../types";
import { formatChartValue } from "./widgetUtils";

export type PieChartWidgetProps = {
  readonly title: string;
  readonly data: ChartDataPoint[];
  readonly unit?: string;
  readonly isCurrency?: boolean;
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

function renderLegendItem(value: string) {
  return <span style={{ color: "#475569", fontSize: "11px" }}>{value}</span>;
}

export default function PieChartWidget({
  title,
  data,
  unit,
  isCurrency = false,
}: PieChartWidgetProps) {
  return (
    <div className="chart-wrapper">
      <h4 className="widget-title" title={title}>{title}</h4>
      <div className="chart-body">
        {data.length === 0 ? (
          <div className="widget-empty">Tidak ada data untuk ditampilkan</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 0, bottom: 5, left: 0, right: 0 }}>
              <Tooltip
                formatter={(v: any) => [
                  formatChartValue(Number(v), isCurrency, unit),
                  "Total",
                ]}
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
                wrapperStyle={{ fontSize: "11px" }}
                formatter={renderLegendItem}
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="groupKey"
                cx="50%"
                cy="45%"
                innerRadius="45%"
                outerRadius="75%"
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.groupKey || `cell-${index}`}
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
