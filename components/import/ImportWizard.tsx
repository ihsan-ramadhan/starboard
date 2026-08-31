"use client";

import { useRef, useState } from "react";
import {
  analyzeExcelAction,
  importExcelAction,
} from "@/app/actions/import";
import type { DetectedSheet } from "@/lib/import-engine";

const TYPE_LABEL: Record<string, string> = {
  numeric: "num",
  date: "date",
  category: "cat",
};

function colLetter(idx: number): string {
  let s = "";
  let n = idx;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export default function ImportWizard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [sheets, setSheets] = useState<DetectedSheet[] | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selectedCols, setSelectedCols] = useState<Record<string, string[]>>({});

  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = sheets
    ? sheets.filter((s) => selected[s.sheetName]).length
    : 0;

  async function handleAnalyze() {
    if (!file) {
      setError("Pilih file Excel terlebih dahulu.");
      return;
    }
    setError(null);
    setAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("datasetKey", displayName);
      const result = await analyzeExcelAction(fd);
      setSheets(result);
      const initSel: Record<string, boolean> = {};
      const initCols: Record<string, string[]> = {};
      for (const s of result) {
        initSel[s.sheetName] = true;
        initCols[s.sheetName] = s.columns.map((c) => c.slug);
      }
      setSelected(initSel);
      setSelectedCols(initCols);
    } catch (e: any) {
      setError(e?.message || "Gagal menganalisis file.");
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleSheet(name: string) {
    setSelected((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function toggleCol(sheet: string, slug: string) {
    setSelectedCols((prev) => {
      const cur = prev[sheet] ?? [];
      const next = cur.includes(slug)
        ? cur.filter((x) => x !== slug)
        : [...cur, slug];
      return { ...prev, [sheet]: next };
    });
  }

  function toggleAll(value: boolean) {
    if (!sheets) return;
    const next: Record<string, boolean> = {};
    for (const s of sheets) next[s.sheetName] = value;
    setSelected(next);
  }

  async function handleImport() {
    if (!file || !sheets) return;
    const valid = sheets
      .filter((s) => selected[s.sheetName])
      .filter((s) => (selectedCols[s.sheetName]?.length ?? 0) > 0)
      .map((s) => s.sheetName);

    if (valid.length === 0) {
      setError(
        "Pilih minimal satu sheet dengan paling tidak satu kolom untuk diimpor."
      );
      return;
    }
    setError(null);
    setImporting(true);
    try {
      const selCols: Record<string, string[]> = {};
      for (const name of valid) selCols[name] = selectedCols[name];

      const fd = new FormData();
      fd.append("file", file);
      fd.append("displayName", displayName);
      fd.append("selectedSheets", JSON.stringify(valid));
      fd.append("selectedColumns", JSON.stringify(selCols));
      await importExcelAction(fd);
    } catch (e: any) {
      setError(e?.message || "Gagal mengimpor file.");
      setImporting(false);
    }
  }

  function reset() {
    setSheets(null);
    setSelected({});
    setSelectedCols({});
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="wizard">
      <div className="wizard-step">
        <label className="wizard-label">
          File Excel (.xlsx)
          <input
            ref={fileRef}
            type="file"
            name="file"
            accept=".xlsx, .xls"
            className="file-input"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setSheets(null);
              setSelected({});
              setSelectedCols({});
            }}
          />
        </label>

        <label className="wizard-label">
          Nama Tampilan Menu (opsional)
          <input
            type="text"
            name="displayName"
            placeholder="Contoh: Daywork 2026"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>

        <div className="import-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleAnalyze}
            disabled={analyzing || !file}
          >
            {analyzing ? "Menganalisis…" : "Analisis Sheet"}
          </button>
          {sheets && (
            <button type="button" className="btn-ghost" onClick={reset}>
              Ganti File
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert" style={{ margin: "16px 0" }}>
          {error}
        </div>
      )}

      {sheets && (
        <div className="wizard-step">
          <div className="wizard-toolbar">
            <div className="wizard-toolbar-info">
              <strong>{sheets.length}</strong> sheet terdeteksi ·{" "}
              <strong>{selectedCount}</strong> dipilih
            </div>
            <div className="wizard-toolbar-actions">
              <button
                type="button"
                className="link-btn"
                onClick={() => toggleAll(true)}
              >
                Pilih semua
              </button>
              <span className="link-sep">·</span>
              <button
                type="button"
                className="link-btn"
                onClick={() => toggleAll(false)}
              >
                Batal pilih
              </button>
            </div>
          </div>

          <div className="sheet-list">
            {sheets.map((s) => {
              const isSel = !!selected[s.sheetName];
              const pickedCols = selectedCols[s.sheetName] ?? [];
              return (
                <div
                  key={s.sheetName}
                  className={`sheet-row${isSel ? " selected" : ""}`}
                  onClick={() => toggleSheet(s.sheetName)}
                >
                  <input
                    type="checkbox"
                    className="sheet-check"
                    checked={isSel}
                    onChange={() => toggleSheet(s.sheetName)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="sheet-main">
                    <div className="sheet-name">{s.sheetName}</div>
                    <div className="sheet-meta">
                      {s.rowCount.toLocaleString()} baris · {s.columns.length}{" "}
                      kolom
                      {isSel && (
                        <>
                          {" · "}
                          <strong>{pickedCols.length}</strong> dipilih
                        </>
                      )}
                    </div>

                    {!isSel && (
                      <div className="sheet-chips">
                        {s.columns.slice(0, 8).map((c) => (
                          <span key={c.slug} className="sheet-chip">
                            {c.rawName}{" "}
                            <span className={`chip-type chip-${c.type}`}>
                              {TYPE_LABEL[c.type]}
                            </span>
                          </span>
                        ))}
                        {s.columns.length > 8 && (
                          <span className="sheet-chip-more">
                            +{s.columns.length - 8}
                          </span>
                        )}
                      </div>
                    )}

                    {isSel && (
                      <div className="col-picker">
                        {s.columns.map((c) => {
                          const on = pickedCols.includes(c.slug);
                          return (
                            <button
                              key={c.slug}
                              type="button"
                              className={`col-pick${on ? " on" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCol(s.sheetName, c.slug);
                              }}
                            >
                              <span className="col-letter">
                                {colLetter(c.colIndex)}
                              </span>
                              {c.rawName}
                              <span className={`chip-type chip-${c.type}`}>
                                {TYPE_LABEL[c.type]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="import-actions" style={{ marginTop: 20 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
            >
              {importing
                ? "Mengimpor…"
                : `Import ${selectedCount} sheet terpilih`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
