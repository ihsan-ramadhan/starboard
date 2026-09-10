import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";

export function isDesktop() {
  return isTauri();
}

export async function pickExcelPath(): Promise<string | null> {
  const picked = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Excel", extensions: ["xlsx", "xls"] }],
  });
  return typeof picked === "string" ? picked : null;
}

export function readSourceBytes(path: string) {
  return invoke<ArrayBuffer>("read_source_bytes", { path });
}

export async function readStableSource(
  path: string
): Promise<{ bytes: ArrayBuffer; revision: string } | null> {
  const before = await sourceFileRevision(path);
  const bytes = await readSourceBytes(path);
  const after = await sourceFileRevision(path);
  if (before !== after) return null;
  return { bytes, revision: after };
}

export function sourceFileRevision(path: string) {
  return invoke<string>("source_file_revision", { path });
}

let machinePromise: Promise<string> | null = null;

export function machineName() {
  machinePromise ??= invoke<string>("machine_name");
  return machinePromise;
}

export type FileDropHandlers = {
  onEnter: () => void;
  onLeave: () => void;
  onDrop: (paths: string[]) => void;
};

export function onFileDrop(handlers: FileDropHandlers) {
  let stopped = false;

  const pending = getCurrentWebview().onDragDropEvent((event) => {
    if (stopped) return;
    if (event.payload.type === "enter") {
      handlers.onEnter();
    } else if (event.payload.type === "leave") {
      handlers.onLeave();
    } else if (event.payload.type === "drop") {
      handlers.onLeave();
      handlers.onDrop(event.payload.paths);
    }
  });

  return () => {
    stopped = true;
    pending.then((unlisten) => unlisten()).catch(() => undefined);
  };
}

export function fileNameOf(path: string) {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export async function setWindowFullscreen(on: boolean) {
  if (isDesktop()) {
    await getCurrentWindow().setFullscreen(on);
    return;
  }
  if (on) {
    await document.documentElement.requestFullscreen();
  } else if (document.fullscreenElement) {
    await document.exitFullscreen();
  }
}
