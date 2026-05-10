import { test, expect } from '@playwright/test';

test.describe('Email confirmation page', () => {
  test('valid token shows success message', async ({ page }) => {
    await page.goto('/auth/confirm-email?token=valid-token-here');
    await expect(page.getByText(/email confirmed/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });

  test('invalid token shows error and resend form', async ({ page }) => {
    await page.goto('/auth/confirm-email?token=invalid-token');
    await expect(page.getByText(/invalid link|link expired/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /resend confirmation email/i })).toBeVisible();
  });

  test('missing token shows invalid link immediately', async ({ page }) => {
    await page.goto('/auth/confirm-email');
    await expect(page.getByText(/invalid link/i)).toBeVisible();
  });
});
