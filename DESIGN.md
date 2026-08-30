# Starboard: Design Direction

Internal operational dashboard untuk PT Stargate Pacific Resources. Multi-departemen
(MIOP, HSE, MPMA). Data-dense, digunakan staf harian.

## Identity & Personality
- Professional, tenang, dan berfungsi. Bukan "tech demo" dan bukan AI-slop.
- Karakter: operational tool yang bisa dipercaya, fokus ke angka dan tindakan.
- Tidak ada dekorasi tanpa tujuan, tidak ada buzzword.

## Mode & Theme
- **Light mode adalah default.** Background utama **putih** (`#ffffff`), bukan abu-abu gelap.
- Aksen utama: **biru** (`#2563eb` / blue-600). Dipakai hemat: primary button, link aktif,
  focus ring, indikator aktif. Bukan glow/neon.
- Department badge punya warna sendiri (MIOP=biru, HSE=merah, MPMA=hijau) sebagai
  pengenal cepat, bukan elemen dekoratif.

## Palette (core)
- Background: `#ffffff` (page), `#f8fafc` (surface/elevated tipis).
- Text: `#0f172a` (primary), `#475569` (secondary/dim).
- Border: `#e2e8f0`.
- Accent: `#2563eb` (blue-600).
- Semantic: success `#16a34a`, danger `#dc2626`, warning `#d97706`.
- Maksimal 2-3 core + 1 accent. Abu-abu/putih bukan bagian dari hitungan core.

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
