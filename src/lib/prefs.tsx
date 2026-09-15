import { createContext, useContext, useSyncExternalStore } from "react";

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

export function useGlobalDataLabels() {
  return usePref("dataLabelsShown");
}

const OVERRIDE_KEY = "sigma_widget_data_labels";

function readOverrides(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

let overrides = readOverrides();

export function getDataLabelsOverride(id: string): boolean | undefined {
  return overrides[id];
}

export function setDataLabelsOverride(id: string, next: boolean | undefined) {
  const copy = { ...overrides };
  if (next === undefined) delete copy[id];
  else copy[id] = next;
  overrides = copy;
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(copy));
  } catch {
    void 0;
  }
  for (const listener of listeners) listener();
}

const NO_OVERRIDES: Record<string, boolean> = {};

export function useDataLabelsOverrides(): Record<string, boolean> {
  return useSyncExternalStore(
    subscribe,
    () => overrides,
    () => NO_OVERRIDES
  );
}

const DataLabelsContext = createContext<boolean | undefined>(undefined);

export function DataLabelsProvider({
  value,
  children,
}: {
  readonly value: boolean | undefined;
  readonly children: React.ReactNode;
}) {
  return (
    <DataLabelsContext.Provider value={value}>
      {children}
    </DataLabelsContext.Provider>
  );
}

export function useDataLabelsShown() {
  const override = useContext(DataLabelsContext);
  const global = usePref("dataLabelsShown");
  return override ?? global;
}
