import { test, expect } from '@playwright/test';

test.describe('Search page', () => {
  test('has booking type tabs', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('text=Hotels').first()).toBeVisible();
    await expect(page.locator('text=Flights').first()).toBeVisible();
    await expect(page.locator('text=Cars').first()).toBeVisible();
  });

  test('has header navigation links', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('link', { name: /perdiemify/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /calculator/i })).toBeVisible();
  });
});

test.describe('Calculator page', () => {
  test('has all form fields', async ({ page }) => {
    await page.goto('/calculator');
    await expect(page.locator('#city')).toBeVisible();
    await expect(page.locator('#state')).toBeVisible();
    await expect(page.locator('#checkIn')).toBeVisible();
    await expect(page.locator('#checkOut')).toBeVisible();
  });

  test('has submit button', async ({ page }) => {
    await page.goto('/calculator');
    await expect(page.getByRole('button', { name: /calculate per diem/i })).toBeVisible();
  });

  test('shows SEO content before calculation', async ({ page }) => {
    await page.goto('/calculator');
    await expect(page.locator('text=What is Per Diem?')).toBeVisible();
    await expect(page.locator('text=First & Last Day Rule')).toBeVisible();
    await expect(page.locator('text=How Per Diem Savings Work')).toBeVisible();
  });
});

test.describe('SEO', () => {
  test('homepage has JSON-LD structured data', async ({ page }) => {
    await page.goto('/');
    const scripts = await page.locator('script[type="application/ld+json"]').all();
    expect(scripts.length).toBeGreaterThanOrEqual(3);
  });

  test('sitemap.xml is accessible', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('xml');
  });
});
