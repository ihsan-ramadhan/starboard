import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export type SourceFile = {
  bytes: number[];
  revision: string;
};

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

export function readSourceFile(path: string) {
  return invoke<SourceFile>("read_source_file", { path });
}

export function sourceFileRevision(path: string) {
  return invoke<string>("source_file_revision", { path });
}

let machinePromise: Promise<string> | null = null;

export function machineName() {
  machinePromise ??= invoke<string>("machine_name");
  return machinePromise;
}

export function fileNameOf(path: string) {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}
