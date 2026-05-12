import ReturnDot from "@/components/feed/ReturnDot";
import Link from "next/link";

export default function Masthead({
  withReturn = false,
  active = "feed",
  subtitle,
}: {
  withReturn?: boolean;
  active?: "feed" | "nutrition";
  subtitle?: string;
}) {
  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="border-b border-cyan/40 pb-6 mb-10">
      <div className="flex items-center justify-between border-b border-purple/40 pb-3 mono text-[11px] uppercase tracking-meta text-cyan">
        <span>Transmission 01</span>
        <span className="hidden md:inline glow-magenta text-magenta">Connect Europe</span>
        <span className="hidden md:inline">{today}</span>
      </div>
      <h1 className="wordmark mt-7 text-center text-[clamp(40px,13vw,168px)] whitespace-nowrap">
        Memonic{withReturn ? <ReturnDot /> : <span className="dot">.</span>}
      </h1>
      <p className="terminal text-center mt-3 text-star-soft text-[clamp(16px,1.4vw,22px)]">
        {subtitle ?? "A small corner of the universe, observed honestly."}
      </p>
      {active === "nutrition" && (
        <nav aria-label="Main navigation" className="mt-5 flex justify-center">
          <Link
            href="/nutrition"
            aria-current="page"
            className="mono text-[10px] uppercase tracking-meta px-6 py-2.5 no-underline border border-purple/40 bg-yellow/10 text-yellow [box-shadow:inset_0_-2px_0_var(--yellow)]"
          >
            Nutrition
          </Link>
        </nav>
      )}
    </header>
  );
}
