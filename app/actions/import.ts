"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { analyzeExcelBuffer, executeImport, type DetectedSheet } from "@/lib/import-engine";

export async function analyzeExcelAction(
  formData: FormData
): Promise<DetectedSheet[]> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const file = formData.get("file") as File | null;
  const datasetKey = String(formData.get("datasetKey") ?? "").trim();

  if (!file || file.size === 0) {
    throw new Error("Pilih file Excel terlebih dahulu.");
  }

  const keyToUse =
    datasetKey || file.name.toLowerCase().replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]+/g, "_");

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return analyzeExcelBuffer(buffer, keyToUse);
}

export async function importExcelAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const file = formData.get("file") as File | null;
  const displayName = String(formData.get("displayName") ?? "").trim();
  const datasetKey = String(formData.get("datasetKey") ?? "").trim();
  const selectedSheetsRaw = String(formData.get("selectedSheets") ?? "[]");
  const selectedColumnsRaw = String(formData.get("selectedColumns") ?? "{}");

  if (!file || file.size === 0) {
    redirect("/import?error=no_file");
  }

  const nameToUse = displayName || file.name.replace(/\.[^/.]+$/, "");
  const keyToUse =
    datasetKey || nameToUse.toLowerCase().replace(/[^a-z0-9]+/g, "_");

  let selectedSheets: string[] = [];
  try {
    const parsed = JSON.parse(selectedSheetsRaw);
    if (Array.isArray(parsed)) {
      selectedSheets = parsed.filter((s) => typeof s === "string");
    }
  } catch {
    selectedSheets = [];
  }

  if (selectedSheets.length === 0) {
    redirect("/import?error=no_sheet");
  }

  let selectedColumns: Record<string, string[]> = {};
  try {
    const parsed = JSON.parse(selectedColumnsRaw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      selectedColumns = parsed as Record<string, string[]>;
    }
  } catch {
    selectedColumns = {};
  }

  let redirectUrl = "";

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await executeImport({
      buffer,
      dept: user.role,
      datasetKey: keyToUse,
      userId: user.id,
      selectedSheets,
      selectedColumns,
    });

    const primary = result.tablesCreated[0];
    redirectUrl = `/d/${result.primaryKey}?imported=${primary?.importedRows ?? 0}&table=${primary?.tableName ?? ""}`;
  } catch (err: any) {
    console.error("Import error:", err);
    redirect(`/import?error=${encodeURIComponent(err.message || "Gagal mengimpor file")}`);
  }

  if (redirectUrl) {
    redirect(redirectUrl);
  }
}
