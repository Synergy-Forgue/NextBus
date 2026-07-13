/**
 * setup-db.ts
 * One-time script to create tables and seed Vizag MVP data.
 * Run AFTER creating the 'nxtbus' database in PostgreSQL.
 *
 * Usage:
 *   npm run setup-db
 */

import dotenv from 'dotenv';
dotenv.config();

import fs   from 'fs';
import path from 'path';
import { Pool } from 'pg';

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'nxtbus',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function run(label: string, filePath: string): Promise<void> {
  const sql = fs.readFileSync(path.resolve(filePath), 'utf8');
  console.log(`⏳ Running ${label}...`);
  await pool.query(sql);
  console.log(`✅ ${label} done.\n`);
}

async function main(): Promise<void> {
  console.log('\n🗄️  NXTBus Database Setup\n');
  try {
    await run('schema.sql', 'src/db/schema.sql');
    await run('seed.sql',   'src/db/seed.sql');
    console.log('🎉 Database is ready! You can now run: npm run dev');
  } catch (err: any) {
    console.error('\n❌ Setup failed:', err.message);
    console.error('   Make sure PostgreSQL is running and your .env is configured.\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
