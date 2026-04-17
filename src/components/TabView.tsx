"use client";

import { useState } from "react";
import { PlanningTable } from "./PlanningTable";
import type { PlanningRow } from "@/types/planning";

interface TabViewProps {
  initialRows: PlanningRow[];
}

export function TabView({ initialRows }: TabViewProps) {
  const [activeTab, setActiveTab] = useState<"planning" | "admin">("planning");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setActiveTab("planning")}
          className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors ${
            activeTab === "planning"
              ? "bg-[#FF7700] text-white"
              : "text-[#FF7700] hover:bg-[#FF7700]/10"
          }`}
        >
          Planning
        </button>
        <button
          onClick={() => setActiveTab("admin")}
          className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors ${
            activeTab === "admin"
              ? "bg-[#FF7700] text-white"
              : "text-[#FF7700] hover:bg-[#FF7700]/10"
          }`}
        >
          Administration
        </button>
      </div>
      <PlanningTable initialRows={initialRows} showMonths={activeTab === "planning"} />
    </div>
  );
}
