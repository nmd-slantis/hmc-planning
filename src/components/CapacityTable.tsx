"use client";

import React from "react";
import { VISIBLE_MONTHS } from "@/config/months";
import { ProjectRow } from "./ProjectRow";
import type { CapacityRow } from "@/types/capacity";

interface CapacityTableProps {
  initialRows: CapacityRow[];
}

const GROUP_STYLE: Record<string, { header: string; bullet: string }> = {
  "Ongoing":          { header: "bg-blue-700 text-white",    bullet: "bg-blue-300"    },
  "Service Pipeline": { header: "bg-orange-600 text-white",  bullet: "bg-orange-300"  },
  "To-Do":            { header: "bg-slate-600 text-white",   bullet: "bg-slate-400"   },
  "Sales Pipeline":   { header: "bg-amber-600 text-white",   bullet: "bg-amber-300"   },
  "Closed Won":       { header: "bg-emerald-700 text-white", bullet: "bg-emerald-300" },
  "Completed":        { header: "bg-green-700 text-white",   bullet: "bg-green-300"   },
  "Closed Lost":      { header: "bg-rose-600 text-white",    bullet: "bg-rose-300"    },
  "No Dates":         { header: "bg-gray-500 text-white",    bullet: "bg-gray-300"    },
};

export function CapacityTable({ initialRows }: CapacityTableProps) {
  const totalCols = 6 + VISIBLE_MONTHS.length * 2;

  if (initialRows.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 rounded-xl border border-gray-200">
        No projects or deals found. Check your API credentials.
      </div>
    );
  }

  // Group rows by their precomputed group label, preserving sort order
  const groups: { label: string; rows: CapacityRow[] }[] = [];
  for (const row of initialRows) {
    const last = groups[groups.length - 1];
    if (last && last.label === row.group) {
      last.rows.push(row);
    } else {
      groups.push({ label: row.group, rows: [row] });
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="min-w-full border-collapse text-xs">

        {/* ── Sticky header ────────────────────────────────────────────── */}
        <thead className="sticky top-0 z-10">
          {/* Month labels */}
          <tr className="bg-[#202022] text-white">
            <th colSpan={6} className="px-3 py-2 text-left border-r-2 border-gray-500" />
            {VISIBLE_MONTHS.map((m, i) => (
              <th
                key={m.key}
                colSpan={2}
                className={`px-2 py-2 text-[11px] whitespace-nowrap ${
                  i === 0
                    ? "border-l-2 border-gray-400"
                    : m.quarterStart
                    ? "border-l-2 border-gray-500"
                    : "border-l border-gray-700"
                }`}
                style={{ fontFamily: "Space Grotesk, sans-serif" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{m.label}</span>
                  <span className="text-gray-400 font-normal">{m.workdayHours} hs</span>
                </div>
              </th>
            ))}
          </tr>

          {/* Sub-headers: h / FTE */}
          <tr className="bg-[#2e2e30] text-gray-300 text-[10px] uppercase tracking-wider">
            <th className="px-3 py-1.5 text-left min-w-[200px] border-r-2 border-gray-600">Project / Deal</th>
            <th className="px-2 py-1.5 text-center">Src</th>
            <th className="px-2 py-1.5 text-left">Start</th>
            <th className="px-2 py-1.5 text-left">Finish</th>
            <th className="px-2 py-1.5 text-right">Effort h</th>
            <th className="px-2 py-1.5 text-center border-r-2 border-gray-600">SO</th>
            {VISIBLE_MONTHS.map((m, i) => (
              <React.Fragment key={m.key}>
                <th className={`px-1 py-1.5 text-right min-w-[44px] ${
                  i === 0
                    ? "border-l-2 border-gray-500"
                    : m.quarterStart
                    ? "border-l-2 border-gray-600"
                    : "border-l border-gray-700"
                }`}>h</th>
                <th className="px-1 py-1.5 text-right min-w-[36px] bg-gray-800/40">FTE</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>

        {/* ── Groups ───────────────────────────────────────────────────── */}
        <tbody>
          {groups.map(({ label, rows }, gi) => {
            const style = GROUP_STYLE[label] ?? { header: "bg-gray-500 text-white", bullet: "bg-gray-300" };
            return (
              <React.Fragment key={label}>
                {/* Gap between groups */}
                {gi > 0 && (
                  <tr>
                    <td colSpan={totalCols} className="py-2 bg-[#f5f5f5]" />
                  </tr>
                )}

                {/* Group header row */}
                <tr>
                  <td
                    colSpan={totalCols}
                    className={`px-4 py-2 ${style.header}`}
                    style={{ fontFamily: "Space Grotesk, sans-serif" }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.bullet}`} />
                      <span className="font-semibold text-[13px] tracking-wide">{label}</span>
                      <span className="ml-1 text-[11px] font-normal opacity-70">({rows.length})</span>
                    </div>
                  </td>
                </tr>

                {/* Data rows */}
                {rows.map((row) => (
                  <ProjectRow key={row.id} initialRow={row} />
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
