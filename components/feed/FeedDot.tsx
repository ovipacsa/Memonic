"use client";

import Link from "next/link";

export default function FeedDot() {
  return (
    <Link
      href="/feed"
      aria-label="Return to feed"
      title="Return to feed"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(calc(-50% - 0.029em), calc(-50% + 0.043em))",
        display: "block",
        width: "0.286em",
        height: "0.286em",
        borderRadius: "50%",
        background: "var(--cyan)",
        boxShadow:
          "0 0 12px rgba(0, 240, 255, 0.85), 0 0 28px rgba(0, 240, 255, 0.55), inset 0 0 6px rgba(255, 255, 255, 0.4)",
        animation: "pulse-ring 1.8s ease-in-out infinite",
        border: "none",
        textDecoration: "none",
        flexShrink: 0,
      }}
    />
  );
}
