"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { EditableCell } from "./EditableCell";
import { FileUploadCell } from "./FileUploadCell";
import { SoRelationCell } from "./SoRelationCell";
import { VISIBLE_MONTHS, hoursToFte, distributeHours } from "@/config/months";
import type { PlanningRow, ServiceOrder, Office } from "@/types/planning";
import { chipTextColor } from "@/lib/color";

interface ProjectRowProps {
  initialRow: PlanningRow;
  showMonths?: boolean;
  serviceOrders?: ServiceOrder[];
  linkedSos?: ServiceOrder[];
  offices?: Office[];
  onSoLink?: (newSoId: string | null, oldSoId: string | null) => void;
  stageStyle?: React.CSSProperties;
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

function OfficeRelationCell({ rowId, offices, value, onSaved }: {
  rowId: string;
  offices: Office[];
  value: string | null;
  onSaved: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (open) setTimeout(() => searchRef.current?.focus(), 0); }, [open]);

  const filtered = offices.filter((o) =>
    !search || o.label.toLowerCase().includes(search.toLowerCase())
  );

  const openPanel = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPanelPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 200) });
    setOpen(true);
  };

  const close = () => { setOpen(false); setSearch(""); };

  const select = async (label: string | null) => {
    onSaved(label);
    close();
    await fetch(`/api/planning/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ office: label }),
    });
  };

  const panel = open && (
    <div
      style={{ position: "fixed", top: panelPos.top, left: panelPos.left, minWidth: panelPos.width, zIndex: 200 }}
      className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
    >
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
        {filtered.length === 0 && (
          <div className="px-3 py-1.5 text-xs text-gray-400">{offices.length === 0 ? "No offices yet" : "No results"}</div>
        )}
        {filtered.map((o) => (
          <button key={o.id} onClick={() => select(o.label)}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 ${value === o.label ? "text-[#FF7700]" : "text-gray-700"}`}>
            <span className="w-3 flex-shrink-0 text-[10px]">{value === o.label ? "✓" : ""}</span>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* look up color for the selected office */}
      {(() => {
        const officeColor = value ? (offices.find((o) => o.label === value)?.color ?? null) : null;
        return (
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
        );
      })()}
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

  // Parse MM/DD/YYYY → YYYY-MM-DD; returns null if invalid
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

export function ProjectRow({ initialRow, showMonths = true, serviceOrders = [], linkedSos = [], offices = [], onSoLink, stageStyle }: ProjectRowProps) {
  const [row, setRow] = useState<PlanningRow>(initialRow);

  const updateField = <K extends keyof PlanningRow>(key: K, value: PlanningRow[K]) =>
    setRow((prev) => ({ ...prev, [key]: value }));

  const rowClass = GROUP_ROW_CLASS[row.group] ?? "bg-white border-gray-100";

  const projectedMonthly = (row.soldHrs && row.startDate && row.endDate)
    ? distributeHours(row.soldHrs, row.startDate, row.endDate, VISIBLE_MONTHS)
    : {};

  return (
    <tr className={`border-b ${rowClass} hover:brightness-[0.97] transition-all text-xs`}>
      {/* Name — sticky */}
      <td className="sticky left-0 z-[1] bg-inherit px-3 py-2 font-medium border-r-2 border-gray-300">
        <span className="block truncate" title={row.name} style={{ fontFamily: "DM Sans, sans-serif" }}>
          {row.name}
        </span>
      </td>

      {/* Admin-only: HubSpot, Odoo, DocuSign */}
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

      {/* Both views: Start, End, Effort Hrs, SO */}
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

      {/* Admin-only: SO # and Confirmation (between SO and Comments) */}
      {!showMonths && (
        <>
          <td className="px-2 py-1 border-l border-gray-200">
            <SoRelationCell
              planningId={row.id}
              serviceOrders={serviceOrders}
              linkedSoId={linkedSos[0]?.id ?? null}
              onLink={(newSoId, oldSoId) => onSoLink?.(newSoId, oldSoId)}
            />
          </td>
          <td className="px-2 py-1">
            <FileUploadCell
              rowId={row.id}
              fileUrl={row.serviceOrderFileUrl}
              fileName={row.serviceOrderFileName}
              onSaved={(url, name) => {
                updateField("serviceOrderFileUrl", url);
                updateField("serviceOrderFileName", name);
              }}
            />
          </td>
        </>
      )}

      {/* Planning-only: Comments (in Details tab it moves to the end) */}
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

      {/* Admin-only: Office */}
      {!showMonths && (
        <td className="px-2 py-1">
          <OfficeRelationCell
            rowId={row.id}
            offices={offices}
            value={row.office}
            onSaved={(v) => updateField("office", v)}
          />
        </td>
      )}

      {/* Admin-only: Comments (at end in Details tab) */}
      {!showMonths && (
        <td className="px-2 py-1">
          <EditableCell rowId={row.id} field="comments"
            value={row.comments} type="text"
            onSaved={(v) => updateField("comments", (v as string | null))}
            className="text-gray-700 text-xs" placeholder="…" />
        </td>
      )}

      {/* Planning-only: monthly columns */}
      {showMonths && VISIBLE_MONTHS.map((month, i) => {
        const hours = projectedMonthly[month.key] ?? 0;
        const fte = hours > 0 ? hoursToFte(hours, month.workdayHours) : null;

        return (
          <React.Fragment key={month.key}>
            <td className={`px-1 py-1 text-right text-gray-700 ${
              i === 0
                ? "border-l-2 border-gray-300"
                : month.quarterStart
                ? "border-l-2 border-gray-300"
                : "border-l border-gray-100"
            }`}>
              {hours > 0 ? hours : ""}
            </td>
            <td className="px-1 py-1 text-right text-gray-400 bg-gray-50/60 text-[10px]">
              {fte !== null ? fte.toFixed(1) : ""}
            </td>
          </React.Fragment>
        );
      })}
      {/* Scrollbar gutter — absorbs header/body width diff when vertical scroll appears */}
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
