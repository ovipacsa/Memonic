import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, type UserRow } from "@/lib/db";
import NutritionTracker from "@/components/nutrition/NutritionTracker";
import Masthead from "@/components/feed/Masthead";

export const dynamic = "force-dynamic";

export default async function NutritionPage() {
  const session = await getSession();
  if (!session) redirect("/home");

  const sql = getDb();
  const [meRow] = await sql<Pick<UserRow, "id"|"display_name">[]>`
    SELECT user_id AS id, display_name FROM users WHERE user_id = ${session.userId}::uuid
  `;
  if (!meRow) redirect("/home");

  return (
    <main className="px-[var(--gutter)] py-[clamp(28px,4vw,56px)]">
      <div className="mx-auto max-w-[860px]">
        <Masthead active="nutrition" subtitle="Fuel the signal — track what you eat, honestly." />
        <NutritionTracker displayName={meRow.display_name} />
      </div>
    </main>
  );
}
