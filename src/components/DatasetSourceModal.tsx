import { useEffect, useRef } from "react";

export type SourceAction = {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
  readonly destructive?: boolean;
  readonly run: () => void;
};

export type DatasetSourceModalProps = {
  readonly isOpen: boolean;
  readonly tone: string;
  readonly status: string;
  readonly path: string | null;
  readonly watchedBy: string;
  readonly updatedAt: string | null;
  readonly error: string | null;
  readonly actions: readonly SourceAction[];
  readonly busy: boolean;
  readonly onClose: () => void;
};

export default function DatasetSourceModal({
  isOpen,
  tone,
  status,
  path,
  watchedBy,
  updatedAt,
  error,
  actions,
  busy,
  onClose,
}: DatasetSourceModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="modal-native"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-card source-modal">
        <div className="modal-header">
          <h3 className="modal-title">Sumber data</h3>
        </div>

        <div className="modal-body">
          <p className={`source-status tone-${tone}`}>
            <span className="dataset-sync-dot" aria-hidden="true" />
            <span>{status}</span>
          </p>

          <dl className="source-facts">
            <dt>Berkas</dt>
            <dd>{path ?? "Belum ada berkas yang ditunjuk"}</dd>
            <dt>Diawasi</dt>
            <dd>{watchedBy}</dd>
            <dt>Terakhir diperbarui</dt>
            <dd>{updatedAt ?? "Belum pernah"}</dd>
          </dl>

          {error && <p className="source-error">{error}</p>}

          {actions.length > 0 && (
            <ul className="source-actions">
              {actions.map((action) => (
                <li key={action.key}>
                  <button
                    type="button"
                    className={action.destructive ? "btn-danger" : "btn-ghost"}
                    onClick={action.run}
                    disabled={busy}
                  >
                    {action.label}
                  </button>
                  <span>{action.hint}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-primary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </dialog>
  );
}
