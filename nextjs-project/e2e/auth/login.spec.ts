import { test, expect } from '../fixtures';

test.describe('Login page', () => {
  test('valid credentials redirect to home', async ({ page, testData }) => {
    const { email, password } = testData.confirmedUser;
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('wrong password shows inline error', async ({ page, testData }) => {
    const { email } = testData.confirmedUser;
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveValue(email);
  });
});
