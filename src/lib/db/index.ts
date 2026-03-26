import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";
import type { Database } from "./schema";
import type {
  DatabaseConnection,
  Driver,
  Dialect,
  QueryResult,
  CompiledQuery,
} from "kysely";

/**
 * Custom Neon HTTP dialect that calls Neon's SQL-over-HTTP endpoint directly
 * via fetch, completely bypassing @neondatabase/serverless to avoid the
 * private class field bundling issue on Vercel.
 *
 * Neon's HTTP endpoint: https://<host>/sql
 * Docs: https://neon.com/docs/serverless/serverless-driver#use-the-driver-over-http
 */

function parseConnectionString(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    user: parsed.username,
    password: parsed.password,
    database: parsed.pathname.slice(1),
    ssl: parsed.searchParams.get("sslmode") !== "disable",
  };
}

class NeonFetchConnection implements DatabaseConnection {
  readonly #endpoint: string;
  readonly #authHeader: string;

  constructor(connectionString: string) {
    const conn = parseConnectionString(connectionString);
    this.#endpoint = `https://${conn.host}/sql`;
    this.#authHeader = `Basic ${btoa(`${conn.user}:${conn.password}`)}`;
  }

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const response = await fetch(this.#endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Neon-Connection-String": process.env.POSTGRES_URL!,
        "Neon-Raw-Text-Output": "true",
        "Neon-Array-Mode": "false",
      },
      body: JSON.stringify({
        query: compiledQuery.sql,
        params: compiledQuery.parameters,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Neon HTTP error ${response.status}: ${text}`);
    }

    const data = await response.json();

    // Build a field name → dataTypeID map for type coercion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fieldTypes = new Map<string, number>();
    for (const f of data.fields ?? []) {
      fieldTypes.set(f.name, f.dataTypeID);
    }

    // Neon returns objects with string values when Neon-Array-Mode: false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data.rows ?? []).map((row: Record<string, any>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed: Record<string, any> = {};
      for (const [key, rawValue] of Object.entries(row)) {
        const typeId = fieldTypes.get(key) ?? 25; // default to TEXT
        parsed[key] = rawValue === null ? null : parseNeonValue(String(rawValue), typeId);
      }
      return parsed;
    }) as R[];

    return {
      numAffectedRows:
        data.command === "INSERT" ||
        data.command === "UPDATE" ||
        data.command === "DELETE" ||
        data.command === "MERGE"
          ? BigInt(data.rowCount ?? 0)
          : undefined,
      rows,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("Streaming not supported with Neon HTTP.");
  }
}

// Parse Neon raw text values back to JS types based on Postgres OIDs
function parseNeonValue(value: string | null, dataTypeID: number): unknown {
  if (value === null) return null;

  switch (dataTypeID) {
    case 20: // INT8 (bigint)
    case 21: // INT2
    case 23: // INT4
      return parseInt(value, 10);
    case 700: // FLOAT4
    case 701: // FLOAT8
    case 1700: // NUMERIC
      return parseFloat(value);
    case 16: // BOOL
      return value === "t" || value === "true";
    case 114: // JSON
    case 3802: // JSONB
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    case 1082: // DATE
    case 1114: // TIMESTAMP
    case 1184: // TIMESTAMPTZ
      return new Date(value);
    default:
      return value;
  }
}

class NeonFetchDriver implements Driver {
  readonly #connectionString: string;
  #conn: NeonFetchConnection | undefined;

  constructor(connectionString: string) {
    this.#connectionString = connectionString;
  }

  async init(): Promise<void> {
    this.#conn = new NeonFetchConnection(this.#connectionString);
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

class NeonFetchDialect implements Dialect {
  readonly #connectionString: string;

  constructor(connectionString: string) {
    this.#connectionString = connectionString;
  }

  createAdapter() {
    return new PostgresAdapter();
  }

  createDriver(): Driver {
    return new NeonFetchDriver(this.#connectionString);
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
    _db = new Kysely<Database>({
      dialect: new NeonFetchDialect(connectionString),
    });
  }
  return _db;
}

// Lazy proxy — doesn't instantiate the connection until first use at runtime.
// This prevents build-time crashes when POSTGRES_URL isn't available.
// We bind methods to the real Kysely instance to preserve `this` context
// (Kysely uses private class fields which require correct `this`).
export const db = new Proxy({} as Kysely<Database>, {
  get(_target, prop) {
    const instance = getDb();
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});
