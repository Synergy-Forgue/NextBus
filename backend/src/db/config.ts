import type { PoolConfig } from 'pg';

/**
 * Builds a pg pool config from the environment.
 *
 * `DATABASE_URL` wins when present, because it is the only form that works from
 * outside Railway. Railway injects DB_HOST=postgres.railway.internal, a private
 * hostname that resolves inside its network and nowhere else — so a laptop
 * reading the discrete DB_* vars silently fails to connect. That failure used to
 * be invisible: the simulator swallowed the error and published hardcoded
 * fallback buses, which looks like a working demo built on fake data.
 *
 * SSL is enabled for any non-local host. Railway's public proxy terminates TLS
 * with a certificate the client cannot chain to a known root, hence
 * `rejectUnauthorized: false` — required to connect at all, and acceptable here
 * because the alternative is not connecting.
 */
export function buildPoolConfig(): PoolConfig {
  const url = process.env.DATABASE_URL?.trim();

  if (url) {
    const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    return {
      connectionString: url,
      ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
    };
  }

  return {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'nxtbus',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || '',
  };
}

/** Host:port for logging, with credentials stripped. Never log the raw URL. */
export function describeTarget(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const m = url.match(/@([^/?]+)/);
    return m ? m[1] : 'DATABASE_URL';
  }
  return `${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}`;
}
