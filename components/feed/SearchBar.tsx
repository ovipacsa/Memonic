"use client";

import { useEffect, useRef, useState } from "react";

export default function SearchBar({
  onResults,
  onClear
}: {
  onResults: (q: string, posts: unknown[]) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);

    if (!q.trim()) {
      onClear();
      return;
    }

    debounceRef.current = window.setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/posts/search?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        if (res.ok) onResults(q.trim(), data.posts || []);
      } finally {
        setBusy(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="border border-cyan/30 bg-midnight-soft/40 px-5 py-3 flex items-center gap-4 focus-within:border-cyan/60 transition-colors">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-magenta shrink-0">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search posts, people, cities…"
        aria-label="Search the feed"
        style={{ background: "transparent", border: "none", padding: 0, boxShadow: "none" }}
        className="terminal text-[20px] flex-1 min-w-0"
      />
      {busy && <span className="mono text-[10px] uppercase tracking-meta text-cyan flicker shrink-0">…tuning</span>}
      {q && (
        <button type="button" className="ghost shrink-0" onClick={() => setQ("")}>
          ↳ Clear
        </button>
      )}
    </div>
  );
}
