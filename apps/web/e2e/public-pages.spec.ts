import { test, expect } from '@playwright/test';

test.describe('Public pages', () => {
  test('homepage loads with hero section', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Perdiemify/);
    await expect(page.locator('text=Keep the Difference')).toBeVisible();
  });

  test('homepage has navigation links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /search/i }).first()).toBeVisible();
  });

  test('homepage has pricing section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Free')).toBeVisible();
    await expect(page.locator('text=Pro')).toBeVisible();
  });

  test('search page loads with form', async ({ page }) => {
    await page.goto('/search');
    await expect(page).toHaveTitle(/Perdiemify/);
  });

  test('calculator page loads', async ({ page }) => {
    await page.goto('/calculator');
    await expect(page).toHaveTitle(/Perdiemify/);
  });

  test('404 page renders for unknown routes', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.locator('text=not found').first()).toBeVisible();
  });

  test('sign-in page renders Clerk component', async ({ page }) => {
    await page.goto('/sign-in');
    // Clerk renders its own sign-in widget
    await expect(
      page.locator('[data-clerk-component], .cl-rootBox, .cl-signIn-root').first()
    ).toBeVisible({ timeout: 15000 });
  });
});
