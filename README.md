# Starboard

Desktop dashboard for daywork reporting at PT Stargate Pacific Resources, a nickel mining site.

Heavy equipment contractors hand over working hours as Excel workbooks. Starboard imports those workbooks into Postgres and turns them into dashboards the operations team arranges themselves. It replaces a manual PowerBI and SharePoint workflow. Staff log in, upload a spreadsheet, pick which sheets and columns they want, and build widgets on a drag-and-drop grid. Nobody writes SQL.

Departments are separate tenants. A user's login decides which datasets they see: MIOP, HSE, or MPMA.

## How the pieces fit

```
src/            React 19 SPA, runs in the browser or in a native webview
   |
   |  HTTP, Authorization: Bearer <token>
   v
crates/server/  Axum server: auth, Excel parsing, dynamic DDL, widget queries
   |
   |  tokio-postgres
   v
PostgreSQL      Self-hosted on the office Windows Server (LAN)
```

`src-tauri/` is the desktop shell. It wraps the built SPA in a native window, WebView2 on Windows and WebKitGTK on Linux, and does nothing else at runtime.

The SPA reaches the backend with `fetch` against `VITE_API_BASE`. It does not use Tauri IPC. `src-tauri/src/commands.rs` still contains an older set of `#[tauri::command]` handlers that nothing calls, and `docs/architecture.md` describes that older IPC design, so both are out of date against the code.

### Data model

Bootstrap tables come with the schema and are never touched by an import: `departments`, `users`, `sessions`, `dataset_registry`, `dataset_columns`, `dashboard_widgets`.

Dynamic tables are created during import, one per selected sheet, named `<dept>_<dataset_key>_<sheet>_records`. Importing the 2026 daywork workbook under MIOP produces `miop_2026_summary_daywork_done_summary_daywork_records`. Column types are inferred by `calamine` at parse time and recorded in `dataset_columns`, which is what the widget builder reads when it offers you a metric or a group-by field.

## Running it

You need Node with npm, a Rust toolchain, and a reachable Postgres database.

### Backend

```bash
cargo run --manifest-path crates/server/Cargo.toml
```

Listens on `0.0.0.0:8080`. It reads `DATABASE_URL` from the environment or from a `.env` file, checking the working directory and its parent. Without `DATABASE_URL` it prints an error and exits.

### Frontend in the browser

```bash
npm install
npm run dev
```

Vite serves on `http://127.0.0.1:1420` with `strictPort` set, so it fails rather than picking another port if 1420 is taken. Point `VITE_API_BASE` at the running backend first.

This is the fast loop. Everything except the native window behaves the same here as it does in the packaged app.

### Desktop window

```bash
npm run tauri dev
```

Tauri starts the same Vite server and loads it in a native webview.

### Windows build

```bash
npm run tauri build -- --target x86_64-pc-windows-msvc
```

The window opens at 1280x800 and refuses to go below 800x600.

## Environment variables

| Variable | Read by | Notes |
| --- | --- | --- |
| `VITE_API_BASE` | frontend | Backend base URL, for example `http://BACKEND_HOST:8080`. Vite inlines it at build time, so a packaged binary points at whichever backend was configured when it was built. |
| `DATABASE_URL` | server | Postgres connection string. Required. |
| `PORT` | server | Listen port. Defaults to `8080`. |

## API

Everything except `/health` and login sits behind the bearer-token middleware.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness check |
| POST | `/api/auth/login` | Exchange credentials for a session token |
| POST | `/api/auth/logout` | Invalidate the current session |
| GET | `/api/datasets` | List datasets for the caller's department |
| GET | `/api/datasets/{key}` | Schema, row count, and a sample of rows |
| DELETE | `/api/datasets/{key}` | Drop the dataset and its physical table |
| GET | `/api/datasets/{key}/widgets` | Read the saved dashboard |
| PUT | `/api/datasets/{key}/widgets` | Replace the saved dashboard |
| POST | `/api/excel/analyze` | Parse an upload and return detected sheets and columns |
| POST | `/api/excel/import` | Create tables and insert the selected sheets |
| POST | `/api/analytics/query` | Run one widget's aggregation |

Uploads are capped at 50 MB.

### Auth

Login accepts a username or an email, verifies the password against `users.passwordHash` with bcrypt, and inserts a row into `sessions` that expires after seven days. The client keeps the token in `localStorage` under `starboard_token`.

This is demo-first auth and it shows. Tokens are opaque rows with no refresh path, and CORS is open to any origin. That is workable on the office LAN it runs on, and not safe to expose to the internet.

## Deploying the backend

```bash
./deploy.sh
```

Cross-compiles for `x86_64-pc-windows-gnu`, stops the `StarboardBackend` Windows service over SSH, copies the binary to `D:/Starboard/Backend`, and starts the service again. The service runs under NSSM. The host, path, and service name are hardcoded in the script.

## Repository layout

```
src/
  components/       Sidebar, modals, import wizard, widget components
  pages/            Login, Home, Import, Dataset
  assets/icons/     SVG files, imported with ?react via vite-plugin-svgr
  lib/api.ts        the only module that talks to the backend
  globals.css       all styling, no CSS framework
crates/server/      Axum backend
src-tauri/          Tauri desktop shell
docs/               architecture, database, roadmap (written in Indonesian)
DESIGN.md           visual direction and design tokens
deploy.sh           backend deploy to the office Windows machine
```

Styling is one hand-written stylesheet. Buttons share a single 34px height, three border radii cover controls, control groups, and cards, and the palette is defined as custom properties at the top of `globals.css`. `DESIGN.md` explains the reasoning.

## Known rough edges

- `docs/architecture.md` documents the Tauri IPC design the code has since moved away from.
- `src-tauri/src/commands.rs` duplicates backend logic that the frontend no longer calls.
- `lucide-react` is listed in `package.json` and nothing imports it. Icons are local SVG files.
- Widget layout is stored as four fixed columns on `dashboard_widgets` (`positionX`, `positionY`, `width`, `height`), so each widget has exactly one layout. The grid scales with the window but the arrangement never changes between a laptop screen and a large monitor.
