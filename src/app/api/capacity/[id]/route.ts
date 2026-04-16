import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const record = await prisma.manualData.findUnique({
    where: { id: params.id },
  });
  return NextResponse.json(record ?? null);
}

// PATCH /api/capacity/[id]
// Body variants:
//   { effort: number | null }
//   { startDate: string | null }  — Hubspot only
//   { endDate: string | null }    — Hubspot only
//   { monthKey: string, monthHours: number }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const id = params.id;
  const [source, ...rest] = id.split("-");
  const sourceId = rest.join("-");

  const existing = await prisma.manualData.findUnique({ where: { id } });
  let currentMonthly: Record<string, number> = {};
  if (existing?.monthlyData) {
    try {
      currentMonthly = JSON.parse(existing.monthlyData);
    } catch {}
  }

  // Merge monthly update
  if (body.monthKey !== undefined && body.monthHours !== undefined) {
    currentMonthly[body.monthKey] =
      body.monthHours === "" || body.monthHours === null
        ? 0
        : Number(body.monthHours);
  }

  const data: Parameters<typeof prisma.manualData.upsert>[0]["create"] = {
    id,
    source,
    sourceId,
    monthlyData: JSON.stringify(currentMonthly),
  };

  if (body.effort !== undefined) {
    data.effort =
      body.effort === "" || body.effort === null ? null : Number(body.effort);
  } else if (existing?.effort !== undefined) {
    data.effort = existing.effort;
  }

  if (body.soldHrs !== undefined) {
    data.soldHrs =
      body.soldHrs === "" || body.soldHrs === null ? null : Number(body.soldHrs);
  } else if (existing?.soldHrs !== undefined) {
    data.soldHrs = existing.soldHrs;
  }

  // Always preserve the seed flag so manual edits don't reset it
  data.soSeeded = existing?.soSeeded ?? false;

  if (body.startDate !== undefined) {
    data.startDate = body.startDate ? new Date(body.startDate) : null;
  } else if (existing?.startDate !== undefined) {
    data.startDate = existing.startDate;
  }

  if (body.endDate !== undefined) {
    data.endDate = body.endDate ? new Date(body.endDate) : null;
  } else if (existing?.endDate !== undefined) {
    data.endDate = existing.endDate;
  }

  const record = await prisma.manualData.upsert({
    where: { id },
    create: data,
    update: data,
  });

  // Return a serializable version
  return NextResponse.json({
    ...record,
    startDate: record.startDate?.toISOString().substring(0, 10) ?? null,
    endDate: record.endDate?.toISOString().substring(0, 10) ?? null,
  });
}
