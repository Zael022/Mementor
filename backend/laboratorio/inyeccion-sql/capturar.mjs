// Graba la demostración del laboratorio: capturas de cada paso y un video corto (MP4).
// Uso (con el laboratorio corriendo en otra terminal): node laboratorio/inyeccion-sql/capturar.mjs
// Necesita Playwright del frontend (npx playwright install chromium) o CHROME_PATH con un Chrome instalado,
// y ffmpeg en el PATH para armar el video con los cuadros capturados.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const { chromium } = await import(pathToFileURL(path.join(raiz, 'frontend/node_modules/playwright/index.mjs')).href);
const salida = path.join(raiz, 'docs/seguridad/evidencias');
const temporal = path.join(salida, '.cuadros');
mkdirSync(temporal, { recursive: true });

const url = `http://127.0.0.1:${process.env.LAB_PORT || 3199}/`;
const navegador = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const contexto = await navegador.newContext({ viewport: { width: 1360, height: 900 } });
const pagina = await contexto.newPage();

// Cuadros del video: una captura cada ~120 ms mientras corre la demostración.
let grabando = true;
const inicio = Date.now();
let cuadro = 0;
const grabacion = (async () => {
  while (grabando) {
    await pagina.screenshot({ path: path.join(temporal, `${String(cuadro++).padStart(5, '0')}.png`) }).catch(() => {});
    await new Promise((listo) => setTimeout(listo, 120));
  }
})();
const pausa = (ms) => pagina.waitForTimeout(ms);
const foto = (nombre) => pagina.screenshot({ path: path.join(salida, `${nombre}.png`) });

async function buscar(destino, texto) {
  const campo = pagina.getByLabel(destino === 'vulnerable' ? 'Buscar (vulnerable)' : 'Buscar (protegida)');
  await campo.fill('');
  await campo.pressSequentially(texto, { delay: 35 });
  await campo.press('Enter');
  await pausa(900);
}

await pagina.goto(url);
await pausa(1200);
await foto('01-busqueda-normal');

// Ataque 1: OR 1=1 devuelve todas las filas, también las del otro colegio.
await buscar('vulnerable', "' OR 1=1 -- ");
await buscar('protegida', "' OR 1=1 -- ");
await foto('02-or-1-igual-1');

// Ataque 2: UNION agrega correos y hashes de contraseñas de toda la tabla.
await buscar('vulnerable', "zzz' UNION SELECT email, password_hash FROM users -- ");
await buscar('protegida', "zzz' UNION SELECT email, password_hash FROM users -- ");
await foto('03-union-hashes');

// Ataque 3: una comilla sola rompe la consulta y la base revela su error.
await buscar('vulnerable', "'");
await buscar('protegida', "'");
await foto('04-error-de-la-base');

// Ataque 4: el inicio de sesión real de MENTOR AI rechaza la inyección.
await pagina.getByRole('button', { name: 'Entrar' }).click();
await pausa(900);
await pagina.locator('section.login').scrollIntoViewIfNeeded();
await foto('05-login-rechazado');
await pausa(1200);

grabando = false;
await grabacion;
const fps = Math.max(1, Math.round((cuadro / ((Date.now() - inicio) / 1000)) * 10) / 10);
await contexto.close();
await navegador.close();
// Arma el MP4 con la cantidad real de cuadros por segundo que se lograron capturar.
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(temporal, '%05d.png'),
  '-vf', 'scale=1360:-2,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', path.join(salida, 'demostracion-inyeccion-sql.mp4')]);
rmSync(temporal, { recursive: true, force: true });
console.log(`Evidencias en ${salida}`);
