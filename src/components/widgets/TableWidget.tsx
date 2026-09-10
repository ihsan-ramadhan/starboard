import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../../lib/api";
import { formatCell, formatCount } from "../../lib/format";
import type { DatasetColumn, WidgetFilter } from "../../types";

type TableRow = { key: string; data: Record<string, unknown> };

export type TableWidgetProps = {
  readonly title: string;
  readonly datasetId: string;
  readonly columns: readonly DatasetColumn[];
  readonly selected?: readonly string[];
  readonly filters?: readonly WidgetFilter[];
  readonly limit: number;
  readonly reloadNonce: number;
};

type SortState = { column: string; dir: "asc" | "desc" } | null;

export default function TableWidget({
  title,
  datasetId,
  columns,
  selected,
  filters,
  limit,
  reloadNonce,
}: TableWidgetProps) {
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);
  const [pageDraft, setPageDraft] = useState("1");
  const [rows, setRows] = useState<TableRow[] | null>(null);
  const [shown, setShown] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wanted = useMemo(
    () => (selected?.length ? [...selected] : undefined),
    [selected]
  );

  const filterKey = useMemo(
    () => (filters ?? []).map((f) => `${f.column}${f.op}${f.value}`).join(","),
    [filters]
  );
  const activeFilters = useMemo(
    () => (filters?.length ? [...filters] : undefined),
    [filterKey]
  );

  useEffect(() => {
    setPage(0);
  }, [datasetId, wanted, limit, filterKey]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    api
      .queryRows({
        datasetId,
        columns: wanted,
        filters: activeFilters,
        limit,
        offset: page * limit,
        sortColumn: sort?.column,
        sortDir: sort?.dir,
      })
      .then((res) => {
        if (!active) return;
        setRows(res.rows.map((data) => ({ key: crypto.randomUUID(), data })));
        setShown(res.columns);
        setTotal(res.total);
      })
      .catch((e) => {
        if (!active) return;
        setError(String(e instanceof Error ? e.message : e));
        setRows([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [datasetId, wanted, activeFilters, limit, page, sort, reloadNonce]);

  const pageCount = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);

  useEffect(() => {
    setPageDraft(String(page + 1));
  }, [page]);

  const typeOf = useMemo(() => {
    const map = new Map(columns.map((c) => [c.name, c.type]));
    return (name: string) => map.get(name);
  }, [columns]);

  const labelOf = useMemo(() => {
    const map = new Map(columns.map((c) => [c.name, c.label || c.name]));
    return (name: string) => map.get(name) ?? name;
  }, [columns]);

  function toggleSort(column: string) {
    setPage(0);
    setSort((current) => {
      if (current?.column !== column) return { column, dir: "asc" };
      if (current.dir === "asc") return { column, dir: "desc" };
      return null;
    });
  }

  function goTo(next: number) {
    setPage(Math.min(Math.max(next, 0), pageCount - 1));
  }

  function commitPageDraft() {
    const parsed = Number.parseInt(pageDraft, 10);
    if (Number.isNaN(parsed)) {
      setPageDraft(String(page + 1));
      return;
    }
    const clamped = Math.min(Math.max(parsed, 1), pageCount);
    setPageDraft(String(clamped));
    setPage(clamped - 1);
  }

  const firstRow = total === 0 ? 0 : page * limit + 1;
  const lastRow = page * limit + (rows?.length ?? 0);

  let notice: ReactNode = null;
  if (error) {
    notice = <div className="widget-empty">{error}</div>;
  } else if (rows === null) {
    notice = (
      <div className="sk-table" aria-busy="true" aria-label={`Memuat ${title}`}>
        <span className="sk sk-row sk-row-head" />
        {Array.from({ length: Math.min(limit, 6) }, (_, i) => (
          <span key={i} className="sk sk-row" />
        ))}
      </div>
    );
  } else if (rows.length === 0 && total === 0) {
    notice = <div className="widget-empty">Tidak ada baris untuk ditampilkan</div>;
  }

  return (
    <div className="chart-wrapper">
      <h4 className="widget-title" title={title}>
        {title}
      </h4>

      {notice ?? (
        <>
          <div className={`table-scroll${loading ? " is-loading" : ""}`}>
            <table className="data-table">
              <thead>
                <tr>
                  {shown.map((name) => {
                    const numeric = typeOf(name) === "numeric";
                    const active = sort?.column === name;
                    const ascending = active && sort?.dir === "asc";
                    let ariaSort: "ascending" | "descending" | "none" = "none";
                    if (active) ariaSort = ascending ? "ascending" : "descending";
                    return (
                      <th
                        key={name}
                        className={numeric ? "cell-num" : undefined}
                        aria-sort={ariaSort}
                      >
                        <button
                          type="button"
                          className={`th-sort${active ? " is-active" : ""}`}
                          onClick={() => toggleSort(name)}
                          title={`Urutkan menurut ${labelOf(name)}`}
                        >
                          <span>{labelOf(name)}</span>
                          <span className="th-sort-arrow">
                            {active && (ascending ? "▲" : "▼")}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((row) => (
                  <tr key={row.key}>
                    {shown.map((name) => (
                      <td
                        key={name}
                        className={typeOf(name) === "numeric" ? "cell-num" : undefined}
                      >
                        {formatCell(row.data[name])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-foot">
            <span className="table-range">
              {firstRow}–{lastRow} dari {formatCount(total)} baris
            </span>

            {pageCount > 1 && (
              <nav className="table-pager" aria-label="Navigasi halaman tabel">
                <button
                  type="button"
                  className="table-page-btn"
                  onClick={() => goTo(page - 1)}
                  disabled={page === 0}
                  aria-label="Halaman sebelumnya"
                >
                  ‹
                </button>

                <span className="table-page-jump">
                  <input
                    className="table-page-input"
                    type="text"
                    inputMode="numeric"
                    value={pageDraft}
                    aria-label={`Halaman, dari ${pageCount} halaman`}
                    onChange={(e) => setPageDraft(e.target.value.replace(/\D/g, ""))}
                    onBlur={commitPageDraft}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitPageDraft();
                      }
                    }}
                  />
                  <span>dari {pageCount}</span>
                </span>

                <button
                  type="button"
                  className="table-page-btn"
                  onClick={() => goTo(page + 1)}
                  disabled={page >= pageCount - 1}
                  aria-label="Halaman berikutnya"
                >
                  ›
                </button>
              </nav>
            )}
          </div>
        </>
      )}
    </div>
  );
}
