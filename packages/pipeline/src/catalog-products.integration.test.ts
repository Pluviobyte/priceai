import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@price-radar/database';
import { seedCanonicalProducts } from './catalog-products.js';

// Explicit opt-in. Creates and drops its OWN database, never truncates caller data.
const adminUrl = process.env.POLICY_TEST_DATABASE_URL;

test('seeding names the catalogue, and a rename reaches rows that already exist', { skip: !adminUrl }, async (t) => {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  const name = `price_seed_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`create database "${name}"`);
  const url = new URL(adminUrl!); url.pathname = `/${name}`;
  const handle = createDatabase(url.toString());
  const db = handle.db;
  try {
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../database/drizzle/', import.meta.url)) });
    const seeded = await seedCanonicalProducts(db);
    assert.ok(seeded > 0, 'the seed reports how many products it stands for');

    await t.test('a category names the product it belongs to', async () => {
      const video = await db.execute(sql`select display_name, brand from canonical_products where slug='video-runway-max'`);
      assert.equal(video.rows[0]?.display_name, '视频生成 · Runway Max');
      assert.equal(video.rows[0]?.brand, 'Runway');
    });

    await t.test('a drifted name is brought back, which is what the catalogue could not do before', async () => {
      // This is the whole point of the upsert. Under onConflictDoNothing a product that
      // already existed kept its old name for ever, so 即梦 would have stayed
      // "即梦 / Dreamina 账号与积分" while the siblings created beside it carried the
      // category prefix, and nothing in the code would have said why.
      await db.execute(sql`update canonical_products set display_name='旧名字', plan_family='旧名字' where slug='dreamina-account'`);
      await seedCanonicalProducts(db);
      const row = await db.execute(sql`select display_name, plan_family from canonical_products where slug='dreamina-account'`);
      assert.equal(row.rows[0]?.display_name, '视频生成 · 即梦 Dreamina');
      assert.equal(row.rows[0]?.plan_family, '视频生成 · 即梦 Dreamina');
    });

    await t.test('seeding twice does not duplicate the catalogue', async () => {
      await seedCanonicalProducts(db);
      const count = await db.execute(sql`select count(*)::int n from canonical_products`);
      assert.equal(Number(count.rows[0]?.n), seeded, 'one row per product no matter how often the worker seeds');
      const slugs = await db.execute(sql`select count(distinct slug)::int n from canonical_products`);
      assert.equal(Number(slugs.rows[0]?.n), seeded);
    });
  } finally {
    await handle.close();
    // The pool has drained. FORCE can terminate sockets still completing their graceful
    // close and surface an asynchronous pg error after all tests pass.
    await admin.query(`drop database "${name}"`);
    await admin.end();
  }
});
