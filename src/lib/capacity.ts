import { fetchOdooProjects, extractSoNumber } from "./odoo";
import { fetchHubspotDeals } from "./hubspot";
import { prisma } from "./prisma";
import type { CapacityRow, RowStatus } from "@/types/capacity";

function computeStatus(start: string | null, end: string | null): RowStatus {
  if (!start && !end) return "undated";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startD = start ? new Date(start) : null;
  const endD = end ? new Date(end) : null;

  if (endD && endD < today) return "done";
  if (startD && startD > today) return "todo";
  return "ongoing";
}

function isoDate(val: string | false | null | undefined): string | null {
  if (!val) return null;
  // Odoo returns "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS"
  return val.substring(0, 10);
}

export async function buildCapacityRows(): Promise<CapacityRow[]> {
  const [odooProjects, hubspotDeals, allManualData] = await Promise.all([
    fetchOdooProjects().catch((e) => {
      console.error("Odoo fetch failed:", e);
      return [];
    }),
    fetchHubspotDeals().catch((e) => {
      console.error("HubSpot fetch failed:", e);
      return [];
    }),
    prisma.manualData.findMany(),
  ]);

  const manualMap = new Map(
    allManualData.map((m) => [
      m.id,
      {
        ...m,
        monthlyData: (() => {
          try {
            return JSON.parse(m.monthlyData) as Record<string, number>;
          } catch {
            return {} as Record<string, number>;
          }
        })(),
      },
    ])
  );

  const rows: CapacityRow[] = [];

  for (const p of odooProjects) {
    const id = `odoo-${p.id}`;
    const manual = manualMap.get(id);
    const startDate = isoDate(p.date_start);
    const endDate = isoDate(p.date);

    rows.push({
      id,
      source: "odoo",
      name: p.name,
      startDate,
      endDate,
      effort: manual?.effort ?? null,
      so: extractSoNumber(p),
      monthlyData: manual?.monthlyData ?? {},
      status: computeStatus(startDate, endDate),
    });
  }

  for (const d of hubspotDeals) {
    const id = `hubspot-${d.id}`;
    const manual = manualMap.get(id);

    // Dates for HubSpot deals come from manual data only
    const startDate = manual?.startDate
      ? manual.startDate.toISOString().substring(0, 10)
      : null;
    const endDate = manual?.endDate
      ? manual.endDate.toISOString().substring(0, 10)
      : null;

    rows.push({
      id,
      source: "hubspot",
      name: d.properties.dealname,
      startDate,
      endDate,
      effort: manual?.effort ?? null,
      so: null,
      monthlyData: manual?.monthlyData ?? {},
      status: computeStatus(startDate, endDate),
    });
  }

  // Sort by status: ongoing → todo → done → undated
  const ORDER: Record<string, number> = {
    ongoing: 0,
    todo: 1,
    done: 2,
    undated: 3,
  };
  rows.sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  return rows;
}
