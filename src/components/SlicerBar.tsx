import { useEffect, useRef, useState } from "react";
import ChevronIcon from "../assets/icons/chevron-left.svg?react";
import { api } from "../lib/api";
import {
  slicerIsActive,
  type DatasetColumn,
  type Slicer,
  type SlicerControl,
  type SlicerValue,
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
};

const TYPE_GROUP: { type: DatasetColumn["type"]; label: string }[] = [
  { type: "category", label: "Teks" },
  { type: "date", label: "Tanggal" },
  { type: "numeric", label: "Angka" },
];

function defaultControl(type: DatasetColumn["type"]): SlicerControl {
  return type === "date" ? "range" : "multi";
}

function ConfigPanel({
  columns,
  slicers,
  onSlicersChange,
}: {
  readonly columns: readonly DatasetColumn[];
  readonly slicers: readonly Slicer[];
  readonly onSlicersChange: (slicers: Slicer[]) => void;
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
                    {picked && type === "numeric" && (
                      <select
                        className="slicer-control-select"
                        value={picked.control}
                        aria-label={`Bentuk filter ${picked.label}`}
                        onChange={(e) =>
                          setControl(picked.id, e.target.value as SlicerControl)
                        }
                      >
                        <option value="multi">Pilih nilai</option>
                        <option value="range">Rentang</option>
                      </select>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </>
  );
}

function summarize(slicer: Slicer, value: SlicerValue | undefined): string {
  if (!slicerIsActive(slicer, value)) return slicer.label;
  if (slicer.control === "multi") {
    const picked = value?.values ?? [];
    if (picked.length === 1) return `${slicer.label}: ${picked[0]}`;
    return `${slicer.label}: ${picked.length} dipilih`;
  }
  const from = value?.from || "awal";
  const to = value?.to || "akhir";
  return `${slicer.label}: ${from} – ${to}`;
}

function MultiPanel({
  datasetId,
  slicer,
  value,
  onChange,
}: {
  readonly datasetId: string;
  readonly slicer: Slicer;
  readonly value: SlicerValue | undefined;
  readonly onChange: (value: SlicerValue) => void;
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
    onChange({ values: next });
  }

  if (error) return <p className="slicer-empty">{error}</p>;
  if (!options) return <p className="slicer-empty">Memuat nilai…</p>;
  if (options.length === 0) return <p className="slicer-empty">Kolom ini kosong.</p>;

  const shown = needle
    ? options.filter((o) => o.toLowerCase().includes(needle.toLowerCase()))
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
              <span>{option}</span>
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
          onClick={() => onChange({ values: [] })}
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
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
      </label>
      <label>
        <span>Sampai</span>
        <input
          type={inputType}
          value={value?.to ?? ""}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
        />
      </label>
      {(value?.from || value?.to) && (
        <button
          type="button"
          className="slicer-clear"
          onClick={() => onChange({ from: "", to: "" })}
        >
          Kosongkan rentang
        </button>
      )}
    </div>
  );
}

function SlicerChip({
  datasetId,
  slicer,
  columns,
  value,
  onChange,
}: {
  readonly datasetId: string;
  readonly slicer: Slicer;
  readonly columns: readonly DatasetColumn[];
  readonly value: SlicerValue | undefined;
  readonly onChange: (value: SlicerValue) => void;
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
        label={summarize(slicer, value)}
        open={open}
        active={active}
        onToggle={() => setOpen((v) => !v)}
      />

      {open && (
        <div className="slicer-panel" role="dialog" aria-label={slicer.label}>
          {slicer.control === "multi" ? (
            <MultiPanel
              datasetId={datasetId}
              slicer={slicer}
              value={value}
              onChange={onChange}
            />
          ) : (
            <RangePanel
              slicer={slicer}
              columns={columns}
              value={value}
              onChange={onChange}
            />
          )}
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
                  {slicer.control === "multi" ? (
                    <MultiPanel
                      datasetId={datasetId}
                      slicer={slicer}
                      value={selection[slicer.id]}
                      onChange={(value) => onChange(slicer.id, value)}
                    />
                  ) : (
                    <RangePanel
                      slicer={slicer}
                      columns={columns}
                      value={selection[slicer.id]}
                      onChange={(value) => onChange(slicer.id, value)}
                    />
                  )}
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
                columns={columns}
                slicers={slicers}
                onSlicersChange={onSlicersChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
