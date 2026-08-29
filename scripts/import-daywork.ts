/**
 * Import script: 2026_Summary_Daywork-Done.xlsx (sheet bulanan JAN..AUGUST)
 * -> daywork_staging (parse + validasi) -> daywork_records (promote baris valid)
 *
 * Sudah diuji langsung terhadap struktur file aslinya:
 * - Header ada di baris 2 (baris 1 cuma judul bulan), data mulai baris 3.
 * - Kolom A-I: EGI, EQNUM, AKTIVITAS, KODE, DEPT, TANGGAL, WH, WEEK, COST($)
 *   (kolom WEEK & COST($) berisi formula Excel — script ini otomatis
 *   ambil hasil hitungnya, bukan teks formulanya)
 * - Nama sheet Februari punya trailing space: "FEB " (bukan "FEB")
 *
 * Setup:
 *   npm install exceljs @prisma/client
 *   npm install -D tsx prisma typescript @types/node
 *   npx prisma generate
 *
 * Jalanin:
 *   npx tsx scripts/import-daywork.ts /path/ke/2026_Summary_Daywork-Done.xlsx
 *
 * Testing ulang dari awal (kosongin staging & records dulu):
 *   npx tsx scripts/import-daywork.ts /path/ke/file.xlsx --reset
 */

import ExcelJS from "exceljs";
import { PrismaClient, StagingStatus } from "@prisma/client";

const prisma = new PrismaClient();

// Nama sheet -> label bulan sumber, buat traceability
const MONTH_SHEETS: Record<string, string> = {
  JAN: "2026-01",
  "FEB ": "2026-02", // perhatikan trailing space, sesuai nama sheet asli
  MAR: "2026-03",
  APRIL: "2026-04",
  MAY: "2026-05",
  JUNE: "2026-06",
  JULY: "2026-07",
  AUGUST: "2026-08",
};

const DATA_START_ROW = 3; // baris 1 = judul bulan, baris 2 = header kolom

interface ParsedRow {
  sheet: string;
  row: number;
  egi: string | null;
  eqnum: string | null;
  aktivitas: string | null;
  kode: string | null;
  dept: string | null;
  tanggal: Date | null;
  wh: number | null;
  costUsd: number | null;
}

/** Formula cell di ExcelJS balik sebagai { formula, result } — ambil result-nya aja. */
function resolveCell(value: ExcelJS.CellValue): any {
  if (value && typeof value === "object" && "result" in (value as any)) {
    return (value as any).result;
  }
  return value;
}

function parseSheet(ws: ExcelJS.Worksheet, sheetName: string): ParsedRow[] {
  const rows: ParsedRow[] = [];

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < DATA_START_ROW) return;

    const egi = resolveCell(row.getCell(1).value);
    const eqnum = resolveCell(row.getCell(2).value);
    const aktivitas = resolveCell(row.getCell(3).value);
    const kode = resolveCell(row.getCell(4).value);
    const dept = resolveCell(row.getCell(5).value);
    const tanggal = resolveCell(row.getCell(6).value);
    const wh = resolveCell(row.getCell(7).value);
    const costUsd = resolveCell(row.getCell(9).value);

    // baris kosong total (bukan data) dilewati; kolom bantu/pivot di sebelah
    // kanan (K, L, M, dst di beberapa sheet) sengaja diabaikan
    if (!egi && !eqnum && !tanggal) return;

    rows.push({
      sheet: sheetName,
      row: rowNumber,
      egi: egi ?? null,
      eqnum: eqnum ?? null,
      aktivitas: aktivitas ?? null,
      kode: kode ?? null,
      dept: dept ?? null,
      tanggal: tanggal instanceof Date ? tanggal : null,
      wh: typeof wh === "number" ? wh : null,
      costUsd: typeof costUsd === "number" ? costUsd : null,
    });
  });

  return rows;
}

function validate(r: ParsedRow): string[] {
  const errors: string[] = [];
  if (!r.egi) errors.push("egi kosong");
  if (!r.eqnum) errors.push("eqnum kosong");
  if (!r.aktivitas) errors.push("aktivitas kosong");
  if (!r.kode) errors.push("kode kosong");
  if (!r.dept) errors.push("dept kosong");
  if (!r.tanggal) errors.push("tanggal tidak valid / tidak terbaca sebagai tanggal");
  if (r.wh === null || r.wh < 0) errors.push("wh kosong atau negatif");
  if (r.costUsd === null || r.costUsd < 0) errors.push("cost($) kosong atau negatif");
  return errors;
}

async function loadToStaging(filePath: string): Promise<number> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  let totalParsed = 0;

  for (const [sheetName, sourceMonth] of Object.entries(MONTH_SHEETS)) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) {
      console.warn(`⚠️  Sheet "${sheetName}" tidak ditemukan di file, dilewati.`);
      continue;
    }

    const parsedRows = parseSheet(ws, sheetName);
    totalParsed += parsedRows.length;

    const stagingData = parsedRows.map((r) => {
      const errors = validate(r);
      return {
        egi: r.egi,
        eqnum: r.eqnum,
        aktivitas: r.aktivitas,
        kode: r.kode,
        dept: r.dept,
        tanggal: r.tanggal,
        wh: r.wh,
        costUsd: r.costUsd,
        sourceFile: filePath,
        sourceSheet: r.sheet,
        sourceRow: r.row,
        sourceMonth,
        status: errors.length ? StagingStatus.ERROR : StagingStatus.VALID,
        errors,
      };
    });

    if (stagingData.length > 0) {
      await prisma.dayworkStaging.createMany({ data: stagingData });
    }
    console.log(`📥 ${sheetName.trim()}: ${parsedRows.length} baris masuk staging`);
  }

  return totalParsed;
}

async function promoteValidStaging(): Promise<number> {
  const validRows = await prisma.dayworkStaging.findMany({
    where: { status: StagingStatus.VALID },
  });

  if (validRows.length === 0) return 0;

  // Bulk insert semua baris valid sekaligus (1 query, bukan per-baris),
  // lalu bulk update status staging jadi PROMOTED (1 query).
  await prisma.dayworkRecord.createMany({
    data: validRows.map((r) => ({
      egi: r.egi!,
      eqnum: r.eqnum!,
      aktivitas: r.aktivitas!,
      kode: r.kode!,
      dept: r.dept!,
      tanggal: r.tanggal!,
      wh: r.wh!,
      costUsd: r.costUsd!,
      sourceMonth: r.sourceMonth,
    })),
  });

  await prisma.dayworkStaging.updateMany({
    where: { id: { in: validRows.map((r) => r.id) } },
    data: { status: StagingStatus.PROMOTED },
  });

  return validRows.length;
}

async function main() {
  const filePath = process.argv[2];
  const reset = process.argv.includes("--reset");

  if (!filePath) {
    console.error(
      "Usage: npx tsx scripts/import-daywork.ts <path-ke-2026_Summary_Daywork-Done.xlsx> [--reset]"
    );
    process.exit(1);
  }

  if (reset) {
    console.log("🗑️  --reset: mengosongkan daywork_staging & daywork_records dulu...\n");
    await prisma.dayworkStaging.deleteMany({});
    await prisma.dayworkRecord.deleteMany({});
  }

  console.log("=== STEP 1: Parse & load ke staging ===");
  const totalParsed = await loadToStaging(filePath);

  const errorCount = await prisma.dayworkStaging.count({ where: { status: StagingStatus.ERROR } });
  const validCount = await prisma.dayworkStaging.count({ where: { status: StagingStatus.VALID } });

  console.log(`\nTotal baris di-parse : ${totalParsed}`);
  console.log(`Valid                : ${validCount}`);
  console.log(`Error                : ${errorCount}`);

  if (errorCount > 0) {
    const samples = await prisma.dayworkStaging.findMany({
      where: { status: StagingStatus.ERROR },
      take: 5,
    });
    console.log("\nContoh baris error (cek & perbaiki manual dulu sebelum promote):");
    samples.forEach((s) =>
      console.log(`  [${s.sourceSheet} baris ${s.sourceRow}] ${s.errors.join(", ")}`)
    );
  }

  console.log("\n=== STEP 2: Promote baris valid ke daywork_records ===");
  const promoted = await promoteValidStaging();
  console.log(`✅ ${promoted} baris berhasil dipindah ke tabel utama.`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
