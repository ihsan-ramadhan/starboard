import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/shell/Navbar";

export default async function DatasetPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { key } = await params;
  const dataset = await prisma.datasetRegistry.findFirst({
    where: { dept: user.role, key },
  });

  const datasets = await prisma.datasetRegistry.findMany({
    where: { dept: user.role },
    orderBy: { createdAt: "asc" },
    select: { key: true, displayName: true },
  });

  if (!dataset) {
    return (
      <div className="app-shell">
        <Navbar user={user} datasets={datasets} activeKey={key} />
        <main className="content">
          <div className="empty-card">
            <h2>Dataset tidak ditemukan</h2>
            <p>dataset &quot;{key}&quot; belum diimpor untuk {user.role}.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar user={user} datasets={datasets} activeKey={key} />
      <main className="content">
        <div className="empty-card">
          <h2>{dataset.displayName}</h2>
          <p>
            tampilan widget dan chart untuk dataset ini disiapkan di tahap
            berikutnya.
          </p>
        </div>
      </main>
    </div>
  );
}
