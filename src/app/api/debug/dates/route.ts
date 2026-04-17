import { NextResponse } from "next/server";
import { buildPlanningRows } from "@/lib/planning";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await buildPlanningRows();

  const sample = rows
    .filter((r) => r.so)
    .slice(0, 10)
    .map((r) => ({
      name: r.name,
      so: r.so,
      startDate: r.startDate,
      endDate: r.endDate,
    }));

  const withDates = rows.filter((r) => r.startDate || r.endDate).length;
  const withSO = rows.filter((r) => r.so).length;

  return NextResponse.json({ total: rows.length, withSO, withDates, sample });
}
