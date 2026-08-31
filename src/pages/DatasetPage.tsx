import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "../App";
import type { DatasetRegistry, DatasetColumn } from "../types";

type DatasetDetail = {
  dataset: DatasetRegistry;
  columns: DatasetColumn[];
  totalRows: number;
  sampleRows: any[];
};

export default function DatasetPage() {
  const { user } = useApp();
  const { key } = useParams<{ key: string }>();
  const [searchParams] = useSearchParams();
  const imported = searchParams.get("imported");

  const [detail, setDetail] = useState<DatasetDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!key) return;
      setLoading(true);
      try {
        if ((window as any).__TAURI_INTERNALS__) {
          const res = await invoke<DatasetDetail>("get_dataset_detail", {
            dept: user.role,
            key,
          });
          setDetail(res);
        }
      } catch (err) {
        console.error(err);
        setDetail(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.role, key]);

  if (loading) {
    return (
      <main className="content">
        <div className="hint">Memuat dataset…</div>
      </main>
    );
  }

  if (!detail || !detail.dataset) {
    return (
      <main className="content">
        <div className="empty-card">
          <h2>Dataset tidak ditemukan</h2>
          <p>Dataset &quot;{key}&quot; belum diimpor untuk {user.role}.</p>
          <Link to="/import" className="btn-primary">
            Import Sekarang
          </Link>
        </div>
      </main>
    );
  }

  const { dataset, columns, totalRows, sampleRows } = detail;

  return (
    <main className="content">
      <div className="dataset-header">
        <div>
          <h1 className="dataset-title">{dataset.displayName}</h1>
          <p className="dataset-meta">
            Tabel database: <code>{dataset.tableName}</code> · Total baris:{" "}
            <strong>{totalRows.toLocaleString()}</strong> · Terdeteksi{" "}
            <strong>{columns.length} kolom</strong>
          </p>
        </div>
        <Link to="/import" className="btn-ghost">
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
          {columns.map((c) => (
            <div key={c.id || c.name} className="column-pill">
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
                {columns.map((c) => (
                  <th key={c.id || c.name}>{c.label || c.name}</th>
                ))}
                <th>source_sheet</th>
              </tr>
            </thead>
            <tbody>
              {sampleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    style={{ textAlign: "center", padding: "24px" }}
                  >
                    Belum ada data dalam tabel ini.
                  </td>
                </tr>
              ) : (
                sampleRows.map((row, rIdx) => (
                  <tr key={row.id || rIdx}>
                    {columns.map((c) => {
                      const val = row[c.name];
                      let formatted = val;
                      if (val instanceof Date) {
                        formatted = val.toISOString().split("T")[0];
                      } else if (typeof val === "number") {
                        formatted = val.toLocaleString();
                      } else if (val === null || val === undefined) {
                        formatted = "-";
                      }
                      return <td key={c.id || c.name}>{String(formatted)}</td>;
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
  );
}
