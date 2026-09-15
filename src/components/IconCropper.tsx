import { useRef, useState, type CSSProperties } from "react";
import type { Crop, ImageMeta } from "../lib/datasetIcon";

export const VIEW = 232;
const MAX_ZOOM = 5;
const NUDGE = 8;

export type Offset = { readonly x: number; readonly y: number };

type Geometry = {
  readonly scale: number;
  readonly dw: number;
  readonly dh: number;
  readonly ox: number;
  readonly oy: number;
};

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

function geometry(image: ImageMeta, zoom: number, offset: Offset): Geometry {
  const scale = (VIEW / Math.min(image.width, image.height)) * zoom;
  const dw = image.width * scale;
  const dh = image.height * scale;
  return {
    scale,
    dw,
    dh,
    ox: clamp(offset.x, VIEW - dw, 0),
    oy: clamp(offset.y, VIEW - dh, 0),
  };
}

export function centerOffset(image: ImageMeta, zoom: number): Offset {
  const g = geometry(image, zoom, { x: 0, y: 0 });
  return { x: (VIEW - g.dw) / 2, y: (VIEW - g.dh) / 2 };
}

export function cropOf(image: ImageMeta, zoom: number, offset: Offset): Crop {
  const g = geometry(image, zoom, offset);
  const side = Math.max(1, Math.round(VIEW / g.scale));
  return {
    sx: clamp(Math.round(-g.ox / g.scale), 0, Math.max(0, image.width - side)),
    sy: clamp(Math.round(-g.oy / g.scale), 0, Math.max(0, image.height - side)),
    side,
  };
}

export function cropImageStyle(
  image: ImageMeta,
  zoom: number,
  offset: Offset,
  box: number
): CSSProperties {
  const g = geometry(image, zoom, offset);
  const k = box / VIEW;
  return {
    position: "absolute",
    left: 0,
    top: 0,
    width: g.dw * k,
    height: g.dh * k,
    maxWidth: "none",
    transform: `translate(${g.ox * k}px, ${g.oy * k}px)`,
  };
}

export type IconCropperProps = {
  readonly image: ImageMeta;
  readonly zoom: number;
  readonly offset: Offset;
  readonly label: string;
  readonly onChange: (zoom: number, offset: Offset) => void;
};

export default function IconCropper({
  image,
  zoom,
  offset,
  label,
  onChange,
}: IconCropperProps) {
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function settle(nextZoom: number, next: Offset) {
    const g = geometry(image, nextZoom, next);
    onChange(nextZoom, { x: g.ox, y: g.oy });
  }

  function zoomTo(next: number) {
    const g = geometry(image, zoom, offset);
    const cx = (VIEW / 2 - g.ox) / g.scale;
    const cy = (VIEW / 2 - g.oy) / g.scale;
    const scale = (VIEW / Math.min(image.width, image.height)) * next;
    settle(next, { x: VIEW / 2 - cx * scale, y: VIEW / 2 - cy * scale });
  }

  function pressStart(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const g = geometry(image, zoom, offset);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: g.ox, oy: g.oy };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function pressMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = dragRef.current;
    if (!start) return;
    settle(zoom, {
      x: start.ox + (e.clientX - start.x),
      y: start.oy + (e.clientY - start.y),
    });
  }

  function pressEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step =
      e.key === "ArrowLeft"
        ? [NUDGE, 0]
        : e.key === "ArrowRight"
          ? [-NUDGE, 0]
          : e.key === "ArrowUp"
            ? [0, NUDGE]
            : e.key === "ArrowDown"
              ? [0, -NUDGE]
              : null;
    if (!step) return;
    e.preventDefault();
    settle(zoom, { x: offset.x + step[0], y: offset.y + step[1] });
  }

  return (
    <div className="icon-crop-wrap">
      <div
        className={`icon-crop${dragging ? " is-dragging" : ""}`}
        style={{ width: VIEW, height: VIEW }}
        role="group"
        aria-label={label}
        tabIndex={0}
        onPointerDown={pressStart}
        onPointerMove={pressMove}
        onPointerUp={pressEnd}
        onPointerCancel={pressEnd}
        onKeyDown={onKeyDown}
      >
        <img
          src={image.url}
          alt=""
          draggable={false}
          style={cropImageStyle(image, zoom, offset, VIEW)}
        />
      </div>

      <input
        className="icon-zoom"
        type="range"
        min={1}
        max={MAX_ZOOM}
        step={0.01}
        value={zoom}
        aria-label={label}
        onChange={(e) => zoomTo(Number(e.target.value))}
      />
    </div>
  );
}
