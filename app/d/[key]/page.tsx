import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/shell/Navbar";

export default async function DatasetPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ imported?: string; table?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { key } = await params;
  const { imported } = await searchParams;

  const dataset = await prisma.datasetRegistry.findFirst({
    where: { dept: user.role, key },
    include: { columns: true },
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
            <p>Dataset &quot;{key}&quot; belum diimpor untuk {user.role}.</p>
            <Link href="/import" className="btn-primary">
              Import Sekarang
            </Link>
          </div>
        </main>
      </div>
    );
  }

  let sampleRows: any[] = [];
  let totalRows = 0;

  try {
    const countRes = await prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT count(*)::text as count FROM "${dataset.tableName}"`
    );
    totalRows = parseInt(countRes[0]?.count ?? "0", 10);

    sampleRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${dataset.tableName}" ORDER BY id ASC LIMIT 15`
    );
  } catch (e) {
    console.error("Error reading table data:", e);
  }

  return (
    <div className="app-shell">
      <Navbar user={user} datasets={datasets} activeKey={key} />
      <main className="content">
        <div className="dataset-header">
          <div>
            <h1 className="dataset-title">{dataset.displayName}</h1>
            <p className="dataset-meta">
              Tabel database: <code>{dataset.tableName}</code> · Total baris:{" "}
              <strong>{totalRows.toLocaleString()}</strong> · Terdeteksi{" "}
              <strong>{dataset.columns.length} kolom</strong>
            </p>
          </div>
          <Link href="/import" className="btn-ghost">
            + Import File Lain
          </Link>
        </div>

        {imported && (
          <div className="success-banner">
            Berhasil membuat tabel <code>{dataset.tableName}</code> dan mengimpor{" "}
            <strong>{Number(imported).toLocaleString()} baris</strong> data!
          </div>
        )}

        <div className="section-card">
          <h3>Struktur Skema Terdeteksi (Otomatis)</h3>
          <div className="columns-grid">
            {dataset.columns.map((c) => (
              <div key={c.id} className="column-pill">
                <span className="col-name">{c.label || c.name}</span>
                <span className={`col-type col-${c.type}`}>{c.type}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="section-card" style={{ marginTop: "20px" }}>
          <div className="table-header-row">
            <h3>Pratinjau Data Impor (15 baris pertama)</h3>
            <span className="table-sub">Data aktual dari database Supabase</span>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  {dataset.columns.map((c) => (
                    <th key={c.id}>{c.label || c.name}</th>
                  ))}
                  <th>source_sheet</th>
                </tr>
              </thead>
              <tbody>
                {sampleRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={dataset.columns.length + 1}
                      style={{ textAlign: "center", padding: "24px" }}
                    >
                      Belum ada data dalam tabel ini.
                    </td>
                  </tr>
                ) : (
                  sampleRows.map((row, rIdx) => (
                    <tr key={row.id || rIdx}>
                      {dataset.columns.map((c) => {
                        const val = row[c.name];
                        let formatted = val;
                        if (val instanceof Date) {
                          formatted = val.toISOString().split("T")[0];
                        } else if (typeof val === "number") {
                          formatted = val.toLocaleString();
                        } else if (val === null || val === undefined) {
                          formatted = "-";
                        }
                        return <td key={c.id}>{String(formatted)}</td>;
                      })}
                      <td>
                        <span className="badge-subtle">
                          {row.source_sheet || "-"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
