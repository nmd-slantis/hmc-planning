import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { buildCapacityRows } from "@/lib/capacity";
import { CapacityTable } from "@/components/CapacityTable";

export const dynamic = "force-dynamic";

export default async function HmcPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rows = await buildCapacityRows();

  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* Header */}
      <header className="bg-[#202022] text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <span
            className="text-2xl font-bold text-[#FF7700]"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            /slantis
          </span>
          <span className="text-gray-500 text-lg font-light">×</span>
          <span
            className="text-white font-semibold text-base"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            HMC Architects
          </span>
          <span className="ml-2 text-[10px] bg-[#FF7700]/20 text-[#FF7700] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider border border-[#FF7700]/30">
            Capacity
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-xs hidden sm:block">{today}</span>
          <span className="text-gray-400 text-xs hidden md:block">
            {session.user?.email}
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Legend */}
      <div className="px-6 pt-4 pb-2 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-200 inline-block" />
          Ongoing
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200 inline-block" />
          To-Do
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-200 inline-block" />
          Completed
        </span>
        <span className="ml-4 text-gray-400">
          💡 Click any cell to edit · FTE = h ÷ 172
        </span>
        <span className="ml-auto text-gray-400">
          {rows.length} project{rows.length !== 1 ? "s" : ""} · Sources: Odoo + Hubspot
        </span>
      </div>

      {/* Table */}
      <main className="px-6 pb-10">
        <CapacityTable initialRows={rows} />
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center text-[10px] text-gray-400">
        Powered by{" "}
        <span className="text-[#FF7700] font-semibold">/slantis</span> ·
        Co-creating the extraordinary 🧡
      </footer>
    </div>
  );
}
