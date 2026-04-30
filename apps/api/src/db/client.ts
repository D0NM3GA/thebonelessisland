import { Pool } from "pg";
import { env } from "../config.js";

export const db = new Pool({
  connectionString: env.DATABASE_URL
});
