# API & Data Layer

Acuan untuk AI agent soal pengambilan data, query runtime, dan kontrak widget.
Filosofi: **server-side fetching**, **deklaratif & aman**, **generic widget**.

## 1. Arsitektur Pengambilan Data

```
app/[dept]/page.tsx  (Server Component)
   │  baca searchParams (filter: month / from / to / year)
   ▼
lib/query-runtime.ts
   │  resolve(widget.dataSourceKey, filter) -> jalankan QuerySpec
   ▼
Prisma (SQL ber-parameter, aman)
   ▼
Generic data shape -> diteruskan ke client component widget
```

- Semua query jalan di server (Prisma). Client component hanya render.
- Tidak ada SQL mentah dari config/user; semua lewat `QuerySpec`.

## 2. QuerySpec (inti "otomatis tampil")

`DataSource.spec` adalah deklarasi query yang **dikompilasi runtime** menjadi
SQL aman. Tidak ada concat input user ke SQL.

```ts
type Agg = "sum" | "count" | "avg";

type QuerySpec = {
  table: string;                  // "miop_daywork_records"
  measure: { field: string; agg: Agg };
  dimension?: string;             // group-by (breakdown)
  timeField?: string;             // untuk timeseries (default "tanggal")
  dateFilterField?: string;       // default "tanggal"
};
```

Contoh `miop.wh_trend`:
```ts
{ table: "miop_daywork_records", measure: { field: "wh", agg: "sum" }, timeField: "tanggal" }
```
Runtime mengkompilasi (dengan filter tanggal dari Filter Context):
```sql
SELECT DATE_TRUNC('month', tanggal) AS x, SUM(wh) AS value
FROM miop_daywork_records
WHERE tanggal BETWEEN $1 AND $2
GROUP BY x ORDER BY x;
```

Contoh `miop.activity_breakdown`:
```ts
{ table: "miop_daywork_records", measure: { field: "wh", agg: "sum" }, dimension: "kode" }
```
```sql
SELECT kode AS label, SUM(wh) AS value
FROM miop_daywork_records WHERE tanggal BETWEEN $1 AND $2
GROUP BY kode ORDER BY value DESC;
```

> Implementasi kompilasi wajib pakai **parameter** (`$1`, `$2`) — jangan string
> interpolation untuk nama kolom/operator. Nama kolom diambil dari `QuerySpec`
> yang sudah divalidasi (whitelist field milik tabel itu), bukan input bebas.

## 3. Generic Data Shapes

Widget hanya mengenal 4 bentuk data:

| Shape | Bentuk | Dipakai oleh |
|---|---|---|
| `Kpi` | `{ value: number, label: string, delta?: number }` | widget `kpi` |
| `TimeSeries` | `{ x: string; [series]: number }[]` | widget `timeseries` |
| `Breakdown` | `{ label: string; value: number }[]` | widget `breakdown` |
| `Table` | `Record<string, unknown>[]` | widget `table` |

Karena shape generik, satu widget type bisa dipakai semua departemen.

## 4. Kontrak Widget Runtime

Widget type generik (dibuat sekali di `components/widgets/`):

| Widget type | Props inti | Chart tersedia |
|---|---|---|
| `kpi` | `data: Kpi` | angka + label |
| `timeseries` | `data: TimeSeries`, `series: string[]`, `chartType: line\|bar` | Line / Bar |
| `breakdown` | `data: Breakdown`, `chartType: pie\|bar` | Pie / Bar |
| `table` | `rows: Table` | tabel |

Setiap widget menerima `chartType` yang bisa di-switch user (sesuai fitur
"switchable chart type" di `PROJECT.md`).

## 5. Routing

```
app/layout.tsx              -> root layout + theme
app/[dept]/page.tsx         -> dashboard shell departemen
      │  validasi dept terhadap Department Registry; else 404
      │  baca searchParams -> filter
      │  resolve semua DataSource yg dirujuk DashboardDefinition
      │  render <DashboardLayout widgets={...} />
app/api/layout/route.ts     -> GET/POST layout user (DashboardWidget)
```

- `dept` di URL adalah `Department.code` (lowercase dari registry).
- Bila dept tidak terdaftar → `notFound()`.

## 6. Filter Context

Satu filter tingkat dashboard (bulan / rentang tanggal / tahun) disuntikkan ke
setiap `QuerySpec` via `dateFilterField`. Disimpan di URL (`?month=2026-07` atau
`?from=&to=`), sehingga shareable & SSR-friendly.

- Bulan tunggal: `tanggal >= awal_bulan AND < awal_bulan_berikutnya`.
- Rentang: `tanggal BETWEEN from AND to`.
- Tahun (multi-tahun, fase depan): `EXTRACT(YEAR FROM tanggal) = $1`.

## 7. Layout Persistence

- Template: `dashboard_definitions` (posisi default tiap widget per dept).
- Override user: `dashboard_widgets` (key `userId, deptCode, widgetKey`).
  `userId = null` = layout default/shared.
- Simpan via Server Action / Route Handler (`app/api/layout`) dari event
  `onLayoutChange` react-grid-layout. Baca saat render awal.

## 8. Keamanan

- QuerySpec dikompilasi dengan parameter terikat; tidak ada `${userInput}` di SQL.
- Whitelist field: nama kolom di `QuerySpec` divalidasi terhadap metadata tabel
  (atau allowlist eksplisit per data source) sebelum dikompilasi.
- `deptCode` selalu difilterkan; user hanya bisa query dept yg diizinkan
  (fase RBAC).
- `.env` (DATABASE_URL) tidak pernah ter-commit (sudah di .gitignore).
