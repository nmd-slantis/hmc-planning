"use client";

import { useState, useMemo, useEffect } from "react";
import { CollapsibleHeader } from "./CollapsibleHeader";
import { PlanningTable } from "./PlanningTable";
import { ServiceOrdersTable } from "./ServiceOrdersTable";
import { OfficesTable } from "./OfficesTable";
import { prewarmOfficeCache } from "./OfficeDropdown";
import type { PlanningRow, ServiceOrder, Office } from "@/types/planning";

export type ActiveTab = "planning" | "admin" | "service-orders" | "offices";

interface HmcClientLayoutProps {
  initialRows: PlanningRow[];
  initialServiceOrders: ServiceOrder[];
  initialOffices: Office[];
  email: string | null | undefined;
  today: string;
  signOut: () => Promise<void>;
}

export function HmcClientLayout({
  initialRows,
  initialServiceOrders,
  initialOffices,
  email,
  today,
  signOut,
}: HmcClientLayoutProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("planning");
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>(initialServiceOrders);
  const [offices, setOffices] = useState<Office[]>(initialOffices);

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
        signOut={signOut}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <main className="px-6 py-6 pb-10">
        {activeTab === "offices" ? (
          <OfficesTable
            offices={offices}
            planningRows={initialRows}
            onUpdate={(updated) => setOffices((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))}
            onCreate={(created) => setOffices((prev) => [...prev, created].sort((a, b) => a.label.localeCompare(b.label)))}
            onDelete={(id) => setOffices((prev) => prev.filter((o) => o.id !== id))}
          />
        ) : activeTab === "service-orders" ? (
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
