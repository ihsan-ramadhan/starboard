import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/shell/Navbar";
import ImportWizard from "@/components/import/ImportWizard";

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
                  : error === "no_sheet"
                  ? "Pilih minimal satu sheet untuk diimpor."
                  : decodeURIComponent(error)}
              </div>
            )}

            <form className="import-form">
              <ImportWizard />
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
