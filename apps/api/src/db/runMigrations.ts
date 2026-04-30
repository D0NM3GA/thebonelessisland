import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db } from "./client.js";

async function main() {
  const migrationDir = resolve("src/db/migrations");
  const files = (await readdir(migrationDir))
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const sqlPath = resolve(migrationDir, file);
    const sql = await readFile(sqlPath, "utf8");
    await db.query(sql);
    console.log(`Applied migration ${file}`);
  }

  await db.end();
}

main().catch(async (err) => {
  console.error(err);
  await db.end();
  process.exit(1);
});
