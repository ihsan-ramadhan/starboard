import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { formatCell } from "../lib/format";
import { useT } from "../lib/i18n";
import { seriesLabeller } from "../lib/series";
import { DataLabelsProvider } from "../lib/prefs";
import type {
  DatasetColumn,
  ValueLabelMap,
  WidgetDefinition,
  WidgetFilter,
} from "../types";
import WidgetRender, { buildQuery } from "./widgets/WidgetRender";
import { WidgetDescriptionProvider } from "./widgets/chartParts";

export type WidgetFocusModalProps = {
  readonly widget: WidgetDefinition | null;
  readonly dataLabels: boolean | undefined;
  readonly columns: readonly DatasetColumn[];
  readonly globalFilters: readonly WidgetFilter[];
  readonly valueLabels?: ValueLabelMap | null;
  readonly onClose: () => void;
};

type Row = Record<string, unknown>;

export default function WidgetFocusModal({
  widget,
  dataLabels,
  columns,
  globalFilters,
  valueLabels,
  onClose,
}: WidgetFocusModalProps) {
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  const query = useMemo(
    () => (widget ? buildQuery(widget, globalFilters) : null),
    [widget, globalFilters]
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (widget) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [widget]);

  useEffect(() => {
    if (!query) {
      setRows(null);
      setFailed(false);
      return;
    }
    let live = true;
    setRows(null);
    setFailed(false);
    api
      .queryWidgetData(query)
      .then((res) => {
        if (live) setRows(res.rows as Row[]);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [query]);

  if (!widget) return null;

  const labelled = rows?.map((row) => {
    const key = String(row.groupKey ?? "");
    const mapped =
      widget.groupByColumn && valueLabels?.[widget.groupByColumn]?.[key];
    return mapped ? { ...row, groupKey: mapped } : row;
  });

  const scalarOnly =
    widget.type === "kpi" || widget.type === "gauge" || widget.type === "date";
  const headers = labelled?.length ? Object.keys(labelled[0]) : [];
  const columnLabel = seriesLabeller(columns);
  const headerLabel = (key: string) => {
    if (key === "groupKey") return t("focus.category");
    if (key === "value") return t("widget.valueSeries");
    return columnLabel(key);
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal-native focus-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-card focus-card">
        <div className="focus-header">
          <div className="focus-titles">
            <h3 className="modal-title">{widget.title}</h3>
            {widget.description && (
              <p className="widget-subtitle focus-description">{widget.description}</p>
            )}
          </div>
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t("focus.close")}
          </button>
        </div>

        <div className="focus-visual">
          <WidgetDescriptionProvider value={undefined}>
            <DataLabelsProvider value={dataLabels}>
              <WidgetRender
                widget={widget}
                columns={columns}
                globalFilters={globalFilters}
                valueLabels={valueLabels}
              />
            </DataLabelsProvider>
          </WidgetDescriptionProvider>
        </div>

        {query && !scalarOnly && (
          <div className="focus-data">
            <h4 className="focus-data-title">{t("focus.dataTitle")}</h4>
            {failed ? (
              <p className="widget-empty">{t("focus.dataFailed")}</p>
            ) : !labelled ? (
              <p className="widget-empty">{t("common.processing")}</p>
            ) : labelled.length === 0 ? (
              <p className="widget-empty">{t("chart.noData")}</p>
            ) : (
              <div className="focus-table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      {headers.map((h) => (
                        <th key={h}>{headerLabel(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {labelled.map((row, i) => (
                      <tr key={i}>
                        {headers.map((h) => (
                          <td
                            key={h}
                            className={
                              typeof row[h] === "number" ? "cell-num" : undefined
                            }
                          >
                            {formatCell(row[h])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
