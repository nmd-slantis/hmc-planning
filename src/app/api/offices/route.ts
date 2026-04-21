import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const options = await prisma.officeOption.findMany({ orderBy: { label: "asc" } });
  return NextResponse.json(
    options.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { label, color, address, contactName, contactEmail, notes } = await req.json();
  if (!label?.trim()) return NextResponse.json({ error: "Label required" }, { status: 400 });
  const option = await prisma.officeOption.create({
    data: {
      label: label.trim(),
      color: color || null,
      address: address?.trim() || null,
      contactName: contactName?.trim() || null,
      contactEmail: contactEmail?.trim() || null,
      notes: notes?.trim() || null,
    },
  });
  return NextResponse.json({ ...option, createdAt: option.createdAt.toISOString() }, { status: 201 });
}
