"use client";

import type { FeedItem } from "@/lib/db";
import { relativeTime, readingTime } from "@/lib/format";

export default function PostCard({ post, animationDelay }: { post: FeedItem; animationDelay?: string }) {
  const created = new Date(post.created_at);
  const absolute = created.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const accent = post.type === "image" ? "cyan" : "magenta";

  return (
    <article
      className={
        "rise border bg-midnight-soft/60 transition-all duration-200 hover:-translate-y-0.5 " +
        (post.type === "image"
          ? "border-cyan/50 shadow-[0_0_28px_rgba(0,240,255,0.18)] hover:shadow-[0_0_42px_rgba(0,240,255,0.30)] hover:border-cyan/75"
          : "border-magenta/50 shadow-[0_0_28px_rgba(255,0,160,0.18)] hover:shadow-[0_0_42px_rgba(255,0,160,0.30)] hover:border-magenta/75")
      }
      style={animationDelay ? { animationDelay } : undefined}
    >
      <header className="flex items-center justify-between border-b border-purple/40 px-6 py-4">
        <div className="flex items-center gap-4">
          {post.author_photo ? (
            <img
              src={post.author_photo}
              alt={post.author_display_name}
              loading="lazy"
              className="h-10 w-10 border border-cyan object-cover shadow-[0_0_12px_rgba(0,240,255,0.45)]"
            />
          ) : (
            <div className="h-10 w-10 border border-cyan bg-midnight-deep flex items-center justify-center font-display text-magenta glow-magenta text-[18px]">
              {post.author_display_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-chrome text-[18px] leading-tight tracking-wide text-star">{post.author_display_name}</div>
            <div className="mono text-[10px] uppercase tracking-meta text-cyan mt-0.5">
              {post.author_city ? `${post.author_city} · ` : ""}
              <span title={absolute}>{relativeTime(post.created_at)}</span>
            </div>
          </div>
        </div>
        <span
          className={
            "mono text-[10px] uppercase tracking-meta px-2 py-1 border " +
            (accent === "cyan"
              ? "border-cyan text-cyan glow-cyan"
              : "border-magenta text-magenta glow-magenta")
          }
        >
          {post.type === "text" ? "Observation" : "Image"}
        </span>
      </header>

      {post.type === "image" && post.image && (
        <figure className="border-b border-purple/40 bg-midnight-deep flex items-center justify-center">
          <img
            src={post.image}
            alt={post.body ? post.body.slice(0, 120) : `Photo by ${post.author_display_name}`}
            loading="lazy"
            className="max-w-full max-h-[640px] object-contain bg-midnight-deep"
            style={{
              imageRendering:
                post.image_w && post.image_w < 64 ? "pixelated" : "auto"
            }}
          />
        </figure>
      )}

      {post.body && (
        <div className="px-6 py-6">
          <p
            className={
              "whitespace-pre-wrap " +
              (post.type === "text"
                ? "terminal text-star text-[24px] leading-relaxed" + ((post.char_count ?? 0) >= 80 ? " dropcap" : "")
                : "terminal text-star-soft text-[19px] italic")
            }
          >
            {post.body}
          </p>
        </div>
      )}

      <footer className="flex items-center justify-between border-t border-purple/40 px-6 py-3 mono text-[10px] uppercase tracking-meta text-mute">
        <span>
          {post.type === "text"
            ? readingTime(post.char_count ?? 0)
            : post.image_w && post.image_h
              ? `${post.image_w} \u00d7 ${post.image_h}`
              : null}
        </span>
        <span title={absolute} className="tabular-nums">{relativeTime(post.created_at)}</span>
      </footer>
    </article>
  );
}
