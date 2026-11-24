---
name: configurar
description: Configura un proyecto Salesforce para usar /probar y /documentar, o lo repara tras un refresco del sandbox. Asistente por pasos que comprueba las herramientas, elige la org de pruebas (nunca producción), genera el par JWT, despliega la ECA y el permission set, propone los usuarios modelo, detecta las extensiones (chat, correo, Omni-Channel), redacta .sf-ui/proyecto.md con el desarrollador y hace una prueba de humo. Se puede relanzar; retoma donde se quedó.
argument-hint: "[entorno]"
---

# /configurar: dejar un proyecto listo para /probar y /documentar

Invocación: `/configurar [entorno]`. Por ejemplo, `/configurar` la primera vez, o `/configurar uat` para añadir un
entorno o repararlo tras un refresco.

Se lanza desde la raíz del proyecto (el repo con `sfdx-project.json`). `<plugin>` es `${CLAUDE_PLUGIN_ROOT}`.

## Cómo se lleva

- **Por pasos, y cada paso empieza comprobando.** Si ya está bien, dilo en una línea y pasa al siguiente: relanzarlo
  no rehace nada ni pisa lo que el equipo ya tiene. Lo que esté a medias, se retoma.
- **En cada paso, di qué haces tú y qué tiene que hacer la persona.** Lo que solo puede hacer ella (un login en el
  navegador, instalar algo del sistema, un paso de Setup sin API) se lo das como comando para que lo lance con `!`
  delante, o como ruta de Setup, y esperas a que diga que está.
- **Las decisiones, con `AskUserQuestion`** y la opción recomendada primero: la org, los usuarios, las extensiones.
- **Nunca contra producción**, ni para leer. **Nunca secretos en el contexto**: ni la clave JWT, ni tokens, ni
  contraseñas; `sf org display` siempre con `--json` y filtrado.
- **No commitees.** Al final, di qué ficheros se versionan.
- Al terminar o al parar, un resumen: qué quedó hecho, qué falta y quién lo hace.

## 1. Herramientas

Comprueba versiones: `node -v` (22 o más), `sf --version`, `git`, `jq`, `openssl`. Después, según lo que vaya a usar el
proyecto: `gh` o `glab` y su login (`gh auth status`, `glab auth status`), y `pandoc` para `/documentar`.

- Lo que falte de sistema lo instala la persona: dale el comando de su sistema (`brew install …` en macOS;
  `winget install …` en Windows).
- Las dependencias del plugin las instalas tú: `npm install --prefix <plugin>` si falta `<plugin>/node_modules`, y
  `node <plugin>/node_modules/@playwright/test/cli.js install chromium`.

## 2. El proyecto y el entorno

1. **`.sf-ui/`.** Si no existe, copia `<plugin>/plantillas/sf-ui/proyecto.md` y `lightning.local.js` a `.sf-ui/` y
   añade las líneas de `<plugin>/plantillas/sf-ui/gitignore` al `.gitignore` del proyecto (las que falten). Si existe,
   léelo: lo que ya tenga manda, y solo completas lo que falte.
2. **La org.** `sf org list --json 2>/dev/null | jq '[.result.nonScratchOrgs[], .result.scratchOrgs[]] |
   map({alias, instanceUrl})'`. Propón las que tengan `.sandbox.` en la URL o sean scratch; las demás pueden ser
   producción y no se ofrecen. Si la que quiere no está, que lance
   `! sf org login web --alias <alias> --instance-url https://test.salesforce.com`. Antes de seguir, la guarda de
   `<plugin>/referencias/preparacion.md` §4.1.
3. **La fila del entorno** en la tabla de `proyecto.md`: nombre (`dev`, `uat`…), alias de admin e idioma de la UI
   (el `LanguageLocaleKey` del admin, si la persona no dice otro). Y, debajo de la tabla, el prefijo de la metadata
   de pruebas (dos o tres letras del proyecto) y la versión de la API (`apiVersion` de `sf org display --json`).

## 3. La clave JWT

Una por proyecto, compartida por el equipo y fuera del repo, en `~/.sf-ui/<proyecto>/` (`<proyecto>`, el nombre de la
carpeta del repo en minúsculas). La ruta va en `proyecto.md`.

- **Ya existe** (`test -f <ruta>/jwt.key`): sigue.
- **No existe, pero `proyecto.md` ya trae un `clientId`**: el equipo ya tiene clave. **No generes otra**, que dejaría
  fuera a los demás. La persona la pide al equipo por un canal seguro y la deja en esa ruta con permisos 600.
- **No existe y no hay `clientId`**: es el primer desarrollador. Genera el par sin sacar la clave al contexto:

  ```bash
  D=~/.sf-ui/<proyecto>; mkdir -p "$D" && chmod 700 "$D"
  openssl req -x509 -sha256 -nodes -days 730 -newkey rsa:2048 -subj "/CN=<prefijo> Pruebas de Usuario" \
    -keyout "$D/jwt.key" -out "$D/jwt.crt" 2>/dev/null && chmod 600 "$D/jwt.key"
  ```

  Dile que la guarde también donde el equipo guarde secretos: si se pierde, hay que generar otra y repetir el paso 4.

## 4. El sandbox

Sigue `<plugin>/referencias/preparacion.md` §4, pasos 1 a 4: guarda, valores, despliegue de la ECA y el permission
set, y la consumer key como `clientId` en `proyecto.md`. Si la ECA ya está y la consumer key coincide, no redespliegues.

## 5. Usuarios modelo

Si `proyecto.md` ya tiene usuarios, compruébalos con la consulta de `preparacion.md` §4.5 y sigue.

Si no, propónlos a partir de la org:

- los perfiles y grupos de permission sets con usuarios activos:
  `SELECT Profile.Name, COUNT(Id) n FROM User WHERE IsActive = true AND UserType = 'Standard' GROUP BY Profile.Name`;
- lo que cuente el repo de sus roles (`force-app/**/profiles`, `permissionsetgroups`, el README);
- usuarios que ya parezcan de pruebas (`Username LIKE '%prueba%' OR Username LIKE '%test%'`).

Con eso, una tabla de roles (rol, perfil o PSG, para qué) y la persona elige. Para cada rol hace falta un usuario
**dedicado a las pruebas**, no el de una persona: las sesiones lo usan y las pruebas le cambian el estado. Si no
existe, créalo con su confirmación (`sf data create record -s User` con `Username` único, `ProfileId`, `Alias`,
`LastName`, `Email` del desarrollador, `TimeZoneSidKey`, `LocaleSidKey`, `EmailEncodingKey`, `LanguageLocaleKey` del entorno), o lo crea
ella en Setup si hace falta una licencia que no ves. Redacta la columna «Cuándo usarlo» con ella: es lo que lee
`/probar` para elegir rol.

Después, `preparacion.md` §4.5: el permission set y el idioma.

## 6. Extensiones

Detecta lo que tiene la org y propón activar solo lo que exista:

| Extensión  | Se detecta con                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `chat`     | `sf org list metadata -o <alias> --metadata-type EmbeddedServiceConfig` (Messaging for In-App and Web) |
| `correo`   | `SELECT Id FROM EmailServicesAddress WHERE IsActive = true` o casos con `Origin = 'Email'`        |
| `enrutado` | `sf data query --use-tooling-api -q "SELECT DeveloperName FROM QueueRoutingConfig"` y `ServiceChannel` |

Para cada una que elija, lee su referencia en `<plugin>/referencias/extensiones/` y anota en `proyecto.md`, debajo de
la tabla de entornos, los datos que pide (deployment, dirección de Email-to-Case, colas, horario). Después, su «Antes
de lanzar»: lo que salga a mano (publicar el deployment, la capacidad de entrega) se lo dices a la persona.

## 7. `proyecto.md`

Lo que queda de la plantilla (dominio, canales y horarios, integraciones, qué es MANUAL, datos de prueba y el gestor
de issues) se rellena en una entrevista corta: primero lee lo que el repo ya cuenta (README, `docs/`, los objetos de
`force-app`, el remoto de git para el gestor) y pregunta solo lo que no sepas. Lo que la persona no sepa, déjalo con
un `PENDIENTE:` y sigue; borra las secciones que no apliquen.

El gestor, compruébalo con una lectura (`gh issue list -L 1`, `glab issue list -P 1` o la búsqueda de Jira de
`<plugin>/referencias/gestores.md`).

## 8. Prueba de humo

Por cada usuario modelo, desde la raíz del proyecto:

1. `node <plugin>/scripts/sesion.js abrir <alias> <username> humo-<rol> --client-id <clientId> --clave <ruta>/jwt.key`.
   Si se queda en `/ChangePassword` o en `/_ui/identity/`, `preparacion.md` §4.7 u §4.8.
2. Un bloque que espere a la home y saque `captura(".sf-ui/resultados/humo/<rol>.png")`. Ábrela tú y comprueba que
   es Lightning con ese usuario.
3. `node <plugin>/scripts/sesion.js cerrar humo-<rol>`.

Si todo pasa, dilo y cierra con:

- **Qué se versiona**: `.sf-ui/proyecto.md`, `.sf-ui/lightning.local.js` y las líneas del `.gitignore`. Si el
  proyecto quiere versionar la ECA, que la recupere con `sf project retrieve start` y le quite `consumerKey`,
  `orgScopedExternalApp` y `oauthLink`.
- **Qué no**: la clave, que vive en `~/.sf-ui/<proyecto>/`; `.sf-ui/resultados/` y `.sf-ui/.estado/`.
- **Para el resto del equipo**: clonar, instalar el plugin, recibir la clave por canal seguro y lanzar
  `/configurar`, que solo comprobará.
- **Tras un refresco del sandbox**: `/configurar <entorno>` otra vez; repara la ECA, la consumer key y los usuarios.
- **Siguiente**: `/probar <HU>` con una HU sencilla.
