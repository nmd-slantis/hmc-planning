"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { ServiceOrder } from "@/types/planning";
import { chipTextColor } from "@/lib/color";

interface SoRelationCellProps {
  planningId: string;
  serviceOrders: ServiceOrder[];
  linkedSoId: string | null;
  onLink: (newSoId: string | null, oldSoId: string | null) => void;
}

export function SoRelationCell({ planningId, serviceOrders, linkedSoId, onLink }: SoRelationCellProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  const linkedSo = serviceOrders.find((so) => so.id === linkedSoId) ?? null;
  const displayLabel = linkedSo
    ? (linkedSo.serviceOrderNo ?? linkedSo.name ?? "—")
    : "—";

  const filtered = serviceOrders.filter((so) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return so.serviceOrderNo?.toLowerCase().includes(q) || so.name.toLowerCase().includes(q);
  });

  const openPanel = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPanelPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 240) });
    setOpen(true);
  };

  const close = () => { setOpen(false); setSearch(""); };

  const handleSelect = async (soId: string | null) => {
    const oldId = linkedSoId;
    onLink(soId, oldId);
    close();

    if (oldId) {
      await fetch(`/api/service-orders/${oldId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removePlanningId: planningId }),
      });
    }
    if (soId) {
      await fetch(`/api/service-orders/${soId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addPlanningId: planningId }),
      });
    }
  };

  const panel = open && (
    <div
      style={{ position: "fixed", top: panelPos.top, left: panelPos.left, minWidth: panelPos.width, zIndex: 200 }}
      className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
    >
      <div className="p-2 border-b border-gray-100">
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search service orders…"
          className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-[#FF7700]"
        />
      </div>
      <div className="max-h-52 overflow-y-auto py-1">
        {linkedSoId && (
          <button
            onClick={() => handleSelect(null)}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50"
          >
            — Clear
          </button>
        )}
        {filtered.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400">No service orders found</div>
        )}
        {filtered.map((so) => (
          <button
            key={so.id}
            onClick={() => handleSelect(so.id)}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 ${so.id === linkedSoId ? "text-[#FF7700]" : "text-gray-700"}`}
          >
            <span className="w-3 flex-shrink-0 text-[10px]">{so.id === linkedSoId ? "✓" : ""}</span>
            <span className="font-medium flex-shrink-0">{so.serviceOrderNo ?? "—"}</span>
            {so.name && <span className="text-gray-400 truncate">{so.name}</span>}
          </button>
        ))}
        {serviceOrders.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400">No service orders yet — create them in the Service Orders tab.</div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        onClick={open ? close : openPanel}
        className="w-full flex items-center gap-1 text-xs text-left group"
      >
        {linkedSo ? (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium truncate max-w-full"
            style={linkedSo.color
              ? { backgroundColor: linkedSo.color, color: chipTextColor(linkedSo.color) }
              : { backgroundColor: "#ede9fe", color: "#6d28d9" }}
          >
            {displayLabel}
          </span>
        ) : (
          <span className="flex-1 text-gray-400">—</span>
        )}
        <span className="text-gray-400 flex-shrink-0 text-[10px] group-hover:text-gray-600">▾</span>
      </button>
      {mounted && createPortal(
        <>
          {open && <div className="fixed inset-0 z-[199]" onMouseDown={close} />}
          {panel}
        </>,
        document.body
      )}
    </>
  );
}
