import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/shell/Navbar";
import { importExcelAction } from "@/app/actions/import";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { error } = await searchParams;

  const datasets = await prisma.datasetRegistry.findMany({
    where: { dept: user.role },
    orderBy: { createdAt: "asc" },
    select: { key: true, displayName: true },
  });

  return (
    <div className="app-shell">
      <Navbar user={user} datasets={datasets} />
      <main className="content">
        <div className="import-container">
          <div className="import-card">
            <h2>Import Dataset Baru</h2>
            <p className="import-sub">
              Upload file Excel (.xlsx) untuk departemen <strong>{user.role}</strong>.
              Sistem akan otomatis mendeteksi kolom, membuat tabel database, dan
              menambahkan menu baru ke dashboard.
            </p>

            {error && (
              <div className="alert" style={{ marginBottom: "16px" }}>
                {error === "no_file"
                  ? "Pilih file Excel terlebih dahulu."
                  : decodeURIComponent(error)}
              </div>
            )}

            <form action={importExcelAction} className="import-form">
              <label>
                File Excel (.xlsx)
                <input
                  type="file"
                  name="file"
                  accept=".xlsx, .xls"
                  required
                  className="file-input"
                />
              </label>

              <label>
                Nama Tampilan Menu (opsional)
                <input
                  type="text"
                  name="displayName"
                  placeholder="Contoh: Daywork 2026"
                />
              </label>

              <div className="import-actions">
                <button type="submit" className="btn-primary">
                  Proses & Buat Tabel
                </button>
                <Link href="/" className="btn-ghost">
                  Batal
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
