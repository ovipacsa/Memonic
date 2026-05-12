"use client";

import { useState } from "react";
import type { FeedItem } from "@/lib/db";
import Composer from "./Composer";
import SearchBar from "./SearchBar";
import PostCard from "./PostCard";
import FriendRequestBanner from "./FriendRequestBanner";

export default function Feed({ initialPosts }: { initialPosts: FeedItem[] }) {
  const [posts, setPosts] = useState<FeedItem[]>(initialPosts);
  const [searchPosts, setSearchPosts] = useState<FeedItem[] | null>(null);
  const [searchQ, setSearchQ] = useState("");

  const visible = searchPosts ?? posts;

  return (
    <div className="space-y-10">
      <FriendRequestBanner />
      <Composer onPosted={(p) => setPosts((prev) => [p as FeedItem, ...prev])} />

      <SearchBar
        onResults={(q, p) => {
          setSearchQ(q);
          setSearchPosts(p as FeedItem[]);
        }}
        onClear={() => {
          setSearchQ("");
          setSearchPosts(null);
        }}
      />

      {searchPosts !== null && (
        <p className="mono text-[10.5px] uppercase tracking-meta text-cyan glow-cyan">
          {visible.length} {visible.length === 1 ? "echo" : "echoes"} for &ldquo;{searchQ}&rdquo;
        </p>
      )}

      {searchPosts === null && visible.length > 0 && (
        <p className="mono text-[10.5px] uppercase tracking-meta text-mute">
          {visible.length} transmission{visible.length !== 1 ? "s" : ""} received
        </p>
      )}

      {visible.length === 0 ? (
        <div
          className="border border-dashed border-purple/60 bg-midnight-soft/40 px-6 py-20 text-center"
          style={{
            backgroundImage: "linear-gradient(rgba(157,0,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(157,0,255,0.04) 1px, transparent 1px)",
            backgroundSize: "32px 32px"
          }}
        >
          <p className="terminal text-star-soft text-[20px]">
            {searchPosts !== null
              ? "No echoes returned. Try another word — the cosmos is patient."
              : "The signal is clear. Send the first transmission above."}
          </p>
          {searchPosts === null && (
            <p className="mono text-[10px] uppercase tracking-meta text-mute mt-3">
              Words and images, equal citizens of this wire.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {visible.map((p, i) => (
            <PostCard
              key={p.id}
              post={p}
              animationDelay={i < 5 ? `${i * 80}ms` : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
