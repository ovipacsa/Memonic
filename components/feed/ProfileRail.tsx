"use client";

import { useRouter } from "next/navigation";

export type Me = {
  id: string;
  display_name: string;
  email: string;
  photo: string | null;
  city: string | null;
  bio: string | null;
  created_at: string;
};

export default function ProfileRail({ me }: { me: Me }) {
  const router = useRouter();
  const joined = new Date(me.created_at).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric"
  });

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <aside className="border border-purple/60 bg-midnight-soft/60 p-7 shadow-[0_0_38px_rgba(157,0,255,0.18)] relative overflow-hidden">
      <p className="mono text-[10.5px] uppercase tracking-meta text-magenta glow-magenta">
        Your perspective from Earth
      </p>

      <div className="mt-5 flex items-start gap-3">
        {me.photo ? (
          <img
            src={me.photo}
            alt={me.display_name}
            loading="lazy"
            className="h-14 w-14 shrink-0 border-2 border-cyan object-cover shadow-[0_0_18px_rgba(0,240,255,0.55)]"
          />
        ) : (
          <div className="h-14 w-14 shrink-0 border-2 border-cyan bg-midnight-deep flex items-center justify-center font-display text-[24px] text-magenta glow-magenta shadow-[0_0_18px_rgba(0,240,255,0.35)]">
            {me.display_name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-chrome text-[18px] leading-tight text-star tracking-wide break-words">{me.display_name}</h2>
          {me.city && (
            <p className="terminal text-cyan text-[17px] mt-1 truncate">{me.city}</p>
          )}
        </div>
      </div>

      {me.bio && (
        <p className="terminal text-star-soft mt-5 text-[18px] leading-relaxed">
          {"\u201C"}{me.bio}{"\u201D"}
        </p>
      )}

      <dl className="mt-6 space-y-3 border-t border-cyan/30 pt-5">
        <div>
          <dt className="mono text-[10px] uppercase tracking-meta text-magenta">Member since</dt>
          <dd className="terminal text-[19px] text-star mt-0.5">{joined}</dd>
        </div>
        <div>
          <dt className="mono text-[10px] uppercase tracking-meta text-magenta">Signal hosted in</dt>
          <dd className="terminal text-[17px] text-cyan mt-0.5">Frankfurt &amp; Amsterdam</dd>
        </div>
      </dl>

      <button onClick={logout} className="ghost mt-7 w-full border-t border-cyan/30 pt-4 text-left flex items-center gap-2">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Sign out
      </button>
    </aside>
  );
}
