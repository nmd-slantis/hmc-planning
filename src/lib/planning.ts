import { fetchOdooProjects, fetchOdooSoDetails, fetchOdooSosByNames, fetchOdooProjectDates, extractSoNumber, type OdooSoData, type OdooProjectDates } from "./odoo";
import { fetchHubspotDeals, fetchHubSpotPortalId } from "./hubspot";
import { prisma } from "./prisma";
import type { PlanningRow, RowStatus } from "@/types/planning";

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

export async function buildPlanningRows(): Promise<PlanningRow[]> {
  const [odooProjects, hubspotDeals, allManualData, hsPortalId] = await Promise.all([
    fetchOdooProjects().catch((e) => {
      console.error("Odoo fetch failed:", e);
      return [];
    }),
    fetchHubspotDeals().catch((e) => {
      console.error("HubSpot fetch failed:", e);
      return [];
    }),
    prisma.manualData.findMany(),
    fetchHubSpotPortalId().catch(() => null),
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

  // ── Seed SO data for unseeded Odoo projects ──────────────────────────────
  try {
    // Collect projects that have a sale_order_id and haven't been seeded yet
    const unseeded = odooProjects.filter(
      (p) =>
        Array.isArray(p.sale_order_id) &&
        !manualMap.get(`odoo-${p.id}`)?.soSeeded
    );

    if (unseeded.length > 0) {
      const soIds = unseeded.map((p) => (p.sale_order_id as [number, string])[0]);
      const soDetails = await fetchOdooSoDetails(soIds);

      for (const p of unseeded) {
        const rowId = `odoo-${p.id}`;
        const soId = (p.sale_order_id as [number, string])[0];
        const so = soDetails.get(soId);
        if (!so) continue;

        const existing = manualMap.get(rowId);

        const rawHrs = so.x_studio_sold_hours;
        const parsedHrs = rawHrs !== false && rawHrs !== null && rawHrs !== undefined
          ? parseFloat(String(rawHrs))
          : NaN;
        const soldHrs = !isNaN(parsedHrs) && parsedHrs > 0
          ? parsedHrs
          : existing?.soldHrs ?? null;

        // Only set dates if not already manually set
        const startDate =
          existing?.startDate !== undefined && existing.startDate !== null
            ? existing.startDate
            : so.x_studio_project_start_date
            ? new Date(isoDate(so.x_studio_project_start_date) as string)
            : existing?.startDate ?? null;

        const endDate =
          existing?.endDate !== undefined && existing.endDate !== null
            ? existing.endDate
            : so.x_studio_project_end_date
            ? new Date(isoDate(so.x_studio_project_end_date) as string)
            : existing?.endDate ?? null;

        const upsertData = {
          id: rowId,
          source: "odoo",
          sourceId: String(p.id),
          soSeeded: true,
          soldHrs,
          startDate,
          endDate,
          effort: existing?.effort ?? null,
          monthlyData: existing
            ? JSON.stringify(existing.monthlyData)
            : "{}",
        };

        await prisma.manualData.upsert({
          where: { id: rowId },
          create: upsertData,
          update: upsertData,
        });

        // Update in-memory map so rows built below see seeded values
        manualMap.set(rowId, {
          ...(existing ?? {
            id: rowId,
            source: "odoo",
            sourceId: String(p.id),
            effort: null,
            updatedAt: new Date(),
            monthlyData: {},
          }),
          soSeeded: true,
          soldHrs,
          startDate,
          endDate,
        } as typeof existing & { soSeeded: boolean; soldHrs: number | null; startDate: Date | null; endDate: Date | null; monthlyData: Record<string, number> });
      }
    }
  } catch (e) {
    console.error("SO seeding failed (non-fatal):", e);
  }
  // ────────────────────────────────────────────────────────────────────────

  // ── Seed HubSpot deals: dates (from HS) + soldHrs + odooSoUrl (from Odoo SO) ──
  // HubSpot returns date properties as Unix ms timestamps (string)
  const parseHsDate = (v: string | null | undefined): Date | null => {
    if (!v) return null;
    const ts = parseInt(v);
    return isNaN(ts) ? null : new Date(ts);
  };

  // Fetch Odoo SO data for all HS deals that have a SO name
  let hsSoMap = new Map<string, OdooSoData>();
  try {
    const soNames = hubspotDeals
      .map((d) => d.properties.sales_order)
      .filter((s): s is string => !!s && s.trim() !== "");
    if (soNames.length > 0) {
      hsSoMap = await fetchOdooSosByNames(soNames);
    }
  } catch (e) {
    console.error("HubSpot SO Odoo lookup failed (non-fatal):", e);
  }

  // Fetch project dates for all projects linked to those SOs
  let projectDatesMap = new Map<number, OdooProjectDates>();
  try {
    const projectIds = new Set<number>();
    for (const so of Array.from(hsSoMap.values())) {
      for (const pid of so.project_ids ?? []) projectIds.add(pid);
    }
    if (projectIds.size > 0) {
      projectDatesMap = await fetchOdooProjectDates(Array.from(projectIds));
    }
  } catch (e) {
    console.error("Odoo project dates fetch failed (non-fatal):", e);
  }

  /** Min start date + max end date across all projects linked to a SO */
  const getSoProjectDates = (so: OdooSoData): { startDate: Date | null; endDate: Date | null } => {
    const starts: number[] = [];
    const ends: number[] = [];
    for (const pid of so.project_ids ?? []) {
      const proj = projectDatesMap.get(pid);
      if (proj?.date_start) {
        const d = new Date(String(proj.date_start).substring(0, 10));
        if (!isNaN(d.getTime())) starts.push(d.getTime());
      }
      if (proj?.date) {
        const d = new Date(String(proj.date).substring(0, 10));
        if (!isNaN(d.getTime())) ends.push(d.getTime());
      }
    }
    return {
      startDate: starts.length > 0 ? new Date(Math.min(...starts)) : null,
      endDate: ends.length > 0 ? new Date(Math.max(...ends)) : null,
    };
  };

  try {
    for (const d of hubspotDeals) {
      const rowId = `hubspot-${d.id}`;
      const existing = manualMap.get(rowId);
      const soData = d.properties.sales_order ? hsSoMap.get(d.properties.sales_order) : undefined;
      const projDates = soData ? getSoProjectDates(soData) : { startDate: null, endDate: null };

      const needsFullSeed = !existing?.soSeeded &&
        (projDates.startDate || projDates.endDate || d.properties.project_start_date || d.properties.project_end_date || soData);
      const needsSoldHrsSeed = (existing?.soldHrs == null) && !!soData;

      if (!needsFullSeed && !needsSoldHrsSeed) continue;

      // Project dates primary → HS dates fallback → keep existing
      const startDate =
        existing?.startDate !== undefined && existing.startDate !== null
          ? existing.startDate
          : projDates.startDate ?? parseHsDate(d.properties.project_start_date);

      const endDate =
        existing?.endDate !== undefined && existing.endDate !== null
          ? existing.endDate
          : projDates.endDate ?? parseHsDate(d.properties.project_end_date);

      let soldHrs = existing?.soldHrs ?? null;
      if (needsSoldHrsSeed && soData) {
        const rawHrs = soData.x_studio_sold_hours;
        const parsed = rawHrs !== false && rawHrs != null
          ? parseFloat(String(rawHrs)) : NaN;
        if (!isNaN(parsed) && parsed > 0) soldHrs = parsed;
      }

      const upsertData = {
        id: rowId,
        source: "hubspot",
        sourceId: d.id,
        soSeeded: true,
        soldHrs,
        startDate,
        endDate,
        effort: existing?.effort ?? null,
        monthlyData: existing ? JSON.stringify(existing.monthlyData) : "{}",
      };

      await prisma.manualData.upsert({
        where: { id: rowId },
        create: upsertData,
        update: upsertData,
      });

      manualMap.set(rowId, {
        ...(existing ?? {
          id: rowId,
          source: "hubspot",
          sourceId: d.id,
          effort: null,
          updatedAt: new Date(),
          monthlyData: {},
        }),
        soSeeded: true,
        soldHrs,
        startDate,
        endDate,
      } as typeof existing & { soSeeded: boolean; soldHrs: number | null; startDate: Date | null; endDate: Date | null; monthlyData: Record<string, number> });
    }
  } catch (e) {
    console.error("HubSpot seeding failed (non-fatal):", e);
  }
  // ────────────────────────────────────────────────────────────────────────

  const rows: PlanningRow[] = [];

  for (const p of odooProjects) {
    const id = `odoo-${p.id}`;
    const manual = manualMap.get(id);

    // Use manual dates (seeded or manually set) falling back to Odoo project dates
    const startDate =
      manual?.startDate
        ? (manual.startDate instanceof Date
            ? manual.startDate.toISOString().substring(0, 10)
            : String(manual.startDate).substring(0, 10))
        : isoDate(p.date_start);
    const endDate =
      manual?.endDate
        ? (manual.endDate instanceof Date
            ? manual.endDate.toISOString().substring(0, 10)
            : String(manual.endDate).substring(0, 10))
        : isoDate(p.date);

    const status = computeStatus(startDate, endDate);
    rows.push({
      id,
      source: "odoo",
      name: p.name,
      startDate,
      endDate,
      effort: manual?.effort ?? null,
      soldHrs: manual?.soldHrs ?? null,
      so: extractSoNumber(p),
      monthlyData: manual?.monthlyData ?? {},
      status,
      hsPipeline: null,
      hsStage: null,
      hsUrl: null,
      odooSoUrl: Array.isArray(p.sale_order_id)
        ? `${process.env.ODOO_URL}/web#id=${(p.sale_order_id as [number, string])[0]}&cids=1-2-3&menu_id=336&action=483&model=sale.order&view_type=form`
        : null,
      group: ODOO_GROUP[status],
    });
  }

  for (const d of hubspotDeals) {
    const id = `hubspot-${d.id}`;
    const manual = manualMap.get(id);

    // Dates for HubSpot deals come from manual data only
    const startDate = manual?.startDate
      ? (manual.startDate instanceof Date
          ? manual.startDate.toISOString().substring(0, 10)
          : String(manual.startDate).substring(0, 10))
      : null;
    const endDate = manual?.endDate
      ? (manual.endDate instanceof Date
          ? manual.endDate.toISOString().substring(0, 10)
          : String(manual.endDate).substring(0, 10))
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
      soldHrs: manual?.soldHrs ?? null,
      so: d.properties.sales_order ?? null,
      monthlyData: manual?.monthlyData ?? {},
      status: computeStatus(startDate, endDate),
      hsPipeline,
      hsStage,
      hsUrl: hsPortalId ? `https://app.hubspot.com/contacts/${hsPortalId}/deal/${d.id}` : null,
      odooSoUrl: (() => {
        const so = d.properties.sales_order ? hsSoMap.get(d.properties.sales_order) : undefined;
        return so ? `${process.env.ODOO_URL}/web#id=${so.id}&cids=1-2-3&menu_id=336&action=483&model=sale.order&view_type=form` : null;
      })(),
      group: hsGroup(hsPipeline, hsStage),
    });
  }

  rows.sort((a, b) => (GROUP_ORDER[a.group] ?? 99) - (GROUP_ORDER[b.group] ?? 99));

  return rows;
}
