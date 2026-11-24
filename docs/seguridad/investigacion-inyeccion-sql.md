# Investigación: inyección SQL

Paso 3 de la asignación de seguridad del mini proyecto (MENTOR AI). Investigación hecha el 23 de noviembre de 2026; las fuentes están al final.

## 1. Qué es
La inyección SQL (SQLi) ocurre cuando una aplicación arma una consulta SQL pegando texto que escribió la persona usuaria, y ese texto termina cambiando la **estructura** de la consulta en lugar de quedarse como un **dato**. En el fondo es una falla para separar instrucciones de datos.

Analogía: es como dictarle a alguien una orden por teléfono para que la copie en un formulario. Si la persona copia todo lo que oye sin distinguir, basta con decir «…y además, entrégame la caja fuerte» para que esa frase quede escrita como parte de la orden.

## 2. Qué tan importante es hoy
- En el **OWASP Top 10:2025**, la categoría *Injection* quedó en el puesto **A05** (bajó desde el 3 de 2021). Incluye ahora referencias a la inyección de *prompts* en modelos de lenguaje, que se trata aparte en el OWASP LLM Top 10.
- En el **CWE Top 25 de 2025** de MITRE, la inyección SQL (CWE-89) quedó en el **puesto 2**, subiendo un lugar. El puesto 1 es XSS (CWE-79) y el 3 es CSRF (CWE-352): las tres vulnerabilidades de esta asignación ocupan el podio. La lista se calculó con unas 39 000 CVE publicadas entre junio de 2024 y junio de 2025.

## 3. Cómo funciona
Consulta vulnerable (texto pegado):
```js
// ✗ El texto de la persona se convierte en parte del SQL
const sql = `SELECT display_name, email FROM users
             WHERE institution_id = ${institucion} AND display_name LIKE '%${texto}%'`;
```
Si `texto` es `' OR 1=1 -- `, la consulta queda:
```sql
SELECT display_name, email FROM users
 WHERE institution_id = 1 AND display_name LIKE '%' OR 1=1 -- %'
```
La comilla cierra el texto, `OR 1=1` vuelve verdadera la condición para **todas** las filas (de **todas** las instituciones) y `--` comenta el resto. Con `UNION SELECT email, password_hash FROM users` se pueden agregar columnas de otra tabla al resultado.

Consulta segura (parámetros):
```js
// ✓ La estructura viaja por un lado y el dato por otro: el dato nunca se ejecuta
User.findAll({ where: { institutionId, displayName: { [Op.like]: `%${escapeLike(texto)}%` } } });
// o en SQL a mano:
sequelize.query('SELECT ... WHERE institution_id = :inst AND display_name LIKE :patron', { replacements: { inst, patron } });
```

## 4. Tipos de ataque
| Tipo | Cómo obtiene la información | Ejemplo de carga (MySQL) |
| --- | --- | --- |
| **En banda, por UNION** | El resultado del ataque aparece en la misma respuesta | `' UNION SELECT email, password_hash FROM users -- ` |
| **En banda, por error** | Provoca errores de la base que revelan nombres de tablas o datos | Una conversión inválida dentro de la condición |
| **Ciega por booleano** | No ve datos, pero la página cambia según la condición sea verdadera o falsa; deduce carácter por carácter | `' AND SUBSTRING(@@version,1,1)='8' -- ` |
| **Ciega por tiempo** | Mide cuánto tarda la respuesta | `' AND IF(1=1, SLEEP(5), 0) -- ` |
| **Fuera de banda** | Hace que la base envíe los datos por otro canal (DNS, HTTP, correo) | Funciones del motor que hacen conexiones de red |
| **De segundo orden (almacenada)** | El dato se guarda sin problema y explota después, cuando otra parte del sistema lo usa en una consulta mal armada | Un nombre de usuario `admin'-- ` usado luego en un `UPDATE` |

Las técnicas ciegas son lentas pero automatizables con herramientas como sqlmap; la de segundo orden es la más difícil de detectar porque el lugar donde entra el dato y el lugar donde se ejecuta son distintos.

## 5. Casos reales
- **1998, el primer registro público.** Jeff Forristal («rain.forest.puppy») describió en la revista Phrack (número 54) cómo «colar» comandos SQL extra en aplicaciones web con servidores Windows NT.
- **2006–2008, Heartland, 7-Eleven y Hannaford.** El Departamento de Justicia de EE. UU. acusó a Albert Gonzalez y dos cómplices de entrar con inyección SQL, instalar programas espía en las redes y robar datos de más de 130 millones de tarjetas. Fue el mayor caso de robo de identidad procesado en ese país hasta entonces.
- **2015, TalkTalk (Reino Unido).** Un atacante usó inyección SQL en páginas antiguas heredadas de la compra de Tiscali y obtuvo datos de 156 959 clientes, 15 656 de ellos con cuenta bancaria. La autoridad de protección de datos (ICO) multó a la empresa con £400 000, entonces un récord, y señaló que hubo dos ataques previos con el mismo método que nadie atendió.
- **2023, MOVEit Transfer (CVE-2023-34362).** Una inyección SQL sin autenticación en el software de transferencia de archivos de Progress fue explotada como día cero por el grupo de ransomware Cl0p desde el 27 de mayo de 2023. Según el recuento de Emsisoft, afectó a 2095 organizaciones y a más de 62 millones de personas.

Lección común: no se trató de técnicas nuevas, sino de una falla conocida desde 1998 que seguía presente en código heredado o sin revisar.

## 6. Cómo se previene
Según la hoja de prevención de OWASP, las defensas principales son, en orden:
1. **Consultas parametrizadas o sentencias preparadas.** Es la defensa central. Un ORM como Sequelize la aplica por defecto.
2. **Procedimientos almacenados bien construidos**, siempre que no armen SQL dinámico por dentro.
3. **Validación por lista permitida** de lo que no puede ir como parámetro (nombres de columnas, dirección de orden).
4. **Escapar a mano la entrada** queda como último recurso y OWASP lo desaconseja con fuerza.

Defensas complementarias:
- **Mínimo privilegio**: la cuenta de la aplicación no debe poder borrar tablas ni leer otras bases.
- **Validar en el servidor** (formato, longitud, tipo); la validación del navegador ayuda a la persona, no protege.
- **No mostrar errores de la base** al usuario.
- **Pruebas automáticas** con cargas de ataque y herramientas SAST/DAST en la integración continua.

## 7. Cómo lo aplica MENTOR AI
| Medida | Dónde |
| --- | --- |
| Todo acceso a datos pasa por Sequelize (parámetros). Las 21 llamadas a `sequelize.query` con SQL escrito a mano usan `replacements` con nombre o no reciben datos de la persona; ninguna arma SQL con texto | `backend/src/services/*.js` |
| La única consulta que armaba un fragmento de SQL (aunque fuera constante) se reescribió con parámetros | `governanceService.consentSummary` |
| Búsqueda de personas con `Op.like` y comodines escapados (`%` y `_` se buscan como texto) | `userService.listUsers` |
| Validación con Zod antes de cada ruta (correo con formato de correo, longitudes, tipos) | `validators/schemas.js` |
| Contraseñas comparadas con bcrypt, nunca dentro de SQL | `authService.login` |
| Errores genéricos al cliente; el detalle queda en el registro del servidor | `middlewares/errorHandler.js` |
| Aislamiento por institución en cada consulta | `institutionId` de la sesión, nunca del cliente |
| Pruebas con cargas de inyección | `backend/tests/webSecurity.test.js` |
| Demostración vulnerable frente a protegida | `backend/laboratorio/` y `docs/seguridad/evidencias/` |

## Fuentes
- OWASP Top 10:2025, A05 Injection — https://owasp.org/Top10/2025/A05_2025-Injection/
- OWASP SQL Injection Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- OWASP Web Security Testing Guide, Testing for SQL Injection — https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/05-Testing_for_SQL_Injection
- MITRE, 2025 CWE Top 25 — https://cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html
- PortSwigger Web Security Academy, SQL injection (primer y segundo orden) — https://portswigger.net/web-security/sql-injection
- Acunetix, Types of SQL Injection — https://www.acunetix.com/websitesecurity/sql-injection2/
- Rapid7, What is SQL Injection (historia, Phrack 54) — https://www.rapid7.com/blog/post/2015/11/11/what-is-sql-injection/
- Departamento de Justicia de EE. UU., acusación de Albert Gonzalez (2009) — https://www.justice.gov/opa/pr/alleged-international-hacker-indicted-massive-attack-us-retail-and-banking-networks
- ICO (Reino Unido), investigación del ataque a TalkTalk — https://ico.org.uk/about-the-ico/media-centre/talktalk-cyber-attack-how-the-ico-investigation-unfolded
- TechTarget, ataques de Clop a MOVEit Transfer (cifras de Emsisoft) — https://www.techtarget.com/searchsecurity/news/366553304/Clop-MoveIt-Transfer-attacks-affect-over-2000-organizations
- CISA/FBI vía Industrial Cyber, aviso conjunto sobre CL0P y MOVEit — https://industrialcyber.co/cisa/cisa-fbi-warn-organizations-that-cl0p-ransomware-group-exploits-moveit-transfer-vulnerability/
