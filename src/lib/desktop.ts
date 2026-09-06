import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

/**
 * A file the shell read from disk, with the revision it carried at the time.
 * The revision is opaque: compare it for equality, nothing else.
 */
export type SourceFile = {
  bytes: number[];
  revision: string;
};

// Live sync needs a path that survives restarts, and only the desktop shell
// has one. In a browser tab the import wizard still works; it just cannot
// offer to keep watching the file afterwards.
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

export function fileNameOf(path: string) {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}
