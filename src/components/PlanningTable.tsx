"use client";

import React, { useState, useRef, useEffect } from "react";
import { VISIBLE_MONTHS, hoursToFte, distributeHours } from "@/config/months";
import { ProjectRow } from "./ProjectRow";
import type { PlanningRow } from "@/types/planning";

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
    </svg>
  );
}

interface PlanningTableProps {
  initialRows: PlanningRow[];
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
      <col style={{ width: "300px" }} />
      <col style={{ width: "36px" }} />{/* HS */}
      <col style={{ width: "36px" }} />{/* ODOO */}
      <col style={{ width: "36px" }} />{/* DocuSign */}
      <col style={{ width: "95px" }} />
      <col style={{ width: "95px" }} />
      <col style={{ width: "58px" }} />{/* Effort Hrs */}
      <col style={{ width: "75px" }} />{/* SO */}
      <col style={{ width: "150px" }} />{/* Comments */}
      <col style={{ width: "80px" }} />{/* Approved */}
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
const TABLE_MIN_WIDTH = "1976px";

export function PlanningTable({ initialRows }: PlanningTableProps) {
  const [searchOpen, setSearchOpen]   = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [activeOnly, setActiveOnly] = useState(true);
  const [sortKey, setSortKey]   = useState<string | null>(null);
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sortRows = (rows: PlanningRow[]) => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey] ?? "";
      const bv = (b as unknown as Record<string, unknown>)[sortKey] ?? "";
      const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  };

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Active filter:
  //   1. Hide "Project Closure" deals whose end date has already passed
  //   2. Hide Closed Won / Closed Lost deals with no Sales Order
  const afterActiveFilter = activeOnly
    ? initialRows.filter((r) => {
        if ((r.group === "Closed Won" || r.group === "Closed Lost") && !r.so) return false;
        if (r.hsStage !== "988280923") return true;
        const end = r.endDate ? new Date(r.endDate) : null;
        return end !== null && end >= today;
      })
    : initialRows;

  // Filter by search query
  const filtered = searchQuery.trim()
    ? afterActiveFilter.filter((r) =>
        r.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : afterActiveFilter;

  // Group rows preserving sort order, then sort within each group
  const rawGroups: { label: string; rows: PlanningRow[] }[] = [];
  for (const row of filtered) {
    const last = rawGroups[rawGroups.length - 1];
    if (last && last.label === row.group) last.rows.push(row);
    else rawGroups.push({ label: row.group, rows: [row] });
  }
  const groups = rawGroups.map((g) => ({ ...g, rows: sortRows(g.rows) }));

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
              {/* Row 1 — filter toggle + month labels */}
              <tr className="bg-[#202022] text-white">
                <th colSpan={1} className="px-3 py-2 border-r-2 border-gray-600" />
                <th colSpan={9} className="px-3 border-r-2 border-gray-600">
                  <button
                    onClick={() => setActiveOnly((v) => !v)}
                    className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded transition-colors ${
                      activeOnly
                        ? "bg-[#FF7700] text-white"
                        : "bg-gray-700 text-gray-400 hover:text-white"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeOnly ? "bg-white" : "bg-gray-500"}`} />
                    Active only
                  </button>
                </th>
                {VISIBLE_MONTHS.map((m, i) => (
                  <th
                    key={m.key}
                    colSpan={2}
                    className={`px-2 py-2 text-[11px] whitespace-nowrap ${
                      i === 0
                        ? "border-l-2 border-gray-600"
                        : m.quarterStart
                        ? "border-l-2 border-gray-600"
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
                      <button onClick={() => handleSort("name")}
                        className="text-[10px] uppercase tracking-wider hover:text-white transition-colors inline-flex items-center gap-1">
                        Project / Deal
                        <span className="text-[9px]">{sortKey === "name" ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}</span>
                      </button>
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
                <th className="px-2 py-1.5 text-center">
                  {/* HubSpot sprocket */}
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 inline-block" aria-label="HubSpot">
                    <circle cx="12" cy="12" r="3" fill="white" />
                    <rect x="11" y="5.5" width="2" height="4.5" rx="1" fill="white" />
                    <circle cx="12" cy="4.5" r="2.5" fill="white" />
                    <line x1="14.2" y1="13.5" x2="17.5" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="19" cy="17.2" r="2.5" fill="white" />
                    <line x1="9.8" y1="13.5" x2="6.5" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="5" cy="17.2" r="2.5" fill="white" />
                  </svg>
                </th>
                <th className="px-2 py-1.5 text-center">
                  {/* Odoo O mark */}
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 inline-block" aria-label="Odoo">
                    <circle cx="12" cy="12" r="5.5" fill="none" stroke="white" strokeWidth="2.5" />
                    <circle cx="12" cy="5.5" r="2" fill="white" />
                  </svg>
                </th>
                <th className="px-2 py-1.5 text-center">
                  {/* DocuSign signature mark */}
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 inline-block" aria-label="DocuSign">
                    <path d="M3 15 Q6 10 9 15 Q12 20 15 15 L20 9" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="20.5" cy="8" r="2" fill="white" />
                  </svg>
                </th>
                {(["startDate","endDate","soldHrs","so"] as const).flatMap((key) => {
                  const labels: Record<string, string> = { startDate: "Start", endDate: "End", soldHrs: "Effort Hrs", so: "SO" };
                  const aligns: Record<string, string> = { startDate: "text-left", endDate: "text-left", soldHrs: "text-right", so: "text-center" };
                  const active = sortKey === key;
                  return [(
                    <th key={key} className={`px-2 py-1.5 ${aligns[key]} cursor-pointer select-none hover:text-white transition-colors`}
                      onClick={() => handleSort(key)}>
                      <span className="inline-flex items-center gap-1">
                        {labels[key]}
                        <span className="text-[9px]">{active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}</span>
                      </span>
                    </th>
                  )];
                })}
                <th className="px-2 py-1.5 text-left">Comments</th>
                <th className="px-2 py-1.5 text-center border-r-2 border-gray-600">Approved?</th>
                {VISIBLE_MONTHS.map((m, i) => (
                  <React.Fragment key={m.key}>
                    <th className={`px-1 py-1.5 text-right ${
                      i === 0
                        ? "border-l-2 border-gray-600"
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

            // Sum distributed hours per month across all rows in this group
            const monthTotals: Record<string, number> = {};
            for (const row of rows) {
              if (!row.soldHrs || !row.startDate || !row.endDate) continue;
              const dist = distributeHours(row.soldHrs, row.startDate, row.endDate, VISIBLE_MONTHS);
              for (const [k, v] of Object.entries(dist)) {
                monthTotals[k] = (monthTotals[k] ?? 0) + v;
              }
            }

            return (
              <div key={label} className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <table className="text-xs" style={TABLE_STYLE}>
                  <TableColgroup />
                  <thead>
                    {/* Group header row — click to toggle, shows month totals */}
                    <tr
                      className={`cursor-pointer select-none ${style.header}`}
                      onClick={() => toggleGroup(label)}
                    >
                      <td colSpan={10} className="px-4 py-2.5" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.bullet}`} />
                          <span className="font-semibold text-[13px] tracking-wide">{label}</span>
                          <span className="ml-1 text-[11px] font-normal opacity-70">({rows.length})</span>
                          <span className="ml-auto text-[11px] opacity-60">{isCollapsed ? "▼" : "▲"}</span>
                        </div>
                      </td>
                      {VISIBLE_MONTHS.map((month, i) => {
                        const hrs = monthTotals[month.key] ?? 0;
                        const fte = hrs > 0 ? hoursToFte(hrs, month.workdayHours) : null;
                        return (
                          <React.Fragment key={month.key}>
                            <td className={`px-1 py-2.5 text-right text-[11px] font-bold ${
                              i === 0 ? "border-l-2 border-white/20" : month.quarterStart ? "border-l-2 border-white/20" : "border-l border-white/10"
                            }`}>
                              {hrs > 0 ? hrs : ""}
                            </td>
                            <td className="px-1 py-2.5 text-right text-[10px] opacity-70">
                              {fte !== null ? fte.toFixed(1) : ""}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  </thead>
                  {!isCollapsed && (
                    <tbody>
                      {rows.map((row) => (
                        <ProjectRow key={row.id} initialRow={row} />
                      ))}
                    </tbody>
                  )}
                </table>
              </div>
            );
          })}

        </div>
      </div>

    </div>
  );
}
