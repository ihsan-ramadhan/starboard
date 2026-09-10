import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "./api";
import {
  fileNameOf,
  isDesktop,
  machineName,
  readStableSource,
  sourceFileRevision,
} from "./desktop";
import { formatCount } from "./format";
import { isAdmin, type DatasetRegistry, type SessionUser } from "../types";

const POLL_INTERVAL_MS = 20_000;
const HEARTBEAT_MS = 60_000;

type SyncOutcome = "skipped" | "imported" | "aborted";

function isPermanent(err: unknown) {
  return err instanceof ApiError && err.status >= 400 && err.status < 500;
}

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
  const lastBeatRef = useRef(0);

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
          cur?.state === merged.state &&
          cur?.error === merged.error &&
          cur?.syncedAt === merged.syncedAt
        ) {
          return prev;
        }
        return { ...prev, [key]: merged };
      });
    }

    async function importOne(
      ds: DatasetRegistry,
      path: string,
      revision: string
    ): Promise<SyncOutcome> {
      setStatus(ds.key, { state: "importing" });
      let attempted = revision;
      try {
        const file = await readStableSource(path);
        if (!file) {
          setStatus(ds.key, { state: "watching" });
          return "skipped";
        }
        attempted = file.revision;
        if (!active) return "aborted";

        const uploadId = await api.uploadFile(file.bytes);
        if (!active) return "aborted";

        const res = await api.syncDataset(dept, ds.key, {
          uploadId,
          sourceMtime: file.revision,
        });
        if (!active) return "aborted";

        importedRef.current[path] = file.revision;
        setStatus(ds.key, { state: "watching" }, Date.now());
        if (res.skipped) return "skipped";

        toast.success(
          `${ds.displayName} diperbarui dari ${fileNameOf(path)} (${formatCount(res.totalImported)} baris).`
        );
        return "imported";
      } catch (err) {
        if (isPermanent(err)) rejectedRef.current[path] = attempted;
        setStatus(ds.key, { state: "error", error: messageOf(err) });
        return "skipped";
      }
    }

    async function syncOne(ds: DatasetRegistry): Promise<SyncOutcome> {
      const path = ds.myPath;
      if (!ds.syncEnabled || !path) {
        forget(ds.key);
        return "skipped";
      }

      let revision: string;
      try {
        revision = await sourceFileRevision(path);
      } catch (err) {
        setStatus(ds.key, { state: "error", error: messageOf(err) });
        return "skipped";
      }
      if (!active) return "aborted";

      if (revision === rejectedRef.current[path]) return "skipped";

      if (
        revision === ds.lastSyncedMtime ||
        revision === importedRef.current[path]
      ) {
        setStatus(ds.key, { state: "watching" });
        return "skipped";
      }

      return importOne(ds, path, revision);
    }

    async function tick() {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        machine ??= await machineName().catch(() => null);
        const host = machine;
        if (!active || !host) return;

        if (Date.now() - lastBeatRef.current > HEARTBEAT_MS) {
          lastBeatRef.current = Date.now();
          await api.heartbeat(dept, host).catch(() => undefined);
        }

        let anyImported = false;
        const seenPaths = new Set<string>();

        for (const ds of datasetsRef.current) {
          if (!active) return;
          if (ds.myPath) {
            if (seenPaths.has(ds.myPath)) continue;
            seenPaths.add(ds.myPath);
          }
          const outcome = await syncOne(ds);
          if (outcome === "aborted") return;
          if (outcome === "imported") anyImported = true;
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
