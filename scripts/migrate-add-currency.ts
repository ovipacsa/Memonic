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
      currency_widget_visible BOOLEAN NOT NULL DEFAULT FALSE
  `;
  console.log("✓ currency_widget_visible column added");
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
