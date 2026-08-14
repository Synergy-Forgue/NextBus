/**
 * migrate.ts
 * Runs a single additive SQL migration file against the configured database.
 *
 * Unlike setup-db.ts, this never runs schema.sql and therefore never drops
 * tables — it is safe to point at a deployed database.
 *
 * Usage:
 *   npm run migrate -- src/db/migrations/001_add_bengaluru_network.sql
 *
 * Connection: DATABASE_URL if set (Railway and most hosts provide it),
 * otherwise the DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD vars.
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const file = process.argv[2];

if (!file) {
  console.error('\n❌ No migration file given.\n');
  console.error('   Usage: npm run migrate -- src/db/migrations/<file>.sql\n');
  process.exit(1);
}

const fullPath = path.resolve(file);
if (!fs.existsSync(fullPath)) {
  console.error(`\n❌ Migration file not found: ${fullPath}\n`);
  process.exit(1);
}

const sql = fs.readFileSync(fullPath, 'utf8');

// Refuse to run anything destructive through this path — that is setup-db's job
// and it should never be aimed at a deployed database by accident.
const destructive = /\b(DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/i.exec(sql);
if (destructive) {
  console.error(`\n❌ Refusing to run: this file contains "${destructive[0]}".`);
  console.error('   Migrations run by this script must be additive.\n');
  process.exit(1);
}

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost')
        ? undefined
        : { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'nxtbus',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    });

async function main(): Promise<void> {
  const target = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL).host
    : `${process.env.DB_HOST || 'localhost'}/${process.env.DB_NAME || 'nxtbus'}`;

  console.log(`\n🗄️  Running migration: ${path.basename(fullPath)}`);
  console.log(`   Target: ${target}\n`);

  try {
    const result = await pool.query(sql);
    const rows = Array.isArray(result) ? result[result.length - 1]?.rows : result.rows;
    if (rows?.length) {
      console.log('✅ Done. Current counts:');
      console.table(rows);
    } else {
      console.log('✅ Done.');
    }
  } catch (err: any) {
    console.error(`\n❌ Migration failed: ${err.message}\n`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
