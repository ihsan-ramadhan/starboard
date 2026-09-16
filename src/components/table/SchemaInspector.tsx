import type { DatasetColumn } from "../../types";
import { useT } from "../../lib/i18n";

export type SchemaInspectorProps = {
  readonly columns: readonly DatasetColumn[];
};

export default function SchemaInspector({ columns }: SchemaInspectorProps) {
  const t = useT();
  return (
    <div className="section-card">
      <h3>{t("schema.title")}</h3>
      <div className="columns-grid">
        {columns.map((c) => (
          <div key={c.id || c.name} className="column-pill">
            <span className="col-name">{c.label || c.name}</span>
            <span className={`col-type col-${c.type}`}>{c.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
