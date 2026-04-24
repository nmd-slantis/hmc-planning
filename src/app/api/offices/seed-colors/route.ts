import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BRAND_COLORS } from "@/lib/brand-colors";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const offices = await prisma.officeOption.findMany({ orderBy: { id: "asc" } });

  // Shuffle palette so each call gives a fresh random assignment
  const palette = [...BRAND_COLORS].sort(() => Math.random() - 0.5);

  const updated = await Promise.all(
    offices.map((o, i) =>
      prisma.officeOption.update({
        where: { id: o.id },
        data: { color: palette[i % palette.length] },
      })
    )
  );

  return NextResponse.json(
    updated.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() }))
  );
}
