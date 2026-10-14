import { test, expect } from '@playwright/test';

test('real UI executes the test-provider battle, shows evidence and archives it', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  for (const id of ['good', 'bad']) await page.locator('label.pick').filter({ hasText: new RegExp(`^${id}`) }).locator('input').check();
  await page.getByRole('button', { name: 'Enter the arena with 2' }).click();
  await expect(page.locator('.lane-completed')).toHaveCount(2);
  await expect(page.locator('.lane').filter({ hasText: 'verified correct' }).locator('.score-num')).toHaveText('100');
  await expect(page.locator('.lane').filter({ hasText: 'verified incorrect' }).locator('.score-num')).toHaveText('0');
  await page.getByRole('button', { name: 'Battle Archive', exact: true }).click();
  await page.locator('.ledger-row').first().click();
  await expect(page.getByRole('link', { name: 'Download the JSON record' })).toBeVisible();
  await expect(page.locator('.lane-completed')).toHaveCount(2);
  const record = await (await page.request.get(await page.getByRole('link', { name: 'Download the JSON record' }).getAttribute('href'))).json();
  expect(record.entries[0].messages[1].content).toBe(record.entries[1].messages[1].content);
  expect(record.entries.every((e) => e.verification?.verifiedAt)).toBeTruthy();
  expect(errors).toEqual([]);
});

test('offline summoning never claims operational status; lineage remains inspectable', async ({ page }) => {
  await page.goto('/#contenders');
  await page.locator('.character-row').filter({ hasText: 'ghost' }).click();
  await expect(page.locator('.profile-availability')).toContainText('OFFLINE');
  await expect(page.locator('.capability-radar')).toContainText('UNTESTED');
  await page.getByRole('button', { name: 'Summon character', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('OFFLINE');
  await expect(dialog).toContainText('AWAITING EVALUATION', { timeout: 6000 });
  await page.getByRole('button', { name: 'View character profile', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Inspect lineage →' }).click();
  await page.getByText('Configuration changes from parent').click();
  await expect(page.locator('.lineage-node details')).toContainText('be careful');
});

test('gallery stays within a mobile viewport and respects reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#contenders');
  await expect(page.locator('.character-profile')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: 'Summon character', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('AWAITING EVALUATION');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
