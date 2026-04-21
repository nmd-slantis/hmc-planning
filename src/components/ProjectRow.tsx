"use client";

import React, { useState } from "react";
import { EditableCell } from "./EditableCell";
import { OfficeDropdown } from "./OfficeDropdown";
import { FileUploadCell } from "./FileUploadCell";
import { SoRelationCell } from "./SoRelationCell";
import { VISIBLE_MONTHS, hoursToFte, distributeHours } from "@/config/months";
import type { PlanningRow, ServiceOrder } from "@/types/planning";

interface ProjectRowProps {
  initialRow: PlanningRow;
  showMonths?: boolean;
  serviceOrders?: ServiceOrder[];
  linkedSos?: ServiceOrder[];
  onSoLink?: (newSoId: string | null, oldSoId: string | null) => void;
}

const GROUP_ROW_CLASS: Record<string, string> = {
  "Ongoing":          "bg-blue-100 border-blue-200",
  "Service Pipeline": "bg-orange-100 border-orange-200",
  "To-Do":            "bg-slate-100 border-slate-200",
  "Sales Pipeline":   "bg-amber-100 border-amber-200",
  "Closed Won":       "bg-emerald-100 border-emerald-200",
  "Completed":        "bg-green-100 border-green-200",
  "Closed Lost":      "bg-rose-50 border-rose-200 opacity-70",
  "No Dates":         "bg-white border-gray-100",
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

const HS_STAGE_MAP: Record<string, { label: string; cls: string }> = {
  closedwon:                { label: "Closed Won",    cls: "bg-emerald-100 text-emerald-700" },
  "969753704":              { label: "Closed Won",    cls: "bg-emerald-100 text-emerald-700" },
  closedlost:               { label: "Closed Lost",   cls: "bg-rose-100 text-rose-600"       },
  appointmentscheduled:     { label: "Scheduled",     cls: "bg-blue-100 text-blue-700"       },
  qualifiedtobuy:           { label: "Qualified",     cls: "bg-blue-100 text-blue-700"       },
  presentationscheduled:    { label: "Presentation",  cls: "bg-violet-100 text-violet-700"   },
  decisionmakerboughtin:    { label: "Decision Maker",cls: "bg-violet-100 text-violet-700"   },
  contractsent:             { label: "Contract Sent", cls: "bg-amber-100 text-amber-700"     },
};

function StageCell({ stageId }: { stageId: string | null }) {
  if (!stageId) return <span className="text-gray-400">—</span>;
  const entry = HS_STAGE_MAP[stageId];
  if (entry) {
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${entry.cls}`}>
        {entry.label}
      </span>
    );
  }
  return <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">{stageId}</span>;
}

function EditableDateCell({
  rowId,
  field,
  value,
  isManual,
  onSaved,
}: {
  rowId: string;
  field: "startDate" | "endDate";
  value: string | null;
  isManual: boolean;
  onSaved: (v: string | null, manual: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  const commit = async () => {
    setEditing(false);
    const v = draft || null;
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
    // Reload so the server re-seeds the live date
    window.location.reload();
  };

  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
        }}
        className="outline-none bg-white border border-[#FF7700] rounded px-1 py-0.5 text-xs w-28"
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-1 group/date">
      <button
        onClick={() => { setDraft(value ?? ""); setEditing(true); }}
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

export function ProjectRow({ initialRow, showMonths = true, serviceOrders = [], linkedSos = [], onSoLink }: ProjectRowProps) {
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
                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#FF7A59] hover:opacity-80 transition-opacity"
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
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition-opacity ${
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
            <StageCell stageId={row.hsStage} />
          </td>
        </>
      )}

      {/* Both views: Start, End, Effort Hrs, SO */}
      <td className="px-2 py-1 whitespace-nowrap">
        <EditableDateCell
          rowId={row.id}
          field="startDate"
          value={row.startDate}
          isManual={row.startDateManual}
          onSaved={(v, manual) => setRow((prev) => ({ ...prev, startDate: v, startDateManual: manual }))}
        />
      </td>
      <td className="px-2 py-1 whitespace-nowrap">
        <EditableDateCell
          rowId={row.id}
          field="endDate"
          value={row.endDate}
          isManual={row.endDateManual}
          onSaved={(v, manual) => setRow((prev) => ({ ...prev, endDate: v, endDateManual: manual }))}
        />
      </td>
      <td className="px-2 py-1 text-right text-gray-800">
        {row.soldHrs != null && row.soldHrs > 0 ? row.soldHrs : ""}
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

      {/* Both views: Comments, Approved */}
      <td className="px-2 py-1">
        <EditableCell rowId={row.id} field="comments"
          value={row.comments} type="text"
          onSaved={(v) => updateField("comments", (v as string | null))}
          className="text-gray-700 text-xs" placeholder="…" />
      </td>
      <td className="px-2 py-1 text-center">
        <ApprovedCheckbox
          rowId={row.id}
          checked={row.approved}
          onChange={(v) => updateField("approved", v)}
        />
      </td>

      {/* Admin-only: Office (after Approved) */}
      {!showMonths && (
        <td className="px-2 py-1">
          <OfficeDropdown
            rowId={row.id}
            value={row.office}
            onSaved={(v) => updateField("office", v)}
          />
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
