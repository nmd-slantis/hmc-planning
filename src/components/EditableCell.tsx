"use client";

import { useState, useRef, useEffect } from "react";

interface EditableCellProps {
  rowId: string;
  field: string;          // "effort" | "startDate" | "endDate" | month key e.g. "aug-25"
  value: string | number | null;
  type?: "number" | "date" | "text";
  onSaved?: (newValue: string | number | null) => void;
  className?: string;
  placeholder?: string;
}

function isMonthKey(field: string): boolean {
  return /^[a-z]{3}-\d{2}$/.test(field);
}

export function EditableCell({
  rowId,
  field,
  value,
  type = "number",
  onSaved,
  className = "",
  placeholder = "—",
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Keep draft in sync if value changes externally
  useEffect(() => {
    if (!editing) {
      setDraft(String(value ?? ""));
    }
  }, [value, editing]);

  const save = async () => {
    setSaving(true);
    setEditing(false);

    let body: Record<string, unknown>;

    if (isMonthKey(field)) {
      body = {
        monthKey: field,
        monthHours: draft === "" ? 0 : parseFloat(draft) || 0,
      };
    } else if (field === "effort") {
      body = { effort: draft === "" ? null : parseFloat(draft) || null };
    } else {
      // startDate or endDate
      body = { [field]: draft === "" ? null : draft };
    }

    try {
      const res = await fetch(`/api/capacity/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const updated = await res.json();
        let savedValue: string | number | null = null;

        if (isMonthKey(field)) {
          const monthly = (() => {
            try {
              return typeof updated.monthlyData === "string"
                ? JSON.parse(updated.monthlyData)
                : updated.monthlyData;
            } catch {
              return {};
            }
          })();
          savedValue = monthly[field] ?? 0;
        } else if (field === "effort") {
          savedValue = updated.effort ?? null;
        } else {
          savedValue = updated[field] ?? null;
        }

        onSaved?.(savedValue);
      }
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(String(value ?? ""));
    setEditing(false);
  };

  const displayValue =
    value !== null && value !== undefined && value !== ""
      ? String(value)
      : null;

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") cancel();
        }}
        className={`w-full border border-[#FF7700] rounded px-1 py-0.5 text-xs outline-none bg-orange-50 ${className}`}
        style={{ minWidth: "48px" }}
      />
    );
  }

  return (
    <div
      onClick={() => {
        setDraft(String(value ?? ""));
        setEditing(true);
      }}
      className={`editable-cell px-1 py-0.5 min-h-[1.5rem] text-xs rounded transition-colors ${
        saving ? "opacity-40" : ""
      } ${className}`}
      title="Click to edit"
    >
      {displayValue ?? (
        <span className="text-gray-300 select-none">{placeholder}</span>
      )}
    </div>
  );
}
