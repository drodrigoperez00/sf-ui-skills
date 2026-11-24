---
name: probar
description: Valida en un sandbox de Salesforce una historia de usuario o tarea que el desarrollador da por terminada. Reúne el contexto de la HU y del desarrollo, escribe el plan de casos y delega en el agente ui-tester, que prueba como un usuario modelo (JWT, sin login) en una sesión de navegador viva con bloques de Playwright y devuelve el resultado por criterio con capturas de evidencia. La HU puede ser su id en el gestor de issues, un fichero o el texto pegado en la conversación.
argument-hint: "<HU | fichero> [entorno] [modelo]"
---

# /probar: validar una HU como un usuario real

Invocación: `/probar <HU> [entorno] [modelo]`. Por ejemplo, `/probar 205`, `/probar docs/hu/alta-cliente.md uat`
o `/probar 205 opus`.

- **HU**: su id en el gestor, un fichero (md, txt, pdf; un docx, con `pandoc -t markdown <fichero>`), el texto pegado
  o nada (la issue de la rama, si `proyecto.md` dice cómo saberla; si no, pregunta).
- **Entorno**: una fila de la tabla de entornos de `proyecto.md`. Por defecto, el que diga, o el único.
- **Modelo del agente**: `sonnet` (por defecto), `opus`, `haiku` o `fable`, en cualquier forma («pruébala con Opus»).

Tú eres el **padre**: juntas el contexto, escribes el plan, lanzas a `ui-tester` y cierras el ciclo. No manejas el
navegador.

## 1. Preparación

Sigue `${CLAUDE_PLUGIN_ROOT}/referencias/preparacion.md`; en ella, `<plugin>` es `${CLAUDE_PLUGIN_ROOT}`.

## 2. Contexto y plan

- **La HU**, con el comando de `${CLAUDE_PLUGIN_ROOT}/referencias/gestores.md` para el gestor de `proyecto.md`. Si te
  dan un código funcional en vez del id, búscala; si hay dudas, pregunta. Los criterios de aceptación, por este
  orden: los de la issue; si no trae, los de la descripción de sus MR o PR; si tampoco, sácalos de la descripción.
  En los dos últimos casos, enséñaselos al desarrollador antes de lanzar y que confirme.
- **El desarrollo**: `git diff --stat <rama base>...<ref>` (la rama base, de `proyecto.md`) y, si ayuda, los
  ficheros clave. `<ref>` es `HEAD` si estás en la rama de la HU; si no, `origin/<rama>` de su MR o PR (`git fetch`
  antes). Si la funcionalidad no está desplegada en el sandbox, despliégala o avisa.
- **El plan**, en `<resultados>/evidencias/<id>/plan.md` (`<resultados>` es `.sf-ui/resultados`):
  - los criterios numerados, cada uno con su vía (API, UI o MANUAL) y qué demuestra que se cumple;
  - el rol que lo prueba, de la tabla de usuarios de `proyecto.md`, por su «Cuándo usarlo»;
  - los datos de partida que hacen falta.

  UI es lo que el usuario ve y hace; API, reglas de validación, lógica de flows y triggers, permisos y valores
  calculados; MANUAL, lo que necesita una persona real o un canal que no se simula (voz, SMS, un buzón real, MFA) y
  lo que `proyecto.md` declare MANUAL. Si una lógica tiene efecto en pantalla, cada criterio va al menos una vez por
  UI.

## 3. Lanzar a `ui-tester`

**Uno por HU**, aunque haya varios roles: abre una sesión por rol y lo que aprende con uno le sirve para el otro.
Dos solo si los roles tienen que actuar a la vez (uno espera mientras el otro hace algo en tiempo real). `Agent` con
`subagent_type: sf-ui-skills:ui-tester` y `model` explícito. Brief:

- la raíz del plugin (`${CLAUDE_PLUGIN_ROOT}`), la del proyecto y la ruta de `proyecto.md`;
- el entorno, los roles con su username y la **etiqueta** de sesión de cada uno (`T<id>-<rol>`, única);
- la ruta del plan y los criterios que le tocan;
- la **carpeta de evidencia**, `<resultados>/evidencias/<id>/`, con la instrucción de dejar ahí las capturas y su
  parte de `evidencia.md`;
- el resumen del desarrollo con rutas, y las extensiones que use la HU.

## 4. Cerrar el ciclo

Junta las respuestas y escribe `<resultados>/evidencias/<id>/evidencia.md` (reescríbelo si existe). Corto: quien
revisa quiere ver que se probó, no cómo.

```markdown
### HU-412 · Gestión de prioridad

`dev` · agente, supervisor · 2026-10-13 · `34ca386` · **PASS**

**1. El agente sube la prioridad** · UI · ✅

![Prioridad subida a Alta](agente-prioridad-alta.png)

**2. Se registra quién la cambió** · API · ✅
```

- Cabecera: entorno, roles, fecha, commit probado y resultado. El commit es `git rev-parse --short HEAD` si `<ref>`
  es `HEAD`; si no, `<rama>@<commit>` de la MR o PR (`git rev-parse --short origin/<rama>`).
- Un párrafo por criterio: vía y ✅, ❌, ⚠️ (no concluyente) o 👤 (manual, con lo que hay que comprobar). Debajo, sus
  capturas. Al terminar, en la carpeta solo
  quedan `evidencia.md` y los PNG que enlaza: borra `plan.md`, los parciales de los agentes y las capturas sueltas.

Al desarrollador, con qué rol, usuario, entorno y modelo se probó, y:

- **FAIL**: el fix que propone el informe; si está de acuerdo, aplícalo, despliega y relanza.
- **NO CONCLUYENTE**: si falta un dato, un permiso o un usuario adecuado.
- **MANUAL**: lo que tiene que comprobar él.
- **Trampas** que los agentes apuntaron en `.sf-ui/lightning.local.js`: que las revise y las commitee.

**Marca la HU como probada** (etiqueta de `proyecto.md`, con `gestores.md`) solo si todo sale ✅. Sin gestor, dile
que no se marca. Lo que pasa después con la evidencia (subirla al gestor, a la MR) lo dice `proyecto.md`; los
comandos, `gestores.md`.

Comparte la ruta completa de `evidencia.md` y ofrécele abrirlo.
