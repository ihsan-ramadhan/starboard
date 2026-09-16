<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="src/assets/sigma-wordmark-dark.webp">
  <img src="src/assets/sigma-wordmark.webp" alt="SIGMA" width="260">
</picture>

**Stargate Integrated Dashboard & Management Analytics**

Turn Excel workbooks into dashboards your team arranges itself — import a file,
pick the columns, drag the charts where you want them. Nobody writes SQL.

</div>

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
  Columns worth indexing get an index after the bulk insert.
- **Stay in sync.** Point a dataset at a file on disk and SIGMA re-imports it
  whenever the file changes, checking every 20 seconds. An import that parses to
  zero rows is refused rather than replacing good data with nothing.
- **Dashboard.** Thirteen widget types: KPI card with a plan-versus-actual
  meter, gauge, vertical and horizontal bar, line, area, combo (bars and lines
  on one grid), pie, treemap, heatmap, scatter, paginated table, and date
  countdown. Drag and resize them on a grid; layout is saved per dataset.
- **Format the numbers.** Per field, choose whole, decimal, percent,
  scientific, or currency — and for currency, Rupiah or US dollar. Sort a chart
  by value or by category. Say which direction is good so a KPI knows whether
  being over target is a win.
- **Slice it.** Filter any widget by column, operator, and value. Date and
  numeric slicers offer both a range and a pick-from-values list. Values can
  carry custom display names — `1` shows as `Januari` without touching the
  database or the workbook.
- **Make it yours.** Give each sidebar menu its own image, cropped to taste, or
  leave it on the initials it derives from the name.
- **Light and dark.** Follows the system theme by default; Settings has an
  explicit override, plus language (Indonesian or English) and two widget
  preferences — always-on data labels, and hiding the shared-axis scale warning.
- **Departments.** Your login decides what you see. Each department's datasets
  and dashboards stay separate. Sessions last seven days and renew themselves
  while you keep using the app.
- **Desktop.** The whole thing packages as a Windows `.exe`.

## Deploying the backend

```bash
./deploy.sh
```

Cross-compiles for Windows, stops the backend service over SSH, copies the
binary, starts it again. Host, path, and service name are hardcoded in the
script.

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
