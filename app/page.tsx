import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/shell/Navbar";

export default async function DashboardHome() {
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
        {datasets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-card">
              <h2>Dashboard belum punya dataset</h2>
              <p>
                Departemen <strong>{user.role}</strong> belum punya dataset.
                Import data Excel pertama untuk mulai menyusun dashboard.
              </p>
              <Link href="/import" className="btn-primary">
                + Import Dataset
              </Link>
            </div>
          </div>
        ) : (
          <div className="hint">
            Pilih dataset di atas, atau{" "}
            <Link href="/import">import dataset baru</Link>.
          </div>
        )}
      </main>
    </div>
  );
}
