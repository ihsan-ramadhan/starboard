import { useEffect } from "react";

export type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen || isLoading) return;
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter") {
        onConfirm();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onConfirm, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={!isLoading ? onCancel : undefined}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
        </div>
        <div className="modal-body">
          <p className="modal-message">{message}</p>
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn-ghost-sm"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={isDestructive ? "btn-danger" : "btn-primary"}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Memproses…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
