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

async function authenticate(): Promise<number> {
  const res = await fetch(
    `${process.env.ODOO_URL}/web/session/authenticate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        id: 1,
        params: {
          db: process.env.ODOO_DB,
          login: process.env.ODOO_USERNAME,
          password: process.env.ODOO_API_KEY,  // API key used as password
        },
      }),
      cache: "no-store",
    }
  );
  const json = await res.json();
  if (!json.result?.uid) {
    throw new Error("Odoo authentication failed");
  }
  return json.result.uid as number;
}

export async function fetchOdooProjects(): Promise<OdooProject[]> {
  const uid = await authenticate();

  const res = await fetch(
    `${process.env.ODOO_URL}/web/dataset/call_kw`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
            uid,
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
  x_studio_sold_hours: number | false | null;
  x_studio_project_start_date: string | false | null;
  x_studio_project_end_date: string | false | null;
}

/** Search sale.orders by SO name (e.g. "S00042") and return a map keyed by name */
export async function fetchOdooSosByNames(names: string[]): Promise<Map<string, OdooSoData>> {
  if (!names.length) return new Map();
  const uid = await authenticate();
  const res = await fetch(`${process.env.ODOO_URL}/web/dataset/call_kw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", method: "call", id: 4,
      params: {
        model: "sale.order",
        method: "search_read",
        args: [[["name", "in", names]]],
        kwargs: {
          fields: ["id", "name", "x_studio_sold_hours", "x_studio_project_start_date", "x_studio_project_end_date"],
          uid,
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
  const uid = await authenticate();
  const res = await fetch(`${process.env.ODOO_URL}/web/dataset/call_kw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", method: "call", id: 3,
      params: {
        model: "sale.order",
        method: "search_read",
        args: [[["id", "in", soIds]]],
        kwargs: {
          fields: ["id", "x_studio_sold_hours", "x_studio_project_start_date", "x_studio_project_end_date"],
          uid,
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
