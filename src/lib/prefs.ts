import { useSyncExternalStore } from "react";

const KEYS = {
  scaleWarningHidden: "sigma_hide_scale_warning",
  dataLabelsShown: "sigma_show_data_labels",
} as const;

type PrefName = keyof typeof KEYS;

function readStored(name: PrefName): boolean {
  try {
    return localStorage.getItem(KEYS[name]) === "1";
  } catch {
    return false;
  }
}

const values: Record<PrefName, boolean> = {
  scaleWarningHidden: readStored("scaleWarningHidden"),
  dataLabelsShown: readStored("dataLabelsShown"),
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function set(name: PrefName, next: boolean) {
  if (values[name] === next) return;
  values[name] = next;
  try {
    localStorage.setItem(KEYS[name], next ? "1" : "0");
  } catch {
    void 0;
  }
  for (const listener of listeners) listener();
}

function usePref(name: PrefName) {
  return useSyncExternalStore(
    subscribe,
    () => values[name],
    () => values[name]
  );
}

export function setScaleWarningHidden(next: boolean) {
  set("scaleWarningHidden", next);
}

export function useScaleWarningHidden() {
  return usePref("scaleWarningHidden");
}

export function setDataLabelsShown(next: boolean) {
  set("dataLabelsShown", next);
}

export function useDataLabelsShown() {
  return usePref("dataLabelsShown");
}
