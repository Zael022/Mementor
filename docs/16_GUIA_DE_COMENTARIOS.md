# Convención de comentarios sencillos

El usuario quiere **buenas prácticas y comentarios vagos/escuetos sobre cada sección importante**: mensajes simples que digan qué hace el módulo, sin explicaciones excesivas.

Correctos:
```jsx
// Muestra la navegación principal.
function Navbar() { /* ... */ }
```
```js
// Valida los datos antes de guardarlos.
async function crearCurso(datos) { /* ... */ }
```
```js
// Conecta con MySQL mediante Sequelize.
export const sequelize = /* ... */;
```

Incorrectos: `// Incrementa i en uno` sobre `i++`, descripciones de 10 líneas, duplicar el nombre de cada función sin aportar sentido, comentarios que prometan un comportamiento no implementado.

Usar comentarios en español, una oración corta, sobre bloques relevantes. No es necesario comentar cada `import`, `return` o declaración.
