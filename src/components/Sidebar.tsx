import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useApp } from "../App";
import { api, setAuthToken } from "../lib/api";
import ConfirmModal from "./ConfirmModal";
import ChevronIcon from "../assets/icons/chevron-left.svg?react";
import LogoutIcon from "../assets/icons/log-out.svg?react";
import PencilIcon from "../assets/icons/pencil.svg?react";
import TrashIcon from "../assets/icons/trash.svg?react";
import { isAdmin, type SessionUser } from "../types";

type DatasetTab = { id: string; key: string; displayName: string };

const COLLAPSE_KEY = "starboard_sidebar_collapsed";

const LONG_PRESS_MS = 150;
const MOVE_TOLERANCE = 6;

function movedPast(press: { x: number; y: number }, x: number, y: number) {
  return (
    Math.abs(x - press.x) > MOVE_TOLERANCE || Math.abs(y - press.y) > MOVE_TOLERANCE
  );
}

function rowIndexAt(list: HTMLElement, clientY: number): number {
  const rows = [...list.querySelectorAll<HTMLElement>("[data-key]")];
  return rows.findIndex((row) => {
    const box = row.getBoundingClientRect();
    return clientY >= box.top && clientY <= box.bottom;
  });
}

function nudgeStep(e: React.KeyboardEvent<HTMLElement>): number | null {
  if (!e.altKey) return null;
  if (e.key === "ArrowUp") return -1;
  if (e.key === "ArrowDown") return 1;
  return null;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

type NavItemProps = {
  readonly item: DatasetTab;
  readonly arranging: boolean;
  readonly active: boolean;
  readonly dragging: boolean;
  readonly renaming: boolean;
  readonly onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  readonly onClickCapture: (e: React.MouseEvent<HTMLDivElement>) => void;
  readonly onNudge: (e: React.KeyboardEvent<HTMLElement>) => void;
  readonly onStartRename: () => void;
  readonly onFinishRename: (value: string) => void;
  readonly onDelete: () => void;
};

function NavItem({
  item,
  arranging,
  active,
  dragging,
  renaming,
  onPointerDown,
  onClickCapture,
  onNudge,
  onStartRename,
  onFinishRename,
  onDelete,
}: NavItemProps) {
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renaming) return;
    renameRef.current?.focus();
    renameRef.current?.select();
  }, [renaming]);

  if (!arranging) {
    return (
      <Link
        data-key={item.key}
        to={`/d/${item.key}`}
        className={`nav-link${active ? " active" : ""}`}
        aria-current={active ? "page" : undefined}
        aria-label={item.displayName}
        title={item.displayName}
      >
        <span className="nav-initial">{initials(item.displayName)}</span>
        <span className="nav-label sidebar-hideable">{item.displayName}</span>
      </Link>
    );
  }

  const rowClass = `nav-row${active ? " is-active" : ""}${
    dragging ? " is-dragging" : ""
  }`;

  return (
    <div
      data-key={item.key}
      className={rowClass}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
    >
      {renaming ? (
        <input
          ref={renameRef}
          className="nav-rename"
          defaultValue={item.displayName}
          maxLength={60}
          aria-label={`Nama menu untuk ${item.displayName}`}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.currentTarget.value = item.displayName;
              e.currentTarget.blur();
            }
          }}
          onBlur={(e) => onFinishRename(e.target.value)}
        />
      ) : (
        <>
          <Link
            to={`/d/${item.key}`}
            className={`nav-link nav-row-link${active ? " active" : ""}`}
            draggable={false}
            aria-current={active ? "page" : undefined}
            onKeyDown={onNudge}
            title={`${item.displayName} — tekan lama untuk memindahkan, atau Alt + panah atas/bawah`}
          >
            <span className="nav-initial">{initials(item.displayName)}</span>
            <span className="nav-label sidebar-hideable">{item.displayName}</span>
          </Link>
          <button
            type="button"
            className="nav-rename-btn"
            aria-label={`Ganti nama ${item.displayName}`}
            title="Ganti nama menu"
            onClick={onStartRename}
          >
            <PencilIcon width={13} height={13} />
          </button>
          <button
            type="button"
            className="nav-del-btn"
            aria-label={`Hapus dataset ${item.displayName}`}
            title="Hapus dataset"
            onClick={onDelete}
          >
            <TrashIcon width={13} height={13} />
          </button>
        </>
      )}
    </div>
  );
}

export function Sidebar({
  user,
  datasets,
  onLogout,
}: {
  user: SessionUser;
  datasets: DatasetTab[];
  onLogout?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshDatasets, datasetsLoaded, setWidgetCache, editMode, setEditMode } =
    useApp();
  const admin = isAdmin(user);
  const arranging = admin && editMode;
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1"
  );
  const [items, setItems] = useState<DatasetTab[]>(datasets);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [datasetToDelete, setDatasetToDelete] = useState<DatasetTab | null>(null);
  const [isDeletingDataset, setIsDeletingDataset] = useState(false);

  const itemsRef = useRef(items);
  const listRef = useRef<HTMLElement>(null);
  const draggingRef = useRef<string | null>(null);
  const pressRef = useRef<{ x: number; y: number; timer: number } | null>(null);
  const suppressClickRef = useRef(false);
  const movedRef = useRef(false);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const dragStartOrderRef = useRef("");

  useEffect(() => {
    itemsRef.current = items;
  });

  useEffect(() => {
    if (draggingRef.current || renamingKey) return;
    setItems(datasets);
  }, [datasets, renamingKey]);

  useEffect(() => {
    if (!editMode) return;
    function checkWidth() {
      if (window.innerWidth <= 1024) {
        setCollapsed(true);
        setRenamingKey(null);
      }
    }
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, [editMode]);

  const activeKey = location.pathname.startsWith("/d/")
    ? location.pathname.replace("/d/", "")
    : undefined;

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    if (next) setRenamingKey(null);
    localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  }

  function withMoved(list: DatasetTab[], key: string, to: number) {
    const from = list.findIndex((i) => i.key === key);
    if (from < 0 || to < 0 || to >= list.length || from === to) return list;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  }

  async function saveOrder(next: DatasetTab[]) {
    try {
      await api.reorderDatasets(user.role, next.map((i) => i.key));
      await refreshDatasets();
    } catch (err) {
      toast.error("Gagal menyimpan urutan menu: " + String(err));
      setItems(datasets);
    }
  }

  async function saveName(key: string, value: string) {
    const previous = datasets.find((d) => d.key === key)?.displayName ?? "";
    const name = value.trim();
    if (!name || name === previous) {
      setItems((prev) =>
        prev.map((i) => (i.key === key ? { ...i, displayName: previous } : i))
      );
      return;
    }
    try {
      await api.updateDataset(user.role, key, { displayName: name });
      await refreshDatasets();
    } catch (err: unknown) {
      toast.error("Gagal mengganti nama menu: " + String(err));
      setItems((prev) =>
        prev.map((i) => (i.key === key ? { ...i, displayName: previous } : i))
      );
    }
  }

  function arm(pointerId: number, key: string) {
    try {
      listRef.current?.setPointerCapture(pointerId);
    } catch {
      void 0;
    }
    draggingRef.current = key;
    dragStartOrderRef.current = itemsRef.current.map((i) => i.key).join("|");
    movedRef.current = false;
    setDraggingKey(key);
  }

  function cancelPress() {
    if (!pressRef.current) return;
    window.clearTimeout(pressRef.current.timer);
    pressRef.current = null;
  }

  function pressStart(e: React.PointerEvent<HTMLDivElement>, key: string) {
    if (e.button !== 0 || draggingRef.current) return;
    suppressClickRef.current = false;
    const pointerId = e.pointerId;

    if ((e.target as HTMLElement).closest("button, input")) return;

    const timer = window.setTimeout(() => {
      pressRef.current = null;
      arm(pointerId, key);
    }, LONG_PRESS_MS);
    pressRef.current = { x: e.clientX, y: e.clientY, timer };
  }

  function pressMove(e: React.PointerEvent<HTMLElement>) {
    const press = pressRef.current;
    if (press) {
      if (movedPast(press, e.clientX, e.clientY)) cancelPress();
      return;
    }
    const key = draggingRef.current;
    if (!key || !listRef.current) return;
    const over = rowIndexAt(listRef.current, e.clientY);
    if (over < 0) return;
    const next = withMoved(itemsRef.current, key, over);
    if (next === itemsRef.current) return;
    movedRef.current = true;
    itemsRef.current = next;
    setItems(next);
  }

  function pressEnd(e: React.PointerEvent<HTMLElement>) {
    cancelPress();
    if (!draggingRef.current) return;
    try {
      listRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      void 0;
    }
    draggingRef.current = null;
    setDraggingKey(null);
    suppressClickRef.current = movedRef.current;
    if (itemsRef.current.map((i) => i.key).join("|") === dragStartOrderRef.current) {
      return;
    }
    saveOrder(itemsRef.current);
  }

  function nudge(e: React.KeyboardEvent<HTMLElement>, key: string) {
    const step = nudgeStep(e);
    if (step === null) return;
    e.preventDefault();
    const from = itemsRef.current.findIndex((i) => i.key === key);
    const next = withMoved(itemsRef.current, key, from + step);
    if (next === itemsRef.current) return;
    itemsRef.current = next;
    setItems(next);
    saveOrder(next);
  }

  async function handleDeleteDataset() {
    if (!datasetToDelete) return;
    setIsDeletingDataset(true);
    try {
      await api.deleteDataset(datasetToDelete.id);
      setWidgetCache((prev) => {
        const { [datasetToDelete.key]: _removed, ...rest } = prev;
        return rest;
      });
      await refreshDatasets();
      toast.success(`Dataset "${datasetToDelete.displayName}" berhasil dihapus.`);
      if (activeKey === datasetToDelete.key) navigate("/", { replace: true });
      setDatasetToDelete(null);
    } catch (err) {
      toast.error("Gagal menghapus dataset: " + String(err));
    } finally {
      setIsDeletingDataset(false);
    }
  }

  async function handleConfirmLogout() {
    setIsLoggingOut(true);
    try {
      await api.logout();
    } catch {
      void 0;
    } finally {
      setIsLoggingOut(false);
      setAuthToken(null);
      setShowLogoutModal(false);
      localStorage.removeItem("starboard_user");
      if (onLogout) onLogout();
      navigate("/login");
    }
  }

  let navNotice: ReactNode = null;
  if (!datasetsLoaded) {
    navNotice = (
      <div className="sk-nav" aria-busy="true" aria-label="Memuat daftar dataset">
        {[0, 1, 2].map((i) => (
          <span key={i} className="sk sk-nav-row" />
        ))}
      </div>
    );
  } else if (items.length === 0) {
    navNotice = (
      <span className="nav-empty">
        {admin
          ? "Belum ada dataset. Mulai dari Import Dataset di bawah."
          : `Admin ${user.role} belum mengimpor dataset.`}
      </span>
    );
  }

  return (
    <>
      <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
        <div className="sidebar-head">
          <div className="brand">
            <span className="brand-mark">★</span>
            <span className="sidebar-hideable"> Starboard</span>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"}
            title={collapsed ? "Buka sidebar" : "Tutup sidebar"}
          >
            <ChevronIcon width={16} height={16} />
          </button>
        </div>

        <nav
          className={`sidebar-nav${draggingKey ? " is-dragging" : ""}`}
          ref={listRef}
          onPointerMove={pressMove}
          onPointerUp={pressEnd}
          onPointerCancel={pressEnd}
        >
          {navNotice ??
            items.map((d) => (
              <NavItem
                key={d.key}
                item={d}
                arranging={arranging}
                active={activeKey === d.key}
                dragging={draggingKey === d.key}
                renaming={renamingKey === d.key}
                onPointerDown={(e) => pressStart(e, d.key)}
                onClickCapture={(e) => {
                  if (!suppressClickRef.current) return;
                  suppressClickRef.current = false;
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onNudge={(e) => nudge(e, d.key)}
                onStartRename={() => setRenamingKey(d.key)}
                onFinishRename={(value) => {
                  setRenamingKey(null);
                  saveName(d.key, value);
                }}
                onDelete={() => setDatasetToDelete(d)}
              />
            ))}

          {admin && (arranging || items.length === 0) && (
            <Link
              to="/import"
              className={`nav-link import${location.pathname === "/import" ? " active" : ""}`}
              aria-current={location.pathname === "/import" ? "page" : undefined}
              aria-label="Import Dataset"
              title="Import Dataset"
            >
              <span className="nav-initial">+</span>
              <span className="nav-label sidebar-hideable">Import Dataset</span>
            </Link>
          )}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-user">
            <span
              className="dept-badge"
              style={user.deptColor ? { backgroundColor: user.deptColor } : undefined}
              title={collapsed ? user.username : undefined}
            >
              {user.role}
            </span>
            <span className="user-name sidebar-hideable">{user.username}</span>
          </div>
          {admin && (
            <button
              type="button"
              className={`sidebar-edit${editMode ? " on" : ""}`}
              aria-pressed={editMode}
              onClick={() => {
                setRenamingKey(null);
                setEditMode((v) => !v);
              }}
              title={editMode ? "Keluar dari mode edit" : "Masuk mode edit"}
            >
              <PencilIcon width={15} height={15} />
              <span className="sidebar-hideable">
                {editMode ? "Selesai Edit" : "Mode Edit"}
              </span>
            </button>
          )}
          <button
            type="button"
            className="sidebar-logout"
            onClick={() => setShowLogoutModal(true)}
            aria-label="Logout"
            title={collapsed ? "Logout" : undefined}
          >
            <LogoutIcon width={15} height={15} />
            <span className="sidebar-hideable">Logout</span>
          </button>
        </div>
      </aside>

      <ConfirmModal
        isOpen={showLogoutModal}
        title="Konfirmasi Logout"
        message="Apakah Anda yakin ingin keluar dari akun Starboard?"
        confirmLabel="Logout"
        cancelLabel="Batal"
        isDestructive={true}
        isLoading={isLoggingOut}
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />

      <ConfirmModal
        isOpen={datasetToDelete !== null}
        title="Hapus Dataset"
        message={`Dataset "${datasetToDelete?.displayName ?? ""}" akan dihapus permanen beserta seluruh baris datanya dan semua widget yang memakainya. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Dataset"
        cancelLabel="Batal"
        isDestructive={true}
        isLoading={isDeletingDataset}
        onConfirm={handleDeleteDataset}
        onCancel={() => setDatasetToDelete(null)}
      />
    </>
  );
}
