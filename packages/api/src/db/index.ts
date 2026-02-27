import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://perdiemify:perdiemify@localhost:5432/perdiemify';

// Parse DATABASE_URL to extract components and pass them explicitly
// This avoids issues with special characters in passwords (like $)
function parseDbUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '5432'),
      database: parsed.pathname.slice(1),
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    };
  } catch {
    return null;
  }
}

const parsed = parseDbUrl(connectionString);

const client = parsed
  ? postgres({
      host: parsed.host,
      port: parsed.port,
      database: parsed.database,
      username: parsed.username,
      password: parsed.password,
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    })
  : postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

export const db = drizzle(client, { schema });
