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
        transform: "translate(calc(-50% - 0.029em), calc(-50% + 0.043em))",
        display: "block",
        width: "0.286em",
        height: "0.286em",
        borderRadius: "50%",
        background: "var(--cyan)",
        boxShadow:
          "0 0 12px rgba(0, 240, 255, 0.85), 0 0 28px rgba(0, 240, 255, 0.55), inset 0 0 6px rgba(255, 255, 255, 0.4)",
        animation: "pulse-ring 1.8s ease-in-out infinite",
        flexShrink: "0",
      }}
    />
  );
}
