import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

type EditableTarget = HTMLInputElement | HTMLTextAreaElement;

type MenuState = {
  x: number;
  y: number;
  target: EditableTarget;
  container: HTMLElement;
};

export default function ContextMenuProvider() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const clipboardRef = useRef<string>("");

  useEffect(() => {
    function onPasteCapture(e: ClipboardEvent) {
      const text = e.clipboardData?.getData("text/plain");
      if (text) clipboardRef.current = text;
    }

    function onContextMenu(e: MouseEvent) {
      e.preventDefault();
      const targetEl = e.target as HTMLElement | null;
      const el = targetEl?.closest?.("input, textarea") as EditableTarget | null;
      if (!el || el.disabled) {
        setMenu(null);
        return;
      }
      setMenu({
        x: e.clientX,
        y: e.clientY,
        target: el,
        container: targetEl?.closest("dialog[open]") ?? document.body,
      });
    }

    function onMouseDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    }

    const close = () => setMenu(null);

    document.addEventListener("paste", onPasteCapture);
    document.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("paste", onPasteCapture);
      document.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", close);
    };
  }, []);

  // execCommand is the only path that keeps the native undo stack intact.
  function run(command: string) {
    setMenu(null);
    document.execCommand(command);
  }

  function insertAtCaret(target: EditableTarget, text: string) {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    target.focus();
    target.setSelectionRange(start, end);
    const ok = document.execCommand("insertText", false, text);
    if (!ok) {
      const next = target.value.slice(0, start) + text + target.value.slice(end);
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(target, next);
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.setSelectionRange(start + text.length, start + text.length);
    }
  }

  async function handlePaste() {
    const target = menu?.target;
    setMenu(null);
    if (!target) return;

    let text = clipboardRef.current;
    if (!text) {
      try {
        text = await navigator.clipboard.readText();
      } catch {
        toast.error("Tidak bisa membaca papan klip. Ctrl+C dulu atau pakai Ctrl+V.");
        return;
      }
    }
    if (text) {
      insertAtCaret(target, text);
    } else {
      toast.error("Clipboard kosong. Salin sesuatu dulu.");
    }
  }

  if (!menu) return null;

  const { target } = menu;
  const hasValue = target.value.length > 0;
  let hasSelection = true;
  try {
    hasSelection = target.selectionStart !== target.selectionEnd;
  } catch {
    /* selection API does not apply to this input type */
  }

  return createPortal(
    <div
      ref={menuRef}
      className="ctx-menu"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          setMenu(null);
          target.focus();
        }
      }}
    >
      <button
        type="button"
        className="ctx-menu-item"
        role="menuitem"
        onClick={() => run("cut")}
        disabled={!hasSelection || target.readOnly}
      >
        Potong
      </button>
      <button
        type="button"
        className="ctx-menu-item"
        role="menuitem"
        onClick={() => run("copy")}
        disabled={!hasSelection}
      >
        Salin
      </button>
      <button
        type="button"
        className="ctx-menu-item"
        role="menuitem"
        onClick={handlePaste}
        disabled={target.readOnly}
      >
        Tempel
      </button>
      <div className="ctx-menu-divider" />
      <button
        type="button"
        className="ctx-menu-item"
        role="menuitem"
        onClick={() => run("selectAll")}
        disabled={!hasValue}
      >
        Pilih Semua
      </button>
    </div>,
    menu.container
  );
}
