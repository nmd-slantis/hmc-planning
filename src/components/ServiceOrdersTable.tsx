"use client";

import { useState, useMemo } from "react";
import { ProjectRelationCell } from "./ProjectRelationCell";
import type { ServiceOrder, PlanningRow } from "@/types/planning";

interface ServiceOrdersTableProps {
  serviceOrders: ServiceOrder[];
  planningRows: PlanningRow[];
  onUpdate: (updated: ServiceOrder) => void;
  onCreate: (created: ServiceOrder) => void;
  onDelete: (id: string) => void;
}

function EditText({
  value,
  onSave,
  placeholder,
  className,
}: {
  value: string | null;
  onSave: (v: string | null) => void;
  placeholder?: string;
  className?: string;
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
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 group-hover/cell:bg-gray-200 transition-colors">
          {value}
        </span>
      ) : (
        <span className="text-gray-400">{placeholder ?? "—"}</span>
      )}
    </button>
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
    patch: Partial<Pick<ServiceOrder, "serviceOrderNo" | "name">>
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
          <col style={{ width: "280px" }} />
          <col />
        </colgroup>
        <thead>
          <tr className="bg-[#202022] text-gray-400 text-[11px] tracking-wide uppercase select-none">
            <th className="px-2 py-2.5" />
            <th className="px-4 py-2.5 text-left font-medium">SO #</th>
            <th className="px-4 py-2.5 text-left font-medium">Name</th>
            <th className="px-4 py-2.5 text-left font-medium">Project / Deal</th>
          </tr>
        </thead>
        <tbody>
          {serviceOrders.length === 0 && !creating && (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-xs text-gray-400">
                No service orders yet — click the button below to add one.
              </td>
            </tr>
          )}
          {serviceOrders.map((so) => (
            <tr key={so.id} className="border-b border-gray-100 bg-white hover:brightness-[0.97] transition-all group">
              {/* Action cell: pencil + X on hover */}
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
              <td className="px-4 py-2">
                <EditText
                  value={so.name || null}
                  placeholder="Name…"
                  onSave={(v) => handleUpdate(so.id, { name: v ?? "" })}
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
              {/* Big circle confirm button */}
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
