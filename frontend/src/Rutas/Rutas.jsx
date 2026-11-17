import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from '../Componentes/Layout.jsx';
import { Cargando } from '../Componentes/Estados.jsx';
import RutaProtegida from './RutaProtegida.jsx';
import Login from '../Pages/Login.jsx';
const Inicio = lazy(() => import('../Pages/Inicio.jsx'));
const Activar = lazy(() => import('../Pages/Activar.jsx'));
const PlataformaInstituciones = lazy(() => import('../Pages/PlataformaInstituciones.jsx'));
const AdminUsuarios = lazy(() => import('../Pages/AdminUsuarios.jsx'));
const AdminAuditoria = lazy(() => import('../Pages/AdminAuditoria.jsx'));
const CursosGestion = lazy(() => import('../Pages/CursosGestion.jsx'));
const CursoContenidos = lazy(() => import('../Pages/CursoContenidos.jsx'));
const CursoEvaluaciones = lazy(() => import('../Pages/CursoEvaluaciones.jsx'));
const CursoMatriculas = lazy(() => import('../Pages/CursoMatriculas.jsx'));
const CursoAnalitica = lazy(() => import('../Pages/CursoAnalitica.jsx'));
const EstudianteCursos = lazy(() => import('../Pages/EstudianteCursos.jsx'));
const EstudianteCurso = lazy(() => import('../Pages/EstudianteCurso.jsx'));
const Leccion = lazy(() => import('../Pages/Leccion.jsx'));
const EstudianteInicio = lazy(() => import('../Pages/EstudianteInicio.jsx'));
const EstudianteTarea = lazy(() => import('../Pages/EstudianteTarea.jsx'));
const CursoClases = lazy(() => import('../Pages/CursoClases.jsx'));
const CursoTareas = lazy(() => import('../Pages/CursoTareas.jsx'));
const CursoAnuncios = lazy(() => import('../Pages/CursoAnuncios.jsx'));
const EstudianteEvaluacion = lazy(() => import('../Pages/EstudianteEvaluacion.jsx'));
const EstudianteResultado = lazy(() => import('../Pages/EstudianteResultado.jsx'));
const EstudianteProgreso = lazy(() => import('../Pages/EstudianteProgreso.jsx'));
const TutorCurso = lazy(() => import('../Pages/TutorCurso.jsx'));
const CitaTutor = lazy(() => import('../Pages/CitaTutor.jsx'));
const CursoFuentes = lazy(() => import('../Pages/CursoFuentes.jsx'));
const AdminDrive = lazy(() => import('../Pages/AdminDrive.jsx'));
const AdminConsumo = lazy(() => import('../Pages/AdminConsumo.jsx'));
const NoEncontrada = lazy(() => import('../Pages/NoEncontrada.jsx'));

// Las páginas se cargan bajo demanda: el acceso queda disponible sin esperar el resto de la aplicación.

// Páginas de gestión de un curso, compartidas por docentes y administración.
function rutasDeGestion(base) {
  return (
    <>
      <Route path={`${base}/cursos`} element={<CursosGestion />} />
      <Route path={`${base}/cursos/:id/contenidos`} element={<CursoContenidos />} />
      <Route path={`${base}/cursos/:id/clases`} element={<CursoClases />} />
      <Route path={`${base}/cursos/:id/tareas`} element={<CursoTareas />} />
      <Route path={`${base}/cursos/:id/evaluaciones`} element={<CursoEvaluaciones />} />
      <Route path={`${base}/cursos/:id/anuncios`} element={<CursoAnuncios />} />
      <Route path={`${base}/cursos/:id/fuentes`} element={<CursoFuentes />} />
      <Route path={`${base}/lecciones/:id`} element={<Leccion />} />
      <Route path={`${base}/cursos/:id/matriculas`} element={<CursoMatriculas />} />
      <Route path={`${base}/cursos/:id/analitica`} element={<CursoAnalitica />} />
    </>
  );
}

// Define las páginas disponibles y quién puede verlas.
export default function Rutas() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/activar" element={<Suspense fallback={<Cargando />}><Activar /></Suspense>} />

      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Inicio />} />

          <Route element={<RutaProtegida roles={['platform_admin']} />}>
            <Route path="/plataforma/instituciones" element={<PlataformaInstituciones />} />
          </Route>

          <Route element={<RutaProtegida roles={['institution_admin', 'platform_admin']} />}>
            <Route path="/admin/auditoria" element={<AdminAuditoria />} />
          </Route>

          <Route element={<RutaProtegida roles={['institution_admin']} />}>
            <Route path="/admin/usuarios" element={<AdminUsuarios />} />
            <Route path="/admin/drive" element={<AdminDrive />} />
            <Route path="/admin/consumo" element={<AdminConsumo />} />
            {rutasDeGestion('/admin')}
          </Route>

          <Route element={<RutaProtegida roles={['teacher']} />}>
            {rutasDeGestion('/docente')}
            <Route path="/docente/tutor/:courseId" element={<TutorCurso />} />
            <Route path="/docente/citas/:messageId/:posicion" element={<CitaTutor />} />
          </Route>

          <Route element={<RutaProtegida roles={['student']} />}>
            <Route path="/estudiante/inicio" element={<EstudianteInicio />} />
            <Route path="/estudiante/cursos" element={<EstudianteCursos />} />
            <Route path="/estudiante/cursos/:id" element={<EstudianteCurso />} />
            <Route path="/estudiante/lecciones/:id" element={<Leccion />} />
            <Route path="/estudiante/tareas/:id" element={<EstudianteTarea />} />
            <Route path="/estudiante/evaluaciones/:id" element={<EstudianteEvaluacion />} />
            <Route path="/estudiante/resultados/:attemptId" element={<EstudianteResultado />} />
            <Route path="/estudiante/tutor/:courseId" element={<TutorCurso />} />
            <Route path="/estudiante/citas/:messageId/:posicion" element={<CitaTutor />} />
            <Route path="/estudiante/progreso" element={<EstudianteProgreso />} />
          </Route>

          {/* Cualquier otra dirección muestra la página de «no encontrada» dentro del diseño. */}
          <Route path="*" element={<NoEncontrada />} />
        </Route>
      </Route>
    </Routes>
  );
}
