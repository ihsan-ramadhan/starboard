export const OTHER_SERIES = "Lainnya";

const SERIES_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
] as const;

const OTHER_COLOR = "#94a3b8";

export function buildColorMap(series: readonly string[]): Record<string, string> {
  const stable = series
    .filter((name) => name !== OTHER_SERIES)
    .slice()
    .sort((a, b) => a.localeCompare(b, "id-ID"));

  const map: Record<string, string> = { [OTHER_SERIES]: OTHER_COLOR };
  stable.forEach((name, index) => {
    map[name] = SERIES_COLORS[index] ?? OTHER_COLOR;
  });
  return map;
}

export const SINGLE_SERIES_COLOR = SERIES_COLORS[0];

export const AXIS_COLOR = "#64748b";
export const GRID_COLOR = "#f1f5f9";

export const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  borderColor: "#e2e8f0",
  borderRadius: "6px",
  fontSize: "12px",
} as const;
