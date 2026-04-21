export interface HubspotDeal {
  id: string;
  properties: {
    dealname: string;
    pipeline: string | null;
    dealstage: string | null;
    createdate: string | null;
    closedate: string | null;
    sales_order: string | null;
    project_start_date: string | null;
    project_end_date: string | null;
  };
}

const BASE = "https://api.hubapi.com";

async function hs<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function getHmcCompanyId(): Promise<string | null> {
  const data = await hs<{ results: { id: string }[] }>(
    "/crm/v3/objects/companies/search",
    {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              { propertyName: "name", operator: "EQ", value: "HMC Architects" },
            ],
          },
        ],
        properties: ["name"],
        limit: 1,
      }),
      next: { revalidate: 3600 },
    }
  );
  return data.results?.[0]?.id ?? null;
}

async function getDealIdsForCompany(companyId: string): Promise<string[]> {
  const data = await hs<{ results: { id: string; type: string }[] }>(
    `/crm/v3/objects/companies/${companyId}/associations/deals`,
    {
      next: { revalidate: 300 },
    }
  );
  return (data.results ?? []).map((r) => r.id);
}

export async function fetchHubspotDeals(): Promise<HubspotDeal[]> {
  const companyId = await getHmcCompanyId();
  if (!companyId) return [];

  const dealIds = await getDealIdsForCompany(companyId);
  if (!dealIds.length) return [];

  // Batch read deals (max 100 per request)
  const chunks: string[][] = [];
  for (let i = 0; i < dealIds.length; i += 100) {
    chunks.push(dealIds.slice(i, i + 100));
  }

  const allDeals: HubspotDeal[] = [];

  for (const chunk of chunks) {
    const data = await hs<{ results: HubspotDeal[] }>(
      "/crm/v3/objects/deals/batch/read",
      {
        method: "POST",
        body: JSON.stringify({
          inputs: chunk.map((id) => ({ id })),
          properties: ["dealname", "pipeline", "dealstage", "createdate", "closedate", "sales_order", "project_start_date", "project_end_date"],
        }),
        next: { revalidate: 300 },
      }
    );
    allDeals.push(...(data.results ?? []));
  }

  // No filtering — all deals shown, color-coded by pipeline/stage in the UI.
  return allDeals;
}

interface HubSpotPipelineStage { id: string; label: string; }
interface HubSpotPipeline { id: string; stages: HubSpotPipelineStage[]; }

export async function fetchDealPipelineStages(): Promise<Map<string, string>> {
  try {
    const data = await hs<{ results: HubSpotPipeline[] }>("/crm/v3/pipelines/deals", {
      next: { revalidate: 3600 },
    } as RequestInit);
    const map = new Map<string, string>();
    for (const pipeline of data.results ?? []) {
      for (const stage of pipeline.stages ?? []) {
        map.set(stage.id, stage.label);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function fetchHubSpotPortalId(): Promise<number | null> {
  try {
    const data = await hs<{ portalId: number }>("/integrations/v1/me");
    return data.portalId ?? null;
  } catch {
    return null;
  }
}
