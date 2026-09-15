import { useEffect, useRef } from "react";
import { LANGUAGES, setLang, useLang, useT, type Lang } from "../lib/i18n";
import {
  setDataLabelsShown,
  setScaleWarningHidden,
  useGlobalDataLabels,
  useScaleWarningHidden,
} from "../lib/prefs";
import { setTheme, useTheme, type ThemeChoice } from "../lib/theme";

export type SettingsModalProps = {
  readonly isOpen: boolean;
  readonly onClose: () => void;
};

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lang = useLang();
  const theme = useTheme();
  const dataLabels = useGlobalDataLabels();
  const warningHidden = useScaleWarningHidden();
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

          <label className="settings-field">
            <span className="settings-label">{t("settings.theme")}</span>
            <select
              className="settings-input"
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemeChoice)}
            >
              <option value="system">{t("theme.system")}</option>
              <option value="light">{t("theme.light")}</option>
              <option value="dark">{t("theme.dark")}</option>
            </select>
            <span className="settings-hint">{t("settings.themeHint")}</span>
          </label>

          <section className="settings-group">
            <h4 className="settings-group-title">{t("settings.widgets")}</h4>

            <label className="settings-check">
              <input
                type="checkbox"
                checked={dataLabels}
                onChange={(e) => setDataLabelsShown(e.target.checked)}
              />
              <span className="settings-check-text">
                <span className="settings-label">{t("settings.dataLabels")}</span>
                <span className="settings-hint">{t("settings.dataLabelsHint")}</span>
              </span>
            </label>

            <label className="settings-check">
              <input
                type="checkbox"
                checked={warningHidden}
                onChange={(e) => setScaleWarningHidden(e.target.checked)}
              />
              <span className="settings-check-text">
                <span className="settings-label">{t("settings.hideScaleWarning")}</span>
                <span className="settings-hint">{t("settings.scaleWarningHint")}</span>
              </span>
            </label>
          </section>
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
