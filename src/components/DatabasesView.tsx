"use client";

import { ServiceOrdersTable } from "./ServiceOrdersTable";
import { OfficesTable } from "./OfficesTable";
import type { ServiceOrder, Office, PlanningRow } from "@/types/planning";

interface DatabasesViewProps {
  serviceOrders: ServiceOrder[];
  offices: Office[];
  planningRows: PlanningRow[];
  onSoUpdate: (updated: ServiceOrder) => void;
  onSoCreate: (created: ServiceOrder) => void;
  onSoDelete: (id: string) => void;
  onOfficeUpdate: (updated: Office) => void;
  onOfficeCreate: (created: Office) => void;
  onOfficeDelete: (id: number) => void;
  onOfficesRefresh?: (offices: Office[]) => void;
}

export function DatabasesView({
  serviceOrders, offices, planningRows,
  onSoUpdate, onSoCreate, onSoDelete,
  onOfficeUpdate, onOfficeCreate, onOfficeDelete, onOfficesRefresh,
}: DatabasesViewProps) {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
          Service Orders
        </h2>
        <ServiceOrdersTable
          serviceOrders={serviceOrders}
          planningRows={planningRows}
          onUpdate={onSoUpdate}
          onCreate={onSoCreate}
          onDelete={onSoDelete}
        />
      </section>
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
          Offices
        </h2>
        <OfficesTable
          offices={offices}
          planningRows={planningRows}
          onUpdate={onOfficeUpdate}
          onCreate={onOfficeCreate}
          onDelete={onOfficeDelete}
          onOfficesRefresh={onOfficesRefresh}
        />
      </section>
    </div>
  );
}
