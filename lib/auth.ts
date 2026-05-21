import { cookies } from "next/headers";
import { signSession, verifySession, SESSION_COOKIE, type Session } from "@/lib/jwt";
import { getDb } from "@/lib/db";

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

// Like getSession, but also checks the user is not deactivated.
// Use in server components and API routes where deactivation must be enforced.
export async function getActiveSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  const sql = getDb();
  const [row] = await sql<{ deactivated: boolean }[]>`
    SELECT deactivated FROM users WHERE user_id = ${session.userId}::uuid
  `;
  if (!row || row.deactivated) {
    clearSessionCookie();
    return null;
  }
  return session;
}
