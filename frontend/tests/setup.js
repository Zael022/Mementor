// jsdom no trae matchMedia ni scrollTo, y ScrollTrigger los necesita al registrarse.
if (!window.matchMedia) {
  window.matchMedia = (consulta) => ({
    matches: false, media: consulta, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
  });
}
window.scrollTo = () => {};
