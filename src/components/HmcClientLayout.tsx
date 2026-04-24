"use client";

import { useState, useMemo } from "react";
import { CollapsibleHeader } from "./CollapsibleHeader";
import { PlanningTable } from "./PlanningTable";
import { DatabasesView } from "./DatabasesView";
import { OfficeView } from "./OfficeView";
import { UsersTable } from "./UsersTable";
import type { PlanningRow, ServiceOrder, Office } from "@/types/planning";

export type ActiveTab = "planning" | "admin" | "office" | "databases" | "users";

interface HmcClientLayoutProps {
  initialRows: PlanningRow[];
  initialServiceOrders: ServiceOrder[];
  initialOffices: Office[];
  email: string | null | undefined;
  userRole: string | null | undefined;
  today: string;
  signOut: () => Promise<void>;
}

export function HmcClientLayout({
  initialRows,
  initialServiceOrders,
  initialOffices,
  email,
  userRole,
  today,
  signOut,
}: HmcClientLayoutProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("planning");
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>(initialServiceOrders);
  const [offices, setOffices] = useState<Office[]>(initialOffices);

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

  const handleSoCreate = (created: ServiceOrder) => {
    setServiceOrders((prev) => [...prev, created]);
  };

  const handleOfficeCreate = (created: Office) => {
    setOffices((prev) => [...prev, created].sort((a, b) => a.label.localeCompare(b.label)));
  };

  return (
    <>
      <CollapsibleHeader
        email={email}
        userRole={userRole}
        today={today}
        signOut={signOut}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <main className="px-6 py-6 pb-10">
        {activeTab === "users" ? (
          <UsersTable currentUserEmail={email} />
        ) : activeTab === "databases" ? (
          <DatabasesView
            serviceOrders={serviceOrders}
            offices={offices}
            planningRows={initialRows}
            onSoUpdate={(updated) => setServiceOrders((prev) => prev.map((so) => (so.id === updated.id ? updated : so)))}
            onSoCreate={handleSoCreate}
            onSoDelete={(id) => setServiceOrders((prev) => prev.filter((so) => so.id !== id))}
            onOfficeUpdate={(updated) => setOffices((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))}
            onOfficeCreate={handleOfficeCreate}
            onOfficeDelete={(id) => setOffices((prev) => prev.filter((o) => o.id !== id))}
            onOfficesRefresh={(updated) => setOffices([...updated].sort((a, b) => a.label.localeCompare(b.label)))}
          />
        ) : activeTab === "office" ? (
          <OfficeView
            initialRows={initialRows}
            serviceOrders={serviceOrders}
            offices={offices}
            soByPlanningId={soByPlanningId}
            onSoLink={handleSoLink}
            onSoCreate={handleSoCreate}
            onOfficeCreate={handleOfficeCreate}
          />
        ) : (
          <PlanningTable
            initialRows={initialRows}
            showMonths={activeTab === "planning"}
            serviceOrders={serviceOrders}
            offices={offices}
            soByPlanningId={soByPlanningId}
            onSoLink={handleSoLink}
            onSoCreate={handleSoCreate}
            onOfficeCreate={handleOfficeCreate}
          />
        )}
      </main>
    </>
  );
}
