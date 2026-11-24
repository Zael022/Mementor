// Colores de las clases: cada curso conserva siempre el mismo según su id.
// Sin tonos naranja para que el botón principal (naranja) siempre resalte sobre el banner.
const COLORES = ['#3452e1', '#0f7d6c', '#7b3fe4', '#b8246a', '#2f6f1d', '#0b6aa8', '#5b3fa8', '#24607a'];

export function colorDeCurso(id) {
  return COLORES[Math.abs(Number(id) || 0) % COLORES.length];
}

// Ruta del aula según el rol: el estudiante entra a su vista y el personal a la gestión.
export function rutaDeCurso(rol, id) {
  if (rol === 'student') return `/estudiante/cursos/${id}`;
  return `${rol === 'teacher' ? '/docente' : '/admin'}/cursos/${id}/anuncios`;
}
