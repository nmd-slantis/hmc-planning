export interface HubspotDeal {
  id: string;
  properties: {
    dealname: string;
    pipeline: string | null;
    dealstage: string | null;
    createdate: string | null;
    closedate: string | null;
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
          properties: ["dealname", "pipeline", "dealstage", "createdate", "closedate"],
        }),
        next: { revalidate: 300 },
      }
    );
    allDeals.push(...(data.results ?? []));
  }

  // Filter: exclude Closed Won and Service Pipeline
  return allDeals.filter((d) => {
    const stage = (d.properties.dealstage ?? "").toLowerCase();
    const pipeline = (d.properties.pipeline ?? "").toLowerCase();
    if (stage === "closedwon") return false;
    if (pipeline === "service_pipeline" || pipeline.includes("service")) return false;
    return true;
  });
}
