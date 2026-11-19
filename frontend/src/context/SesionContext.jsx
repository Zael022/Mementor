import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setCsrfToken } from '../services/api.js';

const SesionContext = createContext(null);

// Maneja la sesión del usuario.
export function SesionProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then(({ data }) => {
        setCsrfToken(data.csrfToken);
        setUsuario(data.user);
      })
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  const iniciarSesion = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setCsrfToken(data.csrfToken);
    setUsuario(data.user);
    return data.user;
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setCsrfToken(null);
      setUsuario(null);
    }
  }, []);

  // Aplica cambios del perfil propio sin volver a iniciar sesión.
  const actualizarUsuario = useCallback((cambios) => setUsuario((previo) => (previo ? { ...previo, ...cambios } : previo)), []);

  const valor = useMemo(
    () => ({ usuario, cargando, iniciarSesion, cerrarSesion, actualizarUsuario }),
    [usuario, cargando, iniciarSesion, cerrarSesion, actualizarUsuario],
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
