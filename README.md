# sf-ui-skills

Plugin de Claude Code para los equipos Salesforce: prueba historias de usuario y genera documentación con
capturas navegando un sandbox como lo haría un usuario real, con Playwright y usuarios modelo que entran por
JWT.

> En pruebas: `/probar` y `/documentar` se usan en un proyecto real; `/configurar` aún no se ha probado de punta a
> punta en una org nueva.

## Uso

```text
/sf-ui-skills:configurar [entorno]
/sf-ui-skills:probar <HU | fichero> [entorno] [modelo]
/sf-ui-skills:documentar <qué documentar y con qué fuentes> [entorno] [modelo]
```

- `configurar` deja un proyecto listo, o lo repara tras un refresco del sandbox: herramientas, org, clave JWT,
  app de conexión, usuarios modelo, extensiones, `proyecto.md` y una prueba de humo.
- `probar` valida una historia de usuario en un sandbox con el agente `ui-tester` y deja la evidencia con
  capturas. La HU puede ser su id en el gestor de issues, un fichero o el texto pegado en la conversación.
- `documentar` genera un manual en Word con capturas anotadas: ingesta de las fuentes, revisión de los segmentos
  por el usuario, un `ui-documentador` por segmento en paralelo y el ensamblado.

## Qué hay

Versión `0.5.0`. Un solo script; lo demás son pautas en `.md` que los agentes siguen con `sf`, `glab`/`gh`, `curl`, `pandoc` y Playwright.

| Carpeta                         | Contenido                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `plugin/scripts/sesion.js`      | sesión de navegador viva por etiqueta: guarda de producción, login JWT y bloques de Playwright |
| `plugin/skills/`, `plugin/agents/` | las skills `configurar`, `probar` y `documentar` y sus cuatro agentes                                    |
| `plugin/referencias/`           | preparación, navegador, trampas del proyecto, gestores de issues, datos de demo, lotes y extensiones |
| `plugin/plantillas/`            | la carpeta `.sf-ui/` de un proyecto y la metadata de pruebas (ECA, permission set, chat)      |

## Instalación

```text
/plugin marketplace add drodrigoperez00/sf-ui-skills
/plugin install sf-ui-skills@sf-ui-skills
```

Requisitos: Node 22 o superior, la CLI de Salesforce (`sf`), el Chromium de la versión de Playwright del plugin
(`node <raíz del plugin>/node_modules/@playwright/test/cli.js install chromium`, otra vez al actualizar el plugin) y,
para `/documentar`, `pandoc`.

Para desarrollar el plugin en local: `cd plugin && npm install` y lanzar Claude Code con
`claude --plugin-dir <ruta>/plugin`.

Sin marketplace, clonando el repo o copiándolo dentro del proyecto: ver `docs/guia.md`.

Cada proyecto se configura con `/sf-ui-skills:configurar`, que deja `.sf-ui/proyecto.md` y prepara el sandbox. La
guía para los equipos está en `docs/guia.md`.

## Seguridad

- Solo trabaja contra sandboxes: la preparación y `sesion.js abrir` comprueban que la org es un sandbox, y se
  niegan con producción.
- Las claves JWT viven fuera de los repositorios (`~/.sf-ui/<proyecto>/`).
- `sesion.js` no imprime tokens ni URLs con sesión; las pautas prohíben sacarlos al contexto.

## Licencia

Todos los derechos reservados. Se puede ver e instalar para usarlo; no se acepta código de fuera.
