import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db } from "./client.js";

async function main() {
  const sqlPath = resolve("src/db/migrations/001_init.sql");
  const sql = await readFile(sqlPath, "utf8");
  await db.query(sql);
  await db.end();
  console.log("Applied migration 001_init.sql");
}

main().catch(async (err) => {
  console.error(err);
  await db.end();
  process.exit(1);
});
