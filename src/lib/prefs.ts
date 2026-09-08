import { useSyncExternalStore } from "react";

const SCALE_WARNING_KEY = "starboard_hide_scale_warning";

function readStored(): boolean {
  try {
    return localStorage.getItem(SCALE_WARNING_KEY) === "1";
  } catch {
    return false;
  }
}

let scaleWarningHidden = readStored();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot() {
  return scaleWarningHidden;
}

export function setScaleWarningHidden(next: boolean) {
  if (scaleWarningHidden === next) return;
  scaleWarningHidden = next;
  try {
    localStorage.setItem(SCALE_WARNING_KEY, next ? "1" : "0");
  } catch {
    void 0;
  }
  for (const listener of listeners) listener();
}

export function useScaleWarningHidden() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
