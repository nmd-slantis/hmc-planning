"use client";

import React, { useState, useRef, useEffect } from "react";
import { VISIBLE_MONTHS, hoursToFte, distributeHours } from "@/config/months";
import { ProjectRow } from "./ProjectRow";
import type { PlanningRow, ServiceOrder, Office } from "@/types/planning";


interface PlanningTableProps {
  initialRows: PlanningRow[];
  showMonths?: boolean;
  serviceOrders?: ServiceOrder[];
  offices?: Office[];
  soByPlanningId?: Map<string, ServiceOrder[]>;
  onSoLink?: (planningId: string, newSoId: string | null, oldSoId: string | null) => void;
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

// Admin: Name, HS, Odoo, Stage, Start, End, EffortHrs, SO, SO#, Confirmation, Approved, Office, Comments
const ADMIN_COL_WIDTHS = [300, 36, 36, 110, 95, 95, 58, 75, 80, 120, 80, 140, 150];
const ADMIN_TOTAL      = ADMIN_COL_WIDTHS.reduce((a, b) => a + b, 0);

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
        <col style={{ width: "16px" }} />{/* scrollbar gutter */}
      </colgroup>
    );
  }
  return (
    <colgroup>
      {ADMIN_COL_WIDTHS.map((w, i) =>
        // Comments column (index 12) has no fixed width — absorbs extra viewport space.
        i === 12
          ? <col key={i} />
          : <col key={i} style={{ width: `${w}px` }} />
      )}
      <col style={{ width: "16px" }} />{/* scrollbar gutter */}
    </colgroup>
  );
}

const PLANNING_TABLE_STYLE: React.CSSProperties = { tableLayout: "fixed", width: "100%", borderCollapse: "collapse" };
const ADMIN_TABLE_STYLE: React.CSSProperties    = { tableLayout: "fixed", width: "100%", minWidth: `${ADMIN_TOTAL}px`, borderCollapse: "collapse" };

const GROUP_FULL_COLORS: Record<string, string> = {
  "Ongoing":          "#1d4ed8",
  "Service Pipeline": "#ea580c",
  "To-Do":            "#475569",
  "Sales Pipeline":   "#d97706",
  "Closed Won":       "#047857",
  "Completed":        "#15803d",
  "Closed Lost":      "#e11d48",
  "No Dates":         "#6b7280",
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`;
}

export function PlanningTable({ initialRows, showMonths = true, serviceOrders = [], offices = [], soByPlanningId, onSoLink }: PlanningTableProps) {
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const setFilter = (key: string, val: string) => setColFilters((prev) => ({ ...prev, [key]: val }));
  const gf = (key: string) => colFilters[key] ?? "";
  const [numericModes, setNumericModes] = useState<Record<string, "=" | ">=" | "<=">>({});
  const getMode = (key: string): "=" | ">=" | "<=" => numericModes[key] ?? "=";
  const toggleMode = (key: string) => setNumericModes((prev) => {
    const cur = prev[key] ?? "=";
    return { ...prev, [key]: cur === "=" ? ">=" : cur === ">=" ? "<=" : "=" };
  });
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
      if (sortKey === "hsStageOrder") {
        const av = a.hsStageOrder ?? 9999;
        const bv = b.hsStageOrder ?? 9999;
        const cmp = av - bv;
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

  useEffect(() => {
    const body   = bodyScrollRef.current;
    const header = headerScrollRef.current;
    if (!body || !header) return;
    const syncFromBody   = () => { header.scrollLeft = body.scrollLeft; };
    const syncFromHeader = () => { body.scrollLeft = header.scrollLeft; };
    body.addEventListener("scroll",   syncFromBody,   { passive: true });
    header.addEventListener("scroll", syncFromHeader, { passive: true });
    return () => {
      body.removeEventListener("scroll",   syncFromBody);
      header.removeEventListener("scroll", syncFromHeader);
    };
  }, []);

  const fmtDate = (iso: string | null) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${m}/${d}/${y}`;
  };

  if (initialRows.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 rounded-xl border border-gray-200">
        No projects or deals found. Check your API credentials.
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ACTIVE_HIDDEN_LABELS = ["Project Closure", "Project Canceled", "Project Cancelled"];
  const afterActiveFilter = activeOnly
    ? initialRows.filter((r) => {
        if (r.group === "Closed Lost" && !r.so) return false;
        if (r.hsStageLabel && ACTIVE_HIDDEN_LABELS.includes(r.hsStageLabel)) return false;
        if (!r.so && r.endDate && new Date(r.endDate).getFullYear() <= 2025) return false;
        return true;
      })
    : initialRows;

  const matchWords = (hay: string, q: string) => q.split(/\s+/).filter(Boolean).every(w => hay.includes(w));
  const matchNum = (val: number | null, q: string, key: string) => {
    const n = parseFloat(q);
    if (isNaN(n)) return true;
    const v = val ?? 0;
    const m = getMode(key);
    return m === ">=" ? v >= n : m === "<=" ? v <= n : v === n;
  };

  const filtered = Object.entries(colFilters).reduce((rows, [key, val]) => {
    const q = val.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      switch (key) {
        case "name":      return matchWords(r.name.toLowerCase(), q);
        case "startDate": return matchWords(fmtDate(r.startDate), q);
        case "endDate":   return matchWords(fmtDate(r.endDate), q);
        case "soldHrs":   return matchNum(r.soldHrs, q, "soldHrs");
        case "so":        return matchWords((r.so ?? "").toLowerCase(), q);
        case "comments":  return matchWords((r.comments ?? "").toLowerCase(), q);
        case "approved":  return q.startsWith("y") ? r.approved : q.startsWith("n") ? !r.approved : true;
        case "stage":     return matchWords((r.hsStageLabel ?? "").toLowerCase(), q);
        case "soNo": {
          const linked = soByPlanningId?.get(r.id) ?? [];
          return linked.some((so) => matchWords((so.serviceOrderNo ?? "").toLowerCase(), q) || matchWords(so.name.toLowerCase(), q));
        }
        case "office":    return matchWords((r.office ?? "").toLowerCase(), q);
        default: {
          if (VISIBLE_MONTHS.some(m => m.key === key)) {
            const hrs = (r.soldHrs && r.startDate && r.endDate)
              ? (distributeHours(r.soldHrs, r.startDate, r.endDate, VISIBLE_MONTHS)[key] ?? 0)
              : 0;
            return matchNum(hrs, q, key);
          }
          return true;
        }
      }
    });
  }, afterActiveFilter);

  const rawGroups: { label: string; rows: PlanningRow[] }[] = [];
  for (const row of filtered) {
    const last = rawGroups[rawGroups.length - 1];
    if (last && last.label === row.group) last.rows.push(row);
    else rawGroups.push({ label: row.group, rows: [row] });
  }
  const groups = rawGroups.map((g) => ({ ...g, rows: sortRows(g.rows) }));

  // Number of non-name columns after the sticky Name cell (for group header colSpan)
  const groupColSpan = showMonths ? 6 : 12;

  // Build per-group stage rank from all rows (before filtering, so gradient stays stable)
  const stageRankByGroup = new Map<string, number[]>();
  {
    const gs = new Map<string, Set<number>>();
    for (const r of initialRows) {
      if (r.hsStageOrder == null) continue;
      if (!gs.has(r.group)) gs.set(r.group, new Set());
      gs.get(r.group)!.add(r.hsStageOrder);
    }
    gs.forEach((stages, group) => {
      stageRankByGroup.set(group, Array.from(stages).sort((a, b) => a - b));
    });
  }

  const getStageStyle = (group: string, stageOrder: number | null): React.CSSProperties => {
    const fullColor = GROUP_FULL_COLORS[group];
    if (!fullColor || stageOrder == null) return { backgroundColor: "#f3f4f6", color: "#6b7280" };
    const stages = stageRankByGroup.get(group) ?? [];
    const idx = stages.indexOf(stageOrder);
    const t = stages.length <= 1 ? 1 : idx === -1 ? 0 : idx / (stages.length - 1);
    return {
      backgroundColor: lerpColor("#ffffff", fullColor, t),
      color: t >= 0.6 ? "#ffffff" : fullColor,
    };
  };

  return (
    <div className="flex flex-col gap-2">

      {/* ── FROZEN HEADER ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 rounded-xl overflow-hidden border border-gray-300 shadow-md">

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
                  <th className="p-0" />{/* gutter */}
                </tr>
              )}

              {/* Row 2 — sub-headers */}
              <tr className="bg-[#2e2e30] text-gray-300 text-[10px] uppercase tracking-wider" style={{ height: "36px" }}>
                <th className="sticky left-0 z-[1] bg-[#2e2e30] px-3 py-1 border-r-2 border-gray-600">
                  <div className="flex items-center justify-between gap-1">
                    <button onClick={() => handleSort("name")}
                      className={`text-[10px] uppercase tracking-wider hover:text-white transition-colors inline-flex items-center gap-1 ${sortKey === "name" ? "text-[#FF7700]" : ""}`}>
                      Project / Deal {sortIndicator("name")}
                    </button>
                    <button
                      onClick={() => setActiveOnly((v) => !v)}
                      className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors flex-shrink-0 ${
                        activeOnly ? "bg-[#FF7700] text-white" : "bg-gray-700 text-gray-400 hover:text-white"
                      }`}
                    >
                      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${activeOnly ? "bg-white" : "bg-gray-500"}`} />
                      Active
                    </button>
                  </div>
                </th>

                {/* Admin-only: HS, Odoo icons + Stage */}
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
                    <th className={`px-2 py-1.5 text-left cursor-pointer select-none hover:text-white transition-colors ${sortKey === "hsStageOrder" ? "text-[#FF7700]" : ""}`}
                      onClick={() => handleSort("hsStageOrder")}>
                      <span className="inline-flex items-center gap-1">Stage {sortIndicator("hsStageOrder")}</span>
                    </th>
                  </>
                )}

                {/* Both views: Start, End, EffortHrs, SO */}
                {(["startDate","endDate","soldHrs","so"] as const).map((key) => {
                  const labels: Record<string, string> = { startDate: "Start", endDate: "End", soldHrs: "Effort Hrs", so: "SO" };
                  const active = sortKey === key;
                  return (
                    <th key={key} className={`px-2 py-1.5 text-left cursor-pointer select-none hover:text-white transition-colors ${active ? "text-[#FF7700]" : ""}`}
                      onClick={() => handleSort(key)}>
                      <span className="inline-flex items-center gap-1">{labels[key]} {sortIndicator(key)}</span>
                    </th>
                  );
                })}

                {/* Admin-only: SO# and Confirmation */}
                {!showMonths && (
                  <>
                    <th className="px-2 py-1.5 text-left border-l border-gray-700">SO #</th>
                    <th className="px-2 py-1.5 text-left border-l border-gray-700">SO Confirmation</th>
                  </>
                )}

                {/* Planning-only: Comments */}
                {showMonths && <th className="px-2 py-1.5 text-left">Comments</th>}

                {/* Both views: Approved */}
                <th className="px-2 py-1.5 text-left">Approved?</th>

                {/* Admin-only: Office, Comments */}
                {!showMonths && (
                  <>
                    <th className="px-2 py-1.5 text-left border-l border-gray-700">Office</th>
                    <th className="px-2 py-1.5 text-left border-l border-gray-700">Comments</th>
                  </>
                )}

                {/* Planning-only month sub-headers */}
                {showMonths && VISIBLE_MONTHS.map((m, i) => (
                  <React.Fragment key={m.key}>
                    <th
                      className={`px-1 py-1.5 text-left cursor-pointer select-none hover:text-white transition-colors border-r-2 border-gray-600 ${
                        i === 0 ? "border-l-2 border-gray-600"
                        : m.quarterStart ? "border-l-2 border-gray-600"
                        : "border-l border-gray-700"
                      } ${sortKey === m.key ? "text-[#FF7700]" : ""}`}
                      onClick={() => handleSort(m.key)}
                    >
                      <span className="inline-flex items-center gap-0.5">Hrs {sortIndicator(m.key)}</span>
                    </th>
                    <th className="px-1 py-1.5 text-left bg-gray-800/40">FTE</th>
                  </React.Fragment>
                ))}
                <th className="p-0" />{/* gutter */}
              </tr>

              {/* Row 3 — column filters */}
              <tr className="bg-[#111113]" style={{ height: "28px" }}>
                <th className="sticky left-0 z-[1] bg-[#111113] px-2 py-0.5 border-r-2 border-gray-800">
                  <input value={gf("name")} onChange={(e) => setFilter("name", e.target.value)}
                    placeholder="Filter…"
                    className="w-full bg-transparent text-gray-400 text-[10px] outline-none placeholder:text-gray-700 border-b border-transparent focus:border-gray-600" />
                </th>
                {!showMonths && (
                  <>
                    <th className="px-1 py-0.5" />{/* HS */}
                    <th className="px-1 py-0.5" />{/* Odoo */}
                    <th className="px-2 py-0.5">
                      <input value={gf("stage")} onChange={(e) => setFilter("stage", e.target.value)}
                        placeholder="Stage…"
                        className="w-full bg-transparent text-gray-400 text-[10px] outline-none placeholder:text-gray-700 border-b border-transparent focus:border-gray-600" />
                    </th>
                  </>
                )}
                {(["startDate","endDate","soldHrs","so"] as const).map((key) => {
                  const isNumeric = key === "soldHrs";
                  return (
                    <th key={key} className="px-2 py-0.5">
                      <div className="flex items-center gap-0.5">
                        {isNumeric && (
                          <button onClick={() => toggleMode(key)}
                            className="text-[9px] text-gray-500 hover:text-[#FF7700] transition-colors flex-shrink-0 w-4 text-center leading-none">
                            {getMode(key) === "=" ? "=" : getMode(key) === ">=" ? "≥" : "≤"}
                          </button>
                        )}
                        <input value={gf(key)} onChange={(e) => setFilter(key, e.target.value)}
                          placeholder="…"
                          className="w-full bg-transparent text-gray-400 text-[10px] outline-none placeholder:text-gray-700 border-b border-transparent focus:border-gray-600" />
                      </div>
                    </th>
                  );
                })}
                {!showMonths && (
                  <>
                    <th className="px-2 py-0.5">
                      <input value={gf("soNo")} onChange={(e) => setFilter("soNo", e.target.value)}
                        placeholder="SO#…"
                        className="w-full bg-transparent text-gray-400 text-[10px] outline-none placeholder:text-gray-700 border-b border-transparent focus:border-gray-600" />
                    </th>
                    <th className="px-1 py-0.5" />{/* Confirmation */}
                  </>
                )}
                {showMonths && (
                  <th className="px-2 py-0.5">
                    <input value={gf("comments")} onChange={(e) => setFilter("comments", e.target.value)}
                      placeholder="…"
                      className="w-full bg-transparent text-gray-400 text-[10px] outline-none placeholder:text-gray-700 border-b border-transparent focus:border-gray-600" />
                  </th>
                )}
                <th className="px-2 py-0.5">
                  <input value={gf("approved")} onChange={(e) => setFilter("approved", e.target.value)}
                    placeholder="y/n"
                    className="w-full bg-transparent text-gray-400 text-[10px] outline-none placeholder:text-gray-700 border-b border-transparent focus:border-gray-600" />
                </th>
                {!showMonths && (
                  <>
                    <th className="px-2 py-0.5">
                      <input value={gf("office")} onChange={(e) => setFilter("office", e.target.value)}
                        placeholder="Office…"
                        className="w-full bg-transparent text-gray-400 text-[10px] outline-none placeholder:text-gray-700 border-b border-transparent focus:border-gray-600" />
                    </th>
                    <th className="px-2 py-0.5">
                      <input value={gf("comments")} onChange={(e) => setFilter("comments", e.target.value)}
                        placeholder="…"
                        className="w-full bg-transparent text-gray-400 text-[10px] outline-none placeholder:text-gray-700 border-b border-transparent focus:border-gray-600" />
                    </th>
                  </>
                )}
                {showMonths && VISIBLE_MONTHS.map((m) => (
                  <React.Fragment key={m.key}>
                    <th className="px-0.5 py-0.5">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => toggleMode(m.key)}
                          className="text-[9px] text-gray-500 hover:text-[#FF7700] transition-colors flex-shrink-0 w-3.5 text-center leading-none">
                          {getMode(m.key) === "=" ? "=" : getMode(m.key) === ">=" ? "≥" : "≤"}
                        </button>
                        <input value={gf(m.key)} onChange={(e) => setFilter(m.key, e.target.value)}
                          placeholder="…"
                          className="w-full bg-transparent text-gray-400 text-[10px] outline-none placeholder:text-gray-700 border-b border-transparent focus:border-gray-600 min-w-0" />
                      </div>
                    </th>
                    <th className="px-1 py-0.5" />{/* FTE */}
                  </React.Fragment>
                ))}
                <th className="p-0" />{/* gutter */}
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
          style={{ overflowX: "auto", overflowY: "auto", maxHeight: showMonths ? "calc(100vh - 292px)" : "calc(100vh - 252px)" }}
        >
          <div style={{ width: "100%", minWidth: TABLE_MIN_WIDTH, paddingBottom: "8px" }}>

            {groups.map(({ label, rows }, groupIndex) => {
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
                <div key={label} className="rounded-xl border border-gray-200 shadow-sm" style={{ overflow: "clip", marginTop: groupIndex > 0 ? "8px" : 0 }}>
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
                        <td className="p-0" />{/* gutter */}
                      </tr>
                    </thead>
                    {/* Always rendered — CSS hidden preserves local edit state when collapsed */}
                    <tbody className={isCollapsed ? "hidden" : ""}>
                      {rows.map((row) => (
                        <ProjectRow
                          key={row.id}
                          initialRow={row}
                          showMonths={showMonths}
                          serviceOrders={serviceOrders}
                          offices={offices}
                          linkedSos={soByPlanningId?.get(row.id) ?? []}
                          onSoLink={(newSoId, oldSoId) => onSoLink?.(row.id, newSoId, oldSoId)}
                          stageStyle={getStageStyle(row.group, row.hsStageOrder)}
                        />
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
