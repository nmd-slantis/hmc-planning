"use client";

import React, { useState } from "react";
import { EditableCell } from "./EditableCell";
import { VISIBLE_MONTHS, hoursToFte } from "@/config/months";
import type { PlanningRow } from "@/types/planning";

interface ProjectRowProps {
  initialRow: PlanningRow;
}

// Row background + border keyed by group label
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

/** Odoo "O" mark — simplified Odoo icon */
function OdooMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true">
      <circle cx="12" cy="12" r="5.5" fill="none" stroke="white" strokeWidth="2.5" />
      <circle cx="12" cy="5.5" r="2" fill="white" />
    </svg>
  );
}

/** HubSpot sprocket mark — simplified 3-arm connected-circles logo */
function HubSpotMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true">
      {/* Center */}
      <circle cx="12" cy="12" r="3" fill="white" />
      {/* Top arm */}
      <rect x="11" y="5.5" width="2" height="4.5" rx="1" fill="white" />
      <circle cx="12" cy="4.5" r="2.5" fill="white" />
      {/* Bottom-right arm */}
      <line x1="14.2" y1="13.5" x2="17.5" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="19" cy="17.2" r="2.5" fill="white" />
      {/* Bottom-left arm */}
      <line x1="9.8" y1="13.5" x2="6.5" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="5" cy="17.2" r="2.5" fill="white" />
    </svg>
  );
}

function effortDot(effortHrs: number, soldHrs: number | null): React.ReactNode {
  if (soldHrs === null || soldHrs === 0) return null;
  const ratio = Math.abs(effortHrs - soldHrs) / soldHrs;
  let color: string;
  if (ratio <= 0.05) color = "bg-green-500";
  else if (ratio <= 0.15) color = "bg-yellow-400";
  else color = "bg-red-500";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color} mr-1 flex-shrink-0`} />;
}

export function ProjectRow({ initialRow }: ProjectRowProps) {
  const [row, setRow] = useState<PlanningRow>(initialRow);

  const updateField = <K extends keyof PlanningRow>(key: K, value: PlanningRow[K]) =>
    setRow((prev) => ({ ...prev, [key]: value }));

  const updateMonthHours = (monthKey: string, hours: number | null) =>
    setRow((prev) => ({
      ...prev,
      monthlyData: { ...prev.monthlyData, [monthKey]: hours ?? 0 },
    }));

  const rowClass = GROUP_ROW_CLASS[row.group] ?? "bg-white border-gray-100";

  // Compute total effort hours from monthly data
  const effortHrs = Object.values(row.monthlyData).reduce(
    (sum, h) => sum + (h || 0),
    0
  );

  return (
    <tr className={`border-b ${rowClass} hover:brightness-[0.97] transition-all text-xs`}>
      {/* Name */}
      <td className="px-3 py-2 font-medium border-r-2 border-gray-300">
        <span className="block truncate" title={row.name} style={{ fontFamily: "DM Sans, sans-serif" }}>
          {row.name}
        </span>
      </td>

      {/* HubSpot link */}
      <td className="px-2 py-2 text-center">
        {row.source === "hubspot" && (
          <a
            href={row.hsUrl ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#FF7A59] hover:opacity-80 transition-opacity"
            title={row.hsUrl ? "Open in HubSpot" : "HubSpot deal"}
            onClick={(e) => !row.hsUrl && e.preventDefault()}
          >
            <HubSpotMark />
          </a>
        )}
      </td>

      {/* Odoo SO link */}
      <td className="px-2 py-2 text-center">
        {row.odooSoUrl ? (
          <a
            href={row.odooSoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#714B67] hover:opacity-80 transition-opacity"
            title="Open Sales Order in Odoo"
          >
            <OdooMark />
          </a>
        ) : null}
      </td>

      {/* Start date — editable for ALL rows */}
      <td className="px-2 py-1 whitespace-nowrap">
        <EditableCell rowId={row.id} field="startDate" value={row.startDate} type="date"
          onSaved={(v) => updateField("startDate", v as string | null)} className="text-gray-700" />
      </td>

      {/* End date — editable for ALL rows */}
      <td className="px-2 py-1 whitespace-nowrap">
        <EditableCell rowId={row.id} field="endDate" value={row.endDate} type="date"
          onSaved={(v) => updateField("endDate", v as string | null)} className="text-gray-700" />
      </td>

      {/* Sold Hrs — editable */}
      <td className="px-2 py-1 text-right">
        <EditableCell rowId={row.id} field="soldHrs" value={row.soldHrs} type="number"
          onSaved={(v) => updateField("soldHrs", v as number | null)}
          className="text-right text-gray-800" placeholder="" />
      </td>

      {/* Effort Hrs — computed, read-only */}
      <td className="px-2 py-1 text-right">
        <div className="flex items-center justify-end">
          <span className="text-gray-800">
            {effortHrs > 0 ? effortHrs : ""}
          </span>
          {effortDot(effortHrs, row.soldHrs)}
        </div>
      </td>

      {/* SO */}
      <td className="px-2 py-1 text-center text-gray-500 border-r-2 border-gray-200">
        {row.so ?? ""}
      </td>

      {/* Monthly columns */}
      {VISIBLE_MONTHS.map((month, i) => {
        const hours = row.monthlyData[month.key] ?? 0;
        const fte = hours > 0 ? hoursToFte(hours, month.workdayHours) : null;

        return (
          <React.Fragment key={month.key}>
            <td className={`px-1 py-1 text-right ${
              i === 0
                ? "border-l-2 border-gray-300"
                : month.quarterStart
                ? "border-l-2 border-gray-300"
                : "border-l border-gray-100"
            }`}>
              <EditableCell rowId={row.id} field={month.key}
                value={hours > 0 ? hours : null} type="number"
                onSaved={(v) => updateMonthHours(month.key, v as number | null)}
                className="text-right text-gray-700" placeholder="" />
            </td>
            <td className="px-1 py-1 text-right text-gray-400 bg-gray-50/60 text-[10px]">
              {fte !== null ? fte.toFixed(1) : ""}
            </td>
          </React.Fragment>
        );
      })}

      {/* Comments */}
      <td className="px-2 py-1">
        <EditableCell rowId={row.id} field="comments"
          value={row.comments} type="text"
          onSaved={(v) => updateField("comments", (v as string | null))}
          className="text-gray-700 text-xs" placeholder="…" />
      </td>
    </tr>
  );
}
