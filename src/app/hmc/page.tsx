import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { buildPlanningRows } from "@/lib/planning";
import { prisma } from "@/lib/prisma";
import { HmcClientLayout } from "@/components/HmcClientLayout";

export const dynamic = "force-dynamic";

export default async function HmcPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [rows, soData, officeData] = await Promise.all([
    buildPlanningRows(),
    prisma.serviceOrder.findMany({ include: { projects: true }, orderBy: { createdAt: "asc" } }),
    prisma.officeOption.findMany({ orderBy: { label: "asc" } }),
  ]);

  const serviceOrders = soData.map((so) => ({
    id: so.id,
    serviceOrderNo: so.serviceOrderNo,
    name: so.name,
    color: so.color,
    docusignUrl: so.docusignUrl,
    projectIds: so.projects.map((p) => p.planningId),
    createdAt: so.createdAt.toISOString(),
    updatedAt: so.updatedAt.toISOString(),
  }));

  const offices = officeData.map((o) => ({
    id: o.id,
    label: o.label,
    color: o.color,
    address: o.address,
    contactName: o.contactName,
    contactEmail: o.contactEmail,
    notes: o.notes,
    createdAt: o.createdAt.toISOString(),
  }));

  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/login" });
  };

  const userRole = (session.user as { role?: string }).role;

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <HmcClientLayout
        initialRows={rows}
        initialServiceOrders={serviceOrders}
        initialOffices={offices}
        email={session.user?.email}
        userRole={userRole}
        today={today}
        signOut={signOutAction}
      />

      <footer className="px-6 py-4 text-center text-[10px] text-gray-400">
        Powered by{" "}
        <span className="text-[#FF7700] font-semibold">/slantis</span> ·
        Co-creating the extraordinary 🧡
      </footer>
    </div>
  );
}
