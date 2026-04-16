export type RowSource = "odoo" | "hubspot";

export type RowStatus = "ongoing" | "done" | "todo" | "undated";

export interface CapacityRow {
  id: string;              // "odoo-{id}" or "hubspot-{id}"
  source: RowSource;
  name: string;
  startDate: string | null;   // ISO date string (serialized for RSC→client)
  endDate: string | null;     // ISO date string
  effort: number | null;
  so: string | null;          // Sales Order number (Odoo only)
  monthlyData: Record<string, number>;  // { "aug-25": 80, "sep-25": 172, ... } hours
  status: RowStatus;
}
