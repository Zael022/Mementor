import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setCsrfToken } from '../services/api.js';
import {
  PREFERENCIAS_BASE, aplicarPreferencias, borrarPreferenciasLocales, guardarPreferenciasLocales, leerPreferenciasLocales,
} from '../services/preferencias.js';

const SesionContext = createContext(null);

// Maneja la sesión del usuario y sus preferencias personales.
export function SesionProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
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
        return cargarPreferencias();
      })
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, [cargarPreferencias]);

  const iniciarSesion = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setCsrfToken(data.csrfToken);
    setUsuario(data.user);
    await cargarPreferencias();
    return data.user;
  }, [cargarPreferencias]);

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

  // Aplica cambios del perfil propio sin volver a iniciar sesión.
  const actualizarUsuario = useCallback((cambios) => setUsuario((previo) => (previo ? { ...previo, ...cambios } : previo)), []);

  const valor = useMemo(
    () => ({ usuario, cargando, iniciarSesion, cerrarSesion, actualizarUsuario, preferencias, guardarPreferencias }),
    [usuario, cargando, iniciarSesion, cerrarSesion, actualizarUsuario, preferencias, guardarPreferencias],
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
  return '/estudiante/inicio';
}
