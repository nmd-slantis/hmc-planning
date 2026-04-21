"use client";

import type { ActiveTab } from "./HmcClientLayout";

interface CollapsibleHeaderProps {
  email: string | null | undefined;
  today: string;
  signOut: () => Promise<void>;
  activeTab?: ActiveTab;
  onTabChange?: (tab: ActiveTab) => void;
}

const TAB_LABELS: Record<ActiveTab, string> = {
  "planning":      "Pipeline",
  "admin":         "Details",
  "service-orders":"Service Orders",
  "offices":       "Offices",
};

export function CollapsibleHeader({ email, today, signOut, activeTab, onTabChange }: CollapsibleHeaderProps) {
  return (
    <header className="bg-[#202022] text-white shadow-md">
      <div className="px-6 flex items-center justify-between" style={{ minHeight: "44px" }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-[#FF7700]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            /slantis
          </span>
          <span className="text-gray-500 text-lg font-light">×</span>
          <span className="text-white font-semibold text-base" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            HMC Architects
          </span>

          {onTabChange && (
            <div className="flex items-center gap-1 ml-2">
              {(["planning", "admin", "service-orders", "offices"] as ActiveTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => onTabChange(tab)}
                  className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-colors ${
                    activeTab === tab
                      ? "bg-[#FF7700] text-white border-[#FF7700]"
                      : "text-[#FF7700] border-[#FF7700]/40 hover:bg-[#FF7700]/10"
                  }`}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="hidden sm:block">{today}</span>
          <span className="hidden md:block">{email}</span>
          <form action={signOut}>
            <button type="submit" className="text-gray-400 hover:text-white transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
