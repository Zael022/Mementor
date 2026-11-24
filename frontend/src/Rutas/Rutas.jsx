import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from '../Componentes/Layout.jsx';
import { Cargando } from '../Componentes/Estados.jsx';
import RutaProtegida from './RutaProtegida.jsx';
import Login from '../Pages/Login.jsx';
const Inicio = lazy(() => import('../Pages/Inicio.jsx'));
const CrmPanel = lazy(() => import('../Pages/CrmPanel.jsx'));
const CrmCandidatos = lazy(() => import('../Pages/CrmCandidatos.jsx'));
const CrmSolicitud = lazy(() => import('../Pages/CrmSolicitud.jsx'));
const CrmAtencion = lazy(() => import('../Pages/CrmAtencion.jsx'));
const CrmConvocatorias = lazy(() => import('../Pages/CrmConvocatorias.jsx'));
const Activar = lazy(() => import('../Pages/Activar.jsx'));
const RecuperarClave = lazy(() => import('../Pages/RecuperarClave.jsx'));
const Terminos = lazy(() => import('../Pages/Terminos.jsx'));
const Privacidad = lazy(() => import('../Pages/Privacidad.jsx'));
const CuentaEliminada = lazy(() => import('../Pages/CuentaEliminada.jsx'));
const Gobernanza = lazy(() => import('../Pages/Gobernanza.jsx'));
const Asistentes = lazy(() => import('../Pages/Asistentes.jsx'));
const RestablecerClave = lazy(() => import('../Pages/RestablecerClave.jsx'));
const ConfirmarCorreo = lazy(() => import('../Pages/ConfirmarCorreo.jsx'));
const PlataformaInstituciones = lazy(() => import('../Pages/PlataformaInstituciones.jsx'));
const PlataformaCrm = lazy(() => import('../Pages/PlataformaCrm.jsx'));
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
const EstudiantePlan = lazy(() => import('../Pages/EstudiantePlan.jsx'));
const TutorCurso = lazy(() => import('../Pages/TutorCurso.jsx'));
const CitaTutor = lazy(() => import('../Pages/CitaTutor.jsx'));
const CursoFuentes = lazy(() => import('../Pages/CursoFuentes.jsx'));
const AdminDrive = lazy(() => import('../Pages/AdminDrive.jsx'));
const AdminConsumo = lazy(() => import('../Pages/AdminConsumo.jsx'));
const NoEncontrada = lazy(() => import('../Pages/NoEncontrada.jsx'));
const Calendario = lazy(() => import('../Pages/Calendario.jsx'));
const Pendientes = lazy(() => import('../Pages/Pendientes.jsx'));
const Configuracion = lazy(() => import('../Pages/Configuracion.jsx'));
const CursoQuizzes = lazy(() => import('../Pages/CursoQuizzes.jsx'));
const CursoCalificaciones = lazy(() => import('../Pages/CursoCalificaciones.jsx'));
const JugarQuiz = lazy(() => import('../Pages/JugarQuiz.jsx'));
const PracticaDiaria = lazy(() => import('../Pages/PracticaDiaria.jsx'));

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
      <Route path={`${base}/cursos/:id/quizzes`} element={<CursoQuizzes />} />
      <Route path={`${base}/cursos/:id/calificaciones`} element={<CursoCalificaciones />} />
    </>
  );
}

// Define las páginas disponibles y quién puede verlas.
export default function Rutas() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/activar" element={<Suspense fallback={<Cargando />}><Activar /></Suspense>} />
      <Route path="/recuperar" element={<Suspense fallback={<Cargando />}><RecuperarClave /></Suspense>} />
      <Route path="/restablecer" element={<Suspense fallback={<Cargando />}><RestablecerClave /></Suspense>} />
      <Route path="/confirmar-correo" element={<Suspense fallback={<Cargando />}><ConfirmarCorreo /></Suspense>} />
      {/* Documentos legales: públicos, se leen sin iniciar sesión. */}
      <Route path="/terminos" element={<Suspense fallback={<Cargando />}><Terminos /></Suspense>} />
      <Route path="/privacidad" element={<Suspense fallback={<Cargando />}><Privacidad /></Suspense>} />
      <Route path="/cuenta-eliminada" element={<Suspense fallback={<Cargando />}><CuentaEliminada /></Suspense>} />

      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/configuracion" element={<Configuracion />} />
          <Route element={<RutaProtegida roles={['institution_admin', 'auditor']} />}>
            <Route path="/admisiones" element={<CrmPanel />} />
          </Route>
          <Route element={<RutaProtegida roles={['institution_admin', 'teacher']} />}>
            <Route path="/admisiones/candidatos" element={<CrmCandidatos />} />
            <Route path="/admisiones/solicitudes/:id" element={<CrmSolicitud />} />
            <Route path="/admisiones/atencion" element={<CrmAtencion />} />
          </Route>
          <Route element={<RutaProtegida roles={['institution_admin']} />}>
            <Route path="/admisiones/convocatorias" element={<CrmConvocatorias />} />
          </Route>
          <Route element={<RutaProtegida roles={['institution_admin', 'teacher', 'student', 'auditor']} />}>
            <Route path="/asistentes" element={<Asistentes />} />
          </Route>

          {/* Vistas de trabajo diario para quien tiene clases. */}
          <Route element={<RutaProtegida roles={['institution_admin', 'teacher', 'student']} />}>
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/pendientes" element={<Pendientes />} />
          </Route>

          <Route element={<RutaProtegida roles={['platform_admin']} />}>
            <Route path="/plataforma/instituciones" element={<PlataformaInstituciones />} />
            <Route path="/plataforma/crm-instituciones" element={<PlataformaCrm />} />
            <Route path="/plataforma/crm-instituciones/:id" element={<PlataformaCrm />} />
          </Route>

          <Route element={<RutaProtegida roles={['institution_admin', 'platform_admin']} />}>
            <Route path="/admin/auditoria" element={<AdminAuditoria />} />
            <Route path="/admin/gobernanza" element={<Gobernanza />} />
          </Route>

          {/* Auditoría: solo lectura. */}
          <Route element={<RutaProtegida roles={['auditor']} />}>
            <Route path="/auditoria/bitacora" element={<AdminAuditoria />} />
            <Route path="/auditoria/gobernanza" element={<Gobernanza />} />
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
            <Route path="/estudiante/cursos/:id/quizzes/:quizId" element={<JugarQuiz />} />
            <Route path="/estudiante/cursos/:id/racha" element={<PracticaDiaria />} />
            <Route path="/estudiante/lecciones/:id" element={<Leccion />} />
            <Route path="/estudiante/tareas/:id" element={<EstudianteTarea />} />
            <Route path="/estudiante/evaluaciones/:id" element={<EstudianteEvaluacion />} />
            <Route path="/estudiante/resultados/:attemptId" element={<EstudianteResultado />} />
            <Route path="/estudiante/tutor/:courseId" element={<TutorCurso />} />
            <Route path="/estudiante/citas/:messageId/:posicion" element={<CitaTutor />} />
            <Route path="/estudiante/progreso" element={<EstudianteProgreso />} />
            <Route path="/estudiante/plan" element={<EstudiantePlan />} />
          </Route>

          {/* Cualquier otra dirección muestra la página de «no encontrada» dentro del diseño. */}
          <Route path="*" element={<NoEncontrada />} />
        </Route>
      </Route>
    </Routes>
  );
}
