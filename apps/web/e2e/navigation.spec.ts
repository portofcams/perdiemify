import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('homepage search link navigates to search page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /search/i }).first().click();
    await expect(page).toHaveURL(/\/search/);
  });

  test('unauthenticated user is redirected from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    // Clerk middleware should redirect to sign-in
    await expect(page).toHaveURL(/sign-in/, { timeout: 15000 });
  });

  test('unauthenticated user is redirected from trips', async ({ page }) => {
    await page.goto('/dashboard/trips');
    await expect(page).toHaveURL(/sign-in/, { timeout: 15000 });
  });
});
