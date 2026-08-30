# Starboard — Stargate Daywork Dashboard — Project Context

Dokumen ini adalah konteks lengkap yang bakal bantu bangun project ini. Baca semua sebelum mulai coding.

## 1. Latar Belakang

Project magang di PT Stargate Pacific Resources (site pertambangan nikel). Saat ini proses pelaporan aktivitas unit alat berat (daywork) masih manual:

1. Kontraktor (PT Kalimantan Prima Persada / KPP) kasih data mentah working hours per unit dalam bentuk Excel (sheet per unit, format "REKONSIL WORKING HOURS").
2. Data itu diinput manual satu-satu ke sebuah **file Excel pusat** (`2026_Summary_Daywork-Done.xlsx`) yang punya 1 sheet per bulan.
3. File Excel pusat itu jadi source buat dashboard **Power BI** yang di-embed lewat SharePoint — dan ini lambat serta rawan human error.

Tujuan akhir project: bikin **admin dashboard sendiri** (bukan PowerBI lagi) yang datanya dari PostgreSQL, bisa di-kustomisasi layout-nya, dan nantinya bisa auto-import data mentah dari kontraktor tanpa proses manual.

## 2. Scope Fase Saat Ini (v1)

Fokus fase ini **hanya**: pindahin data yang sudah ada di `2026_Summary_Daywork-Done.xlsx` (sheet JAN–AUGUST) ke PostgreSQL, lalu tampilin sebagai dashboard web yang bisa dikustomisasi.

- Rentang data: **Januari 2026 s/d data terakhir yang tersedia** (per file yang diimpor, sekitar 18–24 Agustus 2026).
- Data source untuk fase ini: file Excel pusat yang sudah diolah manual — **bukan** file mentah dari kontraktor.
- Import dilakukan lewat script one-time (lihat `import-daywork.ts`), bukan lewat UI upload dulu.

## 3. Di Luar Scope Fase Ini (Fase Berikutnya)

Jangan dikerjain dulu, tapi desain data model & flow-nya sudah disiapkan supaya gampang diperluas ke sini:

- Fitur upload file mentah kontraktor langsung dari admin dashboard (auto-parse → staging → validasi → main table).
- Role-based login/akses per department.
- PowerBI **tidak dipakai lagi** — sudah diputuskan pindah full ke dashboard custom karena masalah lisensi & refresh delay PowerBI Embedded.

## 4. Tech Stack

| Bagian | Pilihan | Catatan |
|---|---|---|
| Framework | Next.js (App Router) fullstack | Server Actions / Route Handlers sebagai backend, tanpa NestJS terpisah |
| Database | PostgreSQL | Self-host di server internal kantor kalau memungkinkan; Supabase/Neon free tier buat dev/testing |
| ORM | Prisma | Lihat `schema.prisma` |
| Import parsing | `exceljs` | Dipakai di `import-daywork.ts`, jalan di Node runtime (bukan Edge) |
| Layout draggable | `react-grid-layout` | Buat fitur drag-and-drop reposisi widget |
| Chart | Recharts atau ECharts | Query data selalu dalam bentuk generik biar gampang di-switch jenis chart-nya |
| Desktop Client | Tauri v2 | Wrapper semi-native ringan (~5-10MB .exe), menggunakan WebView2 Windows |
| Auth | Custom JWT (`@nestjs/passport` style tapi di Next.js, atau `next-auth` credentials) | Role-based access per department |

Semua pilihan di atas gratis / open-source — tidak ada biaya lisensi.

## 5. Data Model (Opsi B: flat fact + lookup tables)

Skema pakai pola **shared dimensions + per-menu fact tables** (lihat `schema.prisma` untuk definisi lengkap):

- **Dimensi bersama** (dipakai lintas menu): `Department` (code PK), `Equipment` (eqnum PK + egi), `User` (buat layout & RBAC fase berikutnya).
- **Lookup daywork**: `ActivityCode` (code PK, vocabulary terkontrol — menyatukan ejaan beda seperti `POST MINING`/`POST-MINING` jadi 1 kode).
- **Fact table daywork**: `DayworkRecord` (1 baris = 1 aktivitas unit per tanggal). Kolom `dept`/`kode`/`eqnum` adalah **FK** ke tabel dimensi/lookup di atas; `aktivitas` tetap teks bebas.
- **Staging**: `DayworkStaging` (transit parse → validasi → promote; dipakai import awal & fitur upload nanti).
- **Layout**: `DashboardWidget` punya `menuKey` supaya layout draggable tersimpan per-menu.

> Pola tambah menu baru = bikin `xxx_records` + `xxx_staging` + lookup khusus, semua referencing dimensi bersama. Jangan pakai 1 tabel generic/EAV.

Ringkasan field utama `DayworkRecord`:

| Field | Arti | Contoh |
|---|---|---|
| `eqnum` | Nomor unit (FK → Equipment.eqnum) | `EX221` |
| `aktivitas` | Deskripsi pekerjaan (teks bebas) | `CONSTRUCT JALAN TOWEA 2` |
| `kode` | Kategori aktivitas (FK → ActivityCode.code) | `ROAD MAINTENANCE`, `BARGING`, `POST-MINING` |
| `dept` | Department (FK → Department.code) | `MIOP`, `MPMA`, `HSE`, `CDR` |
| `tanggal` | Tanggal aktivitas (date, bukan cuma nomor bulan) | `2026-07-01` |
| `wh` | Working hours | `16.7` |
| `costUsd` | Biaya dalam USD | `1457.73` |
| `sourceMonth` | Label bulan sumber data, buat traceability | `2026-07` |

Catatan: `egi` (tipe unit, mis. `PC200`) **tidak** disimpan di `DayworkRecord`, melainkan di `Equipment` — diakses lewat join saat perlu (widget EGI Total).

## 6. Alur Import (Staging Pattern)

Semua import — baik yang one-time lewat script sekarang, maupun fitur upload di web app nanti — ikutin pola yang sama:

1. **Parse** file Excel jadi baris-baris data mentah.
2. **Insert ke `daywork_staging`** dengan status awal (`VALID`/`ERROR` berdasarkan hasil validasi), plus `sourceFile`/`sourceSheet`/`sourceRow` buat traceability kalau ada yang perlu ditelusuri balik.
3. **Validasi**: semua field wajib ada (egi, eqnum, aktivitas, kode, dept), tanggal harus valid, `wh` dan `costUsd` harus angka ≥ 0.
4. **Promote**: baris berstatus `VALID` dipindah (insert) ke `daywork_records`, status staging diupdate jadi `PROMOTED`.
5. Baris `ERROR` dibiarkan di staging buat dicek manual — tidak otomatis masuk ke tabel utama.

Script `import-daywork.ts` sudah mengimplementasikan pola ini dan sudah diuji terhadap struktur file asli — dari 2.624 baris di file contoh, semuanya valid (0 error), jadi flow validasi confirmed bekerja dengan data real.

## 7. Fitur Dashboard

Replikasi dashboard PowerBI yang sudah ada, ditambah fitur baru:

**Widget yang perlu ada (dari dashboard PowerBI existing):**
- Trend WH per bulan (line chart)
- Trend Cost per bulan (line chart)
- Tabel/breakdown aktivitas per bulan beserta WH-nya
- Activity Contribution (WH per `kode`/aktivitas)
- Dept Contribution (WH per `dept`)
- EGI Total (WH per `egi`)
- KPI card: total WH, total Cost

**Fitur baru yang diminta klien:**
- **Layout draggable** — user bisa drag/reposisi tiap widget, layout tersimpan per user (tabel `dashboard_widgets`).
- **Switchable chart type** — tiap widget bisa diganti jenis chart-nya (misal pie → bar). Desain query data dalam bentuk generik `{label, value}[]` untuk widget kategorikal (Activity/Dept/EGI Contribution) supaya switch chart type tidak perlu fetch ulang data.
- **Filter waktu**: pilih bulan spesifik, rentang tanggal custom (dari-sampai), atau summary keseluruhan.
- **Filter tahun** — siapkan query & schema supaya nanti kalau ada data multi-tahun, filter ini langsung jalan (`WHERE EXTRACT(YEAR FROM tanggal) = $1`).

## 8. Struktur Project yang Disarankan

```
/prisma/schema.prisma
/scripts/import-daywork.ts
/docs/
  /architecture.md
  /database.md
  /api.md
  /roadmap.md
  /modules/miop.md
/modules/
  /miop/...
/app/
  /[dept]/page.tsx
/components/
  /widgets/...
  /dashboard-grid.tsx
```

## 9. Cara Menjalankan Import Script

```bash
npm run import -- assets/2026_Summary Daywork-Done.xlsx

# buat testing ulang dari awal (kosongin staging & records dulu):
npm run import -- assets/2026_Summary Daywork-Done.xlsx --reset
```

## 10. Dokumentasi Arsitektur Super App

Detail teknis platform modular & multi-departemen ada di folder `docs/`:
- `docs/architecture.md` — Prinsip platform vs module, generic widget runtime, modularitas.
- `docs/database.md` — Skema shared dimensions, per-module tables, runtime tables.
- `docs/api.md` — QuerySpec, query compiler, generic data shapes, routing.
- `docs/roadmap.md` — Rencana fase (Phase 1 MIOP s/d Phase 4 RBAC).
- `docs/modules/miop.md` — Spesifikasi module referensi MIOP.
