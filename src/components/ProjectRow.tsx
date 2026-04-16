"use client";

import React, { useState } from "react";
import { EditableCell } from "./EditableCell";
import { VISIBLE_MONTHS, hoursToFte } from "@/config/months";
import type { CapacityRow } from "@/types/capacity";

interface ProjectRowProps {
  initialRow: CapacityRow;
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

const SOURCE_BADGE: Record<string, { bg: string; label: string }> = {
  odoo:    { bg: "bg-purple-100 text-purple-700", label: "Odoo" },
  hubspot: { bg: "bg-orange-100 text-orange-700", label: "HS"   },
};

export function ProjectRow({ initialRow }: ProjectRowProps) {
  const [row, setRow] = useState<CapacityRow>(initialRow);

  const updateField = <K extends keyof CapacityRow>(key: K, value: CapacityRow[K]) =>
    setRow((prev) => ({ ...prev, [key]: value }));

  const updateMonthHours = (monthKey: string, hours: number | null) =>
    setRow((prev) => ({
      ...prev,
      monthlyData: { ...prev.monthlyData, [monthKey]: hours ?? 0 },
    }));

  const rowClass = GROUP_ROW_CLASS[row.group] ?? "bg-white border-gray-100";
  const badge = SOURCE_BADGE[row.source];

  return (
    <tr className={`border-b ${rowClass} hover:brightness-[0.97] transition-all text-xs`}>
      {/* Name */}
      <td className="px-3 py-2 font-medium border-r-2 border-gray-300">
        <span className="block truncate" title={row.name} style={{ fontFamily: "DM Sans, sans-serif" }}>
          {row.name}
        </span>
      </td>

      {/* Source */}
      <td className="px-2 py-2">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.bg}`}>
          {badge.label}
        </span>
      </td>

      {/* Start date */}
      <td className="px-2 py-1 whitespace-nowrap">
        {row.source === "hubspot" ? (
          <EditableCell rowId={row.id} field="startDate" value={row.startDate} type="date"
            onSaved={(v) => updateField("startDate", v as string | null)} className="text-gray-700" />
        ) : (
          <span className="text-gray-600 px-1">{row.startDate ?? "—"}</span>
        )}
      </td>

      {/* End date */}
      <td className="px-2 py-1 whitespace-nowrap">
        {row.source === "hubspot" ? (
          <EditableCell rowId={row.id} field="endDate" value={row.endDate} type="date"
            onSaved={(v) => updateField("endDate", v as string | null)} className="text-gray-700" />
        ) : (
          <span className="text-gray-600 px-1">{row.endDate ?? "—"}</span>
        )}
      </td>

      {/* Effort */}
      <td className="px-2 py-1 text-right">
        <EditableCell rowId={row.id} field="effort" value={row.effort} type="number"
          onSaved={(v) => updateField("effort", v as number | null)}
          className="text-right text-gray-800" placeholder="" />
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
    </tr>
  );
}
