// Crea por la API los datos efímeros de cada prueba (institución, personas, curso y lecciones).
// La base _e2e se reinicia al arrancar, así que nada de esto queda como dato de demostración.
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || '3101'}/api/v1`;
export const CLAVE = 'VerificaE2E2026';

export async function sesion(email, password = CLAVE) {
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const body = await res.json();
  if (!res.ok) throw new Error(`No se pudo iniciar sesión como ${email}: ${JSON.stringify(body)}`);
  const cookie = res.headers.get('set-cookie').split(';')[0];
  const llamar = async (method, ruta, datos) => {
    const r = await fetch(`${API}${ruta}`, {
      method, headers: { cookie, 'x-csrf-token': body.data.csrfToken, ...(datos ? { 'content-type': 'application/json' } : {}) }, body: datos ? JSON.stringify(datos) : undefined,
    });
    const json = await r.json().catch(() => null);
    if (!r.ok) throw new Error(`${method} ${ruta} → ${r.status} ${JSON.stringify(json)}`);
    return json?.data;
  };
  return { usuario: body.data.user, post: (r, d = {}) => llamar('POST', r, d), patch: (r, d) => llamar('PATCH', r, d), get: (r) => llamar('GET', r) };
}

async function activar(token) {
  const r = await fetch(`${API}/auth/activate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password: CLAVE, acceptTerms: true, acceptPrivacy: true }) });
  if (!r.ok) throw new Error(`No se pudo activar la cuenta (${r.status}).`);
}

// Institución con docente y estudiante, y un curso publicado con lecciones sobre fracciones.
export async function prepararCurso(nombre, { claseEnMs = null } = {}) {
  // Sufijo único: si Playwright repite la preparación tras un fallo, no choca con lo ya creado.
  const sufijo = `${nombre}-${Date.now().toString(36)}`;
  const operador = await sesion('operador@e2e.test', 'OperadorE2E2026');
  const institucion = await operador.post('/institutions', { name: `Colegio ${sufijo}` });
  const invitar = async (quien, ruta, datos) => { const r = await quien.post(ruta, datos); await activar(r.invitationToken); return sesion(datos.email); };
  const admin = await invitar(operador, `/institutions/${institucion.id}/admins`, { email: `admin.${sufijo}@e2e.test`, displayName: `Admin ${sufijo}` });
  const docente = await invitar(admin, '/users', { email: `docente.${sufijo}@e2e.test`, displayName: `Docente ${sufijo}`, role: 'teacher' });
  const estudiante = await invitar(admin, '/users', { email: `estudiante.${sufijo}@e2e.test`, displayName: `Estudiante ${sufijo}`, role: 'student' });
  const curso = await docente.post('/courses', { code: `MAT-${sufijo}`.slice(0, 30), title: `Matemática ${sufijo}` });
  const modulo = await docente.post(`/courses/${curso.id}/modules`, { title: 'Números' });
  const tema = await docente.post(`/modules/${modulo.id}/topics`, { title: 'Fracciones' });
  for (const [titulo, cuerpo] of [
    ['Fracciones', '# Fracciones\n\nUna fracción representa partes iguales de un entero. El denominador indica en cuántas partes se divide el entero y nunca puede ser cero.'],
    ['Fracciones equivalentes', 'Dos fracciones son equivalentes cuando representan la misma parte del entero aunque cambie el denominador.'],
    ['Comparar fracciones', 'Para comparar fracciones con igual denominador basta mirar el numerador: la mayor tiene el numerador más grande.'],
  ]) {
    const leccion = await docente.post(`/topics/${tema.id}/lessons`, { title: titulo, bodyMd: cuerpo });
    await docente.patch(`/lessons/${leccion.id}`, { status: 'published' });
  }
  await docente.patch(`/courses/${curso.id}`, { status: 'published' });
  await docente.post(`/courses/${curso.id}/enrollments`, { studentId: estudiante.usuario.id });
  if (claseEnMs !== null) {
    await docente.post(`/courses/${curso.id}/sessions`, {
      title: 'Clase de repaso', startsAt: new Date(Date.now() + claseEnMs).toISOString(), durationMinutes: 30, meetingUrl: 'https://meet.google.com/abc-defg-hij',
    });
  }
  return { cursoId: curso.id, admin: `admin.${sufijo}@e2e.test`, docente: `docente.${sufijo}@e2e.test`, estudiante: `estudiante.${sufijo}@e2e.test` };
}

// Inicia sesión desde la pantalla de acceso, como lo haría una persona.
export async function entrar(page, email) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(CLAVE);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

// Cuántas llamadas recibió el doble del modelo.
export async function llamadasAlModelo() {
  const res = await fetch(`http://127.0.0.1:${process.env.E2E_FAKE_AI_PORT || '4599'}/__log`);
  return (await res.json()).length;
}
