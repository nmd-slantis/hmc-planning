import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchOdooProjects } from "@/lib/odoo";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const projects = await fetchOdooProjects();
    return NextResponse.json(projects);
  } catch (err) {
    console.error("Odoo fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch Odoo projects" },
      { status: 500 }
    );
  }
}
