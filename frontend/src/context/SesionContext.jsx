import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setCsrfToken } from '../services/api.js';
import {
  PREFERENCIAS_BASE, aplicarPreferencias, borrarPreferenciasLocales, guardarPreferenciasLocales, leerPreferenciasLocales,
} from '../services/preferencias.js';

const SesionContext = createContext(null);

// Maneja la sesión del usuario y sus preferencias personales.
export function SesionProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  // Documentos legales que falta aceptar (cuentas anteriores o versiones nuevas).
  const [pendientes, setPendientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [preferencias, setPreferencias] = useState(() => ({ ...PREFERENCIAS_BASE, ...leerPreferenciasLocales() }));
  const confirmadas = useRef(preferencias);

  // Aplica y recuerda las preferencias confirmadas por la cuenta.
  const fijarPreferencias = useCallback((valores) => {
    const aplicadas = aplicarPreferencias(valores);
    confirmadas.current = aplicadas;
    guardarPreferenciasLocales(aplicadas);
    setPreferencias(aplicadas);
  }, []);

  const cargarPreferencias = useCallback(async () => {
    try {
      const { data } = await api.get('/me/preferences');
      fijarPreferencias(data);
    } catch {
      // Si falla, se mantiene la última apariencia conocida.
    }
  }, [fijarPreferencias]);

  useEffect(() => {
    api.get('/auth/me')
      .then(({ data }) => {
        setCsrfToken(data.csrfToken);
        setUsuario(data.user);
        setPendientes(data.pendingConsents || []);
        return cargarPreferencias();
      })
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, [cargarPreferencias]);

  // Token vencido: se limpia la sesión local y el inicio de sesión muestra el motivo.
  const [vencida, setVencida] = useState(false);
  const usuarioActual = useRef(null);
  useEffect(() => { usuarioActual.current = usuario; }, [usuario]);
  useEffect(() => {
    const alVencer = () => {
      setCsrfToken(null);
      if (usuarioActual.current) setVencida(true);
      setUsuario(null);
    };
    window.addEventListener('mentor:sesion-vencida', alVencer);
    return () => window.removeEventListener('mentor:sesion-vencida', alVencer);
  }, []);

  // El servidor rechazó una operación por documentos pendientes: se vuelve a pedir la aceptación.
  useEffect(() => {
    const alFaltarConsentimiento = (evento) => {
      const lista = Array.isArray(evento.detail) ? evento.detail.filter((item) => item?.document) : [];
      if (lista.length) setPendientes(lista);
    };
    window.addEventListener('mentor:consentimiento-pendiente', alFaltarConsentimiento);
    return () => window.removeEventListener('mentor:consentimiento-pendiente', alFaltarConsentimiento);
  }, []);

  // Deja lista la sesión que entregó el backend (inicio normal o acceso rápido de prueba).
  const abrirSesion = useCallback(async (data) => {
    setCsrfToken(data.csrfToken);
    setUsuario(data.user);
    setPendientes(data.pendingConsents || []);
    setVencida(false);
    await cargarPreferencias();
    return data.user;
  }, [cargarPreferencias]);

  const iniciarSesion = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    return abrirSesion(data);
  }, [abrirSesion]);

  // Acceso rápido con la cuenta de prueba de un rol (solo si el backend tiene DEMO_MODE encendido).
  const entrarComoPrueba = useCallback(async (role) => {
    const { data } = await api.post('/auth/demo', { role });
    return abrirSesion(data);
  }, [abrirSesion]);

  const cerrarSesion = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setCsrfToken(null);
      setUsuario(null);
      // En un equipo compartido, la siguiente persona empieza con la apariencia del sistema.
      borrarPreferenciasLocales();
      confirmadas.current = PREFERENCIAS_BASE;
      setPreferencias(aplicarPreferencias(PREFERENCIAS_BASE));
    }
  }, []);

  // Muestra el cambio al instante y lo guarda; si el servidor lo rechaza, vuelve a lo anterior.
  const guardarPreferencias = useCallback(async (cambios) => {
    setPreferencias((previas) => aplicarPreferencias({ ...previas, ...cambios }));
    try {
      const { data } = await api.patch('/me/preferences', cambios);
      fijarPreferencias(data);
      return data;
    } catch (error) {
      setPreferencias(aplicarPreferencias(confirmadas.current));
      throw error;
    }
  }, [fijarPreferencias]);

  const consentimientosAceptados = useCallback(() => setPendientes([]), []);
  // Tras una baja, el servidor ya cerró la sesión: solo se limpia el estado local.
  const sesionEliminada = useCallback(() => {
    setCsrfToken(null);
    setUsuario(null);
    setPendientes([]);
  }, []);

  // Aplica cambios del perfil propio sin volver a iniciar sesión.
  const actualizarUsuario = useCallback((cambios) => setUsuario((previo) => (previo ? { ...previo, ...cambios } : previo)), []);

  const valor = useMemo(
    () => ({
      usuario, cargando, vencida, pendientes, iniciarSesion, entrarComoPrueba, cerrarSesion, actualizarUsuario, preferencias, guardarPreferencias,
      consentimientosAceptados, sesionEliminada,
    }),
    [usuario, cargando, vencida, pendientes, iniciarSesion, entrarComoPrueba, cerrarSesion, actualizarUsuario, preferencias, guardarPreferencias,
      consentimientosAceptados, sesionEliminada],
  );
  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function useSesion() {
  return useContext(SesionContext);
}

// Indica la página inicial de cada rol.
export function rutaInicial(rol) {
  if (rol === 'platform_admin') return '/plataforma/instituciones';
  if (rol === 'institution_admin') return '/admin/usuarios';
  if (rol === 'teacher') return '/docente/cursos';
  if (rol === 'auditor') return '/auditoria/bitacora';
  return '/estudiante/inicio';
}
