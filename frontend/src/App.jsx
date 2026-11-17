import { BrowserRouter } from 'react-router-dom';
import Rutas from './Rutas/Rutas.jsx';
import LimiteErrores from './Componentes/LimiteErrores.jsx';
import { SesionProvider } from './context/SesionContext.jsx';

// Muestra las rutas principales; el límite de errores evita una pantalla en blanco si algo falla.
export default function App() {
  return (
    <BrowserRouter>
      <SesionProvider>
        <LimiteErrores><Rutas /></LimiteErrores>
      </SesionProvider>
    </BrowserRouter>
  );
}
