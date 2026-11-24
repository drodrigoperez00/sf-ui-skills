# Guía de sf-ui-skills para equipos

Para quien quiere usar `/probar-tarea` y `/documentar` en su proyecto Salesforce. Lo técnico lo lleva Claude con
`/configurar`; aquí está lo que te toca a ti y lo que conviene saber antes.

## Qué hace

- **`/probar-tarea <HU>`** prueba una historia de usuario en un sandbox como lo haría un usuario real: entra con un usuario
  de pruebas de cada rol, recorre los criterios de aceptación por la interfaz y por API, y deja la evidencia con
  capturas en `.sf-ui/resultados/evidencias/<HU>/`.
- **`/documentar <qué y con qué fuentes>`** genera un manual en Word con capturas marcadas, navegando el sandbox con
  esos mismos usuarios.

Solo trabaja contra sandboxes: se niega con producción.

## Qué necesitas

- Claude Code.
- Node 22 o superior, la CLI de Salesforce (`sf`), `git`, `jq` y `openssl`. En Windows, con Git Bash (lo trae Git
  for Windows).
- `gh` o `glab` si tu gestor de issues es GitHub o GitLab; en Jira, un token de API en `JIRA_EMAIL` y
  `JIRA_API_TOKEN`.
- `pandoc`, solo para `/documentar`.
- Un sandbox en el que seas admin y, para cada rol que quieras probar, un usuario dedicado a las pruebas (si no hay,
  `/configurar` te ayuda a crearlos).

## Instalarlo

En Claude Code, dentro de tu proyecto:

```text
/plugin marketplace add drodrigoperez00/sf-ui-skills
/plugin install sf-ui-skills@sf-ui-skills
```

Para recibir versiones nuevas: `/plugin marketplace update sf-ui-skills`.

### Sin marketplace: clonar el repo

Lo mismo, sin tocar nada, cargando el plugin desde una copia local:

```bash
git clone https://github.com/drodrigoperez00/sf-ui-skills.git ~/sf-skills
npm install --prefix ~/sf-skills/plugin
cd <tu proyecto> && claude --plugin-dir ~/sf-skills/plugin
```

Los comandos son los mismos (`/sf-ui-skills:configurar`…). Para actualizar, `git -C ~/sf-skills pull`. Para no
escribir `--plugin-dir` cada vez, un alias en `~/.zshrc` o `~/.bashrc`:
`alias claude-sf='claude --plugin-dir ~/sf-skills/plugin'`.

### Copiado dentro del proyecto

Solo si el proyecto quiere adaptarlo a su manera: deja de recibir las correcciones del plugin, y cada versión nueva
hay que copiarla y adaptarla otra vez. Las skills usan `${CLAUDE_PLUGIN_ROOT}` (la ruta del plugin, que fuera de un
plugin queda vacía) y llaman a los agentes con el prefijo `sf-ui-skills:`, así que al copiarlas hay que cambiar las
dos cosas. Con el repo clonado en `~/sf-skills`, desde la raíz del proyecto:

```bash
mkdir -p .claude/skills .claude/agents
cp -R ~/sf-skills/plugin .claude/sf-ui && rm -rf .claude/sf-ui/node_modules
cp -R ~/sf-skills/plugin/skills/* .claude/skills/
cp ~/sf-skills/plugin/agents/*.md .claude/agents/
npm install --prefix .claude/sf-ui
perl -pi -e 's#\$\{CLAUDE_PLUGIN_ROOT\}#.claude/sf-ui#g;
  s#sf-ui-skills:(ui-tester|ui-documentador|ingesta-documentacion|ensamblador-documentacion)#$1#g' \
  .claude/skills/{probar-tarea,documentar,configurar}/SKILL.md \
  .claude/agents/{ui-tester,ui-documentador,ingesta-documentacion,ensamblador-documentacion}.md
echo ".claude/sf-ui/node_modules/" >> .gitignore
```

Los comandos quedan sin prefijo: `/configurar`, `/probar-tarea` y `/documentar`. Donde la guía diga `/sf-ui-skills:…`,
quítale el prefijo.

## Configurar el proyecto

```text
/sf-ui-skills:configurar
```

Te lleva por pasos y en cada uno te dice qué hace Claude y qué tienes que hacer tú:

| Paso                 | Claude                                                           | Tú                                                    |
| -------------------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| Herramientas         | comprueba versiones e instala las dependencias del plugin        | instalas lo que falte del sistema                     |
| Org                  | lista tus orgs y descarta las que pueden ser producción          | haces login en el sandbox si no lo está               |
| Clave JWT            | genera el par la primera vez, fuera del repo                     | la guardas donde el equipo guarde secretos            |
| Sandbox              | despliega la app de conexión (ECA) y el permission set           | nada, salvo que algo pida un paso en Setup            |
| Usuarios de pruebas  | propone los roles mirando la org y el repo                       | eliges y confirmas; creas los que necesiten licencia  |
| Extensiones          | detecta chat, correo y Omni-Channel                              | eliges cuáles usar y haces lo que no tenga API        |
| `proyecto.md`        | lo redacta con lo que cuenta el repo                             | respondes lo que no sepa: dominio, canales, horarios  |
| Prueba de humo       | entra con cada usuario y saca una captura                        | revisas                                               |

Se puede parar y relanzar: retoma donde se quedó y no rehace lo que ya está bien.

Al terminar, **commitea** `.sf-ui/proyecto.md`, `.sf-ui/lightning.local.js` y el `.gitignore`. La clave JWT
**nunca** va al repo: vive en `~/.sf-ui/<proyecto>/`.

## El resto del equipo

1. Clona el proyecto e instala el plugin.
2. Pide la clave JWT por un canal seguro y déjala en la ruta que dice `.sf-ui/proyecto.md`.
3. Lanza `/sf-ui-skills:configurar`: solo comprobará.

## Uso

```text
/sf-ui-skills:probar-tarea 205
/sf-ui-skills:probar-tarea docs/hu/alta-cliente.md uat opus
/sf-ui-skills:documentar "manual del rol agente, con el diseño funcional de docs/df.docx"
```

La primera vez en una org, los agentes tardan más: aprenden las trampas de su interfaz y las apuntan en
`.sf-ui/lightning.local.js`. Commitea ese fichero: al resto del equipo le ahorra ese tiempo.

## Cuándo volver a configurar

- **Tras un refresco del sandbox**: `/sf-ui-skills:configurar <entorno>`. El refresco se lleva la app de conexión,
  el permission set y la contraseña de los usuarios.
- **Al añadir un entorno** (por ejemplo, `uat`): igual, con su nombre.
- **Cuando caduque el certificado** (a los dos años): se genera un par nuevo y se reparte otra vez.

## Problemas frecuentes

| Síntoma                                            | Qué pasa                                                    | Solución                                                         |
| -------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| La sesión se para en «Cambiar contraseña»          | el usuario de pruebas nunca ha entrado                      | `/configurar` lo resuelve; si no, entra una vez a mano           |
| La sesión se para en una verificación de identidad | la org exige MFA a ese usuario                              | ponle un correo real, entra una vez y registra el método         |
| «Falta la clave JWT»                               | no tienes la clave del equipo                               | pídela; no generes otra, dejaría fuera a los demás                |
| Falla tras actualizar el plugin                    | falta el Chromium de la nueva versión de Playwright         | `/configurar` lo reinstala                                       |
| El agente se niega a seguir                        | la org parece de producción                                 | es a propósito: usa un sandbox                                   |

## Coste

Cada ejecución lanza agentes (Sonnet por defecto). Como referencia, una HU de dos roles ronda los 150.000-200.000
tokens y un manual de cuatro apartados, unos 700.000.
