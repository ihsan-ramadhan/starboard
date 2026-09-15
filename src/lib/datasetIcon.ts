import { useEffect, useState } from "react";
import { api } from "./api";
import { t } from "./i18n";

export const ICON_SIZE = 64;
export const ICON_MAX_BYTES = 256 * 1024;
const SOURCE_MAX_BYTES = 20 * 1024 * 1024;

export type Crop = { readonly sx: number; readonly sy: number; readonly side: number };

export type ImageMeta = {
  readonly file: File;
  readonly url: string;
  readonly width: number;
  readonly height: number;
};

export function loadImageMeta(file: File): Promise<ImageMeta> {
  if (file.size > SOURCE_MAX_BYTES) {
    return Promise.reject(new Error(t("icon.tooLarge")));
  }
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth < 1 || img.naturalHeight < 1) {
        URL.revokeObjectURL(url);
        reject(new Error(t("icon.unreadable")));
        return;
      }
      resolve({ file, url, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(t("icon.unreadable")));
    };
    img.src = url;
  });
}

export function centerCrop(width: number, height: number): Crop {
  const side = Math.min(width, height);
  return {
    sx: Math.floor((width - side) / 2),
    sy: Math.floor((height - side) / 2),
    side,
  };
}

export async function buildIconBlob(file: File, crop: Crop): Promise<Blob> {
  let source: ImageBitmap;
  try {
    source = await createImageBitmap(file);
  } catch {
    throw new Error(t("icon.unreadable"));
  }

  const side = Math.max(1, Math.min(crop.side, source.width, source.height));
  const sx = Math.max(0, Math.min(crop.sx, source.width - side));
  const sy = Math.max(0, Math.min(crop.sy, source.height - side));

  const square = await createImageBitmap(source, sx, sy, side, side, {
    resizeWidth: ICON_SIZE,
    resizeHeight: ICON_SIZE,
    resizeQuality: "high",
  });
  source.close();

  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    square.close();
    throw new Error(t("icon.unreadable"));
  }
  ctx.drawImage(square, 0, 0);
  square.close();

  const blob = await encode(canvas, "image/webp");
  if (blob && blob.type === "image/webp") return blob;

  const png = await encode(canvas, "image/png");
  if (png) return png;
  throw new Error(t("icon.unreadable"));
}

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.92));
}

export function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(t("icon.unreadable")));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

const cache = new Map<string, Promise<string>>();

function load(key: string, version: number): Promise<string> {
  const id = `${key}:${version}`;
  const hit = cache.get(id);
  if (hit) return hit;

  for (const stale of cache.keys()) {
    if (stale.startsWith(`${key}:`)) cache.delete(stale);
  }

  const pending = api
    .getDatasetIcon(key, version)
    .then(readAsDataUrl)
    .catch((err) => {
      cache.delete(id);
      throw err;
    });
  cache.set(id, pending);
  return pending;
}

export function forgetDatasetIcon(key: string) {
  for (const id of [...cache.keys()]) {
    if (id.startsWith(`${key}:`)) cache.delete(id);
  }
}

export function primeDatasetIcon(key: string, version: number, dataUrl: string) {
  forgetDatasetIcon(key);
  cache.set(`${key}:${version}`, Promise.resolve(dataUrl));
}

export function useDatasetIcon(
  key: string,
  version: number | null | undefined
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (version == null) {
      setUrl(null);
      return;
    }
    let live = true;
    load(key, version).then(
      (value) => {
        if (live) setUrl(value);
      },
      () => {
        if (live) setUrl(null);
      }
    );
    return () => {
      live = false;
    };
  }, [key, version]);

  return url;
}
