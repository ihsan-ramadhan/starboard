# Starboard: Stargate Daywork Dashboard (Project Context)

Dokumen konteks bisnis. Baca sebelum mulai coding; detail teknis ada di `docs/`.

## 1. Latar Belakang

Project magang di PT Stargate Pacific Resources (site pertambangan nikel). Proses
pelaporan aktivitas unit alat berat (daywork) masih manual:

1. Kontraktor (PT Kalimantan Prima Persada / KPP) kasih data mentah working hours
   per unit dalam bentuk Excel (sheet per unit, format "REKONSIL WORKING HOURS").
2. Data diinput manual ke sebuah file Excel pusat (`2026_Summary_Daywork-Done.xlsx`)
   yang punya 1 sheet per bulan.
3. File Excel pusat jadi source dashboard Power BI yang di-embed lewat SharePoint,
   dan ini lambat serta rawan human error.

Tujuan: bangun admin dashboard sendiri (bukan PowerBI lagi) yang datanya dari
PostgreSQL, bisa di-kustomisasi layout, dan nantinya auto-import data mentah dari
kontraktor tanpa proses manual.

## 2. Arah Produk (No-Code, Multi-Departemen)

Starboard berkembang jadi super-app multi-departemen: MIOP (Mining & Operation),
HSE (Health, Safety & Environment), MPMA (Mineral Product Management), dan dept
lain. Prinsip inti:

- User tidak pernah menyentuh database, SQL, atau struktur skema.
- User tidak mendeklarasikan tipe kolom secara manual.
- Sistem menginferensi tipe kolom dari isi data (sampling).
- Tabel dan menu dashboard lahir otomatis saat import.

Dept diambil dari login (kolom `User.role`), bukan dipilih user di UI. Lihat
`docs/architecture.md` untuk alur lengkap.

## 3. Tech Stack

| Bagian | Pilihan | Catatan |
|---|---|---|
| Framework | Next.js (App Router) fullstack | Server Actions / Route Handlers sebagai backend |
| Database | PostgreSQL (Supabase) | project `lejeqlnbdvtmkozjufig` |
| ORM | Prisma v6 | bootstrap schema + dynamic DDL saat import |
| Auth | credentials sederhana | email+password, session cookie (demo-first) |
| Import parsing | `exceljs` | jalan di Node runtime (bukan Edge) |
| Layout draggable | `react-grid-layout` | drag-and-drop reposisi widget |
| Chart | Recharts 3 | query data generik, chart type bisa di-switch |
| Desktop Client | Tauri v2 | wrapper semi-native ringan (.exe ~5-10MB, WebView2) |

Semua pilihan gratis / open-source.

## 4. Data Model (Bootstrap + Dynamic)

Bootstrap (ada sejak hari ke-1, bukan dari Excel): `Department`, `User`,
`Session`, `DatasetRegistry`, `DatasetColumn`, `DashboardWidget`. Lihat
`prisma/schema.prisma`.

Dynamic (dibuat saat import via DDL engine): `<dept>_<slug>_records`,
`<dept>_<slug>_staging`, `<dept>_<slug>_<col>_dim` (derived dimension). Tabel
dynamic tidak didefinisikan di schema, lahir dari upload Excel.

Contoh hasil import daywork MIOP: `miop_daywork_records` (fact),
`miop_daywork_staging` (transit), `miop_daywork_kode_dim` (lookup dari kolom
`kode`, normalisasi alias `POST MINING` / `POST-MINING`).

## 5. Alur Import (Staging Pattern)

1. User upload Excel via UI (tidak ada script one-time lagi).
2. Inference: sample stratifikasi (awal + tengah + akhir) menebak tipe kolom
   (numeric / date / category) + deteksi "monthly pack" (gabung sheet JAN..AUG
   jadi 1 dataset + kolom `source_month`).
3. Dynamic DDL: `CREATE TABLE` fact + staging + derived dimension. Identifier
   divalidasi regex sebelum dieksekusi.
4. Isi `DatasetRegistry` + `DatasetColumn` (metadata navbar & widget picker).
5. Promote baris valid ke fact table; baris error ke staging.
6. Navbar nambah tab otomatis (display_name default dari nama file, bisa di-rename).

## 6. Fitur Dashboard

Dari dashboard PowerBI existing, direplikasi sebagai widget generik:
- Trend WH per bulan (line chart)
- Trend Cost per bulan (line chart)
- Activity Contribution (WH per kode aktivitas)
- Dept Contribution (WH per dept)
- EGI Total (WH per tipe unit)
- KPI card: total WH, total Cost

Fitur baru:
- Layout draggable, tersimpan per user (`dashboard_widgets`).
- Switchable chart type (pie ke bar) tanpa fetch ulang.
- Filter waktu (bulan, rentang custom, tahun).

## 7. Struktur Project

```
/prisma/schema.prisma        bootstrap schema + migrations/
/prisma/seed.ts              seed department + user demo
/docs/                       architecture.md, database.md, roadmap.md, DESIGN.md
/lib/                        prisma.ts, auth.ts
/app/                        layout, page (dashboard), login, import, d/[key]
/components/shell/           Navbar
/proxy.ts                    auth guard (ganti middleware Next 16)
```

## 8. Dokumentasi

- `docs/architecture.md`: prinsip no-code dynamic, inference, derived dimension.
- `docs/database.md`: skema bootstrap + bentuk tabel dinamis.
- `docs/roadmap.md`: fase demo-first, bertahap (Phase 0 auth s/d Phase 4 desktop).
- `DESIGN.md`: arah visual (light mode, aksen biru, ENERGY/RHYTHM/MOTION).
