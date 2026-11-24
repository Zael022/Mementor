import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import Markdown from '../src/Componentes/Markdown.jsx';

afterEach(cleanup);

// XSS: el texto de usuarios (anuncios, lecciones, respuestas del tutor) se muestra como texto, nunca como HTML.
it('no ejecuta ni crea etiquetas HTML escritas por una persona', () => {
  const carga = '<script>window.atacado = true</script><img src=x onerror="window.atacado = true"> **hola**';
  const { container } = render(<Markdown texto={carga} />);
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelector('img')).toBeNull();
  expect(container.textContent).toContain('<script>window.atacado = true</script>');
  // El Markdown permitido sí se interpreta, con elementos de React.
  expect(container.querySelector('strong').textContent).toBe('hola');
  expect(window.atacado).toBeUndefined();
});
