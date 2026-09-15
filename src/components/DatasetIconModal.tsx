import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import {
  buildIconBlob,
  forgetDatasetIcon,
  loadImageMeta,
  primeDatasetIcon,
  readAsDataUrl,
  useDatasetIcon,
  type ImageMeta,
} from "../lib/datasetIcon";
import IconCropper, {
  centerOffset,
  cropImageStyle,
  cropOf,
  type Offset,
} from "./IconCropper";
import { useT } from "../lib/i18n";
import ImageIcon from "../assets/icons/image.svg?react";

const BADGE = 28;

export type DatasetIconModalProps = {
  readonly isOpen: boolean;
  readonly datasetKey: string;
  readonly displayName: string;
  readonly initials: string;
  readonly iconVersion: number | null;
  readonly onSaved: () => void;
  readonly onClose: () => void;
};

export default function DatasetIconModal({
  isOpen,
  datasetKey,
  displayName,
  initials,
  iconVersion,
  onSaved,
  onClose,
}: DatasetIconModalProps) {
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const saved = useDatasetIcon(datasetKey, iconVersion);
  const [image, setImage] = useState<ImageMeta | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!image) return;
    return () => URL.revokeObjectURL(image.url);
  }, [image]);

  useEffect(() => {
    if (!isOpen) setImage(null);
  }, [isOpen]);

  if (!isOpen) return null;

  async function accept(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const meta = await loadImageMeta(file);
      setImage(meta);
      setZoom(1);
      setOffset(centerOffset(meta, 1));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!image) return;
    setBusy(true);
    try {
      const blob = await buildIconBlob(image.file, cropOf(image, zoom, offset));
      const version = await api.setDatasetIcon(datasetKey, blob);
      primeDatasetIcon(datasetKey, version, await readAsDataUrl(blob));
      setImage(null);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(t("icon.saveFailed") + String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.clearDatasetIcon(datasetKey);
      forgetDatasetIcon(datasetKey);
      setImage(null);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(t("icon.removeFailed") + String(err));
    } finally {
      setBusy(false);
    }
  }

  let badge = <span className="nav-initial">{initials}</span>;
  if (image) {
    badge = (
      <span className="nav-initial has-image">
        <img
          src={image.url}
          alt=""
          style={cropImageStyle(image, zoom, offset, BADGE)}
        />
      </span>
    );
  } else if (saved) {
    badge = (
      <span className="nav-initial has-image">
        <img src={saved} alt="" />
      </span>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal-native"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="modal-card icon-modal">
        <div className="modal-header">
          <h3 className="modal-title">{t("icon.title")}</h3>
        </div>

        <div className="modal-body">
          <p className="icon-preview-label">{t("icon.previewLabel")}</p>
          <div className="icon-preview">
            {badge}
            <span className="nav-label">{displayName}</span>
          </div>

          {image && (
            <>
              <IconCropper
                image={image}
                zoom={zoom}
                offset={offset}
                label={t("icon.cropAria")}
                onChange={(nextZoom, nextOffset) => {
                  setZoom(nextZoom);
                  setOffset(nextOffset);
                }}
              />
              <p className="settings-hint icon-crop-hint">{t("icon.cropHint")}</p>
            </>
          )}

          <div
            className={`icon-drop${dragOver ? " is-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              accept(e.dataTransfer.files[0]);
            }}
          >
            <ImageIcon width={20} height={20} aria-hidden="true" />
            <button
              type="button"
              className="icon-drop-btn"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              {image ? t("icon.replace") : t("icon.choose")}
            </button>
            <span className="icon-drop-hint">{t("icon.dropHint")}</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                accept(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          {!image && <p className="settings-hint">{t("icon.sizeHint")}</p>}
        </div>

        <div className="modal-actions icon-actions">
          {iconVersion !== null && (
            <button
              type="button"
              className="btn-ghost icon-remove"
              onClick={remove}
              disabled={busy}
            >
              {t("icon.remove")}
            </button>
          )}
          <button
            type="button"
            className="btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={save}
            disabled={busy || !image}
          >
            {busy ? t("common.processing") : t("icon.save")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
