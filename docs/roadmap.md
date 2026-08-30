# Roadmap

Status & rencana fase. **Fokus saat ini: MIOP / daywork** (dataset lain di MIOP
menyusul; departemen lain menyusul setelah pola terbukti).

## Status Sekarang (per sesi ini)

Selesai:
- ✅ Prisma schema: dimensi bersama + `daywork_records` + lookup.
- ✅ Import script: staging → validasi → promote (bulk), normalisasi `kode`.
- ✅ Supabase project baru + migrasi `init` + data 2.624 baris ter-impor.
- ✅ Scaffold Next.js: dep (Next 16, React 19, Recharts 3, react-grid-layout 2),
  `tsconfig` Next-compatible, `next.config.mjs`, `next-env.d.ts`, `lib/` dasar.
- ✅ Dokumentasi arsitektur (`docs/*.md`).

Belum:
- ⏳ Rename tabel ke prefix `miop_*` (lihat Phase 1).
- ⏳ Platform shell + widget runtime + MIOP sebagai module pertama.
- ⏳ Modul HSE / MPMA.

## Phase 1 — Platform + MIOP sebagai Module Pertama

1. **Rename skema ke konvensi module**: `daywork_records` → `miop_daywork_records`,
   `activity_codes` → `miop_activity_codes` (migrasi + re-import; murah karena data
   reproducible). Ini mematok konvensi sebelum kode dibangun di atas nama lama.
2. **Extract platform**: `lib/query-runtime.ts` (QuerySpec → SQL aman),
   `components/widgets/*` (kpi/timeseries/breakdown/table), `dashboard-grid`.
3. **MIOP module**: `modules/miop/dataSources.ts`, `modules/miop/dashboard.ts`,
   pindahkan query lama ke data source spec.
4. **Shell**: `app/[dept]/page.tsx` + Department Switcher + Filter Context.
5. **Layout persistence** via `dashboard_definitions` + `dashboard_widgets`.
6. Verifikasi: dashboard MIOP jalan dengan drag/resize + switch chart + filter.

> Milestone: satu departemen penuh berjalan di atas platform generik.

## Phase 2 — Tambah HSE (bukti modularitas)

- Buat `modules/hse/` (skema `hse_*`, data sources, dashboard definition).
- **Tidak ada komponen React baru** — pakai widget runtime yang sudah ada.
- Verifikasi: tanpa ubah platform, dashboard HSE muncul otomatis.

## Phase 3 — MPMA + Registry DB-backed + Tauri Desktop Build

- Module `mpma_*`.
- Setup Tauri v2 wrapper (`@tauri-apps/cli`) untuk packaging desktop client (.exe Windows).
- Pindahkan Department Registry & definisi dashboard ke DB (`data_sources`,
  `dashboard_definitions`) bila ingin non-dev bisa nambah dept tanpa kode.
- (Opsional) editor admin sederhana untuk susun dashboard.

## Phase 4 — Auth & RBAC per Departemen

- `UserDepartment` dipakai untuk gate departemen yg boleh dilihat user.
- Login (next-auth credentials / custom JWT — lihat `PROJECT.md`).
- Layout persistence terikat ke `userId` (sudah disiapkan di skema).

## Keputusan Terbuka

- Definisi dashboard di **kode (TS registry)** dulu, atau langsung **DB-backed**?
  Rekomendasi: kode dulu (type-safe, gampang) → DB di Phase 3.
- Isolasi data: **prefix tabel** (`hse_*`) cukup untuk v1; schema terpisah bila
  butuh isolasi kuat (Phase 3+).
- Repo rename: kosmetik saja (lihat pesan di chat); bisa dilakukan kapan pun.
