"use client";

import React, { useState, useRef, useEffect } from "react";
import { VISIBLE_MONTHS, hoursToFte, distributeHours, getMonthWeekdaysForProject } from "@/config/months";
import { SoRelationCell } from "./SoRelationCell";
import { EditableCell } from "./EditableCell";
import type { PlanningRow, ServiceOrder, Office } from "@/types/planning";
import { chipTextColor } from "@/lib/color";

interface OfficeViewProps {
  initialRows: PlanningRow[];
  serviceOrders?: ServiceOrder[];
  offices?: Office[];
  soByPlanningId?: Map<string, ServiceOrder[]>;
  onSoLink?: (planningId: string, newSoId: string | null, oldSoId: string | null) => void;
  onSoCreate?: (so: ServiceOrder) => void;
  onOfficeCreate?: (office: Office) => void;
}

// Stage group chip color
const GROUP_CHIP: Record<string, { bg: string; text: string }> = {
  "Ongoing":       { bg: "#ea580c", text: "#fff" },
  "Opportunities": { bg: "#d97706", text: "#fff" },
  "Canceled":      { bg: "#e11d48", text: "#fff" },
  "No Dates":      { bg: "#6b7280", text: "#fff" },
};

// Office columns: Name(300), StageGroup(110), Start(95), End(95), Hrs(58), SO(75), SO#(90), Comments(flex), Approved(80)
const BASE_WIDTHS = [300, 110, 95, 95, 58, 75, 90, 150, 80];
const BASE_TOTAL  = BASE_WIDTHS.reduce((a, b) => a + b, 0);
const TABLE_STYLE: React.CSSProperties = { tableLayout: "fixed", width: "100%", borderCollapse: "collapse" };
const TABLE_MIN_WIDTH = `${BASE_TOTAL + VISIBLE_MONTHS.length * 96}px`;

function TableColgroup() {
  return (
    <colgroup>
      {BASE_WIDTHS.map((w, i) =>
        i === 7 ? <col key={i} /> : <col key={i} style={{ width: `${w}px` }} />
      )}
      {VISIBLE_MONTHS.map((m) => (
        <React.Fragment key={m.key}>
          <col style={{ width: "56px" }} />
          <col style={{ width: "40px" }} />
        </React.Fragment>
      ))}
      <col style={{ width: "16px" }} />
    </colgroup>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function ApprovedCheckbox({ rowId, checked, onChange }: { rowId: string; checked: boolean; onChange: (v: boolean) => void }) {
  const toggle = async (val: boolean) => {
    onChange(val);
    try {
      const res = await fetch(`/api/planning/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: val }),
      });
      if (!res.ok) onChange(!val);
    } catch { onChange(!val); }
  };
  return <input type="checkbox" checked={checked} onChange={(e) => toggle(e.target.checked)} className="w-4 h-4 accent-[#FF7700] cursor-pointer" />;
}

function OfficeRow({ row, serviceOrders, linkedSos, onSoLink, onSoCreate }: {
  row: PlanningRow;
  serviceOrders: ServiceOrder[];
  linkedSos: ServiceOrder[];
  onSoLink: (newSoId: string | null, oldSoId: string | null) => void;
  onSoCreate?: (so: ServiceOrder) => void;
}) {
  const [approved, setApproved] = useState(row.approved);
  const [comments, setComments] = useState(row.comments);

  const projectedMonthly = (row.soldHrs && row.startDate && row.endDate)
    ? distributeHours(row.soldHrs, row.startDate, row.endDate, VISIBLE_MONTHS)
    : {};
  const monthWeekdays = (row.startDate && row.endDate)
    ? getMonthWeekdaysForProject(row.startDate, row.endDate, VISIBLE_MONTHS)
    : {};

  const rowBg = row.group === "Canceled" ? "bg-rose-50 border-rose-200 opacity-70"
    : row.group === "Ongoing" ? "bg-orange-50 border-orange-200"
    : row.group === "Opportunities" ? "bg-amber-50 border-amber-200"
    : "bg-white border-gray-100";

  const groupChip = GROUP_CHIP[row.group] ?? { bg: "#6b7280", text: "#fff" };

  return (
    <tr className={`border-b ${rowBg} hover:brightness-[0.97] transition-all text-xs`}>
      {/* Name — sticky */}
      <td className="sticky left-0 z-[1] bg-inherit px-3 py-2 font-medium border-r-2 border-gray-300">
        <span className="block truncate" title={row.name} style={{ fontFamily: "DM Sans, sans-serif" }}>
          {row.name}
        </span>
      </td>

      {/* Stage Group */}
      <td className="px-2 py-1">
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
          style={{ backgroundColor: groupChip.bg, color: groupChip.text }}
        >
          {row.group}
        </span>
      </td>

      {/* Start, End */}
      <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-700">{fmtDate(row.startDate) || <span className="text-gray-300">—</span>}</td>
      <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-700">{fmtDate(row.endDate) || <span className="text-gray-300">—</span>}</td>

      {/* Hrs */}
      <td className="px-2 py-1 text-right text-xs text-gray-700">{row.soldHrs ?? <span className="text-gray-300">—</span>}</td>

      {/* SO */}
      <td className="px-2 py-1 text-center text-xs text-gray-500">{row.so ?? ""}</td>

      {/* SO # */}
      <td className="px-2 py-1 border-l border-gray-200">
        <SoRelationCell
          planningId={row.id}
          serviceOrders={serviceOrders}
          linkedSoId={linkedSos[0]?.id ?? null}
          onLink={(newSoId, oldSoId) => onSoLink(newSoId, oldSoId)}
          onSoCreate={onSoCreate}
        />
      </td>

      {/* Comments */}
      <td className="px-2 py-1">
        <EditableCell
          rowId={row.id}
          field="comments"
          value={comments}
          type="text"
          onSaved={(v) => setComments(v as string | null)}
          className="text-gray-700 text-xs"
          placeholder="…"
        />
      </td>

      {/* Approved */}
      <td className="px-2 py-1 text-center">
        <ApprovedCheckbox rowId={row.id} checked={approved} onChange={setApproved} />
      </td>

      {/* Monthly columns */}
      {VISIBLE_MONTHS.map((month, i) => {
        const hours = projectedMonthly[month.key] ?? 0;
        const wd = monthWeekdays[month.key] ?? 0;
        const fte = hours > 0 && wd > 0 ? hoursToFte(hours, wd * 8) : null;
        return (
          <React.Fragment key={month.key}>
            <td className={`px-1 py-1 text-right text-gray-700 ${
              i === 0 ? "border-l-2 border-gray-300" : month.quarterStart ? "border-l-2 border-gray-300" : "border-l border-gray-100"
            }`}>
              {hours > 0 ? hours : ""}
            </td>
            <td className="px-1 py-1 text-right text-gray-400 bg-gray-50/60 text-[10px]">
              {fte !== null ? fte.toFixed(1) : ""}
            </td>
          </React.Fragment>
        );
      })}
      <td className="p-0" />
    </tr>
  );
}

export function OfficeView({ initialRows, serviceOrders = [], offices = [], soByPlanningId, onSoLink, onSoCreate }: OfficeViewProps) {
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
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const body = bodyScrollRef.current;
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

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir("asc"); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortIndicator = (key: string) => (
    <span className={`text-[9px] ${sortKey === key ? "text-[#FF7700]" : "text-gray-500"}`}>
      {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  const ACTIVE_HIDDEN_LABELS = ["Project Closure"];
  const afterActiveFilter = activeOnly
    ? initialRows.filter((r) => {
        if (r.filterOverride === "in") return true;
        if (r.filterOverride === "out") return false;
        if (r.group === "Canceled" && !r.so) return false;
        if (r.hsStageLabel && ACTIVE_HIDDEN_LABELS.includes(r.hsStageLabel)) return false;
        const anchorDate = r.endDate || r.startDate;
        if (!r.so && anchorDate && new Date(anchorDate).getFullYear() <= 2025) return false;
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
        case "group":     return matchWords((r.group ?? "").toLowerCase(), q);
        case "startDate": return matchWords(fmtDate(r.startDate), q);
        case "endDate":   return matchWords(fmtDate(r.endDate), q);
        case "soldHrs":   return matchNum(r.soldHrs, q, "soldHrs");
        case "so":        return matchWords((r.so ?? "").toLowerCase(), q);
        case "soNo": {
          const linked = soByPlanningId?.get(r.id) ?? [];
          return linked.some((so) => matchWords((so.serviceOrderNo ?? "").toLowerCase(), q) || matchWords(so.name.toLowerCase(), q));
        }
        case "comments":  return matchWords((r.comments ?? "").toLowerCase(), q);
        case "approved":  return q.startsWith("y") ? r.approved : q.startsWith("n") ? !r.approved : true;
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
      if (sortKey === "soNo") {
        const getSoNo = (r: PlanningRow) => soByPlanningId?.get(r.id)?.[0]?.serviceOrderNo ?? "";
        const av = getSoNo(a), bv = getSoNo(b);
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      }
      const av = String((a as unknown as Record<string, unknown>)[sortKey] ?? "");
      const bv = String((b as unknown as Record<string, unknown>)[sortKey] ?? "");
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  };

  // Separate canceled rows — they go into the dedicated "Lost" group
  const canceledRows = sortRows(filtered.filter(r => r.group === "Canceled"));
  const nonCanceledFiltered = filtered.filter(r => r.group !== "Canceled");

  // Group non-canceled by office
  const officeLabels = Array.from(new Set(nonCanceledFiltered.map(r => r.office ?? null)));
  const sortedLabels = [
    ...officeLabels.filter(l => l !== null).sort((a, b) => (a ?? "").localeCompare(b ?? "")),
    ...(officeLabels.includes(null) ? [null] : []),
  ];

  const groups: Array<{ label: string; officeLabel: string | null; rows: PlanningRow[]; isLost?: boolean }> =
    sortedLabels.map((label) => ({
      label: label ?? "No Office",
      officeLabel: label,
      rows: sortRows(nonCanceledFiltered.filter(r => (r.office ?? null) === label)),
    }));

  if (canceledRows.length > 0) {
    groups.push({ label: "Lost", officeLabel: null, rows: canceledRows, isLost: true });
  }

  if (initialRows.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 rounded-xl border border-gray-200">
        No projects or deals found. Check your API credentials.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">

      {/* ── FROZEN HEADER ── */}
      <div className="sticky top-0 z-20 rounded-xl overflow-hidden border border-gray-300 shadow-md">
        <div ref={headerScrollRef} style={{ overflowX: "scroll", scrollbarWidth: "none" } as React.CSSProperties} className="[&::-webkit-scrollbar]:hidden">
          <table className="text-xs" style={{ ...TABLE_STYLE, minWidth: TABLE_MIN_WIDTH }}>
            <TableColgroup />
            <thead>
              {/* Row 1 — month labels */}
              <tr className="bg-[#202022] text-white" style={{ height: "40px" }}>
                <th className="sticky left-0 z-[1] bg-[#202022] px-3 py-2 border-r-2 border-gray-600" />
                <th colSpan={8} className="border-r-2 border-gray-600" />
                {VISIBLE_MONTHS.map((m, i) => (
                  <th
                    key={m.key}
                    colSpan={2}
                    className={`px-2 py-2 text-[11px] whitespace-nowrap ${
                      i === 0 ? "border-l-2 border-gray-600" : m.quarterStart ? "border-l-2 border-gray-600" : "border-l border-gray-700"
                    }`}
                    style={{ fontFamily: "Space Grotesk, sans-serif" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{m.label}</span>
                      <span className="text-gray-400 font-normal">{m.workdayHours} hs</span>
                    </div>
                  </th>
                ))}
                <th className="p-0" />
              </tr>

              {/* Row 2 — sub-headers */}
              <tr className="bg-[#2e2e30] text-gray-300 text-[10px] uppercase tracking-wider" style={{ height: "36px" }}>
                <th className="sticky left-0 z-[1] bg-[#2e2e30] px-3 py-1 border-r-2 border-gray-600">
                  <div className="flex items-center justify-between gap-1">
                    <button onClick={() => handleSort("name")}
                      className={`text-[10px] uppercase tracking-wider hover:text-white transition-colors inline-flex items-center gap-1 ${sortKey === "name" ? "text-[#FF7700]" : ""}`}>
                      Project / Deal {sortIndicator("name")}
                    </button>
                    <button
                      onClick={() => setActiveOnly(v => !v)}
                      className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors flex-shrink-0 ${
                        activeOnly ? "bg-[#FF7700] text-white" : "bg-gray-700 text-gray-400 hover:text-white"
                      }`}
                    >
                      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${activeOnly ? "bg-white" : "bg-gray-500"}`} />
                      Active
                    </button>
                  </div>
                </th>
                <th className={`px-2 py-1.5 text-left cursor-pointer select-none hover:text-white transition-colors ${sortKey === "group" ? "text-[#FF7700]" : ""}`}
                  onClick={() => handleSort("group")}>
                  <span className="inline-flex items-center gap-1">Stage Group {sortIndicator("group")}</span>
                </th>
                {(["startDate","endDate","soldHrs","so"] as const).map((key) => {
                  const labels: Record<string, string> = { startDate: "Start", endDate: "End", soldHrs: "Hrs", so: "SO" };
                  return (
                    <th key={key} className={`px-2 py-1.5 text-left cursor-pointer select-none hover:text-white transition-colors ${sortKey === key ? "text-[#FF7700]" : ""}`}
                      onClick={() => handleSort(key)}>
                      <span className="inline-flex items-center gap-1">{labels[key]} {sortIndicator(key)}</span>
                    </th>
                  );
                })}
                <th className={`px-2 py-1.5 text-left cursor-pointer select-none hover:text-white transition-colors border-l border-gray-700 ${sortKey === "soNo" ? "text-[#FF7700]" : ""}`}
                  onClick={() => handleSort("soNo")}>
                  <span className="inline-flex items-center gap-1">SO # {sortIndicator("soNo")}</span>
                </th>
                <th className="px-2 py-1.5 text-left">Comments</th>
                <th className={`px-2 py-1.5 text-left cursor-pointer select-none hover:text-white transition-colors ${sortKey === "approved" ? "text-[#FF7700]" : ""}`}
                  onClick={() => handleSort("approved")}>
                  <span className="inline-flex items-center gap-1">Approved {sortIndicator("approved")}</span>
                </th>
                {VISIBLE_MONTHS.map((m, i) => (
                  <React.Fragment key={m.key}>
                    <th
                      className={`px-1 py-1.5 text-left cursor-pointer select-none hover:text-white transition-colors border-r-2 border-gray-600 ${
                        i === 0 ? "border-l-2 border-gray-600" : m.quarterStart ? "border-l-2 border-gray-600" : "border-l border-gray-700"
                      } ${sortKey === m.key ? "text-[#FF7700]" : ""}`}
                      onClick={() => handleSort(m.key)}
                    >
                      <span className="inline-flex items-center gap-0.5">Hrs {sortIndicator(m.key)}</span>
                    </th>
                    <th className="px-1 py-1.5 text-left bg-gray-800/40">FTE</th>
                  </React.Fragment>
                ))}
                <th className="p-0" />
              </tr>

              {/* Row 3 — filters */}
              <tr className="bg-[#111113]" style={{ height: "28px" }}>
                <th className="sticky left-0 z-[1] bg-[#111113] px-2 py-0.5 border-r-2 border-gray-800">
                  <input value={gf("name")} onChange={(e) => setFilter("name", e.target.value)}
                    placeholder="Filter…"
                    className="w-full bg-transparent text-gray-400 text-[10px] outline-none placeholder:text-gray-700 border-b border-transparent focus:border-gray-600" />
                </th>
                <th className="px-2 py-0.5">
                  <input value={gf("group")} onChange={(e) => setFilter("group", e.target.value)}
                    placeholder="Group…"
                    className="w-full bg-transparent text-gray-400 text-[10px] outline-none placeholder:text-gray-700 border-b border-transparent focus:border-gray-600" />
                </th>
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
                <th className="px-2 py-0.5">
                  <input value={gf("soNo")} onChange={(e) => setFilter("soNo", e.target.value)}
                    placeholder="SO#…"
                    className="w-full bg-transparent text-gray-400 text-[10px] outline-none placeholder:text-gray-700 border-b border-transparent focus:border-gray-600" />
                </th>
                <th className="px-2 py-0.5">
                  <input value={gf("comments")} onChange={(e) => setFilter("comments", e.target.value)}
                    placeholder="…"
                    className="w-full bg-transparent text-gray-400 text-[10px] outline-none placeholder:text-gray-700 border-b border-transparent focus:border-gray-600" />
                </th>
                <th className="px-2 py-0.5">
                  <input value={gf("approved")} onChange={(e) => setFilter("approved", e.target.value)}
                    placeholder="y/n"
                    className="w-full bg-transparent text-gray-400 text-[10px] outline-none placeholder:text-gray-700 border-b border-transparent focus:border-gray-600" />
                </th>
                {VISIBLE_MONTHS.map((m) => (
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
                    <th className="px-1 py-0.5" />
                  </React.Fragment>
                ))}
                <th className="p-0" />
              </tr>
            </thead>
          </table>
        </div>
      </div>

      {/* ── OFFICE GROUPS ── */}
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <div
          ref={bodyScrollRef}
          style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 292px)" }}
        >
          <div style={{ width: "100%", minWidth: TABLE_MIN_WIDTH, paddingBottom: "8px" }}>
            {groups.map(({ label, officeLabel, rows, isLost }, gi) => {
              if (rows.length === 0) return null;
              const officeColor = isLost
                ? "#9f1239"
                : (offices.find(o => o.label === officeLabel)?.color ?? "#6b7280");
              const isCollapsed = collapsed[label] ?? true;

              // Group month totals
              const monthTotals: Record<string, number> = {};
              for (const row of rows) {
                if (!row.soldHrs || !row.startDate || !row.endDate) continue;
                const dist = distributeHours(row.soldHrs, row.startDate, row.endDate, VISIBLE_MONTHS);
                for (const [k, v] of Object.entries(dist)) {
                  monthTotals[k] = (monthTotals[k] ?? 0) + v;
                }
              }

              return (
                <div key={label} className="rounded-xl border border-gray-200 shadow-sm" style={{ overflow: "clip", marginTop: gi > 0 ? "8px" : 0 }}>
                  <table className="text-xs" style={TABLE_STYLE}>
                    <TableColgroup />
                    <thead>
                      <tr
                        className="cursor-pointer select-none text-white"
                        style={{ backgroundColor: officeColor, color: chipTextColor(officeColor) }}
                        onClick={() => setCollapsed(prev => ({ ...prev, [label]: !(prev[label] ?? true) }))}
                      >
                        <td className="sticky left-0 z-[1] bg-inherit px-4 py-2.5" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                          <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-[13px] tracking-wide">{label}</span>
                            <span className="ml-1 text-[11px] font-normal opacity-70">({rows.length})</span>
                          </div>
                        </td>
                        <td colSpan={8} className="px-4 py-2.5 text-right text-[11px] opacity-60">
                          {isCollapsed ? "▼" : "▲"}
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
                        <td className="p-0" />
                      </tr>
                    </thead>
                    <tbody className={isCollapsed ? "hidden" : ""}>
                      {rows.map((row) => (
                        <OfficeRow
                          key={row.id}
                          row={row}
                          serviceOrders={serviceOrders}
                          linkedSos={soByPlanningId?.get(row.id) ?? []}
                          onSoLink={(newSoId, oldSoId) => onSoLink?.(row.id, newSoId, oldSoId)}
                          onSoCreate={onSoCreate}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            {groups.every(g => g.rows.length === 0) && (
              <div className="py-12 text-center text-gray-400 text-sm">
                No rows match the current filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
