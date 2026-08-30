# Starboard — Stargate Multi-Department Dashboard (Super App)

Dokumen ini adalah acuan utama untuk AI coding agent yang mengerjakan project ini (Starboard).
Bacalah bersama `PROJECT.md` (konteks bisnis) dan dokumen pendukung di `docs/`
(`database.md`, `api.md`, `roadmap.md`, `modules/*.md`).

## 1. Tujuan & Ruang Lingkup

Aplikasi ini awalnya dibuat untuk mereplikasi dashboard PowerBI aktivas unit alat
berat (daywork) departemen **MIOP** (Mining & Operation). Rencananya berevolusi
menjadi **super app multi-departemen**: selain MIOP, akan ada dashboard untuk
**MPMA** (Mineral Product Management), **HSE** (Health, Safety & Environment),
dan departemen lain di masa depan. Setiap departemen punya **data yang berbeda**.

Target desain: menambah departemen baru harus **additive & modular** — cukup
"memberi data + apa yang mau ditampilkan", lalu dashboard otomatis muncul, tanpa
mengubah kode platform.

> Fokus saat ini tetap **MIOP / daywork**. Dalam MIOP nanti bisa muncul dataset
> lain (bukan cuma daywork), tapi untuk sekarang hanya daywork yang dikerjakan.

## 2. Prinsip Inti

1. **Platform vs Module.** Pisahkan kode yang stabil (platform, dibangun sekali)
   dari kode yang tumbuh per departemen (module, additive).
2. **Deklaratif & aman.** Widget dan query dideklarasikan via spesifikasi, bukan
   SQL ad-hoc. Runtime mengkompilasi spesifikasi menjadi SQL ber-parameter.
3. **Dimensi bersama.** Tabel seperti `departments`, `equipment`, `users`
   dipakai lintas departemen (pola Opsi B).
4. **Generic widget runtime.** Beberapa tipe widget generik dibuat sekali, dipakai
   semua departemen. Departemen baru tidak perlu bikin komponen React baru.

## 3. Konteks Sistem & Alur Data

```
[Excel / file mentah kontraktor]
        │  (import script per module: staging -> validasi -> promote)
        ▼
[Fact table per module]   contoh: miop_daywork_records, hse_incidents
        │  (data sudah bersih + FK ke dimensi bersama)
        ▼
[Data Source]  deklarasi QuerySpec -> dikompilasi jadi SQL aman
        │  (filter tanggal dari Filter Context disuntikkan)
        ▼
[Widget Runtime]  render generic widget (kpi / timeseries / breakdown / table)
        │
        ▼
[Dashboard per departemen]  disusun dari DashboardDefinition + layout user
```

## 4. Arsitektur Berlapis

```
┌─────────────────────────────────────────────────────────────┐
│  PLATFORM (dibangun sekali)                                  │
│                                                              │
│  app/layout.tsx ── Shell (nav, Department Switcher, theme)   │
│  app/[dept]/page.tsx ── Dashboard shell per departemen       │
│                                                              │
│  components/                                                 │
│    shell/         nav, dept switcher, user menu              │
│    widgets/       Kpi, TimeSeries, Breakdown, Table (GENERIK)│
│    dashboard-grid react-grid-layout + layout persistence      │
│                                                              │
│  lib/                                                         │
│    query-runtime.ts  QuerySpec -> SQL aman (Prisma)          │
│    prisma.ts         Prisma client singleton                 │
│    types.ts          tipe shared                             │
│                                                              │
│  Department Registry  (daftar dept yg ada)                    │
└─────────────────────────────────────────────────────────────┘
        │ module terdaftar di sini
        ▼
┌─────────────────────────────────────────────────────────────┐
│  DEPARTMENT MODULE (additive, tiap dept)                     │
│    modules/<dept>/schema  (tabel fact + lookup)              │
│    modules/<dept>/dataSources.ts (daftar QuerySpec)          │
│    modules/<dept>/dashboard.ts  (DashboardDefinition)        │
│    modules/<dept>/import.ts   (optional, raw -> staging)     │
└─────────────────────────────────────────────────────────────┘
```

## 5. Kontrak Department Module

Untuk menambah departemen (mis. HSE), cukup sediakan:

| Artifact | Kewajiban | Keterangan |
|---|---|---|
| `modules/<dept>/schema` | Tabel `fact` + `lookup` (prefix `<dept>_`) | FK ke dimensi bersama |
| `modules/<dept>/dataSources.ts` | Daftar `QuerySpec` (key unik) | Dipakai widget |
| `modules/<dept>/dashboard.ts` | `DashboardDefinition[]` | Susunan widget |
| `modules/<dept>/import.ts` | (opsional) parse file mentah | Staging → promote |
| Registrasi | Tambah entry di Department Registry | Aktifkan routing |

**Tidak ada komponen React baru** yang wajib ditulis untuk dept baru, karena
widget typenya sudah ada di platform.

## 6. Tiga Sumbu Modularitas

| Sumbu | Mekanisme |
|---|---|
| **Data model** | Tiap dept punya tabel sendiri (`miop_*`, `hse_*`, `mpma_*`) di schema publik, join ke dimensi bersama. |
| **Data source** | Tiap widget makan data dari "query terdaftar" (`QuerySpec`), bukan SQL ad-hoc. |
| **Dashboard** | Tiap dept punya susunan widget berbeda (`DashboardDefinition`), disimpan di DB. |

## 7. Mekanisme "Otomatis Tampil"

Karena (a) widget type generik dan (b) query dideklarasikan via `QuerySpec`
(bukan SQL mentah), maka:

> Dept mendaftarkan tabel + data sources + dashboard definition → shell otomatis
> me-render dashboard departemen tersebut tanpa menyentuh kode platform.

Escape hatch: bila butuh widget khusus, dept boleh mendaftarkan **custom React
component** sebagai widget type tambahan (bukan keharusan).

## 8. Konvensi

- **Dept code**: uppercase, cocok dengan nilai di tabel `departments` (`MIOP`,
  `HSE`, `MPMA`).
- **Module prefix**: `<dept>_` lowercase, mis. `miop_daywork_records`,
  `hse_incidents`, `mpma_production`.
- **Folder module**: `modules/<dept>/`.
- **Schema tunggal**: semua model (shared + semua module) berada di
  `prisma/schema.prisma`, dipisah dengan comment section `// ===== MODULE MIOP =====`.
  (Prisma menggunakan satu file schema; pemisahan fisik per file bisa pakai
  `prisma.config.ts` di Prisma 7+, tapi untuk v1 cukup section comment.)
- **Bahasa**: identifier & commit message English; komentar & doc Indonesia.

## 9. Tech Stack & Delivery Model

- **Frontend / Fullstack:** Next.js (App Router) + React 19 + TypeScript
- **Database:** PostgreSQL via Supabase (Prisma ORM, pinned v6)
- **Visualization & Layout:** Recharts 3, react-grid-layout 2
- **Data Ingestion:** exceljs (Node runtime parser)
- **Desktop Wrapper (Client):** Tauri v2 (semi-native wrapper menggunakan OS Webview / WebView2, installer .exe ringan ~5-10MB tanpa membungkus Chromium utuh)
- **Deployment Model:** Web server Next.js + DB di cloud/server internal; staf mengakses via browser atau aplikasi desktop Tauri.

## 10. Non-Goals (fase ini)

- Auth & RBAC per-departemen (fase 2+, lihat `roadmap.md`).
- Editor admin visual untuk nambah departemen tanpa kode (fase 3).
- Isolasi schema Postgres terpisah per dept (v1 cukup prefix tabel).

## 11. Relasi dengan dokumen lain

- `PROJECT.md` — konteks bisnis & keputusan awal.
- `database.md` — skema lengkap & strategi migrasi.
- `api.md` — query runtime, data source spec, kontrak widget & routing.
- `roadmap.md` — fase & status, fokus MIOP/daywork.
- `modules/miop.md` — definisi module MIOP (referensi implementasi).
