import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const base = process.env.AQUARIA_TEST_URL ?? 'http://localhost:6002';
try {
  for (const device of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport: { width: device.width, height: device.height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto(base + '/start', { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200, device.name + ': /start response');
    await page.getByRole('button', { name: 'Load Game' }).click();
    await page.getByText('Save selection is coming soon.').waitFor();
    assert.equal(await page.locator('.brand-logo').evaluate((img) => img.complete && img.naturalWidth > 0), true);
    await page.screenshot({ path: 'C:/Temp/aquaria-menu-' + device.name + '.png' });
    await page.getByRole('button', { name: 'Start Game' }).click();
    const dialog = page.locator('#customize-panel');
    await dialog.waitFor({ state: 'visible' });
    await page.getByLabel('Hairstyle').selectOption('2');
    await page.getByLabel('Hair color: Teal').check();
    await page.screenshot({ path: 'C:/Temp/aquaria-customize-' + device.name + '.png' });
    await page.getByRole('button', { name: /Enter the Island/ }).click();
    await page.waitForURL(base + '/', { timeout: 15000 });
    await page.locator('#scene').waitFor();
    const veil = page.locator('#island-arrival-veil');
    await veil.waitFor({ state: 'attached', timeout: 7000 });
    await veil.waitFor({ state: 'detached', timeout: 7000 });
    const appearance = await page.evaluate(() => JSON.parse(localStorage.getItem('aquaria.save'))?.appearance);
    assert.equal(appearance.hair, 2, device.name + ': hairstyle saved');
    assert.equal(appearance.hairColor, 5, device.name + ': hair color saved');
    await page.screenshot({ path: 'C:/Temp/aquaria-island-' + device.name + '.png' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!document.getElementById('scene'));
    assert.equal(await page.locator('#island-arrival-veil').count(), 0, device.name + ': no replay on reload');
    assert.deepEqual(errors, [], device.name + ': browser exceptions');
    console.log(device.name + ': /start, placeholder, customize, fade, island, autosave, reload passed');
    await context.close();
  }
} finally {
  await browser.close();
}
