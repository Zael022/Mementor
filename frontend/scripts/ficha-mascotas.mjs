// Arma la lámina de la ficha de marca (docs/marca/mascotas/ficha-mascotas.png) con los PNG por estado.
// Uso: node scripts/exportar-mascotas.mjs && node scripts/ficha-mascotas.mjs   (E2E_CHROME_PATH si hace falta)
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const carpeta = fileURLToPath(new URL('../../docs/marca/mascotas/', import.meta.url));
const imagen = async (nombre) => `data:image/png;base64,${(await readFile(`${carpeta}estados/${nombre}.png`)).toString('base64')}`;

const ORBI = [
  ['saludo', 'Saludo', 'Mapa del curso'],
  ['animo', 'Ánimo', 'Pareja encontrada'],
  ['pensando', 'Pensando', 'Tutor buscando'],
  ['celebrando', 'Celebrando', 'Rango o módulo'],
  ['descanso', 'Descanso', 'Reservado, aún sin uso'],
];
const PAUSA = [
  ['bienvenida', 'Bienvenida', 'Regreso tras 7 días'],
  ['leyendo', 'Leyendo', 'Estados vacíos'],
  ['dormido', 'Dormido', 'Sin novedades'],
];
const PALETA = [
  ['#181B3E', 'Tinta'], ['#3452E1', 'Azul'], ['#6F86FF', 'Azul Orbi'], ['#C5EF6A', 'Lima'], ['#F0591A', 'Naranja'],
  ['#EAEEFF', 'Cielo'], ['#6B7494', 'Gris Pausa'], ['#A9B1CF', 'Gris claro'], ['#8A5A3B', 'Rama'],
];

const tarjeta = async (archivo, titulo, uso, clase = '') => `<figure class="${clase}"><img src="${await imagen(archivo)}" alt=""><figcaption><b>${titulo}</b><span>${uso}</span></figcaption></figure>`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
body { margin: 0; width: 1600px; font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; color: #181B3E; background: #F4F6FC; }
.cabecera { background: #181B3E; color: #fff; padding: 40px 60px; }
.cabecera h1 { margin: 0; font-size: 46px; } .cabecera p { margin: 8px 0 0; font-size: 20px; color: #EAEEFF; }
section { padding: 30px 60px 10px; } h2 { font-size: 26px; margin: 0 0 18px; }
.fila { display: flex; gap: 16px; }
figure { margin: 0; background: #fff; border: 2px solid #DCE1F0; border-radius: 18px; padding: 16px; width: 248px; display: flex; flex-direction: column; align-items: center; box-sizing: border-box; flex: 1; }
figure img { height: 170px; max-width: 100%; object-fit: contain; }
figure.ancha { flex: 1.4; } figure.ancha img { height: 200px; }
figcaption { text-align: center; margin-top: 8px; } figcaption b { display: block; font-size: 20px; } figcaption span { color: #555C7A; font-size: 15px; }
.paleta { display: flex; gap: 14px; padding-bottom: 40px; } .paleta div { flex: 1; }
.paleta i { display: block; height: 80px; border-radius: 14px; border: 2px solid rgba(24, 27, 62, 0.13); }
.paleta b { display: block; margin-top: 6px; } .paleta span { font-family: monospace; color: #555C7A; }
</style></head><body>
<div class="cabecera"><h1>Mascotas de MENTOR AI</h1><p>Orbi acompaña el recorrido; Pausa cuida los momentos tranquilos. Son decorativas: la información siempre está también en texto.</p></div>
<section><h2>Orbi · estados</h2><div class="fila">${(await Promise.all(ORBI.map(([e, t, u]) => tarjeta(`orbi-${e}`, t, u)))).join('')}</div></section>
<section><h2>Pausa · estados y Orbi sticker</h2><div class="fila">${(await Promise.all(PAUSA.map(([e, t, u]) => tarjeta(`pausa-${e}`, t, u)))).join('')}${await tarjeta('orbi-sticker', 'Orbi sticker', 'Celebraciones, rango y Parejas', 'ancha')}</div></section>
<section><h2>Paleta</h2><div class="paleta">${PALETA.map(([color, nombre]) => `<div><i style="background:${color}"></i><b>${nombre}</b><span>${color}</span></div>`).join('')}</div></section>
</body></html>`;

const navegador = await chromium.launch({ executablePath: process.env.E2E_CHROME_PATH || undefined });
const pagina = await navegador.newPage({ viewport: { width: 1600, height: 900 } });
await pagina.setContent(html);
await pagina.screenshot({ path: `${carpeta}ficha-mascotas.png`, fullPage: true });
await navegador.close();
console.log('listo ficha-mascotas.png');
