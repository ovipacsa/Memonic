"use client";

import Link from "next/link";

export type DailyStatsProps = {
  totalCalories: number;
  entryCount: number;
};

export default function DailyStats({ totalCalories, entryCount }: DailyStatsProps) {
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <Link
      href="/nutrition"
      className="block border border-yellow/40 bg-midnight-soft/60 p-5 no-underline hover:border-yellow/70 transition-all duration-200 shadow-[0_0_22px_rgba(249,240,2,0.10)] hover:shadow-[0_0_32px_rgba(249,240,2,0.25)] hover:-translate-y-0.5"
    >
      <p className="mono text-[10px] uppercase tracking-meta text-yellow glow-yellow">
        Calories today · {today}
      </p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="terminal text-[38px] leading-none text-yellow glow-yellow">
          {totalCalories.toFixed(0)}
          <span className="terminal text-[18px] text-star-soft ml-1">kcal</span>
        </p>
        <div className="flex flex-col items-end gap-1.5">
          <p className="mono text-[9px] uppercase tracking-widest text-mute">
            {entryCount} entr{entryCount === 1 ? "y" : "ies"}
          </p>
          <span className="mono text-[9px] uppercase tracking-widest text-cyan border-2 border-magenta px-2.5 py-1.5 shadow-[0_0_10px_rgba(255,0,128,0.45)] hover:shadow-[0_0_18px_rgba(255,0,128,0.7)] transition-shadow">
            Open tracker →
          </span>
        </div>
      </div>
    </Link>
  );
}
