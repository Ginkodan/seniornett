import { Pool } from "pg";

// Module-level singleton — reused across requests in the same process.
// Next.js dev mode hot-reloads modules, so we stash it on globalThis to avoid
// exhausting postgres connection slots during development.
declare global {
  var __pgPool: Pool | undefined;
}

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return new Pool({ connectionString: url, max: 5 });
}

export function getPool(): Pool {
  if (!globalThis.__pgPool) {
    globalThis.__pgPool = createPool();
  }

  return globalThis.__pgPool;
}
