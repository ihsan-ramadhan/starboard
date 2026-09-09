import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "./api";
import {
  fileNameOf,
  isDesktop,
  machineName,
  readSourceFile,
  sourceFileRevision,
} from "./desktop";
import { formatCount } from "./format";
import { isAdmin, type DatasetRegistry, type SessionUser } from "../types";

const POLL_INTERVAL_MS = 20_000;

export type SyncStatus = {
  state: "watching" | "importing" | "error";
  error?: string;
  syncedAt?: number;
};

export type SyncStatuses = Record<string, SyncStatus>;

function messageOf(err: unknown) {
  const text = err instanceof Error ? err.message : String(err);
  return text.replace(/^Error:\s*/, "");
}

export function useMachineName(): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!isDesktop()) return;
    let active = true;
    machineName()
      .then((n) => {
        if (active) setName(n);
      })
      .catch(() => {

      });
    return () => {
      active = false;
    };
  }, []);
  return name;
}

export function useExcelSync(
  datasets: DatasetRegistry[],
  user: SessionUser,
  onSynced: () => void | Promise<void>
): SyncStatuses {
  const dept = user.role;
  const [statuses, setStatuses] = useState<SyncStatuses>({});

  const datasetsRef = useRef(datasets);
  const onSyncedRef = useRef(onSynced);
  useEffect(() => {
    datasetsRef.current = datasets;
    onSyncedRef.current = onSynced;
  });

  const importedRef = useRef<Record<string, string>>({});
  const rejectedRef = useRef<Record<string, string>>({});
  const runningRef = useRef(false);

  useEffect(() => {

    if (!isDesktop() || !isAdmin(user)) return;

    let active = true;
    let machine: string | null = null;

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
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        machine ??= await machineName().catch(() => null);
        if (!active || !machine) return;

        let anyImported = false;

        for (const ds of datasetsRef.current) {
          if (!active) return;
          const path = ds.sourcePath;
          if (!ds.syncEnabled || !path) {
            forget(ds.key);
            continue;
          }

          if (ds.watchedBy !== machine) {
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
          let attempted = revision;
          try {
            const file = await readSourceFile(path);
            attempted = file.revision;
            if (!active) return;
            const res = await api.syncDataset(dept, ds.key, {
              fileBytes: file.bytes,
              sourceMtime: file.revision,
            });
            if (!active) return;
            importedRef.current[ds.key] = file.revision;
            setStatus(ds.key, { state: "watching" }, Date.now());

            if (!res.skipped) {
              anyImported = true;
              toast.success(
                `${ds.displayName} diperbarui dari ${fileNameOf(path)} (${formatCount(res.totalImported)} baris).`
              );
            }
          } catch (err) {
            rejectedRef.current[ds.key] = attempted;
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
  }, [dept, user.accessLevel]);

  return statuses;
}
