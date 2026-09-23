import { Pool, type QueryResultRow } from "pg";

/**
 * Render Postgres connection pool — replaces src/lib/supabase/{client,server,
 * service,public}.ts. There is no per-request cookie-bound client and no
 * service-role/anon-key split on this stack: it's one Postgres database, one
 * pool, and every tenant-scoped query filters explicitly by `business_id`/
 * `owner_id` (the application data-access layer, Constitution Principle I —
 * see reference/render-and-authjs-replacement.md).
 *
 * A single module-scoped pool is reused across requests/route invocations,
 * same lifetime as the Node process Render runs (`next start`), not
 * per-request like the old cookie-bound Supabase client had to be.
 */
const globalForDb = globalThis as unknown as { pgPool?: Pool };

function isLocalHost(connectionString: string): boolean {
  try {
    const { hostname } = new URL(connectionString);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function getPool(): Pool {
  if (!globalForDb.pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set.");
    }
    // Render Postgres requires SSL on external connections but signs with a
    // CA not in Node's default trust store — rejectUnauthorized: false is
    // Render's own documented workaround (the connection is still
    // encrypted, just not chain-verified). Skipped for a local dev database.
    const ssl = isLocalHost(connectionString) ? undefined : { rejectUnauthorized: false };
    globalForDb.pgPool = new Pool({ connectionString, ssl });
  }
  return globalForDb.pgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const { rows } = await getPool().query<T>(text, params);
  return rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
