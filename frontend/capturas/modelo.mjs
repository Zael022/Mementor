import { chromium } from '@playwright/test';
import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';

// Rasteriza únicamente los SVG generados del esquema; no crea datos de aplicación.
const browser = await chromium.launch({ headless: true, executablePath: process.env.E2E_CHROME_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  for (const name of ['er-7-crm', 'er-general']) {
    const source = new URL(`../../docs/datos/${name}.svg`, import.meta.url);
    await page.goto(source.href);
    await page.locator('svg').screenshot({ path: fileURLToPath(new URL(`../../docs/datos/${name}.png`, import.meta.url)) });
  }
} finally { await browser.close(); }
