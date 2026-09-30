import { test, expect, type Page } from '@playwright/test';
import { enterWelcomeAge, selectWelcomeAge } from './onboarding-welcome';
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || '4317'}`;
const headers = { Authorization: 'Bearer local-e2e-token' };

async function captureFade(page: Page, action: () => Promise<unknown>) {
  await page.evaluate(() => {
    const frames: number[][] = [];
    (window as any).onboardingFadeFrames = frames;
    const start = performance.now();
    const sample = () => {
      const names = ['heading-0', 'heading-1', 'content-0', 'actions'];
      const elements = names.map(name => document.querySelector(`[data-testid="onboarding-reveal-${name}"]`));
      if (elements.every(Boolean)) frames.push(elements.map(el => Number(getComputedStyle(el!).opacity)));
      if (performance.now() - start < 1400) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await action();
  await page.waitForTimeout(1500);
  return page.evaluate(() => (window as any).onboardingFadeFrames as number[][]);
}

test('age is a second Welcome step, stays within bounds, and saves with retry before Goal', async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await page.goto('/onboarding');
  await expect(page.getByTestId('onboarding-welcome-age-value')).toHaveCount(0);
  await expect(page.getByRole('button', { name: "I'm ready!" })).toBeEnabled();
  await enterWelcomeAge(page, 13);
  await expect(page.getByRole('button', { name: 'Decrease age', exact: true })).toBeDisabled();
  await selectWelcomeAge(page, 120);
  await expect(page.getByRole('button', { name: 'Increase age', exact: true })).toBeDisabled();
  await selectWelcomeAge(page, 29);
  const before = await (await request.get(`${API}/__state`)).json();
  expect(before.requests.filter((r: any) => r.path === '/users/user' && r.body.age !== undefined)).toHaveLength(0);
  await request.post(`${API}/__fail`, { data: { path: '/users/user' } });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What is your age?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('textbox', { name: 'Your answer' })).toBeVisible();
  const state = await (await request.get(`${API}/__state`)).json();
  expect(state.user.age).toBe(29);
  expect(state.requests.filter((r: any) => r.path === '/users/user' && r.body.age === 29)).toHaveLength(2);
});

test('saved age is prefilled and preview editing performs no profile writes', async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, { headers, data: { age: 31 } });
  await page.goto('/onboarding?preview=1');
  await page.getByRole('button', { name: "I'm ready!" }).click();
  await expect(page.getByTestId('onboarding-welcome-age-value')).toHaveText('31');
  await selectWelcomeAge(page, 29);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Your answer' })).toBeVisible();
  const state = await (await request.get(`${API}/__state`)).json();
  expect(state.user.age).toBe(31);
  expect(state.requests.filter((r: any) => r.path === '/users/user' && r.body.age === 29)).toHaveLength(0);
});

test('sections fade top to bottom on entry and back, and typing does not restart them', async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await page.goto('/onboarding?preview=1');
  await enterWelcomeAge(page);
  const frames = await captureFade(page, () => page.getByRole('button', { name: 'Continue', exact: true }).click());
  expect(frames.some(([art, title, input]) => art > title + 0.05 && title > input + 0.05)).toBe(true);
  expect(frames.some(([, , input, actions]) => input > actions + 0.1)).toBe(true);
  expect(frames.at(-1)).toEqual([1, 1, 1, 1]);
  const content = page.getByTestId('onboarding-reveal-content-0');
  await content.evaluate(el => el.setAttribute('data-mounted-marker', 'same'));
  await page.getByRole('textbox', { name: 'Your answer' }).fill('Run my first half marathon under two hours');
  await expect(content).toHaveAttribute('data-mounted-marker', 'same');
  await expect(content).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'How much do you run now?' })).toBeVisible();
  await page.waitForTimeout(800);
  const back = await captureFade(page, () => page.getByRole('button', { name: 'Previous question', exact: true }).click());
  expect(back.some(([art, title, input]) => art > title + 0.05 && title > input + 0.05)).toBe(true);
  expect(back.at(-1)).toEqual([1, 1, 1, 1]);
});

test('Welcome fades only its body between intro and age, preserves its header, and can go back', async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await page.goto('/onboarding?preview=1');
  const title = page.getByRole('heading', { name: 'Welcome to tracking.so' });
  await expect(page.getByTestId('onboarding-reveal-welcome-intro-2')).toHaveCSS('opacity', '1');
  const original = await title.boundingBox();
  await title.evaluate(el => el.setAttribute('data-mounted-marker', 'same'));
  await page.evaluate(() => {
    const samples: number[] = [];
    (window as any).welcomeBodyFade = samples;
    const start = performance.now();
    const sample = () => {
      const body = document.querySelector('[data-testid="onboarding-welcome-body"]')!;
      samples.push(Number(getComputedStyle(body).opacity));
      if (performance.now() - start < 1200) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await enterWelcomeAge(page);
  await expect(page.getByTestId('onboarding-reveal-welcome-age-2')).toHaveCSS('opacity', '1');
  const samples = await page.evaluate(() => (window as any).welcomeBodyFade as number[]);
  expect(samples.some(value => value > 0 && value < 0.9)).toBe(true);
  await expect(title).toHaveAttribute('data-mounted-marker', 'same');
  expect((await title.boundingBox())!.y).toBeCloseTo(original!.y, 0);
  await page.getByRole('button', { name: 'Previous question', exact: true }).click();
  await expect(page.getByRole('button', { name: "I'm ready!" })).toBeVisible();
  await expect(page.getByTestId('onboarding-welcome-age-value')).toHaveCount(0);
  await page.getByRole('button', { name: "I'm ready!" }).click();
  await expect(page.getByTestId('onboarding-welcome-age-value')).toHaveText('29');
});
