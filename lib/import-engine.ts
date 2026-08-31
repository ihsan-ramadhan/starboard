import ExcelJS from "exceljs";
import { prisma } from "./prisma";

export type InferredType = "numeric" | "date" | "category";

export type ColumnSchema = {
  colIndex: number;
  rawName: string;
  slug: string;
  type: InferredType;
};

export type DetectedSheet = {
  sheetName: string;
  headerRowIndex: number;
  dataStartRowIndex: number;
  columns: ColumnSchema[];
  rowCount: number;
  fingerprint: string;
  suggestedKey: string;
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

function normalizeCategoryValue(raw: string): string {
  return raw
    .trim()
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .toUpperCase();
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
  let best: {
    headerRowIndex: number;
    columns: { colIndex: number; rawName: string }[];
  } | null = null;
  let bestScore = 2;

  for (let r = 1; r <= Math.min(ws.rowCount, 12); r++) {
    const row = ws.getRow(r);
    const textCols: { colIndex: number; rawName: string }[] = [];
    const seen = new Set<string>();
    let distinct = 0;

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const val = resolveCellValue(cell.value);
      if (typeof val === "string" && val.trim().length > 0) {
        const t = val.trim();
        textCols.push({ colIndex: colNumber, rawName: t });
        if (!seen.has(t)) {
          seen.add(t);
          distinct++;
        }
      }
    });

    if (distinct > bestScore) {
      bestScore = distinct;
      best = { headerRowIndex: r, columns: textCols };
    }
  }

  return best;
}

function collectSampleRows(
  ws: ExcelJS.Worksheet,
  headerColumns: { colIndex: number; rawName: string }[],
  dataStartRowIndex: number,
  max = 40
): any[][] {
  const rows: any[][] = [];
  for (
    let r = dataStartRowIndex;
    r <= Math.min(ws.rowCount, dataStartRowIndex + max);
    r++
  ) {
    const row = ws.getRow(r);
    const values = headerColumns.map((c) =>
      resolveCellValue(row.getCell(c.colIndex).value)
    );
    if (values.some((v) => v !== null && v !== undefined && v !== "")) {
      rows.push(values);
    }
  }
  return rows;
}

function buildColumns(
  headerColumns: { colIndex: number; rawName: string }[],
  sampleRows: any[][]
): ColumnSchema[] {
  const seenSlugs = new Map<string, number>();
  const columns: ColumnSchema[] = [];

  for (let idx = 0; idx < headerColumns.length; idx++) {
    const c = headerColumns[idx];
    const colSamples = sampleRows.map((r) => r[idx]);
    const type = inferType(colSamples);

    const baseSlug = slugify(c.rawName) || `col_${idx + 1}`;
    const count = seenSlugs.get(baseSlug) || 0;
    seenSlugs.set(baseSlug, count + 1);

    const uniqueSlug = count === 0 ? baseSlug : `${baseSlug}_${count + 1}`;

    columns.push({
      colIndex: c.colIndex,
      rawName: c.rawName,
      slug: uniqueSlug,
      type,
    });
  }

  return columns;
}

export async function analyzeExcelBuffer(
  buffer: Buffer,
  baseDatasetKey: string
): Promise<DetectedSheet[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  const detected: DetectedSheet[] = [];

  for (const ws of wb.worksheets) {
    const header = findHeaderRow(ws);
    if (!header || header.columns.length < 2) continue;

    const dataStartRowIndex = header.headerRowIndex + 1;
    const sampleRows = collectSampleRows(ws, header.columns, dataStartRowIndex);
    const columns = buildColumns(header.columns, sampleRows);

    const fingerprint = columns
      .map((c) => c.slug)
      .sort()
      .join("|");

    const rowCount = Math.max(0, ws.rowCount - header.headerRowIndex);

    detected.push({
      sheetName: ws.name,
      headerRowIndex: header.headerRowIndex,
      dataStartRowIndex,
      columns,
      rowCount,
      fingerprint,
      suggestedKey: `${slugify(baseDatasetKey)}_${slugify(ws.name)}`,
    });
  }

  return detected;
}

export async function executeImport(params: {
  buffer: Buffer;
  dept: string;
  datasetKey: string;
  userId: string;
  selectedSheets: string[];
  selectedColumns?: Record<string, string[]>;
}): Promise<{
  tablesCreated: {
    key: string;
    displayName: string;
    tableName: string;
    importedRows: number;
    columnsCount: number;
  }[];
  primaryKey: string;
}> {
  const { buffer, dept, datasetKey, userId, selectedSheets } = params;
  const baseKey = slugify(datasetKey);
  const deptLower = dept.toLowerCase().replace(/[^a-z0-9]/g, "");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  const tablesCreated: {
    key: string;
    displayName: string;
    tableName: string;
    importedRows: number;
    columnsCount: number;
  }[] = [];

  for (const sheetName of selectedSheets) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;

    const header = findHeaderRow(ws);
    if (!header || header.columns.length < 2) continue;

    const dataStartRowIndex = header.headerRowIndex + 1;
    const sampleRows = collectSampleRows(ws, header.columns, dataStartRowIndex);
    const columns = buildColumns(header.columns, sampleRows);

    const chosenCols = params.selectedColumns?.[sheetName];
    const importCols =
      chosenCols && chosenCols.length > 0
        ? columns.filter((c) => chosenCols.includes(c.slug))
        : columns;
    if (importCols.length === 0) continue;

    const key = `${baseKey}_${slugify(ws.name)}`;
    const tableName = `${deptLower}_${key}_records`;

    const colDefinitions = importCols.map((col) => {
      let pgType = "text";
      if (col.type === "numeric") pgType = "numeric";
      if (col.type === "date") pgType = "date";
      return `"${col.slug}" ${pgType}`;
    });

    const createTableSql = `
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
        ${colDefinitions.join(",\n        ")},
        "source_sheet" text,
        "created_at" timestamptz DEFAULT now()
      );
    `;

    await prisma.$executeRawUnsafe(createTableSql);

    const dataset = await prisma.datasetRegistry.upsert({
      where: { dept_key: { dept, key } },
      update: {
        displayName: ws.name.trim(),
        tableName,
        createdBy: userId,
      },
      create: {
        dept,
        key,
        tableName,
        displayName: ws.name.trim(),
        createdBy: userId,
      },
    });

    await prisma.datasetColumn.deleteMany({ where: { datasetId: dataset.id } });
    await prisma.datasetColumn.createMany({
      data: importCols.map((c) => ({
        datasetId: dataset.id,
        name: c.slug,
        label: c.rawName,
        type: c.type,
        isDimension: c.type === "category",
      })),
    });

    const allRowsToInsert: any[] = [];
    const dateCol = importCols.find((c) => c.type === "date");
    const categoryCols = importCols.filter((c) => c.type === "category");

    for (let r = dataStartRowIndex; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const rowData: Record<string, any> = {};

      importCols.forEach((col) => {
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
            rowData[col.slug] = normalizeCategoryValue(String(raw).trim());
          }
        } else {
          rowData[col.slug] = null;
        }
      });

      const hasDate = dateCol ? !!rowData[dateCol.slug] : false;
      const filledCategoryCount = categoryCols.filter(
        (c) => !!rowData[c.slug]
      ).length;

      if (!hasDate && filledCategoryCount < 2) {
        continue;
      }

      rowData["source_sheet"] = ws.name.trim();
      allRowsToInsert.push(rowData);
    }

    if (allRowsToInsert.length === 0) {
      continue;
    }

    const CHUNK_SIZE = 100;
    let importedCount = 0;

    for (let i = 0; i < allRowsToInsert.length; i += CHUNK_SIZE) {
      const chunk = allRowsToInsert.slice(i, i + CHUNK_SIZE);
      if (chunk.length === 0) continue;

      const cols = [
        ...importCols.map((c) => ({ slug: c.slug, type: c.type })),
        { slug: "source_sheet", type: "category" as InferredType },
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
      importedCount += chunk.length;
    }

    tablesCreated.push({
      key,
      displayName: ws.name.trim(),
      tableName,
      importedRows: importedCount,
      columnsCount: importCols.length,
    });
  }

  return {
    tablesCreated,
    primaryKey: tablesCreated[0]?.key ?? baseKey,
  };
}
