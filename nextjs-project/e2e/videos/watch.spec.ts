import { test, expect } from '../fixtures';

test.describe('Watch page', () => {
  test('/watch/nonexistent renders a 404 page', async ({ page }) => {
    const res = await page.goto('/watch/nonexistent00');
    expect(res?.status()).toBe(404);
  });

  test('/watch/:slug after upload shows page content while video is processing', async ({
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

    // Video processing is async; the page shows either the video player (if READY)
    // or the processing status message — both are valid states in E2E.
    const videoOrStatus = page.locator('video, p:has-text("Processing")');
    await expect(videoOrStatus.first()).toBeVisible({ timeout: 5000 });
  });
});
