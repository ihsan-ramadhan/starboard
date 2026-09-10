import { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useApp } from "../App";
import { api } from "../lib/api";
import {
  fileNameOf,
  isDesktop,
  machineName,
  onFileDrop,
  pickExcelPath,
  readSourceFile,
} from "../lib/desktop";
import { formatCount } from "../lib/format";
import FilePlusIcon from "../assets/icons/file-plus.svg?react";

type InferredType = "numeric" | "date" | "category";

type ColumnSchema = {
  colIndex: number;
  rawName: string;
  slug: string;
  type: InferredType;
};

export type DetectedSheet = {
  sheetName: string;
  headerRowIndex: number;
  dataStartRowIndex: number;
  columns: ColumnSchema[];
  rowCount: number;
  fingerprint: string;
  suggestedKey: string;
};

export type ImportWizardState = {
  fileName: string;
  fileBytes: number[] | null;
  sourcePath: string | null;
  sourceRevision: string | null;
  displayName: string;
  searchQuery: string;
  activeSheetName: string | null;
  sheets: DetectedSheet[] | null;
  selected: Record<string, boolean>;
  selectedCols: Record<string, string[]>;
};

export const initialImportWizardState: ImportWizardState = {
  fileName: "",
  fileBytes: null,
  sourcePath: null,
  sourceRevision: null,
  displayName: "",
  searchQuery: "",
  activeSheetName: null,
  sheets: null,
  selected: {},
  selectedCols: {},
};

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
    s = String.fromCodePoint(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cleanInitialName(fileName: string): string {
  return fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ImportWizardProps = {
  readonly wizardState: ImportWizardState;
  readonly setWizardState: React.Dispatch<React.SetStateAction<ImportWizardState>>;
  readonly onImportSuccess?: () => void;
};

function initialSelection(sheets: DetectedSheet[]) {
  const selected: Record<string, boolean> = {};
  const selectedCols: Record<string, string[]> = {};
  for (const s of sheets) {
    selected[s.sheetName] = false;
    selectedCols[s.sheetName] = s.columns.map((c) => c.slug);
  }
  return { selected, selectedCols };
}

function matchSheets(
  sheets: DetectedSheet[] | null,
  query: string
): DetectedSheet[] {
  if (!sheets) return [];
  const q = query.trim().toLowerCase();
  if (!q) return sheets;
  return sheets.filter((s) => s.sheetName.toLowerCase().includes(q));
}

export default function ImportWizard({
  wizardState,
  setWizardState,
  onImportSuccess,
}: ImportWizardProps) {
  const { user } = useApp();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    fileName,
    fileBytes,
    sourcePath,
    sourceRevision,
    displayName,
    searchQuery,
    activeSheetName,
    sheets,
    selected,
    selectedCols,
  } = wizardState;

  const selectedCount = sheets
    ? sheets.filter((s) => selected[s.sheetName]).length
    : 0;

  const filteredSheets = useMemo(
    () => matchSheets(sheets, searchQuery),
    [sheets, searchQuery]
  );

  const activeSheet = useMemo(() => {
    if (!sheets || sheets.length === 0) return null;
    return (
      sheets.find((s) => s.sheetName === activeSheetName) ??
      filteredSheets[0] ??
      sheets[0]
    );
  }, [sheets, activeSheetName, filteredSheets]);

  async function analyze(
    bytes: number[],
    name: string,
    source: { path: string; revision: string } | null
  ) {
    setError(null);
    setAnalyzing(true);
    const cleaned = cleanInitialName(name);

    try {
      const result = await api.analyzeExcel(bytes, cleaned);

      const { selected: initSel, selectedCols: initCols } =
        initialSelection(result);

      setWizardState({
        fileName: name,
        fileBytes: bytes,
        sourcePath: source?.path ?? null,
        sourceRevision: source?.revision ?? null,
        displayName: "",
        searchQuery: "",
        activeSheetName: result[0]?.sheetName ?? null,
        sheets: result,
        selected: initSel,
        selectedCols: initCols,
      });
    } catch (e: any) {
      toast.error(e?.toString() || "Gagal menganalisis file Excel.");
      setWizardState(initialImportWizardState);
    } finally {
      setAnalyzing(false);
    }
  }

  async function processFile(selectedFile: File) {
    const buffer = await selectedFile.arrayBuffer();
    await analyze(Array.from(new Uint8Array(buffer)), selectedFile.name, null);
  }

  async function loadFromPath(path: string) {
    if (!/\.(xlsx|xls)$/i.test(path)) {
      setError("Hanya file Excel (.xlsx, .xls) yang didukung.");
      return;
    }
    try {
      setAnalyzing(true);
      const source = await readSourceFile(path);
      await analyze(source.bytes, fileNameOf(path), {
        path,
        revision: source.revision,
      });
    } catch (e: any) {
      setAnalyzing(false);
      toast.error(e?.toString() || "Gagal membuka file.");
    }
  }

  async function pickFromDisk() {
    try {
      const path = await pickExcelPath();
      if (!path) return;
      await loadFromPath(path);
    } catch (e: any) {
      toast.error(e?.toString() || "Gagal membuka file.");
    }
  }

  function openPicker() {
    if (analyzing) return;
    if (isDesktop()) {
      pickFromDisk();
    } else {
      fileRef.current?.click();
    }
  }

  useEffect(() => {
    if (!isDesktop() || sheets || analyzing) return;
    return onFileDrop({
      onEnter: () => setIsDragging(true),
      onLeave: () => setIsDragging(false),
      onDrop: (paths) => {
        if (paths[0]) loadFromPath(paths[0]);
      },
    });
  }, [sheets, analyzing]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (
      droppedFile &&
      (droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".xls"))
    ) {
      processFile(droppedFile);
    } else {
      setError("Hanya file Excel (.xlsx, .xls) yang didukung.");
    }
  }

  function toggleSheet(name: string) {
    setWizardState((prev) => ({
      ...prev,
      selected: { ...prev.selected, [name]: !prev.selected[name] },
    }));
  }

  function toggleCol(sheet: string, slug: string) {
    setWizardState((prev) => {
      const cur = prev.selectedCols[sheet] ?? [];
      const next = cur.includes(slug)
        ? cur.filter((x) => x !== slug)
        : [...cur, slug];
      return {
        ...prev,
        selectedCols: { ...prev.selectedCols, [sheet]: next },
      };
    });
  }

  function toggleAllColsInSheet(sheet: DetectedSheet, select: boolean) {
    setWizardState((prev) => ({
      ...prev,
      selectedCols: {
        ...prev.selectedCols,
        [sheet.sheetName]: select ? sheet.columns.map((c) => c.slug) : [],
      },
    }));
  }

  function toggleAll(value: boolean) {
    if (!sheets) return;
    const next: Record<string, boolean> = {};
    for (const s of sheets) next[s.sheetName] = value;
    setWizardState((prev) => ({ ...prev, selected: next }));
  }

  async function handleImport() {
    if (!fileName || !fileBytes || !sheets) return;
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

      const res = await api.importExcel({
        dept: user.role,
        fileBytes,
        displayName: displayName.trim() || cleanInitialName(fileName),
        baseKey: displayName.trim() || cleanInitialName(fileName),
        selectedSheets: valid,
        selectedColumns: selCols,
        sourcePath: sourcePath ?? undefined,
        sourceMtime: sourceRevision ?? undefined,

        watchedBy: sourcePath ? await machineName() : undefined,
      });

      if (!res.primaryKey) {
        throw new Error("Tidak ada sheet yang berhasil diimpor.");
      }

      setWizardState(initialImportWizardState);
      if (onImportSuccess) onImportSuccess();
      toast.success(
        `${valid.length} sheet berhasil diimpor (${formatCount(res.totalImported)} baris).`
      );
      navigate(`/d/${res.primaryKey}`);
    } catch (e: any) {
      toast.error(e?.toString() || "Gagal mengimpor file.");
      setImporting(false);
    }
  }

  function reset() {
    setWizardState(initialImportWizardState);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="wizard">
      {!sheets ? (
        <button
          type="button"
          className={`dropzone-card${isDragging ? " dragging" : ""}${
            analyzing ? " analyzing" : ""
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={openPicker}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx, .xls"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) processFile(f);
            }}
          />

          <div className="dropzone-inner">
            <div className="dropzone-icon">
              <FilePlusIcon width={32} height={32} />
            </div>
            <div className="dropzone-title">
              {analyzing ? "Membaca file Excel..." : "Klik atau seret file Excel ke sini"}
            </div>
            <div className="dropzone-sub">
              {isDesktop()
                ? "Pilih dari disk atau folder share departemen. Starboard akan mengikuti perubahan file itu."
                : "Format yang didukung: .xlsx, .xls"}
            </div>
          </div>
        </button>
      ) : (
        <div className="wizard-split-container">
          <div className="wizard-topbar">
            <div className="wizard-topbar-left">
              <div className="wizard-name-group">
                <span className="wizard-name-label">Nama Menu Tab:</span>
                <input
                  type="text"
                  className="wizard-name-input"
                  value={displayName}
                  onChange={(e) =>
                    setWizardState((prev) => ({
                      ...prev,
                      displayName: e.target.value,
                    }))
                  }
                  placeholder={fileName ? cleanInitialName(fileName) : "Contoh: Daywork 2026"}
                />
              </div>
            </div>
            <div className="wizard-topbar-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={reset}
              >
                Ganti File
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
              >
                {importing
                  ? "Mengimpor…"
                  : `Import ${selectedCount} Sheet`}
              </button>
            </div>
          </div>

          <div className="wizard-panels">
            <div className="wizard-left-panel">
              <div className="panel-header">
                <input
                  type="text"
                  placeholder="Cari sheet..."
                  value={searchQuery}
                  onChange={(e) =>
                    setWizardState((prev) => ({
                      ...prev,
                      searchQuery: e.target.value,
                    }))
                  }
                  className="search-input"
                />
                <div className="panel-header-sub">
                  <label className="select-all-label">
                    <input
                      type="checkbox"
                      checked={
                        sheets.length > 0 && selectedCount === sheets.length
                      }
                      ref={(el) => {
                        if (el) {
                          el.indeterminate =
                            selectedCount > 0 &&
                            selectedCount < sheets.length;
                        }
                      }}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="sheet-check"
                    />
                    <span>Pilih Semua Sheet</span>
                  </label>
                  <span className="selection-count-badge">
                    {selectedCount}/{sheets.length}
                  </span>
                </div>
              </div>

              <div className="sheet-nav-list">
                {filteredSheets.map((s) => {
                  const isSel = !!selected[s.sheetName];
                  const isAct = activeSheet?.sheetName === s.sheetName;
                  const pickedCols = selectedCols[s.sheetName] ?? [];

                  return (
                    <button
                      key={s.sheetName}
                      type="button"
                      className={`sheet-nav-item${isAct ? " active" : ""}${
                        isSel ? " checked" : ""
                      }`}
                      onClick={() =>
                        setWizardState((prev) => ({
                          ...prev,
                          activeSheetName: s.sheetName,
                        }))
                      }
                    >
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleSheet(s.sheetName)}
                        onClick={(e) => e.stopPropagation()}
                        className="sheet-check"
                      />
                      <div className="sheet-nav-info">
                        <div className="sheet-nav-title">{s.sheetName}</div>
                        <div className="sheet-nav-meta">
                          {formatCount(s.rowCount)} baris ·{" "}
                          {pickedCols.length}/{s.columns.length} kol
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="wizard-right-panel">
              {activeSheet ? (
                <div className="sheet-detail-card">
                  <div className="sheet-detail-header">
                    <div>
                      <div className="sheet-detail-title">
                        {activeSheet.sheetName}
                      </div>
                      <div className="sheet-detail-meta">
                        {formatCount(activeSheet.rowCount)} total baris ·{" "}
                        {activeSheet.columns.length} kolom tersedia · Header baris ke-
                        {activeSheet.headerRowIndex}
                      </div>
                    </div>
                    <div className="sheet-detail-actions">
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => toggleAllColsInSheet(activeSheet, true)}
                      >
                        Pilih Semua Kolom
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => toggleAllColsInSheet(activeSheet, false)}
                      >
                        Batal Kolom
                      </button>
                    </div>
                  </div>

                  <div className="col-grid">
                    {activeSheet.columns.map((c) => {
                      const on = (
                        selectedCols[activeSheet.sheetName] ?? []
                      ).includes(c.slug);

                      return (
                        <button
                          key={c.slug}
                          type="button"
                          className={`col-item-card${on ? " on" : ""}`}
                          onClick={() => toggleCol(activeSheet.sheetName, c.slug)}
                        >
                          <div className="col-item-top">
                            <span className="col-letter">
                              {colLetter(c.colIndex)}
                            </span>
                            <span className={`chip-type chip-${c.type}`}>
                              {TYPE_LABEL[c.type]}
                            </span>
                          </div>
                          <div className="col-item-name" title={c.rawName}>
                            {c.rawName}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="sheet-detail-empty">
                  Pilih sheet dari panel kiri untuk mengatur kolom.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
    </div>
  );
}
