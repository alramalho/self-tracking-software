import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { selectWelcomeAge } from './onboarding-welcome';
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || '4317'}`;
const welcomeCTA = process.env.CAPTURE_CURRENT ? "Let's start" : "I'm ready!";
const headers = { Authorization: 'Bearer local-e2e-token' };
const output = path.resolve('../../docs/reviews/onboarding-2d/screens', process.env.CAPTURE_CURRENT ? 'current' : 'clean-3d');
mkdirSync(output, { recursive: true });
test.use({ video: process.env.CAPTURE_MOTION ? { mode: 'on', size: { width: 390, height: 664 } } : 'off' });
async function capture(page: Page, name: string) {
  await page.waitForTimeout(1000);
  const canvas = page.locator('[data-testid^="onboarding-target-lottie-"] canvas');
  if (await canvas.count()) {
    await expect.poll(() => canvas.evaluate(node => {
      const canvas = node as HTMLCanvasElement;
      const context = canvas.getContext('2d');
      if (!context || !canvas.width || !canvas.height) return false;
      return context.getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0);
    }), { message: 'The real target Lottie must paint before its screenshot.', timeout: 15000 }).toBe(true);
  }
  await page.screenshot({ path: path.join(output, `${name}.png`) });
}
for (const theme of ['LIGHT', 'DARK']) {
  test(`capture complete onboarding visual journey in ${theme}`, async ({ page, request }) => {
    test.setTimeout(180000);
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme } });
    await page.goto('/onboarding?preview=1');
    await expect(page.getByRole('button', { name: welcomeCTA })).toBeVisible();
    if (process.env.CAPTURE_BASELINE) {
      await capture(page, `before-welcome-${theme}`);
      await page.getByRole('button', { name: welcomeCTA }).click();
      await capture(page, `before-goal-${theme}`);
      return;
    }
    if (!process.env.CAPTURE_CURRENT) {
      const invitation = page.getByText('Naturally, most of the work will come from you. Are you ready?');
      await expect(invitation).toBeVisible();
      await expect(page.getByTestId('onboarding-target-lottie-welcome').locator('canvas')).toBeVisible();
      await expect(page.getByTestId('onboarding-reveal-welcome-intro-2')).toHaveCSS('opacity', '1');
      const box = await invitation.boundingBox();
      const actionBox = await page.getByRole('button', { name: welcomeCTA }).boundingBox();
      expect(box!.y + box!.height).toBeLessThan(actionBox!.y - 28);
    }
    await capture(page, `01-welcome-${theme}`);
    if (process.env.CAPTURE_WELCOME_ONLY) return;
    await page.getByRole('button', { name: welcomeCTA }).click();
    if (!process.env.CAPTURE_CURRENT) {
      await selectWelcomeAge(page);
      await capture(page, `01b-welcome-age-${theme}`);
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await expect(page.getByTestId('onboarding-art-goal')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(page.getByTestId('onboarding-target-lottie-goal').locator('canvas')).toBeVisible();
    }
    await capture(page, `02-goal-${theme}`);
    await page.getByRole('textbox', { name: 'Your answer' }).fill('Run my first half marathon under two hours');
    await capture(page, `03-goal-filled-${theme}`);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'How much do you run now?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Your answer' }).fill('I currently run two easy 3 km runs a week');
    await capture(page, `04-baseline-${theme}`);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Why does it matter?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Your answer' }).fill('I want to finish with my friends');
    await capture(page, `05-motivation-${theme}`);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByTestId('onboarding-weekly-frequency-value')).toHaveText('3');
    await page.getByRole('button', { name: 'Increase sessions per week' }).click();
    await expect(page.getByTestId('onboarding-weekly-frequency-value')).toHaveText('4');
    await capture(page, `06-rhythm-${theme}`);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByTestId('coach-tour-role')).toBeVisible();
    await page.getByRole('radio', { name: 'Plan and adjust training' }).click();
    await capture(page, `07-coach-role-${theme}`);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByTestId('coach-tour-contact')).toBeVisible();
    await capture(page, `08-coach-contact-${theme}`);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByTestId('coach-tour-data')).toBeVisible();
    await capture(page, `09-coach-data-${theme}`);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Do it with a group?' })).toBeVisible();
    await capture(page, `10-circle-${theme}`);
    await page.getByRole('button', { name: 'Find me a circle' }).click();
    await expect(page.getByRole('heading', { name: 'Match me by' })).toBeVisible();
    if (!process.env.CAPTURE_CURRENT) {
      const ageMatch = page.getByRole('checkbox', { name: 'Age', exact: true });
      await expect(ageMatch).toContainText('29');
      if (await ageMatch.getAttribute('aria-checked') !== 'true') await ageMatch.click();
      await expect(ageMatch).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('textbox', { name: 'Your age' })).toHaveCount(0);
    }
    await capture(page, `11-match-${theme}`);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByTestId('onboarding-plan-summary')).toBeVisible();
    await capture(page, `12-review-${theme}`);
    await page.getByRole('button', { name: 'This feels right' }).click();
    await expect(page.getByTestId('coaching-paywall')).toBeVisible();
    await capture(page, `13-paywall-${theme}`);
    await page.getByRole('button', { name: 'Just track it for free' }).click();
    await expect(page.getByRole('button', { name: 'Track for free', exact: true })).toBeVisible();
    for (const section of await page.locator('[data-testid^="onboarding-reveal-free-sheet-"]').all()) {
      await expect(section).toHaveCSS('opacity', '1');
    }
    await capture(page, `14-free-option-${theme}`);
    await page.getByRole('button', { name: /^Try \w+ free for 7 days$/ }).click();
    await expect(page.getByText('Your preview is complete')).toBeVisible();
    await capture(page, `15-complete-${theme}`);
    const state = await (await request.get(`${API}/__state`)).json();
    expect(state.requests.filter((r: { path: string }) => r.path.endsWith('/draft') || r.path.endsWith('/finish'))).toHaveLength(0);
    expect(state.plans).toHaveLength(2);
    expect(state.requests.filter((r: { path: string; body: { age?: number } }) => r.path === '/users/user' && r.body.age !== undefined)).toHaveLength(0);
    if (process.env.CAPTURE_MOTION) {
      const video = page.video()!;
      await page.close();
      await video.saveAs(path.join(output, `journey-${theme}.webm`));
    }
  });
}

test('Reduce Motion shows the still and removes the colored artwork plate', async ({ page, request }) => {
  test.skip(!!process.env.CAPTURE_CURRENT, 'Existing clay baseline has its original backdrop.');
  await request.post(`${API}/__reset`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/onboarding?preview=1');
  const artwork = page.getByTestId('onboarding-art-welcome');
  await expect(artwork).toBeVisible();
  await expect(artwork).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(artwork.locator('img')).toHaveAttribute('src', /target-still\.png/);
  await expect(page.locator('[data-testid^=onboarding-reveal-]')).not.toHaveCount(0);
  for (const section of await page.locator('[data-testid^=onboarding-reveal-]').all()) await expect(section).toHaveCSS('opacity', '1');

  await capture(page, 'welcome-reduced-motion');
  await page.getByRole('button', { name: welcomeCTA }).click();
  await expect(page.getByTestId('onboarding-reveal-welcome-age-0')).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByTestId('onboarding-target-still-goal').locator('img')).toHaveAttribute('src', /target-still\.png/);
  await expect(page.getByTestId('onboarding-art-goal')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});
