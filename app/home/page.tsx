import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AuthCard from "@/components/auth/AuthCard";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/feed");

  return (
    <main className="px-[var(--gutter)] py-[clamp(40px,6vw,96px)]">
      <div className="mx-auto max-w-[var(--max)]">
        <div className="mb-12 flex items-center justify-between">
          <span className="mono text-[11px] uppercase tracking-meta text-cyan flicker">Transmission 01</span>
          <span className="mono text-[11px] uppercase tracking-meta text-cyan hidden md:inline">Hosted · Frankfurt · Earth</span>
        </div>

        <AuthCard />

        <footer className="mx-auto mt-20 max-w-[680px] text-center">
          <p className="terminal text-[clamp(15px,1.4vw,20px)] text-star-soft leading-relaxed">
            A social network for the small, remarkable corner of the universe you actually inhabit.
            Smaller circles by default. Words and images, equal citizens.
            European in construction — hosted in the EU.
          </p>
          <p className="mono mt-6 text-[11px] uppercase tracking-meta text-magenta glow-magenta">
            Mnemonic Studio · Stardate 2026.05
          </p>
          <p className="terminal mt-3 text-[18px] text-cyan glow-cyan">We are, all of us, made of star-stuff.</p>
        </footer>
      </div>
    </main>
  );
}
