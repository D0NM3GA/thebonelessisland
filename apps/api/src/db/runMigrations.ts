import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db } from "./client.js";

async function main() {
  // Create tracking table
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const { rows: applied } = await db.query<{ filename: string }>(
    "SELECT filename FROM schema_migrations"
  );
  const appliedSet = new Set(applied.map((r) => r.filename));

  const migrationDir = resolve("src/db/migrations");
  const files = (await readdir(migrationDir))
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  // First run: schema_migrations is empty but DB may already be set up.
  // Detect by checking for a table from migration 017 (general_news).
  if (appliedSet.size === 0) {
    const { rows } = await db.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'general_news'
      ) AS exists
    `);
    if (rows[0].exists) {
      // Seed tracker with all migrations prior to 018 that are already applied
      const seed = files.filter((f) => f < "018");
      for (const file of seed) {
        await db.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING",
          [file]
        );
        appliedSet.add(file);
      }
      console.log(`Seeded migration tracker with ${seed.length} previously applied migrations.`);
    }
  }

  let count = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  skip  ${file}`);
      continue;
    }
    const sql = await readFile(resolve(migrationDir, file), "utf8");
    await db.query(sql);
    await db.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
    console.log(`  apply ${file}`);
    count++;
  }

  if (count === 0) console.log("Nothing new to apply.");
  else console.log(`\nApplied ${count} migration(s).`);

  await db.end();
}

main().catch(async (err) => {
  console.error(err);
  await db.end();
  process.exit(1);
});
