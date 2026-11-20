import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSesion } from '../context/SesionContext.jsx';

// Marco común de los documentos legales: se leen con o sin sesión iniciada.
export default function DocumentoLegal({ titulo, version, children }) {
  const { usuario } = useSesion();
  useEffect(() => { document.title = `${titulo} · MENTOR AI`; }, [titulo]);
  return (
    <div className="documento-legal">
      <header>
        <Link to={usuario ? '/' : '/login'} className="marca">MENTOR <span>AI</span></Link>
        <Link to={usuario ? '/' : '/login'} className="volver">{usuario ? '← Volver a la plataforma' : '← Volver a iniciar sesión'}</Link>
      </header>
      <article className="tarjeta">
        <h1>{titulo}</h1>
        <p className="tenue">Versión {version}. Basado en la Ley N.º 8968 de Protección de la Persona frente al Tratamiento de sus Datos Personales (Costa Rica).</p>
        {children}
        <nav className="enlaces-legales" aria-label="Documentos legales">
          <Link to="/terminos">Términos y condiciones</Link>
          <Link to="/privacidad">Política de privacidad</Link>
        </nav>
      </article>
    </div>
  );
}
