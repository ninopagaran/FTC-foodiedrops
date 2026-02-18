import { expect, test } from '@playwright/test';

test('home renders and for restaurants navigates into auth flow', async ({ page }) => {
  await page.goto('/#/');

  await expect(page.locator('text=foodiedrops').first()).toBeVisible();
  await expect(page.locator('text=For Restaurants').first()).toBeVisible();

  await page.locator('text=For Restaurants').first().click();

  await expect(page).toHaveURL(/#\/(studio|login|auth)/);
  await expect(page.locator('text=Welcome Back').first()).toBeVisible();
});

test('admin route for unauthenticated user does not crash', async ({ page }) => {
  await page.goto('/#/admin');
  await expect(page.locator('text=Something went wrong.')).toHaveCount(0);
  await expect(page.locator('text=foodiedrops').first()).toBeVisible();
});
