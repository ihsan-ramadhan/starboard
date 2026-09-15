import { useSyncExternalStore } from "react";

export type ThemeChoice = "system" | "light" | "dark";
export type Resolved = "light" | "dark";

const STORAGE_KEY = "sigma_theme";

function read(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {}
  return "system";
}

let choice: ThemeChoice = read();
const listeners = new Set<() => void>();

const media =
  typeof matchMedia === "function"
    ? matchMedia("(prefers-color-scheme: dark)")
    : null;

function systemIsDark(): boolean {
  return media?.matches ?? false;
}

export function resolveTheme(pick: ThemeChoice = choice): Resolved {
  if (pick === "system") return systemIsDark() ? "dark" : "light";
  return pick;
}

function paint() {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  root.style.colorScheme = resolveTheme();
}

export function getTheme(): ThemeChoice {
  return choice;
}

export function setTheme(next: ThemeChoice) {
  if (next === choice) return;
  choice = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {}
  paint();
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

media?.addEventListener("change", () => {
  if (choice !== "system") return;
  paint();
  for (const notify of listeners) notify();
});

paint();

export function useTheme(): ThemeChoice {
  return useSyncExternalStore(subscribe, getTheme, getTheme);
}

export function useResolvedTheme(): Resolved {
  return useSyncExternalStore(
    subscribe,
    () => resolveTheme(),
    () => "light" as Resolved
  );
}

type ChartChrome = {
  readonly text: string;
  readonly axis: string;
  readonly grid: string;
  readonly axisLine: string;
  readonly panel: string;
  readonly panelBorder: string;
  readonly shadow: string;
  readonly splitArea: string;
  readonly heatRamp: readonly string[];
  readonly good: string;
  readonly bad: string;
  readonly track: string;
};

const LIGHT: ChartChrome = {
  text: "#0f172a",
  axis: "#64748b",
  grid: "#f1f5f9",
  axisLine: "#e2e8f0",
  panel: "#ffffff",
  panelBorder: "#e2e8f0",
  shadow: "rgba(0,0,0,0.08)",
  splitArea: "rgba(148,163,184,0.06)",
  heatRamp: ["#eff6ff", "#bfdbfe", "#60a5fa", "#2563eb", "#1e3a8a"],
  good: "#15803d",
  bad: "#b91c1c",
  track: "#e2e8f0",
};

const DARK: ChartChrome = {
  text: "#f5f1ea",
  axis: "#a39a8b",
  grid: "#2b2620",
  axisLine: "#332c22",
  panel: "#201c16",
  panelBorder: "#3b3328",
  shadow: "rgba(0,0,0,0.55)",
  splitArea: "rgba(245,241,234,0.04)",
  heatRamp: ["#2a2118", "#5c4a2a", "#a07b31", "#d9a441", "#f5cf7a"],
  good: "#4ade80",
  bad: "#f87171",
  track: "#332c22",
};

export function chartChrome(theme: Resolved): ChartChrome {
  return theme === "dark" ? DARK : LIGHT;
}
