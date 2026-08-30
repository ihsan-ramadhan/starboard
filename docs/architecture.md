# Starboard: No-Code Multi-Department Dashboard (Super App)

Dokumen acuan utama untuk AI agent. Bacalah bersama `PROJECT.md` (konteks bisnis)
dan dokumen pendukung di `docs/` (`database.md`, `roadmap.md`).

> **Catatan pivot (2026-08-30):** Arsitektur awal (`docs` lama) memakai skema
> *terkontrol per-modul* dengan folder `modules/<dept>/` hardcode.
> Berdasarkan diskusi, arah diubah ke **dynamic inference-based**: user cuma
> login + upload Excel, tabel & menu lahir otomatis, tanpa sentuh DB/kode.
> Dokumen ini menulis ulang arsitektur ke arah tersebut.

## 1. Tujuan & Ruang Lingkup

Admin dashboard internal PT Stargate Pacific Resources. Awalnya untuk replikasi
dashboard daywork (working hours unit alat berat) departemen **MIOP**, lalu
berevolusi jadi **super-app multi-departemen** (MIOP, MPMA, HSE, ...).

**Prinsip no-code mutlak:**
- User tidak pernah menyentuh database / SQL / struktur skema.
- User tidak pernah mendeklarasikan tipe kolom secara manual.
- Sistem menginferensi tipe kolom dari isi data (sampling).
- Tabel & menu dashboard lahir **otomatis** saat import.

## 2. Alur End-to-End (Satu-satunya yang user lakukan)

```
1. LOGIN  → sistem tahu dept dari akun (role), bukan dipilih user.
2. DASHBOARD kosong (belum ada dataset) → tampil CTA "Import Dataset".
3. UPLOAD Excel (via UI, bukan script).
4. INFERENCE → baca header + sample baris → tebak tipe tiap kolom
              (numeric | date | category) + deteksi "monthly pack".
5. CREATE TABLE otomatis:
     - <dept>_<slug>_records        (fact table, ISI SELURUH BARIS)
     - <dept>_<slug>_staging         (transit/validasi)
     - <dept>_<slug>_<col>_dim        (derived dimension, 1 per kolom kategori)
   + isi DatasetRegistry + DatasetColumn (metadata, buat navbar & widget picker).
6. NAVBAR nambah tab baru (display_name default dari nama file, bisa di-rename).
7. USER atur widget (pilih chart, drag/resize) → tersimpan per user+dataset.
```

**Yang user lakukan = 3 hal:** login, upload, atur widget. Sisanya otomatis.

## 3. Tiga Konsep Kunci

### 3.1 Dept dari login (bukan dipilih)
`User.role` menyimpan dept code (`MIOP`/`HSE`/`MPMA`). Prefix tabel fisik
`<dept>_` diambil dari sini. User tidak memilih departemen di UI.

### 3.2 Inference (bukan deklarasi)
Tipe kolom ditebak dari isi, bukan diketik:
- isi angka konsisten → `numeric` (kandidat metrik/KPI).
- isi `Date`/`DateTime` → `date` (otomatis sumbu waktu).
- isi teks campuran / kardinalitas rendah → `category` (pie/bar breakdown).
- Sample diambil **stratified** (awal + tengah + akhir), bukan 50 pertama saja,
  supaya representatif. Hasil inference hanya buat "skema", BUKAN yang diimpor.
  **Seluruh baris Excel tetap masuk tabel**.

### 3.3 Display name bisa di-kustom, identitas internal tetap
- `DatasetRegistry.displayName` → **bisa di-rename** user (navbar nampilin ini).
- `key` (slug) & `tableName` fisik → **tetap**, tidak diedit (buat routing/query).
Jadi widget tidak lost-reference saat nama menu diubah.

## 4. Deteksi "Monthly Pack" (banyak sheet = 1 dataset)
Excel daywork punya sheet `JAN..AUGUST` (bukan cuma summary). Sistem deteksi:
- Jika sheet cocok pola bulanan (3 huruf + spasi opsional) **ATAU** semua sheet
  punya kolom `date` → gabung jadi 1 dataset + tambah kolom `source_month`.
- User tidak diminta pilih sheet. (Opsi B di diskusi: deteksi via kolom tanggal.)

## 5. Derived Dimension (equipment, activity, dst lahir otomatis)
Tabel seperti `equipment` / `activity_codes` **bukan bootstrap & bukan hardcode**.
Saat import, tiap kolom `category` yang ditandai `isDimension` → sistem otomatis
buat tabel lookup `<dept>_<slug>_<col>_dim` dari nilai unik kolom itu. Persis
seperti `buildReferenceData()` sekarang, cuma di-generalisasi. User tidak ikut campur.

## 6. Arsitektur Berlapis

```
┌─────────────────────────────────────────────────────────────┐
│  BOOTSTRAP (ada sejak hari ke-1, bukan dari Excel)           │
│   User, Department, DatasetRegistry, DatasetColumn,          │
│   DashboardWidget, Session/Account                           │
└─────────────────────────────────────────────────────────────┘
                    │ import melahirkan
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  DYNAMIC (dibuat saat import, DDL di-whitelist ketat)        │
│   <dept>_<slug>_records, _staging, _<col>_dim                │
└─────────────────────────────────────────────────────────────┘
                    │ dibaca oleh
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  PLATFORM (dibangun sekali)                                  │
│   app/shell (navbar dinamis = DatasetRegistry), auth,        │
│   import-flow (inference + DDL engine), query-runtime,       │
│   widgets generik (kpi/timeseries/breakdown/table),          │
│   dashboard-grid (react-grid-layout + persistence)           │
└─────────────────────────────────────────────────────────────┘
```

**Tidak ada folder `modules/<dept>/`**: departemen & dataset bukan kode, tapi
baris di `DatasetRegistry`. Menambah departemen = buat User dengan role baru +
impor dataset. Tanpa ubah platform.

## 7. Dynamic DDL (keamanan)
Table/column name dari user (nama file) **tidak boleh** langsung di-string-kan ke
SQL. Aturan:
- Slug tabel/kolom divalidasi regex `^[a-z][a-z0-9_]*$`, max 40 char.
- `dept` prefix hanya dari enum `role` (server-side), bukan input bebas.
- Query baca data selalu pakai identifier yang sudah divalidasi + value ber-parameter.

## 8. Konvensi

- **Dept code**: uppercase (`MIOP`, `HSE`, `MPMA`), diambil dari `User.role`.
- **Table prefix**: `<dept>_` lowercase (`miop_`, `hse_`, `mpma_`).
- **Dataset slug**: dari nama file di-humanize+slugify (`2026_Summary_Daywork-Done.xlsx` → `daywork`).
- **Tabel fisik**: `<dept>_<slug>_records`, `<dept>_<slug>_staging`,
  `<dept>_<slug>_<col>_dim` (derived dimension).
- **Bahasa**: identifier & commit message English; komentar & doc Indonesia.

## 9. Tech Stack & Delivery

- **Frontend/Fullstack:** Next.js (App Router) + React 19 + TypeScript
- **DB:** PostgreSQL (Supabase, project baru `lejeqlnbdvtmkozjufig`) + Prisma v6
- **Auth:** simple credentials (email+password, session cookie), demo-first
- **Viz/Layout:** Recharts 3, react-grid-layout 2
- **Ingest:** exceljs (Node runtime)
- **Desktop:** Tauri v2 (fase akhir, bungkus web Next.js)

## 10. Non-Goals (saat ini)

- Pemisahan schema Postgres fisik per dept (cukup prefix tabel).
- Editor admin visual untuk nambah dept tanpa DB (cukup lewat User.role).
- Multi-tenant isolation kuat (v1: trust via role).

## 11. Relasi dokumen

- `PROJECT.md`: konteks bisnis.
- `database.md`: skema bootstrap + bentuk tabel dinamis.
- `roadmap.md`: fase & status (demo-first, bertahap).
