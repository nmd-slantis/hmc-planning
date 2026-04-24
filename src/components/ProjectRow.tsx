"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { EditableCell } from "./EditableCell";
import { SoRelationCell } from "./SoRelationCell";
import { VISIBLE_MONTHS, hoursToFte, distributeWithOverrides, getMonthWeekdaysForProject } from "@/config/months";
import type { PlanningRow, ServiceOrder, Office } from "@/types/planning";
import { chipTextColor } from "@/lib/color";

interface ProjectRowProps {
  initialRow: PlanningRow;
  showMonths?: boolean;
  serviceOrders?: ServiceOrder[];
  linkedSos?: ServiceOrder[];
  offices?: Office[];
  onSoLink?: (newSoId: string | null, oldSoId: string | null) => void;
  onSoCreate?: (so: ServiceOrder) => void;
  onOfficeCreate?: (office: Office) => void;
  stageStyle?: React.CSSProperties;
  filterOverride?: "in" | "out" | null;
  onFilterOverrideChange?: (val: "in" | "out" | null) => void;
}

const GROUP_ROW_CLASS: Record<string, string> = {
  "Ongoing":       "bg-orange-50 border-orange-200",
  "Opportunities": "bg-amber-50 border-amber-200",
  "Canceled":      "bg-rose-50 border-rose-200 opacity-70",
  "No Dates":      "bg-white border-gray-100",
};

function fmtDate(iso: string | null) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function OdooMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true">
      <circle cx="12" cy="12" r="5.5" fill="none" stroke="white" strokeWidth="2.5" />
      <circle cx="12" cy="5.5" r="2" fill="white" />
    </svg>
  );
}

function HubSpotMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true">
      <circle cx="12" cy="12" r="3" fill="white" />
      <rect x="11" y="5.5" width="2" height="4.5" rx="1" fill="white" />
      <circle cx="12" cy="4.5" r="2.5" fill="white" />
      <line x1="14.2" y1="13.5" x2="17.5" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="19" cy="17.2" r="2.5" fill="white" />
      <line x1="9.8" y1="13.5" x2="6.5" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="5" cy="17.2" r="2.5" fill="white" />
    </svg>
  );
}

function StageCell({ stageLabel, style }: { stageLabel: string | null; style?: React.CSSProperties }) {
  if (!stageLabel) return <span className="text-gray-400">—</span>;
  return (
    <span style={style} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium">
      {stageLabel}
    </span>
  );
}

function FilterOverrideCell({ rowId, value, onChange }: {
  rowId: string;
  value: "in" | "out" | null;
  onChange: (val: "in" | "out" | null) => void;
}) {
  const cycle = async () => {
    const next = value === null ? "in" : value === "in" ? "out" : null;
    onChange(next);
    await fetch(`/api/planning/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filterOverride: next }),
    });
  };

  return (
    <button
      onClick={cycle}
      title="Toggle filter override: nothing → In → Out → nothing"
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition-colors ${
        value === "in"
          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
          : value === "out"
          ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
          : "text-gray-300 hover:text-gray-500 hover:bg-gray-100"
      }`}
    >
      {value === "in" ? "In" : value === "out" ? "Out" : "—"}
    </button>
  );
}

function OfficeRelationCell({ rowId, offices, value, onSaved, onOfficeCreate }: {
  rowId: string;
  offices: Office[];
  value: string | null;
  onSaved: (v: string | null) => void;
  onOfficeCreate?: (office: Office) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (open && !creating) setTimeout(() => searchRef.current?.focus(), 0); }, [open, creating]);
  useEffect(() => { if (creating) setTimeout(() => labelRef.current?.focus(), 0); }, [creating]);

  const filtered = offices.filter((o) =>
    !search || o.label.toLowerCase().includes(search.toLowerCase())
  );

  const openPanel = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPanelPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 200) });
    setCreating(false);
    setOpen(true);
  };

  const close = () => { setOpen(false); setSearch(""); setCreating(false); setNewLabel(""); };

  const select = async (label: string | null) => {
    onSaved(label);
    close();
    await fetch(`/api/planning/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ office: label }),
    });
  };

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/offices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() }),
      });
      if (res.ok) {
        const created = await res.json() as Office;
        onOfficeCreate?.(created);
        await select(created.label);
      }
    } finally {
      setSaving(false);
    }
  };

  const panel = open && (
    <div
      style={{ position: "fixed", top: panelPos.top, left: panelPos.left, minWidth: panelPos.width, zIndex: 200 }}
      className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
    >
      {!creating ? (
        <>
          <div className="p-2 border-b border-gray-100">
            <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search offices…"
              className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-[#FF7700]" />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {value && (
              <button onClick={() => select(null)} className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50">
                — Clear
              </button>
            )}
            {filtered.length === 0 && offices.length > 0 && (
              <div className="px-3 py-1.5 text-xs text-gray-400">No results</div>
            )}
            {filtered.map((o) => (
              <button key={o.id} onClick={() => select(o.label)}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 ${value === o.label ? "text-[#FF7700]" : "text-gray-700"}`}>
                {o.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: o.color }} />}
                <span className="w-3 flex-shrink-0 text-[10px]">{value === o.label ? "✓" : ""}</span>
                {o.label}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100 px-3 py-1.5">
            <button
              onClick={() => setCreating(true)}
              className="text-xs text-[#FF7700] hover:bg-orange-50 w-full text-left px-1 py-1 rounded flex items-center gap-1"
            >
              <span className="text-sm leading-none">+</span> New office
            </button>
          </div>
        </>
      ) : (
        <div className="p-3 flex flex-col gap-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">New Office</div>
          <input
            ref={labelRef}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
            placeholder="Office name…"
            className="text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-[#FF7700] w-full"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCreating(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !newLabel.trim()}
              className="text-xs bg-[#FF7700] text-white px-3 py-1 rounded-lg hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Create & Select"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const officeColor = value ? (offices.find((o) => o.label === value)?.color ?? null) : null;

  return (
    <>
      <button ref={triggerRef} onClick={open ? close : openPanel}
        className="w-full flex items-center gap-1 text-xs text-left group">
        {value ? (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium truncate max-w-full"
            style={officeColor
              ? { backgroundColor: officeColor, color: chipTextColor(officeColor) }
              : { backgroundColor: "#e0f2fe", color: "#0369a1" }}
          >
            {value}
          </span>
        ) : (
          <span className="flex-1 text-gray-400">—</span>
        )}
        <span className="text-gray-400 flex-shrink-0 text-[10px] group-hover:text-gray-600">▾</span>
      </button>
      {mounted && createPortal(
        <>{open && <div className="fixed inset-0 z-[199]" onMouseDown={close} />}{panel}</>,
        document.body
      )}
    </>
  );
}

function EditableSoldHrsCell({
  rowId,
  value,
  liveValue,
  isManual,
  onSaved,
}: {
  rowId: string;
  value: number | null;
  liveValue: number | null;
  isManual: boolean;
  onSaved: (v: number | null, manual: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = async () => {
    setEditing(false);
    const parsed = draft === "" ? null : parseFloat(draft);
    const v = parsed == null || isNaN(parsed) || parsed <= 0 ? null : parsed;
    if (v === value) return;
    await fetch(`/api/planning/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soldHrs: v, soldHrsManual: true }),
    });
    onSaved(v, true);
  };

  const resetToLive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/planning/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soldHrs: null, soldHrsManual: false }),
    });
    onSaved(liveValue, false);
  };

  if (editing) {
    return (
      <input
        type="number"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="outline-none bg-white border border-[#FF7700] rounded px-1 py-0.5 text-xs w-16 text-right"
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-1 group/hrs justify-end w-full">
      <button
        onClick={() => { setDraft(value != null ? String(value) : ""); setEditing(true); }}
        className={`text-right text-xs hover:text-[#FF7700] transition-colors ${isManual ? "font-bold text-gray-800" : "text-gray-800"}`}
        title={isManual ? "Manually set — click to edit" : "Click to edit"}
      >
        {value != null && value > 0 ? value : <span className="text-gray-300">—</span>}
      </button>
      {isManual && (
        <button
          onClick={resetToLive}
          className="opacity-0 group-hover/hrs:opacity-100 text-[9px] text-gray-400 hover:text-[#FF7700] transition-all leading-none"
          title="Restore live value from Odoo"
        >
          ⟳
        </button>
      )}
    </span>
  );
}

function EditableDateCell({
  rowId,
  field,
  value,
  liveDate,
  isManual,
  onSaved,
}: {
  rowId: string;
  field: "startDate" | "endDate";
  value: string | null;
  liveDate: string | null;
  isManual: boolean;
  onSaved: (v: string | null, manual: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const parseDisplay = (s: string): string | null => {
    const [m, d, y] = s.split("/");
    if (!m || !d || !y || y.length !== 4) return null;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return isNaN(Date.parse(iso)) ? null : iso;
  };

  const commit = async () => {
    setEditing(false);
    const iso = parseDisplay(draft);
    const v = iso ?? null;
    if (v === value) return;
    await fetch(`/api/planning/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: v, [`${field}Manual`]: true }),
    });
    onSaved(v, true);
  };

  const resetToLive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/planning/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: null, [`${field}Manual`]: false }),
    });
    onSaved(liveDate, false);
  };

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={draft}
        placeholder="MM/DD/YYYY"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="outline-none bg-white border border-[#FF7700] rounded px-1 py-0.5 text-xs w-24 placeholder:text-gray-300"
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-1 group/date">
      <button
        onClick={() => { setDraft(fmtDate(value) ?? ""); setEditing(true); }}
        className={`text-left text-xs text-gray-700 hover:text-[#FF7700] transition-colors whitespace-nowrap ${isManual ? "font-bold" : ""}`}
        title={isManual ? "Manually set — click to edit" : "Click to edit"}
      >
        {fmtDate(value) || <span className="text-gray-300">—</span>}
      </button>
      {isManual && (
        <button
          onClick={resetToLive}
          className="opacity-0 group-hover/date:opacity-100 text-[9px] text-gray-400 hover:text-[#FF7700] transition-all leading-none"
          title="Restore live sync from Odoo"
        >
          ⟳
        </button>
      )}
    </span>
  );
}

function ManualMonthCell({
  rowId,
  monthKey,
  hours,
  isOverridden,
  onSaved,
}: {
  rowId: string;
  monthKey: string;
  hours: number;
  isOverridden: boolean;
  onSaved: (monthKey: string, value: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = async () => {
    setEditing(false);
    const parsed = draft === "" ? null : parseFloat(draft);
    const v = parsed == null || isNaN(parsed) || parsed <= 0 ? null : parsed;
    await fetch(`/api/planning/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthKey, monthHours: v }),
    });
    onSaved(monthKey, v);
  };

  const clear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/planning/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthKey, monthHours: null }),
    });
    onSaved(monthKey, null);
  };

  if (editing) {
    return (
      <input
        type="number"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="outline-none bg-white border border-[#FF7700] rounded px-1 py-0.5 text-xs w-14 text-right"
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 group/mhrs justify-end w-full">
      <button
        onClick={() => { setDraft(hours > 0 ? String(hours) : ""); setEditing(true); }}
        className={`text-right text-xs hover:text-[#FF7700] transition-colors ${isOverridden ? "font-bold text-gray-800" : "text-gray-700"}`}
        title={isOverridden ? "Manually set — click to edit" : "Click to override"}
      >
        {hours > 0 ? hours : <span className="text-gray-200 group-hover/mhrs:text-gray-400">—</span>}
      </button>
      {isOverridden && (
        <button
          onClick={clear}
          className="opacity-0 group-hover/mhrs:opacity-100 text-[9px] text-gray-400 hover:text-[#FF7700] transition-all leading-none"
          title="Clear override — restore auto-distribution"
        >
          ⟳
        </button>
      )}
    </span>
  );
}

export function ProjectRow({ initialRow, showMonths = true, serviceOrders = [], linkedSos = [], offices = [], onSoLink, onSoCreate, onOfficeCreate, stageStyle, filterOverride, onFilterOverrideChange }: ProjectRowProps) {
  const [row, setRow] = useState<PlanningRow>(initialRow);
  const [monthlyOverrides, setMonthlyOverrides] = useState<Record<string, number>>(
    () => ({ ...(initialRow.monthlyData ?? {}) })
  );

  const updateField = <K extends keyof PlanningRow>(key: K, value: PlanningRow[K]) =>
    setRow((prev) => ({ ...prev, [key]: value }));

  const rowClass = GROUP_ROW_CLASS[row.group] ?? "bg-white border-gray-100";

  const projectedMonthly = (row.soldHrs && row.startDate && row.endDate)
    ? distributeWithOverrides(row.soldHrs, row.startDate, row.endDate, monthlyOverrides, VISIBLE_MONTHS)
    : {};

  // Per-row weekdays for FTE: hours / (weekdays in month within project dates × 8)
  const monthWeekdays = (row.startDate && row.endDate)
    ? getMonthWeekdaysForProject(row.startDate, row.endDate, VISIBLE_MONTHS)
    : {};

  return (
    <tr className={`border-b ${rowClass} hover:brightness-[0.97] transition-all text-xs`}>
      {/* Name — sticky */}
      <td className="sticky left-0 z-[1] bg-inherit px-3 py-2 font-medium border-r-2 border-gray-300">
        <span className="block truncate" title={row.name} style={{ fontFamily: "DM Sans, sans-serif" }}>
          {row.name}
        </span>
      </td>

      {/* Admin-only: HubSpot, Odoo, Stage */}
      {!showMonths && (
        <>
          <td className="px-2 py-2 text-center">
            {row.source === "hubspot" && (
              <a
                href={row.hsUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#FF7A59] hover:opacity-80 transition-opacity"
                title={row.hsUrl ? "Open Deal in HubSpot" : "HubSpot deal"}
                onClick={(e) => !row.hsUrl && e.preventDefault()}
              >
                <HubSpotMark />
              </a>
            )}
          </td>
          <td className="px-2 py-2 text-center">
            <a
              href={row.odooSoUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full transition-opacity ${
                row.odooSoUrl
                  ? "bg-[#714B67] hover:opacity-80"
                  : row.so
                  ? "bg-gray-400 cursor-default"
                  : "bg-[#714B67] opacity-30 cursor-default"
              }`}
              title={row.odooSoUrl ? "Open Sales Order in Odoo" : row.so ? "SO has no linked project" : "No Odoo Sales Order"}
              onClick={(e) => !row.odooSoUrl && e.preventDefault()}
            >
              <OdooMark />
            </a>
          </td>
          <td className="px-2 py-1">
            <StageCell stageLabel={row.hsStageLabel} style={stageStyle} />
          </td>
        </>
      )}

      {/* Both views: Start, End, Hrs, SO */}
      <td className="px-2 py-1 whitespace-nowrap">
        <EditableDateCell
          rowId={row.id}
          field="startDate"
          value={row.startDate}
          liveDate={row.startDateLive}
          isManual={row.startDateManual}
          onSaved={(v, manual) => setRow((prev) => ({ ...prev, startDate: v, startDateManual: manual }))}
        />
      </td>
      <td className="px-2 py-1 whitespace-nowrap">
        <EditableDateCell
          rowId={row.id}
          field="endDate"
          value={row.endDate}
          liveDate={row.endDateLive}
          isManual={row.endDateManual}
          onSaved={(v, manual) => setRow((prev) => ({ ...prev, endDate: v, endDateManual: manual }))}
        />
      </td>
      <td className="px-2 py-1 text-right">
        <EditableSoldHrsCell
          rowId={row.id}
          value={row.soldHrs}
          liveValue={row.soldHrsLive}
          isManual={row.soldHrsManual}
          onSaved={(v, manual) => setRow((prev) => ({ ...prev, soldHrs: v, soldHrsManual: manual }))}
        />
      </td>
      <td className="px-2 py-1 text-center text-gray-500">
        {row.so ?? ""}
      </td>

      {/* Both views: SO # (SoRelationCell) */}
      <td className="px-2 py-1 border-l border-gray-200">
        <SoRelationCell
          planningId={row.id}
          serviceOrders={serviceOrders}
          linkedSoId={linkedSos[0]?.id ?? null}
          onLink={(newSoId, oldSoId) => onSoLink?.(newSoId, oldSoId)}
          onSoCreate={onSoCreate}
        />
      </td>

      {/* Both views: Office */}
      <td className="px-2 py-1">
        <OfficeRelationCell
          rowId={row.id}
          offices={offices}
          value={row.office}
          onSaved={(v) => updateField("office", v)}
          onOfficeCreate={onOfficeCreate}
        />
      </td>

      {/* Planning-only: Comments */}
      {showMonths && (
        <td className="px-2 py-1">
          <EditableCell rowId={row.id} field="comments"
            value={row.comments} type="text"
            onSaved={(v) => updateField("comments", (v as string | null))}
            className="text-gray-700 text-xs" placeholder="…" />
        </td>
      )}

      {/* Both views: Approved */}
      <td className="px-2 py-1 text-center">
        <ApprovedCheckbox
          rowId={row.id}
          checked={row.approved}
          onChange={(v) => updateField("approved", v)}
        />
      </td>

      {/* Admin-only: Comments, Filter? */}
      {!showMonths && (
        <>
          <td className="px-2 py-1">
            <EditableCell rowId={row.id} field="comments"
              value={row.comments} type="text"
              onSaved={(v) => updateField("comments", (v as string | null))}
              className="text-gray-700 text-xs" placeholder="…" />
          </td>
          <td className="px-2 py-1 text-center">
            <FilterOverrideCell
              rowId={row.id}
              value={filterOverride ?? null}
              onChange={(val) => {
                updateField("filterOverride", val);
                onFilterOverrideChange?.(val);
              }}
            />
          </td>
        </>
      )}

      {/* Planning-only: monthly columns */}
      {showMonths && VISIBLE_MONTHS.map((month, i) => {
        const isOverridden = monthlyOverrides[month.key] != null;
        const hours = projectedMonthly[month.key] ?? 0;
        const wd = monthWeekdays[month.key] ?? 0;
        const fte = hours > 0 && wd > 0 ? hoursToFte(hours, wd * 8) : null;

        return (
          <React.Fragment key={month.key}>
            <td className={`px-1 py-1 text-right text-gray-700 ${
              i === 0
                ? "border-l-2 border-gray-300"
                : month.quarterStart
                ? "border-l-2 border-gray-300"
                : "border-l border-gray-100"
            }`}>
              <ManualMonthCell
                rowId={row.id}
                monthKey={month.key}
                hours={hours}
                isOverridden={isOverridden}
                onSaved={(key, value) => {
                  setMonthlyOverrides((prev) => {
                    const next = { ...prev };
                    if (value == null) delete next[key];
                    else next[key] = value;
                    return next;
                  });
                }}
              />
            </td>
            <td className="px-1 py-1 text-right text-gray-400 bg-gray-50/60 text-[10px]">
              {fte !== null ? fte.toFixed(1) : ""}
            </td>
          </React.Fragment>
        );
      })}
      {/* Scrollbar gutter */}
      <td className="p-0" />
    </tr>
  );
}


function ApprovedCheckbox({ rowId, checked, onChange }: {
  rowId: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const toggle = async (val: boolean) => {
    onChange(val);
    try {
      const res = await fetch(`/api/planning/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: val }),
      });
      if (!res.ok) onChange(!val);
    } catch {
      onChange(!val);
    }
  };

  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => toggle(e.target.checked)}
      className="w-4 h-4 accent-[#FF7700] cursor-pointer"
    />
  );
}
