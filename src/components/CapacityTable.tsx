"use client";

import React from "react";
import { VISIBLE_MONTHS } from "@/config/months";
import { ProjectRow } from "./ProjectRow";
import type { CapacityRow, RowStatus } from "@/types/capacity";

interface CapacityTableProps {
  initialRows: CapacityRow[];
}

const SECTION_LABELS: Record<RowStatus, { label: string; emoji: string; color: string }> = {
  ongoing: { label: "Ongoing",   emoji: "🔵", color: "text-blue-700 bg-blue-50" },
  todo:    { label: "To-Do",     emoji: "⚪", color: "text-gray-600 bg-gray-50" },
  done:    { label: "Completed", emoji: "🟢", color: "text-green-700 bg-green-50" },
  undated: { label: "No Dates",  emoji: "⬜", color: "text-gray-400 bg-white" },
};

const STATUS_ORDER: RowStatus[] = ["ongoing", "todo", "done", "undated"];

export function CapacityTable({ initialRows }: CapacityTableProps) {
  // Group rows by status
  const grouped = STATUS_ORDER.reduce(
    (acc, status) => {
      acc[status] = initialRows.filter((r) => r.status === status);
      return acc;
    },
    {} as Record<RowStatus, CapacityRow[]>
  );

  // Total columns: name, source, start, finish, effort, SO, + 2 per visible month
  const totalCols = 6 + VISIBLE_MONTHS.length * 2;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          {/* Month group headers — span 2 sub-columns each */}
          <tr className="bg-[#202022] text-white">
            <th colSpan={6} className="px-3 py-2 text-left" />
            {VISIBLE_MONTHS.map((m) => (
              <th
                key={m.key}
                colSpan={2}
                className="px-1 py-2 text-center font-semibold border-l border-gray-700 text-[11px] whitespace-nowrap"
                style={{ fontFamily: "Space Grotesk, sans-serif" }}
              >
                {m.label}
              </th>
            ))}
          </tr>

          {/* Column sub-headers */}
          <tr className="bg-[#2e2e30] text-gray-300 text-[10px] uppercase tracking-wider">
            <th className="px-3 py-1.5 text-left min-w-[200px]">Project / Deal</th>
            <th className="px-2 py-1.5 text-center">Src</th>
            <th className="px-2 py-1.5 text-left min-w-[90px]">Start</th>
            <th className="px-2 py-1.5 text-left min-w-[90px]">Finish</th>
            <th className="px-2 py-1.5 text-right min-w-[52px]">Effort h</th>
            <th className="px-2 py-1.5 text-center min-w-[40px]">SO</th>
            {VISIBLE_MONTHS.map((m) => (
              <React.Fragment key={m.key}>
                <th
                  className="px-1 py-1.5 text-right min-w-[44px] border-l border-gray-700"
                >
                  h
                </th>
                <th
                  className="px-1 py-1.5 text-right min-w-[36px] bg-gray-800/40"
                >
                  FTE
                </th>
              </React.Fragment>
            ))}
          </tr>
        </thead>

        <tbody>
          {STATUS_ORDER.map((status) => {
            const rows = grouped[status];
            if (!rows.length) return null;

            const { label, emoji, color } = SECTION_LABELS[status];

            return (
              <React.Fragment key={status}>
                {/* Section header row */}
                <tr>
                  <td
                    colSpan={totalCols}
                    className={`px-4 py-1.5 font-semibold text-[11px] uppercase tracking-widest ${color}`}
                    style={{ fontFamily: "Space Grotesk, sans-serif" }}
                  >
                    {emoji} {label} ({rows.length})
                  </td>
                </tr>

                {rows.map((row) => (
                  <ProjectRow key={row.id} initialRow={row} />
                ))}
              </React.Fragment>
            );
          })}

          {initialRows.length === 0 && (
            <tr>
              <td
                colSpan={totalCols}
                className="text-center py-16 text-gray-400"
              >
                No projects or deals found. Check your API credentials. 🤔
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
