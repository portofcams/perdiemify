import 'dotenv/config';

/**
 * Perdiemify Discount Code Scraper
 *
 * Scrapes discount codes from travel booking sites:
 * - Booking.com, Expedia, Hotels.com promo codes
 * - Military/government travel discount aggregators
 * - Coupon sites (RetailMeNot, Honey, etc.)
 *
 * Uses Puppeteer for JS-rendered pages, BullMQ for scheduling.
 * Full implementation coming in Phase 2.
 */

console.log('Perdiemify Scraper starting...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Redis URL:', process.env.REDIS_URL ? 'configured' : 'not configured');

// Keep the process alive — in production this would be a BullMQ Worker
const keepAlive = setInterval(() => {
  // Heartbeat — prevents container from restarting
}, 30_000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Scraper received SIGTERM, shutting down...');
  clearInterval(keepAlive);
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Scraper received SIGINT, shutting down...');
  clearInterval(keepAlive);
  process.exit(0);
});

console.log('Scraper is idle — waiting for BullMQ integration (Phase 2).');
