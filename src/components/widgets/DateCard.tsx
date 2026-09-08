import { useEffect, useState } from "react";
import type { DateMode } from "../../types";
import { formatCount } from "../../lib/format";

export type DateCardProps = {
  readonly label: string;
  readonly mode: DateMode;
  readonly targetDate?: string;
  readonly sinceDate?: string | null;
};

const MS_PER_DAY = 86_400_000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

function endOfQuarter(today: Date) {
  const quarter = Math.floor(today.getMonth() / 3);
  return new Date(today.getFullYear(), quarter * 3 + 3, 0);
}

type Reading = {
  value: number | null;
  unit: string;
  caption: string;
  ratio?: number;
};

function read(mode: DateMode, targetDate?: string, sinceDate?: string | null): Reading {
  const today = new Date();

  if (mode === "yearRemaining") {
    const end = new Date(today.getFullYear(), 11, 31);
    const start = new Date(today.getFullYear(), 0, 1);
    const total = daysBetween(start, end) + 1;
    const left = daysBetween(today, end);
    return {
      value: left,
      unit: "hari",
      caption: `${Math.round(((total - left) / total) * 100)}% tahun ${today.getFullYear()} berjalan`,
      ratio: (total - left) / total,
    };
  }

  if (mode === "quarterRemaining") {
    const end = endOfQuarter(today);
    const quarter = Math.floor(today.getMonth() / 3);
    const start = new Date(today.getFullYear(), quarter * 3, 1);
    const total = daysBetween(start, end) + 1;
    const left = daysBetween(today, end);
    return {
      value: left,
      unit: "hari",
      caption: `Kuartal ${quarter + 1} berakhir ${end.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      })}`,
      ratio: (total - left) / total,
    };
  }

  if (mode === "untilDate") {
    if (!targetDate) {
      return { value: null, unit: "", caption: "Tanggal target belum diatur" };
    }
    const target = new Date(`${targetDate}T00:00:00`);
    if (Number.isNaN(target.getTime())) {
      return { value: null, unit: "", caption: "Tanggal target tidak valid" };
    }
    const left = daysBetween(today, target);
    const formatted = target.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (left < 0) {
      return { value: Math.abs(left), unit: "hari", caption: `Lewat dari ${formatted}` };
    }
    return { value: left, unit: "hari", caption: `Menuju ${formatted}` };
  }

  if (!sinceDate) {
    return { value: null, unit: "", caption: "Belum ada tanggal tercatat" };
  }
  const last = new Date(`${sinceDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(last.getTime())) {
    return { value: null, unit: "", caption: "Tanggal terakhir tidak terbaca" };
  }
  return {
    value: daysBetween(last, today),
    unit: "hari",
    caption: `Terakhir ${last.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`,
  };
}

function useCurrentDay() {
  const [day, setDay] = useState(() => new Date().toDateString());

  useEffect(() => {
    const sync = () => {
      const next = new Date().toDateString();
      setDay((current) => (current === next ? current : next));
    };

    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(sync, midnight.getTime() - now.getTime() + 1000);
    document.addEventListener("visibilitychange", sync);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [day]);

  return day;
}

export default function DateCard({ label, mode, targetDate, sinceDate }: DateCardProps) {
  useCurrentDay();
  const reading = read(mode, targetDate, sinceDate);

  return (
    <div className="kpi-wrapper">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {reading.value === null ? "—" : formatCount(reading.value)}
        {reading.unit && <span className="kpi-unit"> {reading.unit}</span>}
      </div>

      {reading.ratio !== undefined && (
        <div className="kpi-meter" aria-hidden="true">
          <span
            className="kpi-meter-fill"
            style={{ width: `${Math.min(Math.max(reading.ratio, 0), 1) * 100}%` }}
          />
        </div>
      )}

      <div className="kpi-caption">{reading.caption}</div>
    </div>
  );
}
