import { Pool } from 'pg';
import dotenv from 'dotenv';
import { buildPoolConfig } from './config';

dotenv.config();

export const pool = new Pool(buildPoolConfig());

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error:', err);
  process.exit(1);
});
