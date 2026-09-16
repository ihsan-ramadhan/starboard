import type { DatasetColumn } from "../../types";
import { formatCell } from "../../lib/format";
import { useT } from "../../lib/i18n";

export type RawTablePreviewProps = {
  readonly columns: readonly DatasetColumn[];
  readonly sampleRows: readonly any[];
};

export default function RawTablePreview({
  columns,
  sampleRows,
}: RawTablePreviewProps) {
  const t = useT();
  return (
    <div className="section-card" style={{ marginTop: "20px" }}>
      <div className="table-header-row">
        <h3>{t("preview.title")}</h3>
        <span className="table-sub">{t("preview.actual")}</span>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.id || c.name}
                  className={c.type === "numeric" ? "cell-num" : undefined}
                >
                  {c.label || c.name}
                </th>
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
                  {t("preview.empty")}
                </td>
              </tr>
            ) : (
              sampleRows.map((row, rIdx) => (
                <tr key={row.id || rIdx}>
                  {columns.map((c) => (
                    <td
                      key={c.id || c.name}
                      className={c.type === "numeric" ? "cell-num" : undefined}
                    >
                      {formatCell(row[c.name])}
                    </td>
                  ))}
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
