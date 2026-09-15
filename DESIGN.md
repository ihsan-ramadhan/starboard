# SIGMA: Design Direction

Internal operational dashboard untuk PT Stargate Pacific Resources. Multi-departemen
(MIOP, HSE, MPMA). Data-dense, digunakan staf harian.

## Identity & Personality
- Professional, tenang, dan berfungsi. Bukan "tech demo" dan bukan AI-slop.
- Karakter: operational tool yang bisa dipercaya, fokus ke angka dan tindakan.
- Tidak ada dekorasi tanpa tujuan, tidak ada buzzword.

## Mode & Theme
Tema mengikuti sistem secara default; Pengaturan punya override eksplisit
(`system` / `light` / `dark`). Token warna didefinisikan dua kali untuk mode gelap —
di `:root[data-theme="dark"]` dan di blok `prefers-color-scheme` — dan **keduanya
harus selalu identik**.

### Light
- Background utama **putih** (`#ffffff`), bukan abu-abu gelap.
- Aksen utama: **biru** (`#2563eb` / blue-600). Dipakai hemat: primary button, link aktif,
  focus ring, indikator aktif. Bukan glow/neon.

### Dark
- Bukan navy. Dasarnya coklat-hangat gelap (`#17140f` page, `#201c16` surface),
  senada dengan warna tanah tambang, bukan biru abu generik.
- Aksen: **emas** (`#d9a441`), hover `#e8bd63`. Teks di atas aksen memakai
  `--on-accent` (`#17140f`) — putih di atas emas hanya 2,5:1 dan tidak boleh dipakai.
- Chart chrome dan heat ramp punya set sendiri per tema di `src/lib/theme.ts`.
  Chart satu seri mengikuti warna aksen tema; chart banyak seri memakai palet
  kategorikal yang tidak berubah supaya seri tetap bisa dibedakan.

Department badge punya warna sendiri (MIOP=biru, HSE=merah, MPMA=hijau) sebagai
pengenal cepat, bukan elemen dekoratif.

## Palette (core)
Light:
- Background: `#ffffff` (page), `#f8fafc` (surface/elevated tipis).
- Text: `#0f172a` (primary), `#475569` (secondary/dim).
- Border: `#e2e8f0`. Accent: `#2563eb` (blue-600).
- Semantic: success `#16a34a`, danger `#dc2626`, warning `#d97706`.

Dark:
- Background: `#17140f` (page), `#201c16` (surface).
- Text: `#f5f1ea` (primary), `#b8ae9f` (secondary/dim).
- Border: `#332c22`. Accent: `#d9a441`.
- Semantic: success `#4ade80`, danger `#f87171`, warning `#fbbf24`.

Maksimal 2-3 core + 1 accent per tema. Abu-abu/putih bukan bagian dari hitungan core.

## Typography
- Sans-serif modern untuk UI (system-ui / Inter-like). Netral, mudah dibaca.
- Angka/metrik boleh tabular-nums untuk alignment kolom.
- Tidak ada monospace besar sebagai gimmick, tidak ada uppercase tracking lebar.

## Dials
- **ENERGY 2**: balanced, ada hierarki jelas tanpa berteriak.
- **RHYTHM 2**: konsisten dengan beberapa break (empty state, card grid).
- **MOTION 1**: hover/transition halus saja, tidak ada scroll-reveal/parallax.

## Layout Principles
- Content-driven: section ada karena data butuh, bukan template.
- Density tinggi tapi bernapas: whitespace sebagai pemisah, bukan sisa.
- Setiap layar punya satu focal point (aksi utama / metrik utama).
- Semua interaktif harus berfungsi (R-26); ada empty/loading/error state (R-27).

## Accessibility
- Kontras WCAG AA (4.5:1 teks normal). Fokus terlihat jelas. Keyboard-navigable.
- Tap target minimal 44px di mobile.
- Setiap keputusan warna diukur, bukan dikira. Label di atas latar yang berubah-ubah
  (heatmap, bar bertumpuk) memilih warna teks mengikuti kegelapan latarnya dan
  memakai halo berlawanan di pita ambang, karena pilihan warna saja tidak cukup.

## Code
- **Tidak ada komentar di kode** — TS/TSX, CSS, maupun Rust. Alasan ditaruh di
  commit message atau di vault. Perkecualian satu-satunya: direktif compiler
  seperti `/// <reference types="vite/client" />` di `src/vite-env.d.ts`.
