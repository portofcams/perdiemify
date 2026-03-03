import { test, expect } from '@playwright/test';

test.describe('Security headers', () => {
  test('response includes X-Content-Type-Options', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('response includes X-Frame-Options', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.headers()['x-frame-options']).toBe('DENY');
  });

  test('response includes Referrer-Policy', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('response includes Content-Security-Policy', async ({ page }) => {
    const response = await page.goto('/');
    const csp = response?.headers()['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('clerk');
  });
});
