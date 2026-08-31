# Roadmap

Status & rencana fase. **Arah sekarang: Tauri v2 Native Desktop, no-code dynamic, demo-first, bertahap.**
User cuma login + upload Excel + atur widget, tanpa sentuh DB/kode.

## Status Sekarang

Selesai:
- ✅ Bootstrap schema auth + dept + dataset registry di Supabase (`lejeqlnbdvtmkozjufig`).
- ✅ Migrasi Desktop Native: Tauri v2 + Vite + React 19 + Rust backend (no Node in bundle).
- ✅ Rust Excel Ingestion Engine (`calamine` + dynamic `tokio-postgres` DDL).
- ✅ Import Wizard: Sheet selector & Column picker bebas ala PowerBI.
- ✅ Autentikasi native bcrypt (login-derived dept) & dataset viewer.

## Phase 1: Widget Runtime & Dashboard Grid (NEXT)

1. Query builder di Rust/Client untuk agregasi metrik (`WH`, `Cost`, `Count`).
2. Widget generik: KPI Card, Timeseries (Line), Activity Breakdown (Bar/Pie) menggunakan Recharts.
3. Interactive dashboard grid (`react-grid-layout`) dengan drag & resize per user.

## Phase 2: Multi-Dept Proof & Polish

- Pengujian login antar departemen (`MIOP`, `HSE`, `MPMA`).
- Custom naming & pengaturan waktu/filter dinamis.

## Phase 3: Desktop Packaging & Production Release

- Cross-compilation & build installer Windows `.exe` / NSIS.
- Auto-updater setup via Tauri.
