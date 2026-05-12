"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { computeAge, MIN_AGE } from "@/lib/age";

function Spinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
      aria-hidden="true"
    />
  );
}

type Tab = "login" | "signup";

const MAX_PHOTO_BYTES = 400 * 1024;

const EUROPEAN_COUNTRIES = [
  "Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina",
  "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia",
  "Finland", "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland",
  "Italy", "Kosovo", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg",
  "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "North Macedonia",
  "Norway", "Poland", "Portugal", "Romania", "Russia", "San Marino", "Serbia",
  "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Turkey", "Ukraine",
  "United Kingdom", "Vatican City"
];

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(file);
  });
}

export default function AuthCard() {
  const [tab, setTab] = useState<Tab>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [dob, setDob] = useState("");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const age = dob ? computeAge(dob) : null;
  const ageOk = age !== null && age >= MIN_AGE;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const fd = new FormData(e.currentTarget);

    try {
      if (tab === "login") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: String(fd.get("email") || "").trim(),
            password: String(fd.get("password") || "")
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Sign-in failed. Check your credentials.");
      } else {
        const dobStr = String(fd.get("dob") || "");
        if (computeAge(dobStr) < MIN_AGE) {
          throw new Error(`Memonic is for members aged ${MIN_AGE} and older.`);
        }

        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: String(fd.get("email") || "").trim(),
            password: String(fd.get("password") || ""),
            firstName: String(fd.get("firstName") || "").trim(),
            familyName: String(fd.get("familyName") || "").trim(),
            dob: dobStr,
            country: String(fd.get("country") || "").trim(),
            socialNumber: String(fd.get("socialNumber") || "").trim(),
            photo
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Account creation failed.");
      }
      router.replace("/feed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_PHOTO_BYTES) {
      setError("Profile photo must be under 400 KB.");
      e.target.value = "";
      return;
    }
    setError(null);
    const dataUrl = await fileToDataUrl(f);
    setPhoto(dataUrl);
  }

  return (
    <section className="rise mx-auto w-full max-w-[860px] border border-purple/60 bg-midnight-soft/70 px-8 py-10 md:px-14 md:py-14 shadow-[0_0_60px_rgba(157,0,255,0.25)]">
      <header className="text-center">
        <p className="mono text-[11px] uppercase tracking-meta text-cyan glow-cyan">
          Transmission 01 · Hosted in the European Union
        </p>
        <h1 className="wordmark mt-5 whitespace-nowrap">
          Memonic<span className="dot">.</span>
        </h1>
        <p className="terminal mt-4 text-star-soft text-[clamp(16px,1.5vw,20px)]">
          A social network for Europe — words and images, equal citizens.
        </p>
        <div className="rule-double mx-auto mt-8 max-w-[460px]" />
      </header>

      {/* Tab switcher */}
      <div className="mt-8 flex justify-center gap-0 border border-cyan/40">
        <button
          type="button"
          className={tab === "login" ? "primary flex-1 border-none" : "flex-1 border-none text-star-soft hover:text-cyan"}
          onClick={() => { setTab("login"); setError(null); }}
        >
          Sign In
        </button>
        <div className="w-px bg-cyan/40 shrink-0" />
        <button
          type="button"
          className={tab === "signup" ? "primary flex-1 border-none" : "flex-1 border-none text-star-soft hover:text-cyan"}
          onClick={() => { setTab("signup"); setError(null); }}
        >
          Create Account
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">

        {/* ── SIGN-UP FIELDS ── */}
        {tab === "signup" && (
          <>
            <div>
              <label className="mono text-[11px] uppercase tracking-meta text-magenta">First Name *</label>
              <input name="firstName" required minLength={1} maxLength={60} placeholder="Ana" />
            </div>
            <div>
              <label className="mono text-[11px] uppercase tracking-meta text-magenta">Family Name *</label>
              <input name="familyName" required minLength={1} maxLength={60} placeholder="Ionescu" />
            </div>
          </>
        )}

        <div className={tab === "signup" ? "md:col-span-2" : ""}>
          <label className="mono text-[11px] uppercase tracking-meta text-magenta">Email *</label>
          <input type="email" name="email" required placeholder="you@somewhere.eu" autoComplete="email" />
        </div>

        <div className={tab === "signup" ? "md:col-span-2" : ""}>
          <label className="mono text-[11px] uppercase tracking-meta text-magenta">Password *</label>
          <input
            type="password"
            name="password"
            required
            minLength={tab === "signup" ? 8 : 1}
            placeholder={tab === "signup" ? "At least 8 characters" : "Your password"}
            autoComplete={tab === "signup" ? "new-password" : "current-password"}
          />
        </div>

        {tab === "signup" && (
          <>
            <div>
              <label className="mono text-[11px] uppercase tracking-meta text-magenta">Date of Birth *</label>
              <input
                type="date"
                name="dob"
                required
                value={dob}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDob(e.target.value)}
              />
              {dob && (
                <p className={"terminal mt-2 text-[17px] " + (ageOk ? "text-cyan" : "text-magenta")}>
                  {age !== null && age >= 0
                    ? ageOk
                      ? `Age ${age} — welcome.`
                      : `You must be ${MIN_AGE} or older to join.`
                    : "Enter a valid date."}
                </p>
              )}
            </div>

            <div>
              <label className="mono text-[11px] uppercase tracking-meta text-magenta">Country *</label>
              <select name="country" required defaultValue="">
                <option value="" disabled>Select your country</option>
                {EUROPEAN_COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mono text-[11px] uppercase tracking-meta text-magenta">Social / National ID Number *</label>
              <input
                name="socialNumber"
                required
                maxLength={40}
                placeholder="Your national identification number"
              />
              <p className="mono text-[9px] uppercase tracking-widest text-mute mt-1">
                Used only to prevent duplicate accounts — never displayed publicly.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="mono text-[11px] uppercase tracking-meta text-magenta">Profile Photo <span className="text-mute normal-case">(optional, max 400 KB)</span></label>
              <div className="mt-2 flex items-center gap-4">
                {photo ? (
                  <img src={photo} alt="Profile photo preview" className="h-16 w-16 shrink-0 border border-cyan object-cover shadow-[0_0_18px_rgba(0,240,255,0.45)]" />
                ) : (
                  <div className="h-16 w-16 shrink-0 border border-dashed border-purple/50 bg-midnight-deep/60 flex items-center justify-center text-mute">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer border border-cyan/60 px-3 py-2 mono text-[10px] uppercase tracking-meta text-cyan hover:border-yellow hover:text-yellow transition-colors">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={onPhotoChange}
                      className="sr-only"
                    />
                    {photo ? "Change photo" : "Choose photo"}
                  </label>
                  {photo && (
                    <button type="button" className="ghost text-[10px]" onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ""; }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="md:col-span-2 border-l-4 border-magenta bg-magenta/10 px-4 py-3 terminal text-[18px] text-star">
            {error}
          </div>
        )}

        <div className="md:col-span-2 flex flex-col items-center gap-3 pt-2">
          <button
            type="submit"
            className="primary w-full md:w-auto md:min-w-[280px]"
            disabled={busy || (tab === "signup" && !!dob && !ageOk)}
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                {tab === "signup" ? "Creating account…" : "Signing in…"}
              </span>
            ) : (
              tab === "signup" ? "Create Account" : "Sign In"
            )}
          </button>
          {tab === "signup" && (
            <p className="mono text-[10px] uppercase tracking-meta text-mute text-center">
              By creating an account you confirm you are {MIN_AGE} or older. Hosted in the European Union.
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
