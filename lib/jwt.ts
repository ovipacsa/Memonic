import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "memonic_session";

export type Session = { userId: string };

function getSecret(): Uint8Array {
  const raw = process.env.MEMONIC_JWT_SECRET || "dev-only-not-for-production-please-change-this";
  return new TextEncoder().encode(raw);
}

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.userId !== "string") return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
