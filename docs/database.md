# Database: Starboard (No-Code Dynamic)

Skema acuan untuk AI agent. Semua tabel di schema `public` Postgres (Supabase
project `lejeqlnbdvtmkozjufig`). Prisma pin **v6**.

## 1. Dua Kelompok Tabel

| Kelompok | Asal | Contoh |
|---|---|---|
| **Bootstrap** | ada sejak migrasi pertama, BUKAN dari Excel | `User`, `Department`, `DatasetRegistry`, `DatasetColumn`, `DashboardWidget`, `Session` |
| **Dynamic** | dibuat saat import via DDL engine | `miop_daywork_records`, `miop_daywork_staging`, `miop_daywork_kode_dim` |

User tidak pernah menyentuh DB. Semua tabel dynamic lahir dari import.

## 2. Bootstrap Schema (Prisma)

```prisma
// ── AUTH & DEPT ──
model Department {
  code    String   @id            // MIOP | HSE | MPMA
  name    String?
  color   String?                 // UI switcher
  users   User[]
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String?
  passwordHash String                 // bcrypt, demo-first auth
  role         String                 // dept code: MIOP | HSE | MPMA
  createdAt    DateTime @default(now())
  sessions      Session[]
  widgets       DashboardWidget[]
}

model Session {                    // opaque session token (demo-first)
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  user      User     @relation(fields:[userId], references:[id])
  @@map("sessions")
}

// ── METADATA (hasil import, bukan kode) ──
model DatasetRegistry {
  id           String   @id @default(cuid())
  dept         String                 // MIOP | HSE | MPMA (dari login)
  key          String                 // slug internal, tetap: "daywork"
  tableName    String                 // fisik: "miop_daywork_records"
  displayName  String                 // EDITABLE user: "Daywork"
  createdBy    String?
  createdAt    DateTime @default(now())
  columns      DatasetColumn[]
  widgets      DashboardWidget[]
  @@unique([dept, key])
  @@map("dataset_registry")
}

model DatasetColumn {
  id            String   @id @default(cuid())
  datasetId     String
  name          String                 // kolom fisik: "wh", "tanggal", "kode"
  label         String?                // tampilan picker widget
  type          String                 // numeric | date | category
  isDimension   Boolean  @default(false) // true => lahirkan tabel _dim
  dataset       DatasetRegistry @relation(fields:[datasetId], references:[id])
  @@unique([datasetId, name])
  @@map("dataset_columns")
}

// ── LAYOUT (per user + dataset) ──
model DashboardWidget {
  id          String   @id @default(cuid())
  userId      String?                // null = default/shared
  datasetId   String
  widgetKey   String                 // unik per (user,dataset)
  chartType   String                 // line | bar | pie | kpi | table
  positionX   Int
  positionY   Int
  width       Int
  height      Int
  filterConfig Json?
  dataset     DatasetRegistry @relation(fields:[datasetId], references:[id])
  user        User?         @relation(fields:[userId], references:[id])
  @@unique([userId, datasetId, widgetKey])
  @@map("dashboard_widgets")
}
```

## 3. Dynamic Table Shape (dicontohkan dari import daywork MIOP)

Saat user MIOP upload `2026_Summary_Daywork-Done.xlsx`, sistem membentuk:

```sql
CREATE TABLE miop_daywork_records (
  id           text PRIMARY KEY DEFAULT gen_random_uuid(),
  eqnum        text,
  aktivitas    text,
  kode         text,                 -- isDimension => lahirkan _dim
  dept         text,
  tanggal      date,                 -- type=date => sumbu waktu
  wh           numeric(10,2),        -- type=numeric => metrik
  cost_usd     numeric(14,2),        -- type=numeric
  source_month text,                 -- dari deteksi monthly-pack
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE miop_daywork_staging ( LIKE miop_daywork_records INCLUDING ALL,
  status text, errors text[], source_file text, source_sheet text,
  source_row int );

CREATE TABLE miop_daywork_kode_dim ( code text PRIMARY KEY, label text );
-- diisi dari nilai unik kolom "kode" (normalisasi alias POST MINING/POST-MINING)
```

Kolom `kode` flagged `isDimension` → lahirkan `miop_daywork_kode_dim`. Kolom
`eqnum` juga bisa di-flag sama (jadi `miop_daywork_eqnum_dim`) bila diinginkan
reuse lintas dataset dalam dept yang sama.

> Nama tabel/kolom divalidasi regex `^[a-z][a-z0-9_]*$` sebelum DDL dijalankan.

## 4. Strategi Migrasi

- Bootstrap: `prisma migrate dev` normal.
- Dynamic: DDL dijalankan lewat `pg`/`prisma.$executeRawUnsafe` **hanya setelah**
  identifier divalidasi (lihat `architecture.md` §7).
- Reset & re-import aman: data reproducible dari Excel (`assets/`).
- Supabase project lama (`onmuqbdpjoklwrqzyrhm`) sudah tidak dipakai; migrasi
  `init` + `rename_miop_prefix` dari project lama dibuang saat bootstrap baru.

## 5. Naming & Integritas

- FK lintas dataset dynamic **tidak** dipaksa (v1); relasi kategori→dim dipakai
  cukup untuk grouping widget, bukan enforced FK.
- Normalisasi nilai berulang (alias `kode`) saat promote ke `_dim`.
- Jangan simpan teks bebas yang punya vocabulary terkontrol sebagai fact mentah.
  arahkan ke derived `_dim`.
