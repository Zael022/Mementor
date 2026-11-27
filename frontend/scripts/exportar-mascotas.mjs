// Exporta un PNG por estado de Orbi y Pausa para la ficha de marca (docs/marca/mascotas/estados/).
// Usa los mismos componentes de la app: lo que se ve en la ficha es lo que se ve en pantalla.
// Uso: node scripts/exportar-mascotas.mjs   (necesita Chrome; E2E_CHROME_PATH si no está en la ruta habitual)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const destino = fileURLToPath(new URL('../../docs/marca/mascotas/estados/', import.meta.url));

const vite = await createServer({ root: raiz, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const orbi = await vite.ssrLoadModule('/src/Componentes/Orbi.jsx');
  const pausa = await vite.ssrLoadModule('/src/Componentes/Pausa.jsx');
  const sticker = await vite.ssrLoadModule('/src/Componentes/OrbiSticker.jsx').catch(() => null);

  const piezas = [
    ...orbi.ESTADOS_ORBI.map((estado) => [`orbi-${estado}`, React.createElement(orbi.default, { estado, ancho: 480, parpadeo: false })]),
    ...pausa.ESTADOS_PAUSA.map((estado) => [`pausa-${estado}`, React.createElement(pausa.default, { estado, ancho: 480, parpadeo: false })]),
    ...(sticker ? [['orbi-sticker', React.createElement(sticker.default, { ancho: 480 })]] : []),
  ];

  await mkdir(destino, { recursive: true });
  // El sticker necesita su CSS: sin él se verían también las capas ocultas que usa el doblez.
  const estilos = await readFile(fileURLToPath(new URL('../src/Componentes/Recorrido.css', import.meta.url)), 'utf8');
  const navegador = await chromium.launch({ executablePath: process.env.E2E_CHROME_PATH || undefined });
  const pagina = await navegador.newPage({ deviceScaleFactor: 1 });
  for (const [nombre, elemento] of piezas) {
    const svg = renderToStaticMarkup(elemento);
    await pagina.setContent(`<!doctype html><style>${estilos}</style><body style="margin:0;padding:28px;background:transparent;display:inline-block">${svg}</body>`);
    const caja = await pagina.locator('body > *').first().boundingBox();
    await pagina.screenshot({
      path: `${destino}${nombre}.png`,
      omitBackground: true,
      clip: { x: Math.max(0, caja.x - 24), y: Math.max(0, caja.y - 24), width: caja.width + 48, height: caja.height + 48 },
    });
    await writeFile(`${destino}${nombre}.svg`, `${svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')}\n`);
    console.log(`listo ${nombre}`);
  }
  await navegador.close();
} finally {
  await vite.close();
}
