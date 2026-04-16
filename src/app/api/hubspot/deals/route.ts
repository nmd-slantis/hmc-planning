import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchHubspotDeals } from "@/lib/hubspot";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const deals = await fetchHubspotDeals();
    return NextResponse.json(deals);
  } catch (err) {
    console.error("HubSpot fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch HubSpot deals" },
      { status: 500 }
    );
  }
}
