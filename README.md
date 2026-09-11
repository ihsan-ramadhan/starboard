# Starboard

Desktop dashboard for operational reporting at PT Stargate Pacific Resources, a
nickel mining site. Each department keeps its figures in master Excel workbooks;
Starboard turns those into dashboards the team arranges themselves. Import a
workbook, pick the sheets and columns you want, drag the charts where you want
them. Nobody writes SQL.

Nothing in the app is tied to one department. Departments are rows in a
`departments` table, and every dataset, dashboard, and login is scoped by
department code. MIOP, HSE, and MPMA use it today; adding another is a row, not
a code change.

## Quick start

You need Node, a Rust toolchain, and a reachable Postgres database.

```bash
cargo run --manifest-path crates/server/Cargo.toml
npm install
npm run dev
```

Both halves read their configuration from `.env`. Ask the team for the values;
they are not published here.

For a native window instead of a browser tab:

```bash
npm run tauri dev
npm run tauri build
```

## What it does

- **Import.** Bring in an `.xlsx`. The server finds the header row, infers a
  type for every column, and creates one Postgres table per sheet you selected.
- **Stay in sync.** Point a dataset at a file on disk and Starboard re-imports
  it whenever the file changes, checking every 20 seconds. An import that parses
  to zero rows is refused rather than replacing good data with nothing.
- **Dashboard.** Build bar, line, area, combo, and pie charts, KPI cards with a
  plan-versus-actual meter, date countdown cards, and paginated tables — then
  drag and resize them on a grid. Layout is saved per dataset.
- **Slice it.** Filter any widget by column, operator, and value. Group by one
  column and split into series by another.
- **Departments.** Your login decides what you see. Each department's datasets
  and dashboards stay separate.
- **Desktop.** The whole thing packages as a Windows `.exe`.

## Deploying the backend

```bash
./deploy.sh
```

Cross-compiles for Windows, stops the `StarboardBackend` service over SSH,
copies the binary, starts it again. Host, path, and service name are hardcoded
in the script.

The server re-reads watched workbooks itself every 20 seconds, so a laptop no
longer has to be running for a dataset to stay current. Two optional settings
control it:

- `SERVER_SYNC=0` turns that loop off without a rebuild.
- `SYNC_ROOT` limits which folders it will read, semicolon-separated. Anything
  outside is refused with a message on the dataset. Unset means no limit.

```
SYNC_ROOT=\\fileserver\share\folder
```

The desktop app has no auto-updater — a new build has to be installed on each
machine.

## Docs

[DESIGN.md](DESIGN.md) covers the visual direction. The architecture notes,
database schema, and roadmap are kept internally and are not part of this
repository.
