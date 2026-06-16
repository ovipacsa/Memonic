"use client";

import { useState, useCallback, useEffect } from "react";
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

  const [showPurge, setShowPurge] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const closePurge = useCallback(() => {
    if (purging) return;
    setShowPurge(false);
    setPurgeError(null);
  }, [purging]);

  useEffect(() => {
    if (!showPurge) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePurge(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPurge, closePurge]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  async function confirmPurge() {
    setPurging(true);
    setPurgeError(null);
    try {
      const res = await fetch("/api/auth/purge", { method: "POST" });
      if (res.ok) {
        router.replace("/home");
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        setPurgeError((body as { error?: string }).error ?? "Something went wrong. Try again.");
        setPurging(false);
      }
    } catch {
      setPurgeError("Network error. Try again.");
      setPurging(false);
    }
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

      <div className="mt-7 border-t border-cyan/30 pt-4 flex items-center justify-between">
        <button onClick={logout} className="ghost text-left flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
        <button
          onClick={() => setShowPurge(true)}
          aria-label="Purge account"
          className="mono uppercase"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--magenta)",
            fontSize: "10px",
            letterSpacing: "0.2em",
            padding: 0,
            opacity: 0.65,
            transition: "opacity 150ms ease",
            fontFamily: "var(--font-space-mono)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.65")}
        >
          Purge
        </button>
      </div>

      {showPurge && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="purge-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(13,2,33,0.85)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closePurge(); }}
        >
          <div style={{
            background: "var(--midnight)",
            border: "1px solid rgba(255,0,160,0.4)",
            boxShadow: "0 0 40px rgba(255,0,160,0.15), inset 0 0 30px rgba(13,2,33,0.9)",
            borderRadius: "2px",
            padding: "28px 32px",
            width: "min(420px, 90vw)",
            animation: "fadeSlideIn 0.2s ease both",
          }}>
            <h2 id="purge-title" className="mono uppercase text-magenta glow-magenta" style={{ fontSize: "13px", letterSpacing: "0.2em", margin: "0 0 12px" }}>
              Purge account
            </h2>
            <p className="terminal text-star-soft" style={{ fontSize: "14px", lineHeight: 1.55, margin: "0 0 8px" }}>
              This will permanently deactivate your account. You will be logged out and will not be able to sign back in.
            </p>
            <p className="terminal" style={{ fontSize: "12px", color: "var(--mute)", margin: "0 0 20px" }}>
              Your posts and data are retained. This action cannot be undone from the app.
            </p>

            {purgeError && (
              <p className="terminal" style={{ fontSize: "12px", color: "var(--magenta)", margin: "0 0 14px" }}>
                {purgeError}
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                onClick={closePurge}
                disabled={purging}
                className="mono uppercase"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(0,240,255,0.3)",
                  color: "var(--cyan)",
                  fontSize: "10px",
                  letterSpacing: "0.15em",
                  padding: "6px 14px",
                  cursor: purging ? "not-allowed" : "pointer",
                  opacity: purging ? 0.4 : 0.8,
                  transition: "opacity 120ms ease",
                  fontFamily: "var(--font-space-mono)",
                }}
                onMouseEnter={(e) => { if (!purging) e.currentTarget.style.opacity = "1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = purging ? "0.4" : "0.8"; }}
              >
                Cancel
              </button>
              <button
                onClick={confirmPurge}
                disabled={purging}
                aria-label="Confirm account purge"
                className="mono uppercase"
                style={{
                  background: "rgba(255,0,160,0.12)",
                  border: "1px solid rgba(255,0,160,0.5)",
                  color: "var(--magenta)",
                  fontSize: "10px",
                  letterSpacing: "0.15em",
                  padding: "6px 14px",
                  cursor: purging ? "not-allowed" : "pointer",
                  opacity: purging ? 0.5 : 1,
                  transition: "opacity 120ms ease, background 120ms ease",
                  fontFamily: "var(--font-space-mono)",
                }}
                onMouseEnter={(e) => { if (!purging) e.currentTarget.style.background = "rgba(255,0,160,0.22)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,0,160,0.12)"; }}
              >
                {purging ? "Purging…" : "Confirm purge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
