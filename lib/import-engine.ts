import ExcelJS from "exceljs";
import { prisma } from "./prisma";

export type InferredType = "numeric" | "date" | "category";

export type ColumnSchema = {
  colIndex: number;
  rawName: string;
  slug: string;
  type: InferredType;
  sample: any;
};

export type SheetAnalysis = {
  sheetName: string;
  headerRowIndex: number;
  dataStartRowIndex: number;
  columns: ColumnSchema[];
  rowCount: number;
};

export type FileAnalysis = {
  sheets: SheetAnalysis[];
  isMonthlyPack: boolean;
  unifiedColumns: ColumnSchema[];
  totalRows: number;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

function resolveCellValue(val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val === "object") {
    if (val instanceof Date) return val;
    if ("result" in val) return val.result;
    if ("text" in val) return val.text;
  }
  return val;
}

function inferType(values: any[]): InferredType {
  const nonNull = values
    .map(resolveCellValue)
    .filter((v) => v !== null && v !== undefined && v !== "");

  if (nonNull.length === 0) return "category";

  let dateCount = 0;
  let numCount = 0;

  for (const v of nonNull) {
    if (v instanceof Date) {
      dateCount++;
    } else if (typeof v === "number" && !isNaN(v)) {
      numCount++;
    } else if (typeof v === "string") {
      const trimmed = v.trim();
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        numCount++;
      } else {
        const parsed = Date.parse(trimmed);
        if (!isNaN(parsed) && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(trimmed)) {
          dateCount++;
        }
      }
    }
  }

  const threshold = nonNull.length * 0.7;
  if (dateCount >= threshold) return "date";
  if (numCount >= threshold) return "numeric";
  return "category";
}

function findHeaderRow(ws: ExcelJS.Worksheet): {
  headerRowIndex: number;
  columns: { colIndex: number; rawName: string }[];
} | null {
  for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
    const row = ws.getRow(r);
    const textCols: { colIndex: number; rawName: string }[] = [];

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const val = resolveCellValue(cell.value);
      if (typeof val === "string" && val.trim().length > 0) {
        textCols.push({ colIndex: colNumber, rawName: val.trim() });
      }
    });

    if (textCols.length >= 3) {
      return { headerRowIndex: r, columns: textCols };
    }
  }
  return null;
}

const MONTH_SHEET_NAMES = new Set([
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "APRIL",
  "MAY",
  "JUN",
  "JUNE",
  "JUL",
  "JULY",
  "AUG",
  "AUGUST",
  "SEP",
  "SEPT",
  "SEPTEMBER",
  "OCT",
  "OKT",
  "OCTOBER",
  "NOV",
  "NOVEMBER",
  "DEC",
  "DES",
  "DECEMBER",
]);

const ACTIVITY_ALIASES: Record<string, string> = {
  "POST MINING": "POST-MINING",
  "POST-MINING": "POST-MINING",
  "PRE MINING": "PRE-MINING",
  "PRE-MINING": "PRE-MINING",
};

function canonicalCode(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.trim().toUpperCase();
  return ACTIVITY_ALIASES[key] ?? key;
}

export async function analyzeExcelBuffer(buffer: Buffer): Promise<FileAnalysis> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  const sheets: SheetAnalysis[] = [];
  let monthMatchingSheets = 0;

  for (const ws of wb.worksheets) {
    const cleanName = ws.name.trim().toUpperCase();
    if (MONTH_SHEET_NAMES.has(cleanName)) {
      monthMatchingSheets++;
    }

    const header = findHeaderRow(ws);
    if (!header || header.columns.length === 0) continue;

    const dataStartRowIndex = header.headerRowIndex + 1;
    const sampleRows: any[][] = [];

    for (
      let r = dataStartRowIndex;
      r <= Math.min(ws.rowCount, dataStartRowIndex + 40);
      r++
    ) {
      const row = ws.getRow(r);
      const rowValues = header.columns.map((c) =>
        resolveCellValue(row.getCell(c.colIndex).value)
      );
      if (rowValues.some((v) => v !== null && v !== undefined && v !== "")) {
        sampleRows.push(rowValues);
      }
    }

    const columns: ColumnSchema[] = header.columns.map((c, idx) => {
      const colSamples = sampleRows.map((r) => r[idx]);
      const type = inferType(colSamples);
      const firstValid = colSamples.find(
        (v) => v !== null && v !== undefined && v !== ""
      );
      return {
        colIndex: c.colIndex,
        rawName: c.rawName,
        slug: slugify(c.rawName) || `col_${idx + 1}`,
        type,
        sample: firstValid !== undefined ? String(firstValid) : null,
      };
    });

    sheets.push({
      sheetName: ws.name,
      headerRowIndex: header.headerRowIndex,
      dataStartRowIndex,
      columns,
      rowCount: Math.max(0, ws.rowCount - header.headerRowIndex),
    });
  }

  const isMonthlyPack = monthMatchingSheets >= 2;
  const targetSheets = isMonthlyPack
    ? sheets.filter((s) =>
        MONTH_SHEET_NAMES.has(s.sheetName.trim().toUpperCase())
      )
    : sheets.slice(0, 1);

  const unifiedColumns = targetSheets[0]?.columns ?? [];
  const totalRows = targetSheets.reduce((sum, s) => sum + s.rowCount, 0);

  return {
    sheets,
    isMonthlyPack,
    unifiedColumns,
    totalRows,
  };
}

export async function executeImport(params: {
  buffer: Buffer;
  dept: string;
  datasetKey: string;
  displayName: string;
  userId: string;
}): Promise<{
  tableName: string;
  totalImported: number;
  dimensionsCreated: string[];
  columns: { name: string; type: string }[];
}> {
  const { buffer, dept, datasetKey, displayName, userId } = params;
  const analysis = await analyzeExcelBuffer(buffer);

  if (analysis.unifiedColumns.length === 0) {
    throw new Error("Tidak ada kolom yang valid terdeteksi di file Excel.");
  }

  const deptLower = dept.toLowerCase().replace(/[^a-z0-9]/g, "");
  const keySlug = slugify(datasetKey);
  const tableName = `${deptLower}_${keySlug}_records`;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  const targetSheets = analysis.isMonthlyPack
    ? wb.worksheets.filter((ws) =>
        MONTH_SHEET_NAMES.has(ws.name.trim().toUpperCase())
      )
    : [wb.worksheets[0]];

  const colDefinitions = analysis.unifiedColumns.map((col) => {
    let pgType = "text";
    if (col.type === "numeric") pgType = "numeric";
    if (col.type === "date") pgType = "date";
    return `"${col.slug}" ${pgType}`;
  });

  const createTableSql = `
    CREATE TABLE IF NOT EXISTS "${tableName}" (
      "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
      ${colDefinitions.join(",\n      ")},
      "source_month" text,
      "created_at" timestamptz DEFAULT now()
    );
  `;

  await prisma.$executeRawUnsafe(createTableSql);

  const dataset = await prisma.datasetRegistry.upsert({
    where: { dept_key: { dept, key: keySlug } },
    update: {
      displayName,
      tableName,
      createdBy: userId,
    },
    create: {
      dept,
      key: keySlug,
      tableName,
      displayName,
      createdBy: userId,
    },
  });

  await prisma.datasetColumn.deleteMany({ where: { datasetId: dataset.id } });
  await prisma.datasetColumn.createMany({
    data: analysis.unifiedColumns.map((c) => ({
      datasetId: dataset.id,
      name: c.slug,
      label: c.rawName,
      type: c.type,
      isDimension: c.type === "category",
    })),
  });

  let totalImported = 0;
  const allRowsToInsert: any[] = [];
  const equipmentMap = new Map<string, string>();

  for (const ws of targetSheets) {
    const cleanSheetName = ws.name.trim();
    const sheetMeta = analysis.sheets.find((s) => s.sheetName === ws.name);
    if (!sheetMeta) continue;

    for (let r = sheetMeta.dataStartRowIndex; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const rowData: Record<string, any> = {};

      const c1 = resolveCellValue(row.getCell(1).value);
      const c2 = resolveCellValue(row.getCell(2).value);
      const c6 = resolveCellValue(row.getCell(6).value);
      const c7 = resolveCellValue(row.getCell(7).value);

      if (!c1 && !c2 && !c6 && !c7) {
        continue;
      }

      analysis.unifiedColumns.forEach((col) => {
        const raw = resolveCellValue(row.getCell(col.colIndex).value);
        if (raw !== null && raw !== undefined && raw !== "") {
          if (col.type === "date") {
            if (raw instanceof Date) {
              rowData[col.slug] = raw.toISOString().split("T")[0];
            } else {
              const d = new Date(raw);
              rowData[col.slug] = !isNaN(d.getTime())
                ? d.toISOString().split("T")[0]
                : null;
            }
          } else if (col.type === "numeric") {
            const n = Number(raw);
            rowData[col.slug] = !isNaN(n) ? n : null;
          } else {
            let str = String(raw).trim();
            if (col.slug === "kode" || col.slug === "activity_code") {
              str = canonicalCode(str) || str;
            }
            rowData[col.slug] = str;
          }
        } else {
          rowData[col.slug] = null;
        }
      });

      const eqnumVal = rowData["eqnum"] || rowData["unit"];
      const egiVal = rowData["egi"];
      if (eqnumVal && egiVal) {
        equipmentMap.set(String(eqnumVal), String(egiVal));
      }

      rowData["source_month"] = cleanSheetName;
      allRowsToInsert.push(rowData);
    }
  }

  const CHUNK_SIZE = 100;
  for (let i = 0; i < allRowsToInsert.length; i += CHUNK_SIZE) {
    const chunk = allRowsToInsert.slice(i, i + CHUNK_SIZE);
    if (chunk.length === 0) continue;

    const cols = [
      ...analysis.unifiedColumns.map((c) => ({
        slug: c.slug,
        type: c.type,
      })),
      { slug: "source_month", type: "category" as InferredType },
    ];
    const colListStr = cols.map((c) => `"${c.slug}"`).join(", ");

    const valueRows: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    for (const row of chunk) {
      const valueHolders: string[] = [];
      for (const col of cols) {
        const cast =
          col.type === "date"
            ? "::date"
            : col.type === "numeric"
            ? "::numeric"
            : "";
        valueHolders.push(`$${paramIdx}${cast}`);
        params.push(row[col.slug]);
        paramIdx++;
      }
      valueRows.push(`(${valueHolders.join(", ")})`);
    }

    const insertSql = `
      INSERT INTO "${tableName}" (${colListStr})
      VALUES ${valueRows.join(",\n")}
    `;

    await prisma.$executeRawUnsafe(insertSql, ...params);
    totalImported += chunk.length;
  }

  const dimensionsCreated: string[] = [];

  if (equipmentMap.size > 0) {
    const eqTable = `${deptLower}_equipment_dim`;
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${eqTable}" (
        "eqnum" text PRIMARY KEY,
        "egi" text NOT NULL,
        "updated_at" timestamptz DEFAULT now()
      );
    `);

    for (const [eqnum, egi] of equipmentMap.entries()) {
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO "${eqTable}" ("eqnum", "egi")
        VALUES ($1, $2)
        ON CONFLICT ("eqnum") DO UPDATE SET "egi" = EXCLUDED."egi", "updated_at" = now();
      `,
        eqnum,
        egi
      );
    }
    dimensionsCreated.push(`${eqTable} (${equipmentMap.size} unit)`);
  }

  return {
    tableName,
    totalImported,
    dimensionsCreated,
    columns: analysis.unifiedColumns.map((c) => ({
      name: c.rawName,
      type: c.type,
    })),
  };
}
