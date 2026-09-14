import { databasePool } from "./database";

// The pool bounds connection acquisition to 5 seconds. Bound the query too,
// and discard the connection on failure so timed-out work cannot accumulate.
export async function checkDatabaseHealth(pool = databasePool): Promise<boolean> {
  let client;
  let failed = false;
  try {
    client = await pool.connect();
    // pg supports per-query query_timeout; @types/pg only lists it on clients.
    const healthQuery = { text: "SELECT 1", query_timeout: 2_000 };
    await client.query(healthQuery);
    return true;
  } catch {
    failed = true;
    return false;
  } finally {
    client?.release(failed);
  }
}
