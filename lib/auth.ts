import { cookies } from "next/headers";
import { signSession, verifySession, SESSION_COOKIE, type Session } from "@/lib/jwt";

export type { Session };
export { SESSION_COOKIE };

export async function setSessionCookie(userId: string) {
  const token = await signSession(userId);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSession(): Promise<Session | null> {
  const c = cookies().get(SESSION_COOKIE);
  if (!c?.value) return null;
  return verifySession(c.value);
}
