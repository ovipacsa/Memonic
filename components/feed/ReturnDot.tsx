"use client";

import { useRouter } from "next/navigation";

export default function ReturnDot() {
  const router = useRouter();

  async function handleReturn() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleReturn}
      aria-label="Log out and return to login"
      title="Log out and return to login"
      style={{
        all: "unset",
        cursor: "pointer",
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        display: "block",
        width: "0.286em",
        height: "0.286em",
        borderRadius: "50%",
        background: "var(--cyan)",
        boxShadow:
          "0 0 12px rgba(0, 240, 255, 0.85), 0 0 28px rgba(0, 240, 255, 0.55), inset 0 0 6px rgba(255, 255, 255, 0.4)",
        animation: "pulse-ring 1.8s ease-in-out infinite",
        transition: "box-shadow 200ms ease, filter 200ms ease",
        flexShrink: "0",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow =
          "0 0 18px rgba(0, 240, 255, 1), 0 0 40px rgba(0, 240, 255, 0.9), 0 0 65px rgba(0, 240, 255, 0.55), inset 0 0 8px rgba(255, 255, 255, 0.7)";
        e.currentTarget.style.filter = "drop-shadow(0 0 6px rgba(0,240,255,0.8))";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow =
          "0 0 12px rgba(0, 240, 255, 0.85), 0 0 28px rgba(0, 240, 255, 0.55), inset 0 0 6px rgba(255, 255, 255, 0.4)";
        e.currentTarget.style.filter = "none";
      }}
    />
  );
}
