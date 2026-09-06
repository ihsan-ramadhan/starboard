import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "./api";
import { fileNameOf, isDesktop, readSourceFile, sourceFileRevision } from "./desktop";
import type { DatasetRegistry } from "../types";

// Long enough that a workbook on a department share is not restatted
// constantly, short enough that an operator who saves the file sees the
// dashboard move before wondering whether it is broken.
const POLL_INTERVAL_MS = 20_000;

export type SyncStatus = {
  state: "watching" | "importing" | "error";
  error?: string;
  /** Set when this session imported the dataset. Bumps on every fresh import. */
  syncedAt?: number;
};

export type SyncStatuses = Record<string, SyncStatus>;

function messageOf(err: unknown) {
  const text = err instanceof Error ? err.message : String(err);
  return text.replace(/^Error:\s*/, "");
}

/**
 * Watches every dataset that was imported from a file path and re-imports it
 * when that file changes. Only the desktop shell can do this: the path may be
 * a local disk or a department share, and only the machine running the app can
 * reach both.
 */
export function useExcelSync(
  datasets: DatasetRegistry[],
  dept: string,
  onSynced: () => void | Promise<void>
): SyncStatuses {
  const [statuses, setStatuses] = useState<SyncStatuses>({});

  const datasetsRef = useRef(datasets);
  const onSyncedRef = useRef(onSynced);
  useEffect(() => {
    datasetsRef.current = datasets;
    onSyncedRef.current = onSynced;
  });

  // Revisions already imported this session. The dataset list only catches up
  // after onSynced refreshes it, and the next tick can arrive first.
  const importedRef = useRef<Record<string, string>>({});
  // Revisions the server rejected, usually because a picked sheet or column was
  // renamed. Retrying them every 20s would upload the same doomed file forever.
  const rejectedRef = useRef<Record<string, string>>({});
  const runningRef = useRef(false);

  useEffect(() => {
    if (!isDesktop()) return;

    let active = true;

    function forget(key: string) {
      setStatuses((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }

    function setStatus(
      key: string,
      status: { state: SyncStatus["state"]; error?: string },
      syncedAt?: number
    ) {
      setStatuses((prev) => {
        const cur = prev[key];
        // Carried forward rather than reset, so the "last synced" line does not
        // blink away on the next quiet poll.
        const merged: SyncStatus = { ...status, syncedAt: syncedAt ?? cur?.syncedAt };
        if (
          cur &&
          cur.state === merged.state &&
          cur.error === merged.error &&
          cur.syncedAt === merged.syncedAt
        ) {
          return prev;
        }
        return { ...prev, [key]: merged };
      });
    }

    async function tick() {
      // A slow import must not overlap the next tick, or the same file gets
      // sent twice and the second run wins a race with the first.
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        let anyImported = false;

        for (const ds of datasetsRef.current) {
          if (!active) return;
          const path = ds.sourcePath;
          if (!ds.syncEnabled || !path) {
            forget(ds.key);
            continue;
          }

          let revision: string;
          try {
            revision = await sourceFileRevision(path);
          } catch (err) {
            setStatus(ds.key, { state: "error", error: messageOf(err) });
            continue;
          }
          if (!active) return;

          if (revision === rejectedRef.current[ds.key]) continue;

          if (
            revision === ds.lastSyncedMtime ||
            revision === importedRef.current[ds.key]
          ) {
            setStatus(ds.key, { state: "watching" });
            continue;
          }

          setStatus(ds.key, { state: "importing" });
          try {
            const file = await readSourceFile(path);
            if (!active) return;
            const res = await api.syncDataset(dept, ds.key, {
              fileBytes: file.bytes,
              sourceMtime: file.revision,
            });
            if (!active) return;
            // Recorded from the read, not the stat above: the file may have
            // been saved again in between, and that write must not be skipped.
            importedRef.current[ds.key] = file.revision;
            anyImported = true;
            setStatus(ds.key, { state: "watching" }, Date.now());
            toast.success(
              `${ds.displayName} diperbarui dari ${fileNameOf(path)} (${res.totalImported.toLocaleString()} baris).`
            );
          } catch (err) {
            rejectedRef.current[ds.key] = revision;
            setStatus(ds.key, { state: "error", error: messageOf(err) });
          }
        }

        if (anyImported && active) await onSyncedRef.current();
      } finally {
        runningRef.current = false;
      }
    }

    tick();
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [dept]);

  return statuses;
}
