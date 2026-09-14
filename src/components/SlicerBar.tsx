import { useEffect, useRef, useState } from "react";
import ChevronIcon from "../assets/icons/chevron-left.svg?react";
import { api } from "../lib/api";
import {
  labelForValue,
  slicerIsActive,
  slicerMode,
  type DatasetColumn,
  type Slicer,
  type SlicerControl,
  type SlicerMode,
  type SlicerValue,
  type ValueLabelMap,
} from "../types";

const VISIBLE_LIMIT = 3;

function ChipButton({
  label,
  open,
  active = false,
  onToggle,
}: {
  readonly label: string;
  readonly open: boolean;
  readonly active?: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`slicer-chip${active ? " is-active" : ""}`}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={onToggle}
    >
      <span className="slicer-chip-label">{label}</span>
      <ChevronIcon
        className={`slicer-chip-icon${open ? " is-open" : ""}`}
        width={12}
        height={12}
        aria-hidden="true"
      />
    </button>
  );
}

type SlicerBarProps = {
  readonly datasetId: string;
  readonly slicers: readonly Slicer[];
  readonly columns: readonly DatasetColumn[];
  readonly selection: Record<string, SlicerValue>;
  readonly onChange: (id: string, value: SlicerValue) => void;
  readonly onReset: () => void;
  readonly editing: boolean;
  readonly onSlicersChange: (slicers: Slicer[]) => void;
  readonly valueLabels: ValueLabelMap | null;
  readonly onValueLabelsChange: (labels: ValueLabelMap) => void;
};

const TYPE_GROUP: { type: DatasetColumn["type"]; label: string }[] = [
  { type: "category", label: "Teks" },
  { type: "date", label: "Tanggal" },
  { type: "numeric", label: "Angka" },
];

function defaultControl(type: DatasetColumn["type"]): SlicerControl {
  return type === "category" ? "multi" : "both";
}

const CONTROL_LABEL: Record<SlicerControl, string> = {
  multi: "Pilih nilai",
  range: "Rentang",
  both: "Rentang + pilih nilai",
};

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function monthPreset(values: readonly string[]): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const raw of values) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 12) return null;
    out[raw] = MONTH_NAMES[n - 1];
  }
  return Object.keys(out).length > 0 ? out : null;
}

function ConfigPanel({
  datasetId,
  columns,
  slicers,
  onSlicersChange,
  valueLabels,
  onValueLabelsChange,
}: {
  readonly datasetId: string;
  readonly columns: readonly DatasetColumn[];
  readonly slicers: readonly Slicer[];
  readonly onSlicersChange: (slicers: Slicer[]) => void;
  readonly valueLabels: ValueLabelMap | null;
  readonly onValueLabelsChange: (labels: ValueLabelMap) => void;
}) {
  function toggle(column: DatasetColumn) {
    const existing = slicers.find((s) => s.column === column.name);
    if (existing) {
      onSlicersChange(slicers.filter((s) => s.id !== existing.id));
      return;
    }
    onSlicersChange([
      ...slicers,
      {
        id: crypto.randomUUID(),
        column: column.name,
        label: column.label || column.name,
        control: defaultControl(column.type),
      },
    ]);
  }

  function setControl(id: string, control: SlicerControl) {
    onSlicersChange(slicers.map((s) => (s.id === id ? { ...s, control } : s)));
  }

  return (
    <>
      <p className="slicer-note">
        Filter yang dicentang berlaku untuk semua widget. Tiga pertama tampil di
        header, sisanya masuk tombol tambahan.
      </p>

      {TYPE_GROUP.map(({ type, label }) => {
        const group = columns.filter((c) => c.type === type);
        if (group.length === 0) return null;

        return (
          <div key={type} className="slicer-stacked">
            <p className="slicer-stacked-label">{label}</p>
            <ul className="slicer-options">
              {group.map((column) => {
                const picked = slicers.find((s) => s.column === column.name);
                return (
                  <li key={column.name}>
                    <label>
                      <input
                        type="checkbox"
                        checked={picked !== undefined}
                        onChange={() => toggle(column)}
                      />
                      <span>{column.label || column.name}</span>
                    </label>
                    {picked && type !== "category" && (
                      <select
                        className="slicer-control-select"
                        value={picked.control}
                        aria-label={`Bentuk filter ${picked.label}`}
                        onChange={(e) =>
                          setControl(picked.id, e.target.value as SlicerControl)
                        }
                      >
                        <option value="both">{CONTROL_LABEL.both}</option>
                        <option value="range">{CONTROL_LABEL.range}</option>
                        <option value="multi">{CONTROL_LABEL.multi}</option>
                      </select>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <ValueLabelEditor
        datasetId={datasetId}
        columns={columns}
        valueLabels={valueLabels}
        onValueLabelsChange={onValueLabelsChange}
      />
    </>
  );
}

function ValueLabelEditor({
  datasetId,
  columns,
  valueLabels,
  onValueLabelsChange,
}: {
  readonly datasetId: string;
  readonly columns: readonly DatasetColumn[];
  readonly valueLabels: ValueLabelMap | null;
  readonly onValueLabelsChange: (labels: ValueLabelMap) => void;
}) {
  const [column, setColumn] = useState("");
  const [options, setOptions] = useState<string[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!column) {
      setOptions(null);
      return;
    }
    let active = true;
    setOptions(null);
    setError(null);
    setDraft({ ...(valueLabels?.[column] ?? {}) });
    api
      .columnValues(datasetId, column)
      .then((res) => {
        if (!active) return;
        setOptions(res.values);
        setTruncated(res.truncated);
      })
      .catch((e) => active && setError(String(e)));
    return () => {
      active = false;
    };
  }, [datasetId, column]);

  function commit(next: Record<string, string>) {
    const cleaned: Record<string, string> = {};
    for (const [raw, text] of Object.entries(next)) {
      if (text.trim()) cleaned[raw] = text.trim();
    }
    const map: ValueLabelMap = { ...(valueLabels ?? {}) };
    if (Object.keys(cleaned).length === 0) delete map[column];
    else map[column] = cleaned;
    onValueLabelsChange(map);
  }

  const preset = options ? monthPreset(options) : null;
  const dirty =
    column !== "" &&
    JSON.stringify(draft) !== JSON.stringify(valueLabels?.[column] ?? {});

  return (
    <div className="slicer-stacked">
      <p className="slicer-stacked-label">Nama tampilan nilai</p>
      <p className="slicer-note">
        Mengganti tampilan saja. Isi di database dan Excel tidak berubah.
      </p>

      <select
        className="slicer-control-select is-block"
        value={column}
        aria-label="Kolom yang namanya diganti"
        onChange={(e) => setColumn(e.target.value)}
      >
        <option value="">Pilih kolom…</option>
        {columns.map((c) => (
          <option key={c.name} value={c.name}>
            {c.label || c.name}
            {valueLabels?.[c.name] ? " ✓" : ""}
          </option>
        ))}
      </select>

      {error && <p className="slicer-empty">{error}</p>}
      {column && !options && !error && <p className="slicer-empty">Memuat nilai…</p>}
      {options?.length === 0 && <p className="slicer-empty">Kolom ini kosong.</p>}

      {options && options.length > 0 && (
        <>
          {truncated ? (
            <p className="slicer-note">
              Kolom ini punya lebih dari 200 nilai unik, terlalu banyak untuk
              diberi nama satu per satu.
            </p>
          ) : (
            <>
              {preset && (
                <button
                  type="button"
                  className="slicer-clear"
                  onClick={() => setDraft(preset)}
                >
                  Isi nama bulan
                </button>
              )}

              <ul className="slicer-labels">
                {options.map((raw) => (
                  <li key={raw}>
                    <span className="slicer-label-raw" title={raw}>
                      {raw}
                    </span>
                    <input
                      type="text"
                      value={draft[raw] ?? ""}
                      placeholder={raw}
                      aria-label={`Nama tampilan untuk ${raw}`}
                      onChange={(e) =>
                        setDraft({ ...draft, [raw]: e.target.value })
                      }
                    />
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="slicer-save"
                disabled={!dirty}
                onClick={() => commit(draft)}
              >
                Simpan nama
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

function summarize(
  slicer: Slicer,
  value: SlicerValue | undefined,
  labels: ValueLabelMap | null | undefined
): string {
  if (!slicerIsActive(slicer, value)) return slicer.label;
  if (slicerMode(slicer, value) === "multi") {
    const picked = value?.values ?? [];
    if (picked.length === 1) {
      return `${slicer.label}: ${labelForValue(labels, slicer.column, picked[0])}`;
    }
    return `${slicer.label}: ${picked.length} dipilih`;
  }
  const from = value?.from
    ? labelForValue(labels, slicer.column, value.from)
    : "awal";
  const to = value?.to ? labelForValue(labels, slicer.column, value.to) : "akhir";
  return `${slicer.label}: ${from} – ${to}`;
}

function MultiPanel({
  datasetId,
  slicer,
  value,
  onChange,
  valueLabels,
}: {
  readonly datasetId: string;
  readonly slicer: Slicer;
  readonly value: SlicerValue | undefined;
  readonly onChange: (value: SlicerValue) => void;
  readonly valueLabels?: ValueLabelMap | null;
}) {
  const [options, setOptions] = useState<string[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needle, setNeedle] = useState("");

  useEffect(() => {
    let active = true;
    api
      .columnValues(datasetId, slicer.column)
      .then((res) => {
        if (!active) return;
        setOptions(res.values);
        setTruncated(res.truncated);
      })
      .catch((e) => active && setError(String(e)));
    return () => {
      active = false;
    };
  }, [datasetId, slicer.column]);

  const picked = value?.values ?? [];

  function toggle(option: string) {
    const next = picked.includes(option)
      ? picked.filter((v) => v !== option)
      : [...picked, option];
    onChange({ ...value, mode: "multi", values: next });
  }

  const show = (raw: string) => labelForValue(valueLabels, slicer.column, raw);

  if (error) return <p className="slicer-empty">{error}</p>;
  if (!options) return <p className="slicer-empty">Memuat nilai…</p>;
  if (options.length === 0) return <p className="slicer-empty">Kolom ini kosong.</p>;

  const lowered = needle.toLowerCase();
  const shown = needle
    ? options.filter(
        (o) =>
          o.toLowerCase().includes(lowered) ||
          show(o).toLowerCase().includes(lowered)
      )
    : options;

  return (
    <>
      {options.length > 8 && (
        <input
          className="slicer-search"
          type="search"
          value={needle}
          placeholder="Cari nilai"
          aria-label={`Cari nilai ${slicer.label}`}
          onChange={(e) => setNeedle(e.target.value)}
        />
      )}

      <ul className="slicer-options">
        {shown.map((option) => (
          <li key={option}>
            <label>
              <input
                type="checkbox"
                checked={picked.includes(option)}
                onChange={() => toggle(option)}
              />
              <span>{show(option)}</span>
            </label>
          </li>
        ))}
      </ul>

      {shown.length === 0 && <p className="slicer-empty">Tidak ada yang cocok.</p>}
      {truncated && (
        <p className="slicer-note">
          Hanya 200 nilai pertama yang ditampilkan. Pakai pencarian untuk mempersempit.
        </p>
      )}
      {picked.length > 0 && (
        <button
          type="button"
          className="slicer-clear"
          onClick={() => onChange({ ...value, mode: "multi", values: [] })}
        >
          Kosongkan pilihan
        </button>
      )}
    </>
  );
}

function RangePanel({
  slicer,
  columns,
  value,
  onChange,
}: {
  readonly slicer: Slicer;
  readonly columns: readonly DatasetColumn[];
  readonly value: SlicerValue | undefined;
  readonly onChange: (value: SlicerValue) => void;
}) {
  const kind = columns.find((c) => c.name === slicer.column)?.type;
  const inputType = kind === "date" ? "date" : "number";

  return (
    <div className="slicer-range">
      <label>
        <span>Dari</span>
        <input
          type={inputType}
          value={value?.from ?? ""}
          onChange={(e) =>
            onChange({ ...value, mode: "range", from: e.target.value })
          }
        />
      </label>
      <label>
        <span>Sampai</span>
        <input
          type={inputType}
          value={value?.to ?? ""}
          onChange={(e) =>
            onChange({ ...value, mode: "range", to: e.target.value })
          }
        />
      </label>
      {(value?.from || value?.to) && (
        <button
          type="button"
          className="slicer-clear"
          onClick={() => onChange({ ...value, mode: "range", from: "", to: "" })}
        >
          Kosongkan rentang
        </button>
      )}
    </div>
  );
}

function SlicerPanel({
  datasetId,
  slicer,
  columns,
  value,
  onChange,
  valueLabels,
}: {
  readonly datasetId: string;
  readonly slicer: Slicer;
  readonly columns: readonly DatasetColumn[];
  readonly value: SlicerValue | undefined;
  readonly onChange: (value: SlicerValue) => void;
  readonly valueLabels?: ValueLabelMap | null;
}) {
  const kind = columns.find((c) => c.name === slicer.column)?.type;
  const mode =
    slicer.control === "both" && !value?.mode && !value?.values?.length
      ? (kind === "date" ? "range" : "multi")
      : slicerMode(slicer, value);

  function setMode(next: SlicerMode) {
    if (next !== mode) onChange({ ...value, mode: next });
  }

  return (
    <>
      {slicer.control === "both" && (
        <div className="slicer-modes" role="group" aria-label="Bentuk filter">
          {(["range", "multi"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`slicer-mode${mode === option ? " is-on" : ""}`}
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
            >
              {CONTROL_LABEL[option]}
            </button>
          ))}
        </div>
      )}

      {mode === "multi" ? (
        <MultiPanel
          datasetId={datasetId}
          slicer={slicer}
          value={value}
          onChange={onChange}
          valueLabels={valueLabels}
        />
      ) : (
        <RangePanel
          slicer={slicer}
          columns={columns}
          value={value}
          onChange={onChange}
        />
      )}
    </>
  );
}

function SlicerChip({
  datasetId,
  slicer,
  columns,
  value,
  onChange,
  valueLabels,
}: {
  readonly datasetId: string;
  readonly slicer: Slicer;
  readonly columns: readonly DatasetColumn[];
  readonly value: SlicerValue | undefined;
  readonly onChange: (value: SlicerValue) => void;
  readonly valueLabels?: ValueLabelMap | null;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const active = slicerIsActive(slicer, value);

  return (
    <div className="slicer-chip-wrap" ref={wrapRef}>
      <ChipButton
        label={summarize(slicer, value, valueLabels)}
        open={open}
        active={active}
        onToggle={() => setOpen((v) => !v)}
      />

      {open && (
        <div className="slicer-panel" role="dialog" aria-label={slicer.label}>
          <SlicerPanel
            datasetId={datasetId}
            slicer={slicer}
            columns={columns}
            value={value}
            onChange={onChange}
            valueLabels={valueLabels}
          />
        </div>
      )}
    </div>
  );
}

export default function SlicerBar({
  datasetId,
  slicers,
  columns,
  selection,
  onChange,
  onReset,
  editing,
  onSlicersChange,
  valueLabels,
  onValueLabelsChange,
}: SlicerBarProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  const configRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!configOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!configRef.current?.contains(e.target as Node)) setConfigOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setConfigOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [configOpen]);

  useEffect(() => {
    if (!overflowOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!overflowRef.current?.contains(e.target as Node)) setOverflowOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOverflowOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [overflowOpen]);

  if (slicers.length === 0 && !editing) return null;

  const visible = slicers.slice(0, VISIBLE_LIMIT);
  const hidden = slicers.slice(VISIBLE_LIMIT);
  const hiddenActive = hidden.filter((s) => slicerIsActive(s, selection[s.id])).length;
  const anyActive = slicers.some((s) => slicerIsActive(s, selection[s.id]));

  return (
    <div className="slicer-bar">
      {visible.map((slicer) => (
        <SlicerChip
          key={slicer.id}
          datasetId={datasetId}
          slicer={slicer}
          columns={columns}
          value={selection[slicer.id]}
          onChange={(value) => onChange(slicer.id, value)}
          valueLabels={valueLabels}
        />
      ))}

      {hidden.length > 0 && (
        <div className="slicer-chip-wrap" ref={overflowRef}>
          <ChipButton
            label={
              hiddenActive > 0
                ? `+${hidden.length} filter · ${hiddenActive} aktif`
                : `+${hidden.length} filter`
            }
            open={overflowOpen}
            active={hiddenActive > 0}
            onToggle={() => setOverflowOpen((v) => !v)}
          />

          {overflowOpen && (
            <div className="slicer-panel is-wide" role="dialog" aria-label="Filter lainnya">
              {hidden.map((slicer) => (
                <div key={slicer.id} className="slicer-stacked">
                  <p className="slicer-stacked-label">{slicer.label}</p>
                  <SlicerPanel
                    datasetId={datasetId}
                    slicer={slicer}
                    columns={columns}
                    value={selection[slicer.id]}
                    onChange={(value) => onChange(slicer.id, value)}
                    valueLabels={valueLabels}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {anyActive && (
        <button type="button" className="slicer-reset" onClick={onReset}>
          Reset
        </button>
      )}

      {editing && (
        <div className="slicer-chip-wrap" ref={configRef}>
          <ChipButton
            label="Atur filter"
            open={configOpen}
            onToggle={() => setConfigOpen((v) => !v)}
          />

          {configOpen && (
            <div className="slicer-panel is-wide" role="dialog" aria-label="Atur filter">
              <ConfigPanel
                datasetId={datasetId}
                columns={columns}
                slicers={slicers}
                onSlicersChange={onSlicersChange}
                valueLabels={valueLabels}
                onValueLabelsChange={onValueLabelsChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
