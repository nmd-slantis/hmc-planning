"use client";

import React, { useState, useRef, useEffect } from "react";
import { VISIBLE_MONTHS } from "@/config/months";
import { ProjectRow } from "./ProjectRow";
import type { CapacityRow } from "@/types/capacity";

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
    </svg>
  );
}

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

/** Shared colgroup — used in every table so columns stay pixel-aligned */
function TableColgroup() {
  return (
    <colgroup>
      <col style={{ width: "220px" }} />
      <col style={{ width: "50px" }} />
      <col style={{ width: "95px" }} />
      <col style={{ width: "95px" }} />
      <col style={{ width: "65px" }} />{/* Sold Hrs */}
      <col style={{ width: "75px" }} />{/* Effort Hrs */}
      <col style={{ width: "50px" }} />
      {VISIBLE_MONTHS.map((m) => (
        <React.Fragment key={m.key}>
          <col style={{ width: "56px" }} />
          <col style={{ width: "40px" }} />
        </React.Fragment>
      ))}
    </colgroup>
  );
}

const TABLE_STYLE: React.CSSProperties = {
  tableLayout: "fixed",
  width: "100%",
  borderCollapse: "collapse",
};

/** Minimum pixel width of a table row — sum of all colgroup widths */
const TABLE_MIN_WIDTH = "1797px";

export function CapacityTable({ initialRows }: CapacityTableProps) {
  const [searchOpen, setSearchOpen]   = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // All groups collapsed by default (true = collapsed)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !(prev[label] ?? true) }));

  // Refs for horizontal-scroll sync
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // When body scrolls horizontally, mirror the offset to the header
  useEffect(() => {
    const body   = bodyScrollRef.current;
    const header = headerScrollRef.current;
    if (!body || !header) return;
    const sync = () => { header.scrollLeft = body.scrollLeft; };
    body.addEventListener("scroll", sync, { passive: true });
    return () => body.removeEventListener("scroll", sync);
  }, []);

  const closeSearch = () => { setSearchOpen(false); setSearchQuery(""); };

  if (initialRows.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 rounded-xl border border-gray-200">
        No projects or deals found. Check your API credentials.
      </div>
    );
  }

  // Filter by search query
  const filtered = searchQuery.trim()
    ? initialRows.filter((r) =>
        r.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : initialRows;

  // Group rows preserving sort order
  const groups: { label: string; rows: CapacityRow[] }[] = [];
  for (const row of filtered) {
    const last = groups[groups.length - 1];
    if (last && last.label === row.group) last.rows.push(row);
    else groups.push({ label: row.group, rows: [row] });
  }

  return (
    <div className="flex flex-col gap-2">

      {/* ── FROZEN HEADER CARD ──────────────────────────────────────────
          Sits outside the scrollable body, so it never moves vertically.
          JS (above) keeps its scrollLeft in sync with the body's.       */}
      <div className="sticky top-0 z-20 rounded-xl overflow-hidden border border-gray-300 shadow-md">
        {/* overflow-x hidden: content pans via scrollLeft set by JS */}
        <div
          ref={headerScrollRef}
          style={{ overflowX: "hidden" }}
        >
          <table className="text-xs" style={{ ...TABLE_STYLE, minWidth: TABLE_MIN_WIDTH }}>
            <TableColgroup />
            <thead>
              {/* Row 1 — month labels */}
              <tr className="bg-[#202022] text-white">
                <th colSpan={6} className="px-3 py-2 text-left border-r-2 border-gray-500" />
                {VISIBLE_MONTHS.map((m, i) => (
                  <th
                    key={m.key}
                    colSpan={2}
                    className={`px-2 py-2 text-[11px] whitespace-nowrap ${
                      i === 0
                        ? "border-l-2 border-gray-500"
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

              {/* Row 2 — sub-headers */}
              <tr className="bg-[#2e2e30] text-gray-300 text-[10px] uppercase tracking-wider">
                <th className="px-3 py-1 border-r-2 border-gray-600">
                  {searchOpen ? (
                    <div className="flex items-center gap-1">
                      <input
                        ref={searchRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Escape" && closeSearch()}
                        placeholder="Search…"
                        className="flex-1 bg-[#3a3a3c] text-white text-[10px] px-2 py-0.5 rounded border border-gray-500 focus:border-[#FF7700] outline-none placeholder-gray-500 min-w-0"
                      />
                      <button
                        onClick={closeSearch}
                        className="text-gray-400 hover:text-white flex-shrink-0 leading-none"
                        aria-label="Close search"
                      >✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] uppercase tracking-wider">Project / Deal</span>
                      <button
                        onClick={() => setSearchOpen(true)}
                        className="text-gray-500 hover:text-white flex-shrink-0 transition-colors"
                        aria-label="Search projects"
                      >
                        <SearchIcon />
                      </button>
                    </div>
                  )}
                </th>
                <th className="px-2 py-1.5 text-center">Src</th>
                <th className="px-2 py-1.5 text-left">Start</th>
                <th className="px-2 py-1.5 text-left">Finish</th>
                <th className="px-2 py-1.5 text-right">Sold Hrs</th>
                <th className="px-2 py-1.5 text-right">Effort Hrs</th>
                <th className="px-2 py-1.5 text-center border-r-2 border-gray-600">SO</th>
                {VISIBLE_MONTHS.map((m, i) => (
                  <React.Fragment key={m.key}>
                    <th className={`px-1 py-1.5 text-right ${
                      i === 0
                        ? "border-l-2 border-gray-500"
                        : m.quarterStart
                        ? "border-l-2 border-gray-600"
                        : "border-l border-gray-700"
                    }`}>Hrs</th>
                    <th className="px-1 py-1.5 text-right bg-gray-800/40">FTE</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
          </table>
        </div>
      </div>

      {/* ── GROUP CARDS ─────────────────────────────────────────────────
          Each group is its own rounded card. The outer div scrolls both
          axes; horizontal offset is mirrored to the header above.       */}
      <div
        ref={bodyScrollRef}
        style={{
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: "calc(100vh - 220px)",
          scrollbarGutter: "stable",
        }}
      >
        {/* Inner column keeps a stable min-width matching the header */}
        <div style={{ minWidth: TABLE_MIN_WIDTH, display: "flex", flexDirection: "column", gap: "8px", paddingBottom: "8px" }}>

          {groups.map(({ label, rows }) => {
            const style = GROUP_STYLE[label] ?? { header: "bg-gray-500 text-white", bullet: "bg-gray-300" };
            const isCollapsed = collapsed[label] ?? true;

            return (
              <div
                key={label}
                className="rounded-xl overflow-hidden border border-gray-200 shadow-sm"
              >
                {/* Group header bar — click to toggle */}
                <div
                  className={`px-4 py-2 cursor-pointer select-none ${style.header}`}
                  style={{ fontFamily: "Space Grotesk, sans-serif" }}
                  onClick={() => toggleGroup(label)}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.bullet}`} />
                    <span className="font-semibold text-[13px] tracking-wide">{label}</span>
                    <span className="ml-1 text-[11px] font-normal opacity-70">({rows.length})</span>
                    <span className="ml-auto text-[11px] opacity-60">
                      {isCollapsed ? "▼" : "▲"}
                    </span>
                  </div>
                </div>

                {/* Data rows — hidden when collapsed */}
                {!isCollapsed && (
                  <table className="text-xs" style={TABLE_STYLE}>
                    <TableColgroup />
                    <tbody>
                      {rows.map((row) => (
                        <ProjectRow key={row.id} initialRow={row} />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}

        </div>
      </div>

    </div>
  );
}
