import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../lib/i18n";
import MoreIcon from "../assets/icons/more-horizontal.svg?react";
import FocusIcon from "../assets/icons/expand-focus.svg?react";
import CopyIcon from "../assets/icons/copy.svg?react";
import TagIcon from "../assets/icons/tag.svg?react";
import CheckIcon from "../assets/icons/check.svg?react";
import ImageIcon from "../assets/icons/image.svg?react";

const MENU_WIDTH = 190;

export type WidgetMenuProps = {
  readonly label: string;
  readonly dataLabels: boolean;
  readonly onFocus: () => void;
  readonly onCopyData: () => void;
  readonly onToggleDataLabels: () => void;
  readonly canCopyImage: boolean;
  readonly onCopyImage: () => void;
};

export default function WidgetMenu({
  label,
  dataLabels,
  onFocus,
  onCopyData,
  onToggleDataLabels,
  canCopyImage,
  onCopyImage,
}: WidgetMenuProps) {
  const t = useT();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!spot) return;
    const close = () => setSpot(null);
    function away(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof Node)) {
        close();
        return;
      }
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("mousedown", away);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [spot]);

  function open(e: React.MouseEvent) {
    e.stopPropagation();
    const box = buttonRef.current?.getBoundingClientRect();
    if (!box) return;
    setSpot({
      x: Math.min(box.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8),
      y: box.bottom + 4,
    });
  }

  function run(action: () => void) {
    setSpot(null);
    action();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn widget-menu-btn"
        aria-label={t("widget.menuAria", { title: label })}
        aria-haspopup="menu"
        aria-expanded={spot !== null}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={open}
      >
        <MoreIcon width={15} height={15} />
      </button>

      {spot &&
        createPortal(
          <div
            ref={menuRef}
            className="ctx-menu widget-menu"
            role="menu"
            style={{ left: spot.x, top: spot.y, width: MENU_WIDTH }}
          >
            <button
              type="button"
              role="menuitem"
              className="ctx-menu-item widget-menu-item"
              onClick={() => run(onFocus)}
            >
              <FocusIcon width={14} height={14} />
              <span>{t("widget.focusMode")}</span>
            </button>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={dataLabels}
              className="ctx-menu-item widget-menu-item"
              onClick={() => run(onToggleDataLabels)}
            >
              <TagIcon width={14} height={14} />
              <span>{t("widget.dataLabels")}</span>
              {dataLabels && (
                <CheckIcon className="widget-menu-check" width={14} height={14} />
              )}
            </button>

            <div className="ctx-menu-divider" />

            <button
              type="button"
              role="menuitem"
              className="ctx-menu-item widget-menu-item"
              onClick={() => run(onCopyData)}
            >
              <CopyIcon width={14} height={14} />
              <span>{t("widget.copyData")}</span>
            </button>
            {canCopyImage && (
              <button
                type="button"
                role="menuitem"
                className="ctx-menu-item widget-menu-item"
                onClick={() => run(onCopyImage)}
              >
                <ImageIcon width={14} height={14} />
                <span>{t("widget.copyImage")}</span>
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
