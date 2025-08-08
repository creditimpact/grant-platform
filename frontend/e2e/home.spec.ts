import { test, expect } from '@playwright/test';

test('home page displays headline', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Grant Application Platform' })).toBeVisible();
});
