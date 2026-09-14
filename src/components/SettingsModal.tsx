import { useEffect, useRef } from "react";
import { LANGUAGES, setLang, useLang, useT, type Lang } from "../lib/i18n";

export type SettingsModalProps = {
  readonly isOpen: boolean;
  readonly onClose: () => void;
};

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lang = useLang();
  const t = useT();

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
      <div className="modal-card settings-modal">
        <div className="modal-header">
          <h3 className="modal-title">{t("settings.title")}</h3>
        </div>

        <div className="modal-body">
          <label className="settings-field">
            <span className="settings-label">{t("settings.language")}</span>
            <select
              className="settings-input"
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
            >
              {LANGUAGES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
            <span className="settings-hint">{t("settings.languageHint")}</span>
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-primary" onClick={onClose}>
            {t("settings.close")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
