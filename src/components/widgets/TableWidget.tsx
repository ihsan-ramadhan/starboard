import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { formatCell } from "../../lib/format";
import type { DatasetColumn } from "../../types";

export type TableWidgetProps = {
  readonly title: string;
  readonly datasetId: string;
  readonly columns: readonly DatasetColumn[];
  readonly selected?: readonly string[];
  readonly limit: number;
  readonly reloadNonce: number;
};

type SortState = { column: string; dir: "asc" | "desc" } | null;

export default function TableWidget({
  title,
  datasetId,
  columns,
  selected,
  limit,
  reloadNonce,
}: TableWidgetProps) {
  const [sort, setSort] = useState<SortState>(null);
  const [rows, setRows] = useState<Array<Record<string, unknown>> | null>(null);
  const [shown, setShown] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const wanted = useMemo(
    () => (selected && selected.length > 0 ? [...selected] : undefined),
    [selected]
  );

  useEffect(() => {
    let active = true;
    setRows(null);
    setError(null);

    api
      .queryRows({
        datasetId,
        columns: wanted,
        limit,
        sortColumn: sort?.column,
        sortDir: sort?.dir,
      })
      .then((res) => {
        if (!active) return;
        setRows(res.rows);
        setShown(res.columns);
        setTotal(res.total);
      })
      .catch((e) => {
        if (!active) return;
        setError(String(e instanceof Error ? e.message : e));
        setRows([]);
      });

    return () => {
      active = false;
    };
  }, [datasetId, wanted, limit, sort, reloadNonce]);

  const typeOf = useMemo(() => {
    const map = new Map(columns.map((c) => [c.name, c.type]));
    return (name: string) => map.get(name);
  }, [columns]);

  const labelOf = useMemo(() => {
    const map = new Map(columns.map((c) => [c.name, c.label || c.name]));
    return (name: string) => map.get(name) ?? name;
  }, [columns]);

  function toggleSort(column: string) {
    setSort((current) => {
      if (!current || current.column !== column) return { column, dir: "asc" };
      if (current.dir === "asc") return { column, dir: "desc" };
      return null;
    });
  }

  return (
    <div className="chart-wrapper">
      <h4 className="widget-title" title={title}>
        {title}
      </h4>

      {error ? (
        <div className="widget-empty">{error}</div>
      ) : rows === null ? (
        <div className="widget-empty">Memuat data…</div>
      ) : rows.length === 0 ? (
        <div className="widget-empty">Tidak ada baris untuk ditampilkan</div>
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {shown.map((name) => {
                    const numeric = typeOf(name) === "numeric";
                    const active = sort?.column === name;
                    return (
                      <th
                        key={name}
                        className={numeric ? "cell-num" : undefined}
                        aria-sort={
                          active
                            ? sort?.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <button
                          type="button"
                          className={`th-sort${active ? " is-active" : ""}`}
                          onClick={() => toggleSort(name)}
                          title={`Urutkan menurut ${labelOf(name)}`}
                        >
                          <span>{labelOf(name)}</span>
                          <span className="th-sort-arrow">
                            {active ? (sort?.dir === "asc" ? "▲" : "▼") : ""}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    {shown.map((name) => (
                      <td
                        key={name}
                        className={typeOf(name) === "numeric" ? "cell-num" : undefined}
                      >
                        {formatCell(row[name])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-footnote">
            Menampilkan {rows.length} dari {total.toLocaleString("id-ID")} baris
          </div>
        </>
      )}
    </div>
  );
}
