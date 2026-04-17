import { fetchOdooSosByNames, fetchOdooProjectDates, type OdooSoData, type OdooProjectDates } from "./odoo";
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

function dateToIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString().substring(0, 10) : String(d).substring(0, 10);
}

export async function buildPlanningRows(): Promise<PlanningRow[]> {
  const [hubspotDeals, allManualData, hsPortalId] = await Promise.all([
    fetchHubspotDeals().catch((e) => { console.error("HubSpot fetch failed:", e); return []; }),
    prisma.manualData.findMany(),
    fetchHubSpotPortalId().catch(() => null),
  ]);

  const manualMap = new Map(
    allManualData.map((m) => [
      m.id,
      {
        ...m,
        monthlyData: (() => {
          try { return JSON.parse(m.monthlyData) as Record<string, number>; }
          catch { return {} as Record<string, number>; }
        })(),
      },
    ])
  );

  // ── Fetch Odoo SO data for all HS deals that have a SO name ──────────────
  const parseHsDate = (v: string | null | undefined): Date | null => {
    if (!v) return null;
    const ts = parseInt(v);
    if (isNaN(ts) || ts === 0) return null;
    return new Date(ts);
  };

  const isValidDate = (d: Date | null | undefined): d is Date =>
    d != null && !isNaN(d.getTime()) && d.getFullYear() >= 2020;

  let hsSoMap = new Map<string, OdooSoData>();
  try {
    const soNames = hubspotDeals
      .map((d) => d.properties.sales_order)
      .filter((s): s is string => !!s && s.trim() !== "");
    if (soNames.length > 0) hsSoMap = await fetchOdooSosByNames(soNames);
  } catch (e) {
    console.error("HubSpot SO Odoo lookup failed (non-fatal):", e);
  }

  // ── Fetch project dates for all project_ids linked to those SOs ──────────
  let projectDatesMap = new Map<number, OdooProjectDates>();
  try {
    const projectIds = new Set<number>();
    for (const so of Array.from(hsSoMap.values())) {
      for (const pid of so.project_ids ?? []) projectIds.add(pid);
    }
    if (projectIds.size > 0) projectDatesMap = await fetchOdooProjectDates(Array.from(projectIds));
  } catch (e) {
    console.error("Odoo project dates fetch failed (non-fatal):", e);
  }

  /** Min start + max end across all Odoo projects linked to a SO */
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

  // ── Seed manual data for unseeded HubSpot deals ──────────────────────────
  try {
    for (const d of hubspotDeals) {
      const rowId = `hubspot-${d.id}`;
      const existing = manualMap.get(rowId);
      const soData = d.properties.sales_order ? hsSoMap.get(d.properties.sales_order) : undefined;
      const projDates = soData ? getSoProjectDates(soData) : { startDate: null, endDate: null };

      // Canonical dates: SO+projects → project dates; SO only → SO date_order / null; no SO → HS project dates / null
      const canonicalStart: Date | null = soData
        ? (projDates.startDate ?? (soData.date_order
            ? new Date(String(soData.date_order).substring(0, 10))
            : null))
        : parseHsDate(d.properties.project_start_date);
      const canonicalEnd: Date | null = soData
        ? (projDates.endDate ?? null)
        : parseHsDate(d.properties.project_end_date);

      const storedStartStr   = isValidDate(existing?.startDate) ? dateToIso(existing.startDate) : null;
      const storedEndStr     = isValidDate(existing?.endDate)   ? dateToIso(existing.endDate)   : null;
      const canonicalStartStr = canonicalStart ? dateToIso(canonicalStart) : null;
      const canonicalEndStr   = canonicalEnd   ? dateToIso(canonicalEnd)   : null;

      // Re-seed whenever computed dates differ from stored (overrides stale/epoch values)
      const needsDateSeed = storedStartStr !== canonicalStartStr || storedEndStr !== canonicalEndStr;
      const needsSoldHrsSeed = existing?.soldHrs == null && !!soData;
      if (!needsDateSeed && !needsSoldHrsSeed) continue;

      const startDate = canonicalStart;
      const endDate = canonicalEnd;

      let soldHrs = existing?.soldHrs ?? null;
      if (needsSoldHrsSeed && soData) {
        const rawHrs = soData.x_studio_sold_hours;
        const parsed = rawHrs !== false && rawHrs != null ? parseFloat(String(rawHrs)) : NaN;
        if (!isNaN(parsed) && parsed > 0) soldHrs = parsed;
      }

      const upsertData = {
        id: rowId, source: "hubspot", sourceId: d.id, soSeeded: true,
        soldHrs, startDate, endDate,
        effort: existing?.effort ?? null,
        monthlyData: existing ? JSON.stringify(existing.monthlyData) : "{}",
      };

      await prisma.manualData.upsert({ where: { id: rowId }, create: upsertData, update: upsertData });

      manualMap.set(rowId, {
        ...(existing ?? { id: rowId, source: "hubspot", sourceId: d.id, effort: null, updatedAt: new Date(), monthlyData: {} }),
        soSeeded: true, soldHrs, startDate, endDate,
      } as typeof existing & { soSeeded: boolean; soldHrs: number | null; startDate: Date | null; endDate: Date | null; monthlyData: Record<string, number> });
    }
  } catch (e) {
    console.error("HubSpot seeding failed (non-fatal):", e);
  }
  // ─────────────────────────────────────────────────────────────────────────

  const rows: PlanningRow[] = [];

  for (const d of hubspotDeals) {
    const id = `hubspot-${d.id}`;
    const manual = manualMap.get(id);
    const soData = d.properties.sales_order ? hsSoMap.get(d.properties.sales_order) : undefined;
    const projDates = soData ? getSoProjectDates(soData) : { startDate: null, endDate: null };
    // Dates: fully live — SO+projects → project dates; SO only → SO date_order / null; no SO → HS project dates / null
    const startDate: string | null = soData
      ? (projDates.startDate
          ? dateToIso(projDates.startDate)
          : (soData.date_order ? String(soData.date_order).substring(0, 10) : null))
      : dateToIso(parseHsDate(d.properties.project_start_date));
    const endDate: string | null = soData
      ? dateToIso(projDates.endDate)
      : dateToIso(parseHsDate(d.properties.project_end_date));
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
      odooSoUrl: soData
        ? `${process.env.ODOO_URL}/web#id=${soData.id}&cids=1-2-3&menu_id=336&action=483&model=sale.order&view_type=form`
        : null,
      comments: manual?.comments ?? null,
      docusignUrl: manual?.docusignUrl ?? null,
      approved: manual?.approved ?? false,
      group: hsGroup(hsPipeline, hsStage),
    });
  }

  rows.sort((a, b) => {
    const groupDiff = (GROUP_ORDER[a.group] ?? 99) - (GROUP_ORDER[b.group] ?? 99);
    if (groupDiff !== 0) return groupDiff;
    // Within group: sort by end date, then start date (nulls last)
    const endA = a.endDate ?? "9999-99-99";
    const endB = b.endDate ?? "9999-99-99";
    if (endA !== endB) return endA < endB ? -1 : 1;
    const startA = a.startDate ?? "9999-99-99";
    const startB = b.startDate ?? "9999-99-99";
    return startA < startB ? -1 : startA > startB ? 1 : 0;
  });
  return rows;
}
