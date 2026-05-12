"use client";

import { useState } from "react";

export type PersonEntry = {
  id: string;
  display_name: string;
  city: string | null;
  country: string | null;
  photo: string | null;
};

type ConfirmState =
  | { type: "befriend"; person: PersonEntry }
  | { type: "ban"; person: PersonEntry }
  | null;

export default function PeopleRail({ people: initial }: { people: PersonEntry[] }) {
  const [people, setPeople] = useState<PersonEntry[]>(initial);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (people.length === 0) return null;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function handleLeftClick(person: PersonEntry) {
    setConfirm({ type: "befriend", person });
  }

  function handleRightClick(e: React.MouseEvent, person: PersonEntry) {
    e.preventDefault();
    setConfirm({ type: "ban", person });
  }

  async function confirmAction() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.type === "befriend") {
        const res = await fetch("/api/friends/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toUserId: confirm.person.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Request failed");
        setPeople((prev) => prev.filter((p) => p.id !== confirm.person.id));
        showToast(`Friend request sent to ${confirm.person.display_name}`);
      } else {
        const res = await fetch("/api/users/block", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: confirm.person.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Block failed");
        setPeople((prev) => prev.filter((p) => p.id !== confirm.person.id));
        showToast(`${confirm.person.display_name} removed for 30 days`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  return (
    <>
      <aside className="border border-cyan/50 bg-midnight-soft/60 shadow-[0_0_38px_rgba(0,240,255,0.12)] relative overflow-hidden">
        {/* header */}
        <div className="px-5 pt-5 pb-3 border-b border-cyan/20">
          <p className="mono text-[10px] uppercase tracking-meta text-cyan glow-cyan">
            Europeans
          </p>
          <p className="terminal text-[11px] text-star-soft mt-0.5 opacity-60">
            {people.length} in this transmission
          </p>
        </div>

        {/* scrollable list — 5 rows visible */}
        <ul
          className="overflow-y-auto divide-y divide-cyan/10"
          style={{ maxHeight: "calc(5 * 68px)" }}
        >
          {people.map((p) => (
            <li
              key={p.id}
              onClick={() => handleLeftClick(p)}
              onContextMenu={(e) => handleRightClick(e, p)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-cyan/5 active:bg-cyan/10 transition-colors duration-150 cursor-pointer select-none"
              style={{ height: "68px" }}
              title="Left-click to befriend · Right-click to remove"
            >
              {p.photo ? (
                <img
                  src={p.photo}
                  alt={p.display_name}
                  loading="lazy"
                  className="h-9 w-9 shrink-0 border border-magenta/60 object-cover shadow-[0_0_10px_rgba(255,0,160,0.3)]"
                />
              ) : (
                <div className="h-9 w-9 shrink-0 border border-magenta/60 bg-midnight-deep flex items-center justify-center font-display text-[16px] text-magenta shadow-[0_0_10px_rgba(255,0,160,0.25)]">
                  {p.display_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-chrome text-[13px] text-star leading-tight truncate">
                  {p.display_name}
                </p>
                {(p.city || p.country) && (
                  <p className="terminal text-[12px] text-cyan/70 mt-0.5 truncate">
                    {[p.city, p.country].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
              <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-cyan shadow-[0_0_6px_rgba(0,240,255,0.8)]" />
            </li>
          ))}
        </ul>

        {/* footer hint */}
        <div className="px-5 py-2.5 border-t border-cyan/20">
          <p className="mono text-[9px] uppercase tracking-meta text-star-soft/50 text-center">
            left-click · befriend &nbsp;·&nbsp; right-click · dismiss
          </p>
        </div>
      </aside>

      {/* toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 border border-cyan/60 bg-midnight-soft px-5 py-3 shadow-[0_0_28px_rgba(0,240,255,0.3)] animate-[fadeSlideIn_0.25s_ease_both]">
          <p className="terminal text-[16px] text-cyan">{toast}</p>
        </div>
      )}

      {/* confirmation overlay */}
      {confirm && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-midnight/80 backdrop-blur-sm"
          onClick={() => !busy && setConfirm(null)}
        >
          <div
            className="relative w-[340px] border bg-midnight-soft p-8 shadow-2xl"
            style={{
              borderColor: confirm.type === "befriend" ? "rgba(0,240,255,0.6)" : "rgba(255,0,160,0.6)",
              boxShadow: confirm.type === "befriend"
                ? "0 0 60px rgba(0,240,255,0.2)"
                : "0 0 60px rgba(255,0,160,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mono text-[10px] uppercase tracking-meta mb-4"
               style={{ color: confirm.type === "befriend" ? "var(--cyan)" : "var(--magenta)" }}>
              {confirm.type === "befriend" ? "Friend Request" : "Dismiss"}
            </p>

            {/* avatar + name */}
            <div className="flex items-center gap-3 mb-5">
              {confirm.person.photo ? (
                <img src={confirm.person.photo} alt={confirm.person.display_name}
                     className="h-11 w-11 shrink-0 border border-cyan/40 object-cover" />
              ) : (
                <div className="h-11 w-11 shrink-0 border border-cyan/40 bg-midnight-deep flex items-center justify-center font-display text-[20px] text-magenta">
                  {confirm.person.display_name.charAt(0).toUpperCase()}
                </div>
              )}
              <p className="font-chrome text-[16px] text-star">{confirm.person.display_name}</p>
            </div>

            <p className="terminal text-[17px] text-star-soft leading-relaxed mb-6">
              {confirm.type === "befriend"
                ? `Send a friend request to ${confirm.person.display_name}? You will see each other's posts once accepted.`
                : `Remove ${confirm.person.display_name} from your list and flag them for 30 days? They won't appear in your Signal Members during this period.`}
            </p>

            <div className="flex gap-3">
              <button
                onClick={confirmAction}
                disabled={busy}
                className="primary flex-1 disabled:opacity-50"
              >
                {busy ? "…" : confirm.type === "befriend" ? "Befriend" : "Dismiss"}
              </button>
              <button
                onClick={() => setConfirm(null)}
                disabled={busy}
                className="ghost flex-1 disabled:opacity-50 text-[1.5em]" style={{ color: "var(--yellow)" }}
              >
                X
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
