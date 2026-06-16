import postgres from "postgres";
import { readFileSync } from "fs";

try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([^#=]+)=(.+)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS
      deactivated BOOLEAN NOT NULL DEFAULT FALSE
  `;
  console.log("✓ deactivated column added");

  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS
      deactivated_at TIMESTAMPTZ
  `;
  console.log("✓ deactivated_at column added");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_deactivated ON users(deactivated)
  `;
  console.log("✓ idx_users_deactivated index created");

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
