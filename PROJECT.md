# Starboard: Stargate Daywork Dashboard (Project Context)

Dokumen konteks bisnis & arsitektur desktop client.

## 1. Latar Belakang

Project magang di PT Stargate Pacific Resources (site pertambangan nikel). Proses
pelaporan aktivitas unit alat berat (daywork) dimodernisasi:

1. Kontraktor (PT Kalimantan Prima Persada / KPP) memberikan data mentah working hours
   per unit dalam bentuk Excel (`2026_Summary_Daywork-Done.xlsx`).
2. Data diimpor ke sistem Starboard (PostgreSQL / Supabase) via desktop app.
3. Menggantikan proses manual PowerBI/SharePoint menjadi dashboard native yang cepat,
   bisa kustomisasi layout, dan aman.

## 2. Arah Produk (Desktop-First, No-Code, Multi-Dept)

- **Frontend Desktop**: Tauri v2 + React 19 + Vite (Native Webview, tanpa runtime Node di bundle).
- **Backend Native**: Rust commands (`tokio-postgres`, `calamine` Excel parser) terintegrasi langsung di `.exe`.
- **Database**: PostgreSQL di Supabase (project `lejeqlnbdvtmkozjufig`).
- User tidak perlu menyentuh database / SQL secara manual.
- Sheet & kolom dipilih bebas oleh user saat import; tabel dibuat otomatis.

## 3. Tech Stack

| Bagian | Pilihan | Catatan |
|---|---|---|
| Desktop Framework | Tauri v2 | Native shell ringan (.exe kecil, WebView2 di Windows / WebKitGTK di Linux) |
| Frontend | React 19 + Vite + React Router | SPA murni, dev loop cepat di browser |
| Backend Core | Rust | High performance, memory-safe, no Node overhead |
| Excel Parser | `calamine` (Rust) | Parsing sheet & inferensi tipe di sisi native |
| Database Client | `tokio-postgres` (Rust) | Direct connection ke Supabase PostgreSQL |
| Layout / Viz | Recharts 3, react-grid-layout | Visualisasi data dan grid layout |
