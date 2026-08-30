# Roadmap

Status & rencana fase. **Arah sekarang: no-code dynamic, demo-first, bertahap.**
User cuma login + upload + atur widget, tidak sentuh DB/kode.

> Pivot 2026-08-30: dari arsitektur Opsi B (skema terkontrol per-modul hardcode)
> ke dynamic inference-based (lihat `architecture.md`). Data daywork lama (2.624
> baris di project Supabase lama) dibuang; akan di-reimport lewat UI nanti.

## Status Sekarang

Selesai (di project lama, akan di-reset):
- ✅ Bootstrap awal + import daywork 2.624 baris (skema terkontrol).
- ✅ Scaffold Next.js 16 + React 19 + Recharts 3 + react-grid-layout 2.
- ✅ Dokumentasi arsitektur (sudah dipivot ke no-code dynamic).

Sedang dikerjakan:
- 🔧 Reset ke Supabase project baru (`lejeqlnbdvtmkozjufig`), bootstrap schema
  auth + dept + dataset registry, implementasi auth (login-derived dept).

## Phase 0: Bootstrap + Auth (SEDANG)

1. **Reset Supabase baru**: buang migrasi lama, bootstrap schema baru.
   Tabel: `Department`, `User`, `Session`, `DatasetRegistry`, `DatasetColumn`,
   `DashboardWidget`. Seed dept `MIOP`/`HSE`/`MPMA` + 1 user demo per dept.
2. **Auth**: login email+password (bcrypt + session cookie). `User.role` = dept.
3. **Shell + navbar dinamis**: navbar baris-1 (app chrome fixed), baris-2 =
   tab dataset dari `DatasetRegistry` (kosong saat user baru). CTA "Import Dataset".

> Milestone: login MIOP → dashboard kosong dengan tombol import.

## Phase 1: Import Engine (inference + dynamic DDL)

1. Upload Excel via UI → `exceljs` parse (Node runtime, Route Handler/Action).
2. Inference: sample stratified (awal+tengah+akhir) → tebak tipe kolom.
3. Deteksi monthly-pack (gabung sheet JAN..AUG → 1 dataset + `source_month`).
4. Dynamic DDL: `CREATE TABLE <dept>_<slug>_records` + `_staging` + `_<col>_dim`.
   Identifier divalidasi regex sebelum dieksekusi.
5. Isi `DatasetRegistry` + `DatasetColumn` (metadata navbar & widget picker).
6. Promote baris valid ke `_records`; baris error ke `_staging`.
7. Navbar nambah tab otomatis (display_name default dari nama file).

> Milestone: upload `2026_Summary_Daywork-Done.xlsx` → tabel `miop_daywork_records`
> lahir + tab "Daywork" muncul, tanpa sentuh DB.

## Phase 2: Widget Runtime + Dashboard Grid

1. `lib/query-runtime.ts`: QuerySpec sederhana (`{table, measure, dimension, timeField}`)
   → SQL aman (identifier tervalidasi, value ber-parameter).
2. Widget generik: `kpi`, `timeseries`, `breakdown`, `table` (Recharts).
3. Widget picker: pilih dataset + kolom dari `DatasetColumn`.
4. `dashboard-grid`: react-grid-layout + drag/resize → simpan `DashboardWidget`.

> Milestone: user pilih chart, drag/resize, layout tersimpan per user.

## Phase 3: Polish + Multi-Dept Proof

- User HSE login → import dataset sendiri → navbar & dashboard terisi otomatis
  (tanpa ubah platform). Bukti modularitas.
- Rename dataset (display_name) dari UI.
- Filter waktu dasar.

## Phase 4: Desktop + Lanjutan

- Tauri v2 wrapper (.exe ringan).
- (Opsional) normalisasi alias, derived dim reuse lintas dataset.

## Keputusan Terbuka

- Auth: **demo-first simple credentials** (sesuai diskusi), bukan next-auth dulu.
- Deteksi monthly-pack: **via kolom tanggal** (Opsi B), paling robust.
- Derived dimension: lahir otomatis dari kolom `category` flagged `isDimension`.
- Repo rename: kosmetik, dilakukan kapan pun.
