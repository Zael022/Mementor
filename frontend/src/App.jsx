import { BrowserRouter } from 'react-router-dom';
import Rutas from './Rutas/Rutas.jsx';
import { SesionProvider } from './context/SesionContext.jsx';

// Muestra las rutas principales.
export default function App() {
  return (
    <BrowserRouter>
      <SesionProvider>
        <Rutas />
      </SesionProvider>
    </BrowserRouter>
  );
}
