"use client";

import { useState, useMemo, useEffect } from "react";
import { CollapsibleHeader } from "./CollapsibleHeader";
import { PlanningTable } from "./PlanningTable";
import { ServiceOrdersTable } from "./ServiceOrdersTable";
import { prewarmOfficeCache } from "./OfficeDropdown";
import type { PlanningRow, ServiceOrder } from "@/types/planning";

export type ActiveTab = "planning" | "admin" | "service-orders";

interface HmcClientLayoutProps {
  initialRows: PlanningRow[];
  initialServiceOrders: ServiceOrder[];
  email: string | null | undefined;
  today: string;
  rowCount: number;
  signOut: () => Promise<void>;
}

export function HmcClientLayout({
  initialRows,
  initialServiceOrders,
  email,
  today,
  rowCount,
  signOut,
}: HmcClientLayoutProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("planning");
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>(initialServiceOrders);

  useEffect(() => { prewarmOfficeCache(); }, []);

  // planningId → SOs linked to that row
  const soByPlanningId = useMemo(() => {
    const map = new Map<string, ServiceOrder[]>();
    for (const so of serviceOrders) {
      for (const pid of so.projectIds) {
        map.set(pid, [...(map.get(pid) ?? []), so]);
      }
    }
    return map;
  }, [serviceOrders]);

  const handleSoLink = (planningId: string, newSoId: string | null, oldSoId: string | null) => {
    setServiceOrders((prev) =>
      prev.map((so) => {
        if (so.id === oldSoId) return { ...so, projectIds: so.projectIds.filter((id) => id !== planningId) };
        if (so.id === newSoId) return { ...so, projectIds: [...so.projectIds, planningId] };
        return so;
      })
    );
  };

  return (
    <>
      <CollapsibleHeader
        email={email}
        today={today}
        rowCount={rowCount}
        signOut={signOut}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <main className="px-6 py-6 pb-10">
        {activeTab === "service-orders" ? (
          <ServiceOrdersTable
            serviceOrders={serviceOrders}
            planningRows={initialRows}
            onUpdate={(updated) =>
              setServiceOrders((prev) => prev.map((so) => (so.id === updated.id ? updated : so)))
            }
            onCreate={(created) => setServiceOrders((prev) => [...prev, created])}
            onDelete={(id) => setServiceOrders((prev) => prev.filter((so) => so.id !== id))}
          />
        ) : (
          <PlanningTable
            initialRows={initialRows}
            showMonths={activeTab === "planning"}
            serviceOrders={serviceOrders}
            soByPlanningId={soByPlanningId}
            onSoLink={handleSoLink}
          />
        )}
      </main>
    </>
  );
}
