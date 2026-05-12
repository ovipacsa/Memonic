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
        display: "inline-block",
        verticalAlign: "middle",
        lineHeight: 0,
      }}
    >
      <span className="dot dot-return">.</span>
    </button>
  );
}
