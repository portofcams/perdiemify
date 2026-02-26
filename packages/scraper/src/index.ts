import 'dotenv/config';

console.log('Perdiemify Scraper starting...');
console.log('Scraper service will be built in Phase 2 (Weeks 3-4).');
console.log('Base scraper class, BullMQ scheduling, and Puppeteer integration coming soon.');

// Placeholder — scraper worker will connect to Redis/BullMQ and process jobs
process.on('SIGTERM', () => {
  console.log('Scraper shutting down...');
  process.exit(0);
});
