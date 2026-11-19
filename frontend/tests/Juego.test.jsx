import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NotaCurso from '../src/Componentes/NotaCurso.jsx';
import OpcionesQuiz from '../src/Componentes/OpcionesQuiz.jsx';
import TarjetaRacha from '../src/Componentes/TarjetaRacha.jsx';

afterEach(cleanup);
// jsdom no trae matchMedia ni IntersectionObserver; los contadores animados los consultan.
window.matchMedia = window.matchMedia || (() => ({ matches: true, addEventListener() {}, removeEventListener() {} }));

const opciones = [{ id: 1, body: 'Tres' }, { id: 2, body: 'Cuatro' }, { id: 3, body: 'Cinco' }];

describe('quiz, racha y nota', () => {
  it('las opciones avisan la elegida y, al revelar, marcan correcta e incorrecta para el lector de pantalla', () => {
    const elegir = vi.fn();
    const { rerender } = render(<OpcionesQuiz opciones={opciones} alElegir={elegir} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cuatro' }));
    expect(elegir).toHaveBeenCalledWith(2);

    rerender(<OpcionesQuiz opciones={opciones} alElegir={elegir} elegida={1} correcta={2} />);
    const [tres, cuatro, cinco] = screen.getAllByRole('button');
    expect(cuatro.textContent).toContain('(respuesta correcta)');
    expect(cuatro.disabled).toBe(true);
    expect(tres.textContent).toContain('(tu respuesta, incorrecta)');
    expect(cinco.className).toContain('atenuada');
  });

  it('la racha en riesgo invita a salvarla y una cumplida ya no muestra el botón', () => {
    const { rerender } = render(
      <MemoryRouter><TarjetaRacha racha={{ current: 4, best: 6, completedToday: false, atRisk: true }} enlace="/racha" valorDia={0.09} /></MemoryRouter>,
    );
    expect(screen.getByText(/en riesgo/)).toBeTruthy();
    expect(screen.getByText(/suma 0,09 a tu nota/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Salvar mi racha' }).getAttribute('href')).toBe('/racha');

    rerender(<MemoryRouter><TarjetaRacha racha={{ current: 5, best: 6, completedToday: true, atRisk: false }} enlace="/racha" /></MemoryRouter>);
    expect(screen.getByText('¡Listo por hoy! Vuelve mañana para seguir sumando.')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('la nota explica cuándo se llegó al tope del bono', () => {
    const politica = { scale: 10, assessmentsWeight: 40, assignmentsWeight: 30, classworkWeight: 30, bonusCap: 0.3 };
    const nota = {
      final: 8.05, base: 7.75, bonusEarned: 0.37, bonusApplied: 0.3,
      assessmentsPct: 100, assessmentsCounted: 1, assignmentsPct: 50, assignmentsCounted: 1, classworkPct: null, classworkCounted: 0,
      quizBonus: 0.1, perfectQuizzes: 1, streakBonus: 0.27, streakDaysEarned: 3,
    };
    render(<NotaCurso nota={nota} politica={politica} />);
    expect(screen.getByText(/Llegaste al tope del bono/).textContent).toContain('ganaste 0,37, pero cuentan 0,30');
    expect(screen.getByText('Días de racha: 3 (+0,27)')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Trabajo en clase: sin calificaciones todavía' })).toBeTruthy();
  });
});
