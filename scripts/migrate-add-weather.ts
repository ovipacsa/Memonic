import postgres from "postgres";
import { readFileSync } from "fs";

// Read .env.local manually
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
      weather_widget_visible BOOLEAN NOT NULL DEFAULT FALSE
  `;
  console.log("✓ weather_widget_visible column added");
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
