import "server-only";
import { Pool, types, type QueryResultRow } from "pg";
types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));
const globalDb = globalThis as unknown as { coderisePool?: Pool };
export const pool = globalDb.coderisePool ?? new Pool({
  host: process.env.PGHOST || "localhost", port: Number(process.env.PGPORT || "5432"),
  database: process.env.PGDATABASE || "coderise", user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD, max: 8, connectionTimeoutMillis: 5000,
  statement_timeout: 15000, idleTimeoutMillis: 30000,
});
if (process.env.NODE_ENV !== "production") globalDb.coderisePool = pool;
pool.on("error", (error) => console.error("Database pool error:", error.message));
export async function query<T extends QueryResultRow>(sql: string, args: unknown[] = []): Promise<T[]> {
  return (await pool.query<T>(sql, args)).rows;
}
