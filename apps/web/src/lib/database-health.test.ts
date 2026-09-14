import assert from "node:assert/strict";
import { test } from "node:test";
import type { databasePool } from "./database";
import { checkDatabaseHealth } from "./database-health";

test("database health releases a healthy connection and bounds the query", async () => {
  let released: boolean | undefined;
  const pool = { connect: async () => ({
    query: async (query: { text: string; query_timeout: number }) => {
      assert.equal(query.text, "SELECT 1");
      assert.equal(query.query_timeout, 2_000);
    },
    release: (destroy: boolean) => { released = destroy; },
  }) };
  assert.equal(await checkDatabaseHealth(pool as unknown as typeof databasePool), true);
  assert.equal(released, false);
});

test("database failure destroys the connection without exposing the error", async () => {
  let released: boolean | undefined;
  const pool = { connect: async () => ({
    query: async () => { throw new Error("private connection details"); },
    release: (destroy: boolean) => { released = destroy; },
  }) };
  assert.equal(await checkDatabaseHealth(pool as unknown as typeof databasePool), false);
  assert.equal(released, true);
});

test("unavailable database fails readiness when connection acquisition fails", async () => {
  const pool = { connect: async () => { throw new Error("connection timeout"); } };
  assert.equal(await checkDatabaseHealth(pool as unknown as typeof databasePool), false);
});
