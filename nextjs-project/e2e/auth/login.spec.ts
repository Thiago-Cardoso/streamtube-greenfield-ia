import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test('valid credentials redirect to home', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('correctpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('wrong password shows inline error', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveValue('user@example.com');
  });

  test('unconfirmed email shows resend link', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill('unconfirmed@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/email not confirmed/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /resend confirmation email/i })).toBeVisible();
  });
});
