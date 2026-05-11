import { test, expect } from '../fixtures';

test.describe('Upload page', () => {
  test('unauthenticated visit to /upload redirects to /auth/login', async ({ page }) => {
    await page.goto('/upload');
    await expect(page).toHaveURL('/auth/login');
  });

  test('authenticated user sees file input and upload button', async ({ page, testData }) => {
    const { email, password } = testData.confirmedUser;
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/upload');
    await expect(page.getByLabel(/video file/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /upload/i })).toBeVisible();
  });

  test('selecting a file and uploading shows a progress bar and redirects to /watch/:slug', async ({
    page,
    testData,
  }) => {
    const { email, password } = testData.confirmedUser;
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/upload');

    const fileInput = page.getByLabel(/video file/i);
    await fileInput.setInputFiles({
      name: 'test.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake-mp4-content'),
    });

    await page.getByRole('button', { name: /upload/i }).click();

    await expect(page).toHaveURL(/\/watch\/[A-Za-z0-9_-]{11}/, { timeout: 15000 });
  });
});
