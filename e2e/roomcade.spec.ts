import { expect, test } from '@playwright/test';

test('creates a House and enters its fireside room', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Make yourself at home.' })).toBeVisible();
  await page.getByRole('button', { name: 'Create a House' }).first().click();
  await page.getByLabel('House name').fill(`Lantern House ${testInfo.project.name}`);
  await page.getByLabel('Your name in this House').fill('Mara Bell');
  await page.getByRole('button', { name: 'Create House', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Living Room' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bring Codenames in.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join voice' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('fireside-room.png'), fullPage: true });
});

test('House overview stays separate from the room scene', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create a House' }).first().click();
  await page.getByLabel('House name').fill(`Juniper House ${testInfo.project.name}`);
  await page.getByLabel('Your name in this House').fill('Tavi Moss');
  await page.getByRole('button', { name: 'Create House', exact: true }).click();
  await page.getByRole('button', { name: /Juniper House/ }).click();
  await page.getByRole('menuitem', { name: 'House overview' }).click();
  await expect(page.getByRole('region', { name: 'House floor plan' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('house-overview.png'), fullPage: true });
});
