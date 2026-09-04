# Starboard

Desktop dashboard for daywork reporting at PT Stargate Pacific Resources, a
nickel mining site. Contractors hand over working hours as Excel workbooks;
Starboard turns them into dashboards the operations team arranges themselves.
Upload a spreadsheet, pick the sheets and columns you want, drag the charts
where you want them. Nobody writes SQL.

## Quick start

You need Node, a Rust toolchain, and a reachable Postgres database.

```bash
cargo run --manifest-path crates/server/Cargo
npm install
npm run dev
```

Both halves read their configuration from `.env`. Ask the team for the values;
they are not published here.

For a native window instead of a browser tab:

```bash
npm run tauri dev                          # 
npm run tauri build -- --target x86_64-pc-windows-msvc
```

## What it does

- **Import.** Upload an `.xlsx`. The server finds the header row, infers a type
  for every column, and creates one Postgres table per sheet you selected.
- **Dashboard.** Build KPI cards and bar, line, or donut charts from those
  columns, then drag and resize them on a grid. Layout is saved per dataset.
- **Departments.** Your login decides what you see. MIOP, HSE, and MPMA each
  keep their own datasets.
- **Desktop.** The whole thing packages as a Windows `.exe`.

## Deploying the backend

```bash
./deploy.sh
```

Cross-compiles for Windows, stops the `StarboardBackend` service over SSH,
copies the binary, starts it again. Host, path, and service name are hardcoded
in the script.

## Docs

[DESIGN.md](DESIGN.md) covers the visual direction. The architecture notes,
database schema, and roadmap are kept internally and are not part of this
repository.
