export interface OdooProject {
  id: number;
  name: string;
  date_start: string | false;
  date: string | false;
  partner_id: [number, string] | false;
  last_update_status: string;
  // Sale order number — field name varies by Odoo setup; we try common ones
  sale_order_id?: [number, string] | false;
  analytic_account_id?: [number, string] | false;
}

function odooHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.ODOO_API_KEY}`,
  };
}

export async function fetchOdooProjects(): Promise<OdooProject[]> {
  const res = await fetch(
    `${process.env.ODOO_URL}/web/dataset/call_kw`,
    {
      method: "POST",
      headers: odooHeaders(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        id: 2,
        params: {
          model: "project.project",
          method: "search_read",
          args: [[["partner_id.name", "=", "HMC Architects"]]],
          kwargs: {
            fields: [
              "id",
              "name",
              "date_start",
              "date",
              "partner_id",
              "last_update_status",
              "sale_order_id",
              "analytic_account_id",
            ],
            context: { lang: "en_US", tz: "UTC" },
          },
        },
      }),
      next: { revalidate: 300 },
    }
  );

  const json = await res.json();
  if (json.error) {
    throw new Error(`Odoo RPC error: ${JSON.stringify(json.error)}`);
  }
  return (json.result ?? []) as OdooProject[];
}

export function extractSoNumber(project: OdooProject): string | null {
  if (project.sale_order_id && Array.isArray(project.sale_order_id)) {
    return String(project.sale_order_id[0]);
  }
  if (project.analytic_account_id && Array.isArray(project.analytic_account_id)) {
    return project.analytic_account_id[1] ?? null;
  }
  return null;
}

export interface OdooSoData {
  id: number;
  name?: string;
  project_ids?: number[];
  x_studio_sold_hours: number | false | null;
  x_studio_project_start_date: string | false | null;
  x_studio_project_end_date: string | false | null;
}

export interface OdooProjectDates {
  id: number;
  date_start: string | false | null;
  date: string | false | null;
}

/** Search sale.orders by SO name (e.g. "S00042") and return a map keyed by name */
export async function fetchOdooSosByNames(names: string[]): Promise<Map<string, OdooSoData>> {
  if (!names.length) return new Map();
  const res = await fetch(`${process.env.ODOO_URL}/web/dataset/call_kw`, {
    method: "POST",
    headers: odooHeaders(),
    body: JSON.stringify({
      jsonrpc: "2.0", method: "call", id: 4,
      params: {
        model: "sale.order",
        method: "search_read",
        args: [[["name", "in", names]]],
        kwargs: {
          fields: ["id", "name", "project_ids", "x_studio_sold_hours", "x_studio_project_start_date", "x_studio_project_end_date"],
          context: { lang: "en_US", tz: "UTC" },
        },
      },
    }),
    next: { revalidate: 300 },
  });
  const json = await res.json();
  if (json.error) throw new Error(`Odoo SO by name RPC error: ${JSON.stringify(json.error)}`);
  const map = new Map<string, OdooSoData>();
  for (const so of (json.result ?? []) as (OdooSoData & { name: string })[]) {
    map.set(so.name, so);
  }
  return map;
}

export async function fetchOdooSoDetails(soIds: number[]): Promise<Map<number, OdooSoData>> {
  if (!soIds.length) return new Map();
  const res = await fetch(`${process.env.ODOO_URL}/web/dataset/call_kw`, {
    method: "POST",
    headers: odooHeaders(),
    body: JSON.stringify({
      jsonrpc: "2.0", method: "call", id: 3,
      params: {
        model: "sale.order",
        method: "search_read",
        args: [[["id", "in", soIds]]],
        kwargs: {
          fields: ["id", "x_studio_sold_hours", "x_studio_project_start_date", "x_studio_project_end_date"],
          context: { lang: "en_US", tz: "UTC" },
        },
      },
    }),
    next: { revalidate: 300 },
  });
  const json = await res.json();
  if (json.error) throw new Error(`Odoo SO RPC error: ${JSON.stringify(json.error)}`);
  const map = new Map<number, OdooSoData>();
  for (const so of (json.result ?? []) as OdooSoData[]) map.set(so.id, so);
  return map;
}

/** Fetch date_start + date for a list of project IDs */
export async function fetchOdooProjectDates(projectIds: number[]): Promise<Map<number, OdooProjectDates>> {
  if (!projectIds.length) return new Map();
  const res = await fetch(`${process.env.ODOO_URL}/web/dataset/call_kw`, {
    method: "POST",
    headers: odooHeaders(),
    body: JSON.stringify({
      jsonrpc: "2.0", method: "call", id: 5,
      params: {
        model: "project.project",
        method: "search_read",
        args: [[["id", "in", projectIds]]],
        kwargs: {
          fields: ["id", "date_start", "date"],
          context: { lang: "en_US", tz: "UTC" },
        },
      },
    }),
    next: { revalidate: 300 },
  });
  const json = await res.json();
  if (json.error) throw new Error(`Odoo project dates RPC error: ${JSON.stringify(json.error)}`);
  const map = new Map<number, OdooProjectDates>();
  for (const p of (json.result ?? []) as OdooProjectDates[]) map.set(p.id, p);
  return map;
}
