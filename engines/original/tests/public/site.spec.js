import { test, expect } from '@playwright/test';

test('static public site needs no server API and honestly handles unsupported devices', async ({ page }) => {
  const errors = [], apiCalls = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (new URL(r.url()).pathname.startsWith('/api/')) apiCalls.push(r.url()); });
  await page.addInitScript(() => { localStorage.setItem('colosseum-device-backend','webgpu'); Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Summon. Solve. See the evidence.' })).toBeVisible();
  await expect(page.locator('.device-support')).toContainText('WebGPU is unavailable');
  await expect(page.locator('.model-download')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Load model' }).first()).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Return to server arena' })).toHaveCount(0);
  await expect(page.locator('.roster-row')).toHaveCount(15);
  await page.getByRole('button', { name: 'Battle Archive', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The archive is empty' })).toBeVisible();
  await page.getByRole('button', { name: 'Leaderboards', exact: true }).click();
  await expect(page.getByText('Your device leaderboard', { exact: false })).toBeVisible();
  expect(apiCalls).toEqual([]);
  expect(errors).toEqual([]);
});

test('static gallery and lineage remain usable on mobile with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#contenders');
  await expect(page.locator('.character-profile')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: 'Summon character', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('OFFLINE');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Lineage', exact: true }).click();
  await page.getByText('Configuration changes from parent').click();
  await expect(page.locator('.lineage-node details')).toContainText('Solve independently');
});

test('real WebLLM worker download failure displays an error and keeps weights offline', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('colosseum-device-backend','webgpu'));
  await page.route('https://huggingface.co/**', (route) => route.abort('failed'));
  await page.goto('/');
  const button = page.locator('.model-download').filter({ hasText: 'SmolLM' }).getByRole('button', { name: 'Load model' });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.locator('.device-actions .err')).toBeVisible({ timeout: 20000 });
  await expect(button).toBeEnabled();
  await expect(page.getByText('Weights validated ✓', { exact: true })).toHaveCount(0);
  await expect(page.locator('.pick input:enabled')).toHaveCount(0);
});

test('CPU mode works without WebGPU and a real CPU download failure stays offline', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }));
  await page.route('https://huggingface.co/**', (route) => route.abort('failed'));
  await page.goto('/');
  await expect(page.getByLabel('Device inference backend')).toHaveValue('wasm');
  await expect(page.locator('.sys')).toContainText('CPU available');
  const button = page.locator('.model-download').filter({ hasText: 'SmolLM' }).getByRole('button', { name: 'Load model' });
  await button.click();
  await expect(page.locator('.device-actions .err')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.pick input:enabled')).toHaveCount(0);
});
