import { test, expect } from '../fixtures';

test.describe('Password recovery', () => {
  test('forgot-password shows neutral success message', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await page.getByLabel('Email').fill('anyone@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();
    await expect(page.getByText(/if this email is registered/i)).toBeVisible();
  });

  test('reset-password with valid token shows success', async ({ page, testData }) => {
    await page.goto(`/auth/reset-password?token=${encodeURIComponent(testData.resetToken)}`);
    await page.getByLabel('New password', { exact: true }).fill('newpassword123');
    await page.getByLabel('Confirm new password').fill('newpassword123');
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText(/password updated/i)).toBeVisible();
  });

  test('reset-password with invalid token shows error', async ({ page }) => {
    await page.goto('/auth/reset-password?token=invalid-or-expired-token');
    await page.getByLabel('New password', { exact: true }).fill('newpassword123');
    await page.getByLabel('Confirm new password').fill('newpassword123');
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText(/link expired|invalid link/i)).toBeVisible();
    await expect(
      page.getByRole('link', { name: /request a new link/i }),
    ).toBeVisible();
  });
});
