"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { chipTextColor } from "@/lib/color";
import { createPortal } from "react-dom";
import { ProjectRelationCell } from "./ProjectRelationCell";
import type { ServiceOrder, PlanningRow } from "@/types/planning";

interface ServiceOrdersTableProps {
  serviceOrders: ServiceOrder[];
  planningRows: PlanningRow[];
  onUpdate: (updated: ServiceOrder) => void;
  onCreate: (created: ServiceOrder) => void;
  onDelete: (id: string) => void;
}

function ColorPickerCell({ color, onSave }: { color: string | null; onSave: (v: string) => void }) {
  const [local, setLocal] = useState(color ?? "#6b7280");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setLocal(color ?? "#6b7280"); }, [color]);
  return (
    <div className="flex items-center justify-center">
      <button type="button" onClick={() => ref.current?.click()}
        title="Pick color"
        className="w-5 h-5 rounded-full border-2 hover:scale-110 transition-transform flex-shrink-0"
        style={{ backgroundColor: local, borderColor: color ? local : "#d1d5db" }} />
      <input ref={ref} type="color" value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => onSave(e.target.value)}
        className="sr-only" aria-hidden />
    </div>
  );
}

function EditText({
  value,
  onSave,
  placeholder,
  className,
  chipStyle,
}: {
  value: string | null;
  onSave: (v: string | null) => void;
  placeholder?: string;
  className?: string;
  chipStyle?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  const commit = () => {
    setEditing(false);
    const v = draft.trim() || null;
    if (v !== value) onSave(v);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
        }}
        className={`w-full outline-none bg-white border border-[#FF7700] rounded px-1.5 py-0.5 text-xs ${className ?? ""}`}
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      className={`text-left text-xs group/cell ${className ?? ""}`}
    >
      {value ? (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium transition-opacity group-hover/cell:opacity-80"
          style={chipStyle ?? { backgroundColor: "#f3f4f6", color: "#374151" }}
        >
          {value}
        </span>
      ) : (
        <span className="text-gray-400">{placeholder ?? "—"}</span>
      )}
    </button>
  );
}

function DocuSignMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true">
      <path d="M3 15 Q6 10 9 15 Q12 20 15 15 L20 9" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20.5" cy="8" r="2" fill="white" />
    </svg>
  );
}

function DocuSignCell({ soId, url, onSaved }: { soId: string; url: string | null; onSaved: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(url ?? "");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 0); }, [open]);

  const openModal = () => { setDraft(url ?? ""); setOpen(true); };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/service-orders/${soId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docusignUrl: draft.trim() || null }),
      });
      if (res.ok) { onSaved(draft.trim() || null); setOpen(false); }
    } finally { setSaving(false); }
  };

  const modal = open && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="bg-white rounded-xl shadow-2xl p-5 w-96 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#FFB500]">
            <DocuSignMark />
          </span>
          <span className="font-semibold text-sm text-gray-800">DocuSign URL</span>
        </div>
        <input
          ref={inputRef}
          type="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setOpen(false); }}
          placeholder="https://app.docusign.com/…"
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#FFB500] focus:ring-1 focus:ring-[#FFB500] w-full"
        />
        <div className="flex items-center gap-2 justify-end">
          {url && (
            <button onClick={() => setDraft("")} className="text-xs text-rose-500 hover:text-rose-700 mr-auto">
              Clear
            </button>
          )}
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-[#FFB500] hover:underline px-3 py-1.5 rounded-lg border border-[#FFB500]/40">
              Open ↗
            </a>
          )}
          <button onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="text-xs font-medium bg-[#FFB500] text-white px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={openModal}
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#FFB500] transition-opacity ${url ? "hover:opacity-80" : "opacity-30 hover:opacity-50"}`}
        title={url ? "Edit DocuSign link" : "Add DocuSign link"}
      >
        <DocuSignMark />
      </button>
      {mounted && createPortal(modal, document.body)}
    </>
  );
}

export function ServiceOrdersTable({
  serviceOrders,
  planningRows,
  onUpdate,
  onCreate,
  onDelete,
}: ServiceOrdersTableProps) {
  const [creating, setCreating] = useState(false);
  const [newSoNo, setNewSoNo] = useState("");
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filters, setFilters] = useState({ soNo: "", name: "", project: "" });
  const sf = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFilters((p) => ({ ...p, [k]: e.target.value }));

  const nextSoNoPlaceholder = useMemo(() => {
    const nums = serviceOrders
      .map((so) => parseInt(so.serviceOrderNo ?? ""))
      .filter((n) => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return String(max + 1);
  }, [serviceOrders]);

  const handleCreate = async () => {
    if (!newSoNo.trim() && !newName.trim()) return;
    const res = await fetch("/api/service-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceOrderNo: newSoNo.trim() || null, name: newName.trim() }),
    });
    if (res.ok) {
      onCreate(await res.json());
      setNewSoNo("");
      setNewName("");
      setCreating(false);
    }
  };

  const handleUpdate = async (
    id: string,
    patch: Partial<Pick<ServiceOrder, "serviceOrderNo" | "name" | "color">>
  ) => {
    const res = await fetch(`/api/service-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) onUpdate(await res.json());
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await fetch(`/api/service-orders/${id}`, { method: "DELETE" });
    onDelete(id);
    setDeleting(null);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <table className="w-full text-xs" style={{ tableLayout: "fixed", borderCollapse: "collapse" }}>
        <colgroup>
          <col style={{ width: "40px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "40px" }} />{/* color */}
          <col style={{ width: "280px" }} />
          <col style={{ width: "50px" }} />
          <col />
        </colgroup>
        <thead>
          <tr className="bg-[#2e2e30] text-gray-300 text-[10px] tracking-wider uppercase select-none" style={{ height: "36px" }}>
            <th className="px-2 py-2.5" />
            <th className="px-4 py-2.5 text-left font-medium">SO #</th>
            <th className="px-2 py-2.5 text-center font-medium">Color</th>
            <th className="px-4 py-2.5 text-left font-medium">Name</th>
            <th className="px-2 py-2.5 text-center font-medium">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 inline-block" aria-label="DocuSign">
                <path d="M3 15 Q6 10 9 15 Q12 20 15 15 L20 9" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="20.5" cy="8" r="2" fill="white" />
              </svg>
            </th>
            <th className="px-4 py-2.5 text-left font-medium">Project / Deal</th>
          </tr>
          <tr className="bg-[#111113]" style={{ height: "28px" }}>
            <th className="px-1 py-0.5" />
            <th className="px-2 py-0.5">
              <input value={filters.soNo} onChange={sf("soNo")} placeholder="SO#…"
                className="w-full bg-transparent text-gray-400 text-[10px] outline-none placeholder:text-gray-700 border-b border-transparent focus:border-gray-600" />
            </th>
            <th className="px-1 py-0.5" />{/* color */}
            <th className="px-2 py-0.5">
              <input value={filters.name} onChange={sf("name")} placeholder="Name…"
                className="w-full bg-transparent text-gray-400 text-[10px] outline-none placeholder:text-gray-700 border-b border-transparent focus:border-gray-600" />
            </th>
            <th className="px-1 py-0.5" />
            <th className="px-2 py-0.5">
              <input value={filters.project} onChange={sf("project")} placeholder="Project…"
                className="w-full bg-transparent text-gray-400 text-[10px] outline-none placeholder:text-gray-700 border-b border-transparent focus:border-gray-600" />
            </th>
          </tr>
        </thead>
        <tbody>
          {serviceOrders.length === 0 && !creating && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-xs text-gray-400">
                No service orders yet — click the button below to add one.
              </td>
            </tr>
          )}
          {serviceOrders.filter((so) => {
            const q1 = filters.soNo.trim().toLowerCase();
            const q2 = filters.name.trim().toLowerCase();
            const q3 = filters.project.trim().toLowerCase();
            if (q1 && !(so.serviceOrderNo ?? "").toLowerCase().includes(q1)) return false;
            if (q2 && !so.name.toLowerCase().includes(q2)) return false;
            if (q3 && !so.projectIds.some((pid) => planningRows.find((r) => r.id === pid)?.name.toLowerCase().includes(q3))) return false;
            return true;
          }).map((so) => (
            <tr key={so.id} className="border-b border-gray-100 bg-white hover:brightness-[0.97] transition-all group">
              <td className="px-2 py-2 text-center">
                <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDelete(so.id)}
                    disabled={deleting === so.id}
                    className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors text-[10px]"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </td>
              <td className="px-4 py-2">
                <EditText
                  value={so.serviceOrderNo}
                  placeholder="SO #"
                  onSave={(v) => handleUpdate(so.id, { serviceOrderNo: v })}
                />
              </td>
              <td className="px-2 py-2">
                <ColorPickerCell
                  color={so.color}
                  onSave={(c) => handleUpdate(so.id, { color: c })}
                />
              </td>
              <td className="px-4 py-2">
                <EditText
                  value={so.name || null}
                  placeholder="Name…"
                  chipStyle={so.color ? { backgroundColor: so.color, color: chipTextColor(so.color) } : undefined}
                  onSave={(v) => handleUpdate(so.id, { name: v ?? "" })}
                />
              </td>
              <td className="px-2 py-2 text-center">
                <DocuSignCell
                  soId={so.id}
                  url={so.docusignUrl}
                  onSaved={(v) => onUpdate({ ...so, docusignUrl: v })}
                />
              </td>
              <td className="px-4 py-2">
                <ProjectRelationCell
                  soId={so.id}
                  planningRows={planningRows}
                  linkedIds={so.projectIds}
                  onLink={(newIds) => onUpdate({ ...so, projectIds: newIds })}
                />
              </td>
            </tr>
          ))}

          {creating && (
            <tr className="border-b border-gray-100 bg-orange-50/50">
              <td className="px-2 py-2 text-center">
                <button
                  onClick={handleCreate}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#FF7700] text-white hover:opacity-90 transition-opacity text-sm font-bold shadow-sm mx-auto"
                  title="Save"
                >
                  ✓
                </button>
              </td>
              <td className="px-4 py-2">
                <input
                  autoFocus
                  value={newSoNo}
                  onChange={(e) => setNewSoNo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") setCreating(false);
                  }}
                  placeholder={nextSoNoPlaceholder}
                  className="w-full outline-none bg-transparent border-b border-[#FF7700] text-xs px-0.5 py-0.5 placeholder:text-gray-300"
                />
              </td>
              <td className="px-2 py-2" />{/* color — set after saving */}
              <td className="px-4 py-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") setCreating(false);
                  }}
                  placeholder="Name…"
                  className="w-full outline-none bg-transparent border-b border-[#FF7700] text-xs px-0.5 py-0.5 placeholder:text-gray-400"
                />
              </td>
              <td className="px-2 py-2" />
              <td className="px-4 py-2 text-gray-400 text-xs italic">
                <div className="flex items-center gap-2">
                  <span>Link projects after saving</span>
                  <button
                    onClick={() => { setCreating(false); setNewSoNo(""); setNewName(""); }}
                    className="text-gray-400 hover:text-gray-600 text-[10px] ml-auto"
                  >
                    ✕
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="border-t border-gray-100 px-4 py-2">
        <button
          onClick={() => setCreating(true)}
          className="text-xs text-[#FF7700] hover:bg-orange-50 px-2 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
        >
          <span className="text-base leading-none">+</span> New service order
        </button>
      </div>
    </div>
  );
}
