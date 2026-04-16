import { fetchOdooProjects, extractSoNumber } from "./odoo";
import { fetchHubspotDeals } from "./hubspot";
import { prisma } from "./prisma";
import type { CapacityRow, RowStatus } from "@/types/capacity";

const HS_SERVICE_PIPELINE = "673846910";
const HS_CLOSED_WON_STAGES = new Set(["closedwon", "969753704"]);
const HS_CLOSED_LOST_STAGE = "closedlost";

function hsGroup(pipeline: string | null, stage: string | null): string {
  if (pipeline === HS_SERVICE_PIPELINE) return "Service Pipeline";
  if (stage && HS_CLOSED_WON_STAGES.has(stage)) return "Closed Won";
  if (stage === HS_CLOSED_LOST_STAGE) return "Closed Lost";
  return "Sales Pipeline";
}

const ODOO_GROUP: Record<RowStatus, string> = {
  ongoing: "Ongoing",
  todo:    "To-Do",
  done:    "Completed",
  undated: "No Dates",
};

const GROUP_ORDER: Record<string, number> = {
  "Ongoing":          0,
  "Service Pipeline": 1,
  "To-Do":            2,
  "Sales Pipeline":   3,
  "Closed Won":       4,
  "Completed":        5,
  "Closed Lost":      6,
  "No Dates":         7,
};

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

    const status = computeStatus(startDate, endDate);
    rows.push({
      id,
      source: "odoo",
      name: p.name,
      startDate,
      endDate,
      effort: manual?.effort ?? null,
      so: extractSoNumber(p),
      monthlyData: manual?.monthlyData ?? {},
      status,
      hsPipeline: null,
      hsStage: null,
      group: ODOO_GROUP[status],
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

    const hsPipeline = d.properties.pipeline ?? null;
    const hsStage = d.properties.dealstage ?? null;
    rows.push({
      id,
      source: "hubspot",
      name: d.properties.dealname,
      startDate,
      endDate,
      effort: manual?.effort ?? null,
      so: d.properties.sales_order ?? null,
      monthlyData: manual?.monthlyData ?? {},
      status: computeStatus(startDate, endDate),
      hsPipeline,
      hsStage,
      group: hsGroup(hsPipeline, hsStage),
    });
  }

  rows.sort((a, b) => (GROUP_ORDER[a.group] ?? 99) - (GROUP_ORDER[b.group] ?? 99));

  return rows;
}
