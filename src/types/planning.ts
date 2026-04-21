export interface ServiceOrder {
  id: string;
  serviceOrderNo: string | null;
  name: string;
  color: string | null;
  docusignUrl: string | null;
  projectIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Office {
  id: number;
  label: string;
  color: string | null;
  address: string | null;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  createdAt: string;
}

export type RowSource = "odoo" | "hubspot";

export type RowStatus = "ongoing" | "done" | "todo" | "undated";

export interface PlanningRow {
  id: string;              // "odoo-{id}" or "hubspot-{id}"
  source: RowSource;
  name: string;
  startDate: string | null;     // ISO date string (serialized for RSC→client)
  endDate: string | null;       // ISO date string
  startDateLive: string | null; // live date from Odoo/HubSpot, never overridden
  endDateLive: string | null;
  startDateManual: boolean;     // true = user-edited, breaks live Odoo sync
  endDateManual: boolean;
  effort: number | null;
  soldHrs: number | null;
  soldHrsLive: number | null;
  soldHrsManual: boolean;
  so: string | null;          // Sales Order number (Odoo only)
  monthlyData: Record<string, number>;  // { "aug-25": 80, "sep-25": 172, ... } hours
  status: RowStatus;
  hsPipeline: string | null;    // HubSpot pipeline ID (hubspot rows only)
  hsStage: string | null;       // HubSpot dealstage ID (hubspot rows only)
  hsStageLabel: string | null;  // HubSpot dealstage display label (hubspot rows only)
  hsStageOrder: number | null;  // HubSpot dealstage displayOrder for sorting
  hsUrl: string | null;       // Direct link to the HubSpot deal (hubspot rows only)
  odooSoUrl: string | null;   // Direct link to the Odoo Sales Order (odoo rows only)
  comments: string | null;
  approved: boolean;
  docusignUrl: string | null;
  office: string | null;
  serviceOrderNo: string | null;
  serviceOrderFileUrl: string | null;
  serviceOrderFileName: string | null;
  group: string;              // display group label, used for section headers
}
