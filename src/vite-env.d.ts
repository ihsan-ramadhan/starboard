/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

declare module "*.css";
declare module "*.png";
declare module "*.jpg";

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
