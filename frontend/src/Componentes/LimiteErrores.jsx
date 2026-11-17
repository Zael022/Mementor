import { Component } from 'react';

// Detecta si el fallo vino de una parte de la aplicación que no se pudo descargar (por ejemplo, tras publicar una versión nueva).
function esCargaFallida(error) {
  const texto = String(error?.message || '');
  return error?.name === 'ChunkLoadError' || /dynamically imported module|Failed to fetch|Importing a module script failed/i.test(texto);
}

// Evita la pantalla en blanco: si una página falla al dibujarse, muestra un aviso con opción de recargar.
export default class LimiteErrores extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    // Solo se registra en consola; no se envía a ningún servicio externo.
    console.error('Error al mostrar la página', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const carga = esCargaFallida(error);
    return (
      <section className="tarjeta pagina-error" role="alert">
        <h1>{carga ? 'Hay una versión nueva de MENTOR AI' : 'Esta página no se pudo mostrar'}</h1>
        <p>{carga
          ? 'Recarga para descargar la versión más reciente. Tu sesión se mantiene.'
          : 'Ocurrió un error inesperado. Recarga la página; si se repite, avisa a la administración de tu institución.'}</p>
        <button type="button" className="boton" onClick={() => window.location.reload()}>Recargar</button>
      </section>
    );
  }
}
