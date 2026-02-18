import { expect, test } from '@playwright/test';

test('auth page loads in login mode', async ({ page }) => {
  await page.goto('/#/login');

  await expect(page.locator('text=Welcome Back')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();
});

test('signup mode allows selecting vendor role', async ({ page }) => {
  await page.goto('/#/login');

  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.locator('text=Join The Drop')).toBeVisible();

  await page.getByRole('button', { name: 'Vendor' }).click();
  await expect(
    page.locator('text=Vendor accounts finish setup in Seller Studio after email confirmation.')
  ).toBeVisible();
});

test('auth form validates required fields', async ({ page }) => {
  await page.goto('/#/login');

  const email = page.getByPlaceholder('YOU@EXAMPLE.COM');
  const password = page.getByPlaceholder('••••••••');

  await expect(email).toHaveAttribute('required', '');
  await expect(password).toHaveAttribute('required', '');

  const formIsValid = await page.locator('form').evaluate((form) => {
    return (form as HTMLFormElement).checkValidity();
  });
  expect(formIsValid).toBe(false);
});
