import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { scrapeAllSources } from './scrapers';

const connectionString = process.env.DATABASE_URL || 'postgresql://perdiemify:perdiemify@localhost:5432/perdiemify';
const client = postgres(connectionString, { max: 3, idle_timeout: 20 });
const db = drizzle(client);

console.log('Perdiemify Scraper starting...');
console.log('Environment:', process.env.NODE_ENV || 'development');

const SCRAPE_INTERVAL_MS = 4 * 60 * 60 * 1000; // Every 4 hours

async function runScrapeJob() {
  console.log(`[${new Date().toISOString()}] Starting scrape job...`);
  try {
    const results = await scrapeAllSources(db);
    console.log(`[${new Date().toISOString()}] Scrape complete:`, results);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Scrape failed:`, err);
  }
}

// Run on startup after a short delay (let DB settle)
setTimeout(() => {
  runScrapeJob();
}, 10_000);

// Then run on interval
const interval = setInterval(runScrapeJob, SCRAPE_INTERVAL_MS);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Scraper received SIGTERM, shutting down...');
  clearInterval(interval);
  client.end().then(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('Scraper received SIGINT, shutting down...');
  clearInterval(interval);
  client.end().then(() => process.exit(0));
});

console.log(`Scraper running — scrapes every ${SCRAPE_INTERVAL_MS / 3600000}h`);
