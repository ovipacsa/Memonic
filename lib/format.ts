export function relativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now.getTime() - t);
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 2) return "a minute ago";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 2) return "an hour ago";
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 2) return "yesterday";
  if (d < 30) return `${d} days ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} mo ago`;
  const y = Math.floor(mo / 12);
  return `${y} yr ago`;
}

export function readingTime(charCount: number): string {
  // Average reading: ~14 chars per second silently
  const seconds = Math.max(1, Math.round(charCount / 14));
  if (seconds < 60) return `~${seconds}s read`;
  const min = Math.round(seconds / 60);
  return `~${min} min read`;
}

export function wordCount(s: string): number {
  return s.trim().length === 0 ? 0 : s.trim().split(/\s+/).length;
}
