# Starboard Architecture: Tauri v2 + React SPA + Rust Backend

Dokumen arsitektur desktop client no-code multi-departemen.

## 1. Desain Arsitektur (No-Node Desktop)

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (React 19 + Vite + React Router)                  │
│   - SPA dimuat di native WebView (WebView2 / WebKitGTK)     │
│   - State & UI: Navbar, ImportWizard, Dashboard Views       │
│   - Interaksi via Tauri IPC: invoke('command_name', args)   │
└─────────────────────────────────────────────────────────────┘
                             │ IPC (Tauri Bridge)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND (Tauri v2 Rust Core)                               │
│   - Auth: verifikasi bcrypt password terhadap table users   │
│   - Excel Engine: calamine parser + dynamic type inference  │
│   - DDL & Data Ingest: tokio-postgres direct connection     │
└─────────────────────────────────────────────────────────────┘
                             │ TLS Direct Connection
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  DATABASE (PostgreSQL / Supabase)                           │
│   - Bootstrap: departments, users, sessions, registry       │
│   - Dynamic: <dept>_<slug>_records                          │
└─────────────────────────────────────────────────────────────┘
```

## 2. Fitur Utama

1. **Auth & Dept Scoping**: User login (e.g. `MIOP` / `HSE`) dicek langsung ke database via Rust command `login`.
2. **Sheet & Column Picker**: User upload `.xlsx`, `calamine` membaca semua sheet, user bebas memilih sheet mana dan kolom mana saja yang ingin diimpor.
3. **Dynamic DDL**: Rust membuat tabel fisik `<dept>_<slug>_records` secara dinamis dan batch-insert data.
4. **Desktop Native**: Tanpa perlu hosting server backend terpisah, tanpa bundling Node runtime.

## 3. Development Workflow

- **Development di Browser (Linux / CachyOS)**:
  ```bash
  npm run dev
  ```
- **Development Desktop Native**:
  ```bash
  cargo tauri dev
  ```
- **Build Windows `.exe`**:
  ```bash
  cargo tauri build --target x86_64-pc-windows-msvc
  ```
