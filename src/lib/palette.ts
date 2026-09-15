import type { Resolved } from "./theme";
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

const SERIES_COLORS_DARK = [
  "#5c9ded",
  "#f4915f",
  "#35c893",
  "#f0b93a",
  "#f09cba",
  "#48b348",
  "#8b7ae0",
  "#ef7170",
] as const;

const OTHER_COLOR = "#94a3b8";
const OTHER_COLOR_DARK = "#8d8577";

const SINGLE_LIGHT = "#2563eb";
const SINGLE_DARK = "#d9a441";

export function singleSeriesColor(theme: Resolved): string {
  return theme === "dark" ? SINGLE_DARK : SINGLE_LIGHT;
}

export function buildColorMap(
  series: readonly string[],
  theme: Resolved = "light"
): Record<string, string> {
  const dark = theme === "dark";
  const stable = series
    .filter((name) => name !== OTHER_SERIES)
    .slice()
    .sort((a, b) => a.localeCompare(b, "id-ID"));

  if (stable.length === 1) {
    return {
      [OTHER_SERIES]: dark ? OTHER_COLOR_DARK : OTHER_COLOR,
      [stable[0]]: singleSeriesColor(theme),
    };
  }

  const palette = dark ? SERIES_COLORS_DARK : SERIES_COLORS;
  const map: Record<string, string> = {
    [OTHER_SERIES]: dark ? OTHER_COLOR_DARK : OTHER_COLOR,
  };
  stable.forEach((name, index) => {
    map[name] = palette[index] ?? (dark ? OTHER_COLOR_DARK : OTHER_COLOR);
  });
  return map;
}

export const AXIS_COLOR = "#64748b";
export const GRID_COLOR = "#f1f5f9";

export const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  borderColor: "#e2e8f0",
  borderRadius: "6px",
  fontSize: "12px",
} as const;
