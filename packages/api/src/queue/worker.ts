import 'dotenv/config';

/**
 * Perdiemify Background Worker
 *
 * Processes background jobs via BullMQ:
 * - Discount code scraping schedules
 * - Per diem rate refreshes (daily GSA sync)
 * - Loyalty valuation updates
 * - Email notifications (trip summaries, deal alerts)
 *
 * Full implementation coming in Phase 2.
 */

console.log('Perdiemify Worker starting...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Redis URL:', process.env.REDIS_URL ? 'configured' : 'not configured');

// Keep the process alive — in production this would be a BullMQ Worker
const keepAlive = setInterval(() => {
  // Heartbeat — prevents container from showing as unhealthy
}, 30_000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Worker received SIGTERM, shutting down...');
  clearInterval(keepAlive);
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Worker received SIGINT, shutting down...');
  clearInterval(keepAlive);
  process.exit(0);
});

console.log('Worker is idle — waiting for BullMQ integration (Phase 2).');
