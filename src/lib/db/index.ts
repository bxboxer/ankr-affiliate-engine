import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";
import { neon } from "@neondatabase/serverless";
import type { Database } from "./schema";
import type {
  DatabaseConnection,
  Driver,
  Dialect,
  QueryResult,
  CompiledQuery,
} from "kysely";

/**
 * Custom Neon HTTP dialect that bypasses the private class field bundling
 * issue with kysely-neon + @neondatabase/serverless@1.x on Vercel.
 *
 * Instead of going through NeonDatabaseConnection's .query() method (which
 * triggers private field access errors when bundled), we call neon's HTTP
 * function directly in a way that preserves the `this` context.
 */
class NeonHTTPConnection implements DatabaseConnection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly #sql: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(sql: any) {
    this.#sql = sql;
  }

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    // Use .query() for conventional parameterized call (not tagged template)
    const result = await this.#sql.query(compiledQuery.sql, compiledQuery.parameters, {
      arrayMode: false,
      fullResults: true,
    });

    return {
      numAffectedRows:
        result.command === "INSERT" ||
        result.command === "UPDATE" ||
        result.command === "DELETE" ||
        result.command === "MERGE"
          ? BigInt(result.rowCount ?? 0)
          : undefined,
      rows: (result.rows ?? []) as R[],
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("Streaming not supported with Neon HTTP.");
  }
}

class NeonHTTPDriver implements Driver {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly #sql: any;
  #conn: NeonHTTPConnection | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(sql: any) {
    this.#sql = sql;
  }

  async init(): Promise<void> {
    this.#conn = new NeonHTTPConnection(this.#sql);
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    return this.#conn!;
  }

  async beginTransaction(): Promise<void> {
    throw new Error("Transactions not supported with Neon HTTP.");
  }

  async commitTransaction(): Promise<void> {}
  async rollbackTransaction(): Promise<void> {}
  async releaseConnection(): Promise<void> {}
  async destroy(): Promise<void> {}
}

class NeonHTTPDialect implements Dialect {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly #sql: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(sql: any) {
    this.#sql = sql;
  }

  createAdapter() {
    return new PostgresAdapter();
  }

  createDriver(): Driver {
    return new NeonHTTPDriver(this.#sql);
  }

  createIntrospector(db: Kysely<unknown>) {
    return new PostgresIntrospector(db);
  }

  createQueryCompiler() {
    return new PostgresQueryCompiler();
  }
}

// ── Connection ──────────────────────────────────────────────────────────────

let _db: Kysely<Database> | null = null;

function getDb(): Kysely<Database> {
  if (!_db) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error("POSTGRES_URL environment variable is not set");
    }
    const sql = neon(connectionString);
    _db = new Kysely<Database>({
      dialect: new NeonHTTPDialect(sql),
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
