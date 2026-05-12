"use client";

import { useEffect, useState, useCallback } from "react";

type PendingRequest = {
  id: string;
  from_user_id: string;
  sender_display_name: string;
  sender_photo: string | null;
  created_at: string;
};

export default function FriendRequestBanner() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/friends/requests");
      if (!res.ok) return;
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 30_000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  async function respond(requestId: string, action: "accept" | "decline") {
    setBusy((b) => ({ ...b, [requestId]: true }));
    try {
      await fetch("/api/friends/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch { /* silent */ } finally {
      setBusy((b) => ({ ...b, [requestId]: false }));
    }
  }

  if (requests.length === 0) return null;

  return (
    <div className="space-y-2">
      {requests.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-4 border border-yellow/60 bg-yellow/5 px-5 py-3.5 shadow-[0_0_24px_rgba(249,240,2,0.12)] animate-[fadeSlideIn_0.3s_ease_both]"
        >
          {/* avatar */}
          {r.sender_photo ? (
            <img
              src={r.sender_photo}
              alt={r.sender_display_name}
              className="h-9 w-9 shrink-0 border border-yellow/60 object-cover shadow-[0_0_10px_rgba(249,240,2,0.3)]"
            />
          ) : (
            <div className="h-9 w-9 shrink-0 border border-yellow/60 bg-midnight-deep flex items-center justify-center font-display text-[16px] text-yellow shadow-[0_0_10px_rgba(249,240,2,0.25)]">
              {r.sender_display_name.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="terminal text-[17px] text-star leading-tight">
              <span className="text-yellow glow-yellow">{r.sender_display_name}</span>
              {" "}wants to befriend you
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => respond(r.id, "accept")}
              disabled={busy[r.id]}
              className="primary text-[12px] px-3 py-1.5 disabled:opacity-50"
            >
              Accept
            </button>
            <button
              onClick={() => respond(r.id, "decline")}
              disabled={busy[r.id]}
              className="ghost text-[12px] px-3 py-1.5 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
