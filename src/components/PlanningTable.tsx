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
  showMonths?: boolean;
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

// Planning: Name, Start, End, EffortHrs, SO, Comments, Approved (no HS/Odoo/DS)
const PLANNING_BASE_WIDTHS = [300, 95, 95, 58, 75, 150, 80];
const PLANNING_BASE_TOTAL  = PLANNING_BASE_WIDTHS.reduce((a, b) => a + b, 0); // 853

// Admin: Name, HS, Odoo, DS, Start, End, EffortHrs, SO, SO#, Confirmation, Comments, Approved, Office
const ADMIN_COL_WIDTHS = [300, 36, 36, 36, 95, 95, 58, 75, 80, 120, 150, 80, 140];
const ADMIN_TOTAL      = ADMIN_COL_WIDTHS.reduce((a, b) => a + b, 0); // 1301

function TableColgroup({ showMonths }: { showMonths: boolean }) {
  if (showMonths) {
    return (
      <colgroup>
        {PLANNING_BASE_WIDTHS.map((w, i) => <col key={i} style={{ width: `${w}px` }} />)}
        {VISIBLE_MONTHS.map((m) => (
          <React.Fragment key={m.key}>
            <col style={{ width: "56px" }} />
            <col style={{ width: "40px" }} />
          </React.Fragment>
        ))}
      </colgroup>
    );
  }
  return (
    <colgroup>
      {ADMIN_COL_WIDTHS.map((w, i) => <col key={i} style={{ width: `${w}px` }} />)}
    </colgroup>
  );
}

const PLANNING_TABLE_STYLE: React.CSSProperties = { tableLayout: "fixed", width: "100%", borderCollapse: "collapse" };
const ADMIN_TABLE_STYLE: React.CSSProperties    = { tableLayout: "fixed", width: `${ADMIN_TOTAL}px`, borderCollapse: "collapse" };

export function PlanningTable({ initialRows, showMonths = true }: PlanningTableProps) {
  const [searchOpen, setSearchOpen]   = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [activeOnly, setActiveOnly] = useState(true);
  const [sortKey, setSortKey]   = useState<string | null>(null);
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("asc");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const TABLE_STYLE     = showMonths ? PLANNING_TABLE_STYLE : ADMIN_TABLE_STYLE;
  const TABLE_MIN_WIDTH = showMonths
    ? `${PLANNING_BASE_TOTAL + VISIBLE_MONTHS.length * 96}px`
    : `${ADMIN_TOTAL}px`;

  const toggleGroup = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !(prev[label] ?? true) }));

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir("asc"); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortRows = (rows: PlanningRow[]) => {
    if (!sortKey) return rows;
    const isMonthKey = VISIBLE_MONTHS.some((m) => m.key === sortKey);
    return [...rows].sort((a, b) => {
      if (isMonthKey) {
        const getHrs = (row: PlanningRow) => {
          if (!row.soldHrs || !row.startDate || !row.endDate) return 0;
          return distributeHours(row.soldHrs, row.startDate, row.endDate, VISIBLE_MONTHS)[sortKey] ?? 0;
        };
        const av = getHrs(a), bv = getHrs(b);
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      }
      const av = String((a as unknown as Record<string, unknown>)[sortKey] ?? "");
      const bv = String((b as unknown as Record<string, unknown>)[sortKey] ?? "");
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  };

  const sortIndicator = (key: string) => (
    <span className={`text-[9px] ${sortKey === key ? "text-[#FF7700]" : "text-gray-500"}`}>
      {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef   = useRef<HTMLDivElement>(null);

  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

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

  const afterActiveFilter = activeOnly
    ? initialRows.filter((r) => {
        if ((r.group === "Closed Won" || r.group === "Closed Lost") && !r.so) return false;
        if (r.hsStage !== "988280923") return true;
        const end = r.endDate ? new Date(r.endDate) : null;
        return end !== null && end >= today;
      })
    : initialRows;

  const filtered = searchQuery.trim()
    ? afterActiveFilter.filter((r) =>
        r.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : afterActiveFilter;

  const rawGroups: { label: string; rows: PlanningRow[] }[] = [];
  for (const row of filtered) {
    const last = rawGroups[rawGroups.length - 1];
    if (last && last.label === row.group) last.rows.push(row);
    else rawGroups.push({ label: row.group, rows: [row] });
  }
  const groups = rawGroups.map((g) => ({ ...g, rows: sortRows(g.rows) }));

  // Number of non-name columns after the sticky Name cell (for group header colSpan)
  const groupColSpan = showMonths ? 6 : 12;

  return (
    <div className="flex flex-col gap-2">

      {/* ── FROZEN HEADER ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex flex-col rounded-xl overflow-hidden border border-gray-300 shadow-md">

        {/* Filter bar — outside scroll, always visible at left */}
        <div className="bg-[#202022] px-4 py-1.5 flex items-center gap-2 border-b border-gray-700/60">
          <button
            onClick={() => setActiveOnly((v) => !v)}
            className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded transition-colors ${
              activeOnly ? "bg-[#FF7700] text-white" : "bg-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeOnly ? "bg-white" : "bg-gray-500"}`} />
            Active only
          </button>
        </div>

        {/* Scrollable header table */}
        <div ref={headerScrollRef} style={{ overflowX: "scroll", scrollbarWidth: "none" } as React.CSSProperties} className="[&::-webkit-scrollbar]:hidden">
          <table className="text-xs" style={{ ...TABLE_STYLE, minWidth: TABLE_MIN_WIDTH }}>
            <TableColgroup showMonths={showMonths} />
            <thead>

              {/* Row 1 — month labels, planning only */}
              {showMonths && (
                <tr className="bg-[#202022] text-white" style={{ height: "40px" }}>
                  <th className="sticky left-0 z-[1] bg-[#202022] px-3 py-2 border-r-2 border-gray-600" />
                  <th colSpan={6} className="border-r-2 border-gray-600" />
                  {VISIBLE_MONTHS.map((m, i) => (
                    <th
                      key={m.key}
                      colSpan={2}
                      className={`px-2 py-2 text-[11px] whitespace-nowrap ${
                        i === 0 ? "border-l-2 border-gray-600"
                        : m.quarterStart ? "border-l-2 border-gray-600"
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
              )}

              {/* Row 2 — sub-headers */}
              <tr className="bg-[#2e2e30] text-gray-300 text-[10px] uppercase tracking-wider" style={{ height: "30px" }}>
                <th className="sticky left-0 z-[1] bg-[#2e2e30] px-3 py-1 border-r-2 border-gray-600">
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
                      <button onClick={closeSearch} className="text-gray-400 hover:text-white flex-shrink-0 leading-none" aria-label="Close search">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-1">
                      <button onClick={() => handleSort("name")}
                        className={`text-[10px] uppercase tracking-wider hover:text-white transition-colors inline-flex items-center gap-1 ${sortKey === "name" ? "text-[#FF7700]" : ""}`}>
                        Project / Deal {sortIndicator("name")}
                      </button>
                      <button onClick={() => setSearchOpen(true)} className="text-gray-500 hover:text-white flex-shrink-0 transition-colors" aria-label="Search projects">
                        <SearchIcon />
                      </button>
                    </div>
                  )}
                </th>

                {/* Admin-only: HS, Odoo, DS icons */}
                {!showMonths && (
                  <>
                    <th className="px-2 py-1.5 text-center">
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
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 inline-block" aria-label="Odoo">
                        <circle cx="12" cy="12" r="5.5" fill="none" stroke="white" strokeWidth="2.5" />
                        <circle cx="12" cy="5.5" r="2" fill="white" />
                      </svg>
                    </th>
                    <th className="px-2 py-1.5 text-center">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 inline-block" aria-label="DocuSign">
                        <path d="M3 15 Q6 10 9 15 Q12 20 15 15 L20 9" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="20.5" cy="8" r="2" fill="white" />
                      </svg>
                    </th>
                  </>
                )}

                {/* Both views: Start, End, EffortHrs, SO */}
                {(["startDate","endDate","soldHrs","so"] as const).map((key) => {
                  const labels: Record<string, string> = { startDate: "Start", endDate: "End", soldHrs: "Effort Hrs", so: "SO" };
                  const aligns: Record<string, string> = { startDate: "text-left", endDate: "text-left", soldHrs: "text-right", so: "text-center" };
                  const active = sortKey === key;
                  return (
                    <th key={key} className={`px-2 py-1.5 ${aligns[key]} cursor-pointer select-none hover:text-white transition-colors ${active ? "text-[#FF7700]" : ""}`}
                      onClick={() => handleSort(key)}>
                      <span className="inline-flex items-center gap-1">{labels[key]} {sortIndicator(key)}</span>
                    </th>
                  );
                })}

                {/* Admin-only: SO# and Confirmation (between SO and Comments) */}
                {!showMonths && (
                  <>
                    <th className="px-2 py-1.5 text-right border-l border-gray-700">SO #</th>
                    <th className="px-2 py-1.5 text-left border-l border-gray-700">SO Confirmation</th>
                  </>
                )}

                {/* Both views: Comments, Approved */}
                <th className="px-2 py-1.5 text-left">Comments</th>
                <th className="px-2 py-1.5 text-center">Approved?</th>

                {/* Admin-only: Office */}
                {!showMonths && (
                  <th className="px-2 py-1.5 text-left border-l border-gray-700">Office</th>
                )}

                {/* Planning-only month sub-headers */}
                {showMonths && VISIBLE_MONTHS.map((m, i) => (
                  <React.Fragment key={m.key}>
                    <th
                      className={`px-1 py-1.5 text-right cursor-pointer select-none hover:text-white transition-colors border-r-2 border-gray-600 ${
                        i === 0 ? "border-l-2 border-gray-600"
                        : m.quarterStart ? "border-l-2 border-gray-600"
                        : "border-l border-gray-700"
                      } ${sortKey === m.key ? "text-[#FF7700]" : ""}`}
                      onClick={() => handleSort(m.key)}
                    >
                      <span className="inline-flex items-center justify-end gap-0.5">Hrs {sortIndicator(m.key)}</span>
                    </th>
                    <th className="px-1 py-1.5 text-right bg-gray-800/40">FTE</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
          </table>
        </div>
      </div>

      {/* ── GROUP CARDS ─────────────────────────────────────────────────── */}
      {/* Outer rounded frame — overflow:hidden clips body area to rounded corners */}
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <div
          ref={bodyScrollRef}
          style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 220px)", scrollbarGutter: "stable" }}
        >
          <div style={{ minWidth: TABLE_MIN_WIDTH, display: "flex", flexDirection: "column", gap: "8px", paddingBottom: "8px" }}>

            {groups.map(({ label, rows }) => {
              const style = GROUP_STYLE[label] ?? { header: "bg-gray-500 text-white", bullet: "bg-gray-300" };
              const isCollapsed = collapsed[label] ?? true;

              const monthTotals: Record<string, number> = {};
              if (showMonths) {
                for (const row of rows) {
                  if (!row.soldHrs || !row.startDate || !row.endDate) continue;
                  const dist = distributeHours(row.soldHrs, row.startDate, row.endDate, VISIBLE_MONTHS);
                  for (const [k, v] of Object.entries(dist)) {
                    monthTotals[k] = (monthTotals[k] ?? 0) + v;
                  }
                }
              }

              return (
                <div key={label} className="rounded-xl border border-gray-200 shadow-sm" style={{ overflow: "clip" }}>
                  <table className="text-xs" style={TABLE_STYLE}>
                    <TableColgroup showMonths={showMonths} />
                    <thead>
                      <tr className={`cursor-pointer select-none ${style.header}`} onClick={() => toggleGroup(label)}>
                        {/* Sticky name cell */}
                        <td className="sticky left-0 z-[1] bg-inherit px-4 py-2.5" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.bullet}`} />
                            <span className="font-semibold text-[13px] tracking-wide">{label}</span>
                            <span className="ml-1 text-[11px] font-normal opacity-70">({rows.length})</span>
                          </div>
                        </td>
                        <td colSpan={groupColSpan} className="px-4 py-2.5 text-right text-[11px] opacity-60">
                          {isCollapsed ? "▼" : "▲"}
                        </td>
                        {/* Planning month totals */}
                        {showMonths && VISIBLE_MONTHS.map((month, i) => {
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
                    {/* Always rendered — CSS hidden preserves local edit state when collapsed */}
                    <tbody className={isCollapsed ? "hidden" : ""}>
                      {rows.map((row) => (
                        <ProjectRow key={row.id} initialRow={row} showMonths={showMonths} />
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}

          </div>
        </div>
      </div>

    </div>
  );
}
