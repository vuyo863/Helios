import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";

const RUNTIME_ENV = process.env.RUNTIME_ENV || "replit";

let db: ReturnType<typeof drizzleNeon> | ReturnType<typeof drizzlePg>;

try {
  if (RUNTIME_ENV === "server") {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    db = drizzlePg(pool);
    console.log("[DB] Using node-postgres (server mode)");
  } else {
    const sql = neon(process.env.DATABASE_URL!);
    db = drizzleNeon(sql);
    console.log("[DB] Using Neon serverless (replit mode)");
  }
} catch (error) {
  console.error("[DB] Failed to initialize database connection:", error);
  const sql = neon(process.env.DATABASE_URL || "");
  db = drizzleNeon(sql);
  console.log("[DB] Fallback to Neon serverless");
}

export { db };
