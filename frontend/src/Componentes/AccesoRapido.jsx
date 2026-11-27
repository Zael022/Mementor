import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

// Botón discreto para entrar con una cuenta de prueba por rol.
// Solo aparece si el backend tiene el modo de prueba encendido (DEMO_MODE=on).
export default function AccesoRapido({ alEntrar, deshabilitado = false }) {
  const [cuentas, setCuentas] = useState([]);

  useEffect(() => {
    let activo = true;
    api.get('/auth/demo')
      .then(({ data }) => { if (activo && data?.enabled) setCuentas(data.accounts || []); })
      .catch(() => {});
    return () => { activo = false; };
  }, []);

  if (!cuentas.length) return null;
  return (
    <details className="acceso-rapido">
      <summary>Acceso rápido de prueba</summary>
      <p className="tenue pequeno">Entra sin contraseña con una cuenta de prueba:</p>
      <div className="acceso-rapido-roles">
        {cuentas.map((cuenta) => (
          <button key={cuenta.role} type="button" className="chip" disabled={deshabilitado}
            title={cuenta.email} onClick={() => alEntrar(cuenta.role)}>
            {cuenta.label}
          </button>
        ))}
      </div>
    </details>
  );
}
