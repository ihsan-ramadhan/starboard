"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { executeImport } from "@/lib/import-engine";

export async function importExcelAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const file = formData.get("file") as File | null;
  const displayName = String(formData.get("displayName") ?? "").trim();
  const datasetKey = String(formData.get("datasetKey") ?? "").trim();

  if (!file || file.size === 0) {
    redirect("/import?error=no_file");
  }

  const nameToUse = displayName || file.name.replace(/\.[^/.]+$/, "");
  const keyToUse =
    datasetKey || nameToUse.toLowerCase().replace(/[^a-z0-9]+/g, "_");

  let redirectUrl = "";

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await executeImport({
      buffer,
      dept: user.role,
      datasetKey: keyToUse,
      displayName: nameToUse,
      userId: user.id,
    });

    redirectUrl = `/d/${keyToUse}?imported=${result.totalImported}&table=${result.tableName}`;
  } catch (err: any) {
    console.error("Import error:", err);
    redirect(`/import?error=${encodeURIComponent(err.message || "Gagal mengimpor file")}`);
  }

  if (redirectUrl) {
    redirect(redirectUrl);
  }
}
