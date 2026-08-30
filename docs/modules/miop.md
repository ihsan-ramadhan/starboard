# Module MIOP (reference implementation)

MIOP = Mining & Operation. Ini adalah **module pertama & referensi** untuk pola
multi-departemen. Semua dataset MIOP di-prefix `miop_`.

## 1. Tabel

- `miop_daywork_records` — 1 baris = 1 aktivitas unit per tanggal.
  FK: `eqnum`→`equipment`, `kode`→`miop_activity_codes`, `dept`→`departments`.
- `miop_activity_codes` — lookup kategori aktivitas (vocabulary terkontrol,
  menyerap ejaan beda jadi 1, mis. `POST-MINING`).

> Rename dari `daywork_records` / `activity_codes` dilakukan di Phase 1 roadmap.

## 2. Data Sources (QuerySpec)

| key | spec | bentuk | widget |
|---|---|---|---|
| `miop.kpi_wh` | `{table, measure:{field:"wh",agg:"sum"}}` | Kpi | kpi |
| `miop.kpi_cost` | `{table, measure:{field:"costUsd",agg:"sum"}}` | Kpi | kpi |
| `miop.kpi_count` | `{table, measure:{field:"id",agg:"count"}}` | Kpi | kpi |
| `miop.wh_trend` | `{table, measure:{field:"wh",agg:"sum"}, timeField:"tanggal"}` | TimeSeries | timeseries |
| `miop.cost_trend` | `{table, measure:{field:"costUsd",agg:"sum"}, timeField:"tanggal"}` | TimeSeries | timeseries |
| `miop.activity_breakdown` | `{table, measure:{field:"wh",agg:"sum"}, dimension:"kode"}` | Breakdown | breakdown |
| `miop.dept_breakdown` | `{table, measure:{field:"wh",agg:"sum"}, dimension:"dept"}` | Breakdown | breakdown |
| `miop.egi_breakdown` | `{table, measure:{field:"wh",agg:"sum"}, dimension:"egi (via equipment)"}` | Breakdown | breakdown |

> `egi_breakdown` butuh join ke `equipment` (egi ada di sana). Pada implementasi
> bisa berupa data source khusus yg kompilasinya menyertakan `JOIN equipment`.

## 3. Dashboard Definition (awal)

| widgetKey | widgetType | dataSourceKey | chartType | layout (x,y,w,h) |
|---|---|---|---|---|
| `kpi` | kpi | (3 KPI digabung 1 widget) | — | 0,0,12,2 |
| `trend_wh` | timeseries | `miop.wh_trend` | line | 0,2,6,7 |
| `trend_cost` | timeseries | `miop.cost_trend` | line | 6,2,6,7 |
| `activity_contribution` | breakdown | `miop.activity_breakdown` | pie | 0,9,4,7 |
| `dept_contribution` | breakdown | `miop.dept_breakdown` | bar | 4,9,4,7 |
| `egi_total` | breakdown | `miop.egi_breakdown` | bar | 8,9,4,7 |

(Sesuai widget di `PROJECT.md`: trend WH/cost, activity/dept/EGI contribution, KPI.)

## 4. Import

- `scripts/import-daywork.ts` (sudah ada) → staging → validasi → promote ke
  `miop_daywork_records`, sekaligus upsert `departments`, `equipment`,
  `miop_activity_codes` (dengan normalisasi `kode`).
- Jalankan: `npm run import -- assets/2026_Summary Daywork-Done.xlsx`
  (pakai `--reset` untuk bersihkan dulu).

## 5. Dataset MIOP lain (menyusul)

MIOP akan punya dataset selain daywork (mis. fuel, production). Cukup tambah
tabel `miop_*` + data source + widget di definisi dashboard — tanpa sentuh
platform. Pola sama persis dengan nambah departemen.
