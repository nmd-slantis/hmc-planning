import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function serializeSo(so: { id: string; serviceOrderNo: string | null; name: string; color: string | null; docusignUrl: string | null; projects: { planningId: string }[]; createdAt: Date; updatedAt: Date }) {
  return {
    id: so.id,
    serviceOrderNo: so.serviceOrderNo,
    name: so.name,
    color: so.color,
    docusignUrl: so.docusignUrl,
    projectIds: so.projects.map((p) => p.planningId),
    createdAt: so.createdAt.toISOString(),
    updatedAt: so.updatedAt.toISOString(),
  };
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sos = await prisma.serviceOrder.findMany({
    include: { projects: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(sos.map(serializeSo));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { serviceOrderNo, name, color } = await req.json();
  const so = await prisma.serviceOrder.create({
    data: { serviceOrderNo: serviceOrderNo || null, name: name || "", color: color || null },
    include: { projects: true },
  });

  return NextResponse.json(serializeSo(so), { status: 201 });
}
