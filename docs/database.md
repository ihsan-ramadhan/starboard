# Database — Skema Multi-Department

Acuan skema untuk AI agent. Semua tabel berada di schema `public` Postgres
(Supabase). Prisma pin **v6** (v8 RC tidak kompatibel dengan workflow
`generate`/`migrate` klasik — lihat `PROJECT.md`).

## 1. Prinsip

- **Dimensi bersama** (`departments`, `equipment`, `users`) dipakai lintas dept.
- **Fact/lookup per module** di-prefix `<dept>_` (`miop_`, `hse_`, `mpma_`).
- Tabel runtime/platform (`data_sources`, `dashboard_definitions`,
  `dashboard_widgets`) netral terhadap dept, di-key oleh `dept_code`.
- Migration via `prisma migrate dev`; data selalu reproducible dari file Excel
  (import script), jadi reset + re-import aman saat mengubah skema early-dev.

## 2. Shared Dimensions

```prisma
model Department {
  code            String          @id
  name            String?
  color           String?         // untuk UI switcher
  icon            String?
  dayworkRecords  MiopDayworkRecord[]   // contoh relasi ke module MIOP
  // relasi ke module lain ditambah seiring module dibuat
}

model Equipment {
  eqnum           String          @id   // "EX221"
  egi             String                // "PC200"
  // fact records tiap module mereferensikan eqnum bila relevan
}

model User {
  id              String          @id @default(cuid())
  email           String          @unique
  name            String?
  role            String?               // fase RBAC
  userDepartments UserDepartment[]
  widgetOverrides DashboardWidget[]
}

// Akses per-dept (fase RBAC). user_id null = shared/default.
model UserDepartment {
  userId          String
  deptCode         String
  @@id([userId, deptCode])
}
```

> `Department.code` memakai nilai `MIOP` / `HSE` / `MPMA` — konsisten dengan data
> daywork yg sudah ada.

## 3. Module MIOP (fokus saat ini)

```prisma
model MiopDayworkRecord {
  id          String   @id @default(cuid())
  eqnum       String                 // FK -> Equipment.eqnum
  aktivitas   String                 // teks bebas
  kode        String                 // FK -> MiopActivityCode.code
  dept        String                 // FK -> Department.code (MIOP/MPMA/HSE/CDR)
  tanggal     DateTime @db.Date
  wh          Decimal  @db.Decimal(10,2)
  costUsd     Decimal  @db.Decimal(14,2)
  sourceMonth String
  createdAt   DateTime @default(now())

  equipment   Equipment     @relation(fields:[eqnum], references:[eqnum])
  activity    MiopActivityCode @relation(fields:[kode], references:[code])
  department  Department    @relation(fields:[dept], references:[code])

  @@index([tanggal]) @@index([dept]) @@index([kode]) @@index([eqnum])
  @@map("miop_daywork_records")
}

model MiopActivityCode {
  code        String @id
  description String?
  records     MiopDayworkRecord[]
  @@map("miop_activity_codes")
}
```

> Catatan migrasi: saat ini tabel bernama `daywork_records` /
> `activity_codes` (belum di-prefix). Sebelum membangun di atas nama tersebut,
> lakukan rename ke `miop_daywork_records` / `miop_activity_codes` (lihat
> `roadmap.md` Phase 1).

## 4. Module HSE (contoh dept berikutnya)

```prisma
model HseIncident {
  id            String   @id @default(cuid())
  incidentType  String                 // FK -> HseIncidentType.code
  severity      String?                // "LOW" | "MEDIUM" | "HIGH"
  location      String?
  tanggal       DateTime @db.Date
  dept          String                 // FK -> Department.code
  keterangan    String?
  @@map("hse_incidents")
}
model HseIncidentType {
  code String @id
  description String?
  @@map("hse_incident_types")
}
```

## 5. Module MPMA (contoh, belum dibuat)

Tabel diawali `mpma_`, mis. `mpma_production`, `mpma_stockpile`. Bentuk mengikuti
pola module di atas.

## 6. Runtime / Platform Tables

```prisma
// Deklarasi query yg bisa dipakai widget (aman, dikompilasi runtime).
model DataSource {
  id          String @id @default(cuid())
  deptCode    String
  key         String                 // unik per dept, mis "miop.wh_trend"
  spec        Json                   // QuerySpec (lihat api.md)
  @@unique([deptCode, key])
  @@map("data_sources")
}

// Susunan widget per departemen (template dashboard).
model DashboardDefinition {
  id           String @id @default(cuid())
  deptCode      String
  widgetKey     String
  widgetType    String               // "kpi" | "timeseries" | "breakdown" | "table"
  title         String
  dataSourceKey String?              // ref DataSource.key
  chartType     String?              // "line" | "bar" | "pie"
  layout        Json                 // {x,y,w,h}
  filters       Json?
  @@unique([deptCode, widgetKey])
  @@map("dashboard_definitions")
}

// Override layout per user (drag/resize hasil). userId null = default/shared.
model DashboardWidget {
  id         String @id @default(cuid())
  userId     String?                // FK -> User.id (null = shared)
  deptCode   String
  widgetKey  String
  chartType  String?
  positionX  Int
  positionY  Int
  width      Int
  height     Int
  filterConfig Json?
  @@unique([userId, deptCode, widgetKey])
  @@map("dashboard_widgets")
}
```

## 7. Diagram Relasi (konseptual)

```
departments ──< MiopDayworkRecord >── Equipment
     │               │
     │               └──> MiopActivityCode
     │
     ├──< HseIncident >── HseIncidentType
     │
users ──< UserDepartment >── departments
users ──< DashboardWidget (per dept+user)
Data/DashboardDefinition ── keyed by deptCode
```

## 8. Strategi Migrasi & Menambah Module

1. Edit `prisma/schema.prisma`: tambah model module di section `// ===== MODULE <DEPT> =====`.
2. `npm run db:migrate` (buat migration baru, jangan `--reset` kecuali data bisa di-reimport).
3. Tulis `modules/<dept>/dataSources.ts` + `dashboard.ts`.
4. Daftarkan dept di Department Registry (kode) + seed `data_sources` /
   `dashboard_definitions` (bisa lewat seed script atau admin nanti).
5. Bila ada import file mentah, tulis `modules/<dept>/import.ts`.

**Reset & re-import** aman selama data reproducible dari Excel (jalankan
`npm run import` setelah `--reset`). Lakukan reset hanya di environment dev.

## 9. Naming & Integritas

- FK selalu ke dimensi bersama untuk `dept`, `eqnum` (bila relevan), dan lookup
  module (`kode` aktivitas, tipe insiden, dst).
- Normalisasi nilai berulang (mis. ejaan `kode` beda) dilakukan saat import, bukan
  di query (lihat `scripts/import-daywork.ts` + `canonicalCode`).
- Jangan simpan teks bebas yg sebenarnya punya vocabulary terkontrol — buat
  lookup table.
