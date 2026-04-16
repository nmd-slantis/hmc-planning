import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#202022]">
      {/* Background slash mark — slantis brand visual */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
        aria-hidden
      >
        <span
          className="text-[60vw] font-bold leading-none opacity-5 text-[#FF7700]"
          style={{ fontFamily: "Space Grotesk, sans-serif" }}
        >
          /
        </span>
      </div>

      <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm text-center">
        {/* Logo */}
        <div className="mb-6">
          <span
            className="text-4xl font-bold text-[#FF7700]"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            /slantis
          </span>
        </div>

        <h1
          className="text-xl font-semibold text-[#202022] mb-1"
          style={{ fontFamily: "Space Grotesk, sans-serif" }}
        >
          HMC Capacity
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Co-creating the extraordinary 🚀
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/hmc" });
          }}
        >
          <button
            type="submit"
            className="w-full bg-[#FF7700] hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            Sign in with Google →
          </button>
        </form>

        <p className="mt-6 text-xs text-gray-400">
          For /slantis team members only
        </p>
      </div>
    </div>
  );
}
