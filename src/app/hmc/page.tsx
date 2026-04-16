import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { buildPlanningRows } from "@/lib/planning";
import { PlanningTable } from "@/components/PlanningTable";
import { CollapsibleHeader } from "@/components/CollapsibleHeader";

export const dynamic = "force-dynamic";

export default async function HmcPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rows = await buildPlanningRows();

  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/login" });
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <CollapsibleHeader
        email={session.user?.email}
        today={today}
        rowCount={rows.length}
        signOut={signOutAction}
      />

      <main className="px-6 py-6 pb-10">
        <PlanningTable initialRows={rows} />
      </main>

      <footer className="px-6 py-4 text-center text-[10px] text-gray-400">
        Powered by{" "}
        <span className="text-[#FF7700] font-semibold">/slantis</span> ·
        Co-creating the extraordinary 🧡
      </footer>
    </div>
  );
}
