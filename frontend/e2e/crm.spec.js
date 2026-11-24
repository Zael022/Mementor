import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { entrar, prepararCurso, sesion } from './support/datos.mjs';

const config = { transiciones: Array.from({ length: 8 }, () => ({ ventanaDias: 7, metaPct: null })), diasAlerta: 5, conservacionCerradasDias: 90, conservacionBorradoresDias: 30, politica: 'Consultar las condiciones verificadas antes de continuar el proceso de admisión.', politicaVersion: '1', aprobacionConservacion: 'Referencia temporal aislada' };
async function setup(label) {
  const data = await prepararCurso(label); const admin = await sesion(data.admin); const now = Date.now();
  const cycle = await admin.post('/crm/convocatorias', { courseId: data.cursoId, nombre: `Admisión ${label}`, sede: 'Sede temporal', inicio: new Date(now - 86400000).toISOString(), fin: new Date(now + 86400000 * 30).toISOString(), configuracion: config });
  return { ...data, adminApi: admin, cycle };
}

test('registro, ficha, movimiento con teclado, borrador y conflicto de contexto', async ({ page }) => {
  const data = await setup('crm-ui'); await entrar(page, data.admin); await page.goto('/admisiones/candidatos');
  await page.getByText('Registrar prospecto o reutilizar una ficha').click();
  await page.getByLabel('Convocatoria de registro').selectOption(String(data.cycle.id)); await page.getByLabel('Nombre del prospecto').fill('Persona temporal CRM'); await page.getByLabel('Correo del prospecto').fill(`persona.${data.cycle.id}@e2e.test`); await page.getByLabel('Procedencia', { exact: true }).fill('Formulario temporal');
  await page.getByRole('button', { name: 'Crear ficha y solicitud' }).click(); await expect(page.getByRole('heading', { name: 'Persona temporal CRM', exact: true })).toBeVisible();
  const move = page.getByRole('button', { name: 'Mover a', exact: true }); await move.focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('dialog')).toBeVisible(); await page.getByLabel('Motivo de la operación').fill('Revisión inicial verificada'); await page.getByRole('button', { name: 'Confirmar operación' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(move).toBeFocused();
  await page.getByLabel('Objetivo del contacto').fill('Explicar el siguiente paso autorizado'); await page.getByRole('button', { name: 'Solicitar borrador con IA' }).click(); await expect(page.getByLabel('Texto del borrador')).toBeVisible();
  await page.getByRole('button', { name: 'Aprobar esta versión' }).click(); await expect(page.getByText(/Revisión: Aprobado/)).toBeVisible();
  await page.getByLabel('Texto del borrador').fill('Texto editado para una nueva revisión humana.'); await page.getByRole('button', { name: 'Guardar edición e invalidar aprobación' }).click(); await expect(page.getByText(/Revisión: Pendiente/)).toBeVisible();
  const id = page.url().split('/').at(-1); const current = await data.adminApi.get(`/crm/solicitudes/${id}`); await data.adminApi.patch(`/crm/solicitudes/${id}`, { versionEsperada: current.version, revisada: true, motivo: 'Cambio concurrente controlado' });
  await page.getByRole('button', { name: 'Aprobar esta versión' }).click(); await expect(page.getByRole('alert').filter({ hasText: 'Cambió la ficha' })).toBeVisible(); await page.getByRole('button', { name: 'Actualizar contexto para revisión' }).click(); await page.getByRole('button', { name: 'Aprobar esta versión' }).click(); await expect(page.getByText(/Revisión: Aprobado/)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: '../docs/mockups/crm-ficha.png', fullPage: true });
});

test('tablero móvil, reflujo y contraste medido en temas @movil', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const data = await setup('crm-accesibilidad'); await data.adminApi.post('/crm/prospectos', { convocatoriaId: data.cycle.id, nombre: 'Persona temporal contraste', correo: `contraste.${data.cycle.id}@e2e.test`, procedencia: 'Prueba' });
  await entrar(page, data.admin); await page.goto(`/admisiones/candidatos?convocatoriaId=${data.cycle.id}`); await page.getByRole('button', { name: 'Ver tablero' }).click();
  await page.getByText('Registrar prospecto o reutilizar una ficha').click();
  const measurements = [];
  for (const theme of ['claro', 'oscuro']) for (const contrast of ['normal', 'alto']) {
    await page.evaluate(({ theme, contrast }) => { document.documentElement.dataset.tema = theme; document.documentElement.dataset.contraste = contrast; }, { theme, contrast });
    for (const state of ['normal', 'hover', 'focus']) {
      const primary = page.getByRole('button', { name: 'Crear ficha y solicitud' });
      if (state === 'hover') await primary.hover();
      if (state === 'focus') { await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await primary.focus(); }
      const ratios = await primary.evaluate((button) => {
      const rgb = (s) => s.startsWith('#') ? [1, 3, 5].map((n) => Number.parseInt(s.slice(n, n + 2), 16)) : s.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = (arr) => arr.map((n) => n / 255).map((n) => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
      const ratio = (a, b) => (Math.max(lum(rgb(a)), lum(rgb(b))) + .05) / (Math.min(lum(rgb(a)), lum(rgb(b))) + .05);
      const background = (element) => { for (let current = element; current; current = current.parentElement) { const color = getComputedStyle(current).backgroundColor; if (color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') return color; } return 'rgb(255, 255, 255)'; };
      const style = getComputedStyle(button);
      const field = document.querySelector('main input'); const fieldStyle = getComputedStyle(field);
      const selected = document.querySelector('.pestanas a.active'); const selectedStyle = getComputedStyle(selected);
      return { button: ratio(style.color, style.backgroundColor), fieldBoundary: ratio(fieldStyle.borderColor, background(field)), selectedText: ratio(selectedStyle.color, background(selected)), selectedIndicator: ratio(selectedStyle.borderBottomColor, background(selected)), focus: ratio(style.outlineColor, background(button.parentElement)), focusWidth: Number.parseFloat(style.outlineWidth) };
    });
    expect(ratios.button).toBeGreaterThanOrEqual(4.5);
    expect(ratios.fieldBoundary).toBeGreaterThanOrEqual(3); expect(ratios.selectedText).toBeGreaterThanOrEqual(4.5); expect(ratios.selectedIndicator).toBeGreaterThanOrEqual(3);
    if (state === 'focus') { expect(ratios.focusWidth).toBeGreaterThanOrEqual(3); expect(ratios.focus).toBeGreaterThanOrEqual(3); }
    measurements.push({ theme, contrast, state, ...ratios });
    }
    await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `../docs/mockups/crm-${test.info().project.name}-${theme}-${contrast}.png`, fullPage: true });
  }
  await writeFile(`../docs/mockups/contraste-crm-${test.info().project.name}.json`, JSON.stringify(measurements, null, 2));
  await page.setViewportSize({ width: 360, height: 800 }); await expect(page.getByLabel('Columna del tablero')).toBeVisible(); await page.getByLabel('Columna del tablero').selectOption('candidato');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('matrícula excepcional conserva activación pendiente y renovación evita dobles peticiones', async ({ page }) => {
  const data = await setup('crm-matricula'); const invitation = await data.adminApi.post('/users', { email: `invitada.${data.cycle.id}@e2e.test`, displayName: 'Cuenta invitada temporal', role: 'student' });
  await data.adminApi.post(`/courses/${data.cursoId}/enrollments`, { studentId: invitation.user.id });
  const p = await data.adminApi.post('/crm/prospectos', { convocatoriaId: data.cycle.id, nombre: 'Cuenta invitada temporal', correo: invitation.user.email, procedencia: 'Prueba' });
  await entrar(page, data.admin); await page.goto(`/admisiones/solicitudes/${p.solicitudId}`); await page.getByRole('button', { name: 'Confirmar matrícula', exact: true }).click(); await page.getByLabel('Operación de matrícula').selectOption('vincular'); await page.getByText('Vinculación excepcional de matrícula activa existente').click(); await page.getByLabel('Motivo de la operación').fill('Matrícula existente verificada por administración'); await page.getByRole('button', { name: 'Confirmar operación' }).click(); await expect(page.getByText('Invitada: activación pendiente', { exact: true })).toBeVisible();
  await page.goto('/admin/usuarios'); let calls = 0; page.on('request', (req) => { if (req.url().endsWith(`/users/${invitation.user.id}/invitation`)) calls++; });
  const row = page.getByRole('row').filter({ hasText: invitation.user.email }); await row.getByRole('button', { name: 'Nuevo enlace' }).dblclick(); await expect(page.getByText(`Invitación creada para ${invitation.user.email}`)).toBeVisible(); expect(calls).toBe(1);
});
