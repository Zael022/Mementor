// Comprueba la CSP de la compilación: npm run build && npx vite preview --port 4180, y en otra terminal: node scripts/verificar-csp.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage();
const problemas = [];
page.on('console', (m) => { if (/Content Security Policy|Refused/i.test(m.text())) problemas.push(m.text()); });
const res = await page.goto(`http://127.0.0.1:${process.env.PREVIEW_PORT || 4180}/login`, { waitUntil: 'networkidle' });
console.log('CSP:', res.headers()['content-security-policy']);
await page.waitForTimeout(1500);
console.log('Título visible:', await page.getByRole('heading').first().textContent());
// Un script inyectado en línea debe bloquearse.
await page.evaluate(() => { const s = document.createElement('script'); s.textContent = 'window.inyectado = 1'; document.body.appendChild(s); });
await page.waitForTimeout(300);
console.log('Script en línea ejecutado:', await page.evaluate(() => window.inyectado === 1));
console.log('Violaciones:', problemas.length, problemas.slice(0, 3));
await browser.close();
