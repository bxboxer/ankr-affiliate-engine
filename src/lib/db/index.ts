import { Kysely } from "kysely";
import { NeonDialect } from "kysely-neon";
import { neon } from "@neondatabase/serverless";
import type { Database } from "./schema";

let _db: Kysely<Database> | null = null;

function getDb(): Kysely<Database> {
  if (!_db) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error("POSTGRES_URL environment variable is not set");
    }
    _db = new Kysely<Database>({
      dialect: new NeonDialect({
        neon: neon(connectionString),
      }),
    });
  }
  return _db;
}

// Lazy proxy — doesn't instantiate the connection until first use at runtime.
// This prevents build-time crashes when POSTGRES_URL isn't available.
export const db = new Proxy({} as Kysely<Database>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
