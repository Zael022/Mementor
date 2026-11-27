import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { gsap } from './gsap.js';

// MotionPathPlugin solo lo usa el mapa del curso: se registra aquí para no sumarlo a las demás páginas.
gsap.registerPlugin(MotionPathPlugin);

export { gsap, MotionPathPlugin };
