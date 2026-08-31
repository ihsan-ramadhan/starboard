import type { DatasetColumn } from "../../types";

export type RawTablePreviewProps = {
  columns: DatasetColumn[];
  sampleRows: any[];
};

export default function RawTablePreview({
  columns,
  sampleRows,
}: RawTablePreviewProps) {
  return (
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
                    return <td key={c.id || c.name}>{formatted}</td>;
                  })}
                  <td>
                    <span className="sheet-badge">
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
  );
}
