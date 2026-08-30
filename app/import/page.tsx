import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/shell/Navbar";

export default async function ImportPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const datasets = await prisma.datasetRegistry.findMany({
    where: { dept: user.role },
    orderBy: { createdAt: "asc" },
    select: { key: true, displayName: true },
  });

  return (
    <div className="app-shell">
      <Navbar user={user} datasets={datasets} />
      <main className="content">
        <div className="empty-card">
          <h2>Import Dataset</h2>
          <p>
            halaman upload excel dan preview schema disiapkan di tahap
            berikutnya.
          </p>
          <Link href="/" className="btn-ghost">
            ← kembali
          </Link>
        </div>
      </main>
    </div>
  );
}
