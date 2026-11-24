# Preparación antes de lanzar agentes de navegador

La siguen `/probar` y `/documentar` antes de lanzar a ningún agente. Si falla un paso, para y di cómo se resuelve:
no lances agentes contra un entorno a medio preparar. `<plugin>` es la raíz del plugin: la ruta que te dio quien te
remitió aquí.

## 1. El proyecto

Lee `.sf-ui/proyecto.md` entero. Es la configuración (entornos, usuarios modelo, gestor, rama base) y lo que hay que
saber del proyecto; prevalece sobre los ejemplos genéricos del plugin. Pasa su ruta en cada brief: todos los agentes
lo leen.

Si no existe, o el entorno elegido no tiene fila o `clientId`, el proyecto no está configurado: para y dile al
desarrollador que lance `/sf-ui-skills:configurar [entorno]`.

## 2. El entorno

Del entorno elegido, en la tabla de `proyecto.md`:

1. **Guarda**: `sf data query -q "SELECT IsSandbox FROM Organization" -o <alias> --json` devuelve `true`. Si no, o
   si el alias no está autenticado, para. **Nunca contra producción.**
2. **clientId**: si está vacío, el sandbox no está preparado (§3).
3. **Clave JWT**: el fichero existe (`test -f <ruta>`). No lo leas. Vive fuera del repo; si falta, el desarrollador
   la pide al equipo por un canal seguro.
4. **Chromium**: `node <plugin>/node_modules/@playwright/test/cli.js install chromium` si no está instalado para la
   versión de Playwright del plugin (lo dice el error de `sesion.js abrir`; tras actualizar el plugin, hace falta
   otra vez). Si falta `<plugin>/node_modules`, antes `npm install --prefix <plugin>`.

## 3. Las extensiones

Si la HU o algún segmento usa chat, correo u Omni-Channel y el entorno declara la extensión, sigue el «Antes de
lanzar» de su referencia en `<plugin>/referencias/extensiones/` y pasa la ruta en el brief al agente que lo navega.
Si el entorno no la declara, eso se prueba o se documenta como MANUAL, salvo que `proyecto.md` diga otra cosa.

## 4. Preparar un sandbox (alta o tras un refresco)

Un refresco se lleva la ECA, el permission set y la contraseña de los usuarios modelo, y puede cambiar los
usernames. Todo va con el **alias de admin** del entorno (`<alias>`). Lo normal es hacerlo con
`/sf-ui-skills:configurar`, que sigue estos pasos y genera el par JWT si el proyecto aún no lo tiene. Nunca contra
producción:

1. **Guarda.** `sf data query -q "SELECT IsSandbox FROM Organization" -o <alias>` devuelve `true`, y el
   `instanceUrl` de `sf org display -o <alias>` acaba en `.sandbox.my.salesforce.com`. Si no, para.
2. **Valores** de los marcadores `{{…}}` de `<plugin>/plantillas/metadata/pruebas/`:
   - `ECA` = `<prefijo>_ECA_PruebasUsuario` y `PS` = `<prefijo>_PS_PruebasUsuario` (el prefijo, de `proyecto.md`);
   - `ETIQUETA` = `<prefijo> Pruebas de Usuario`;
   - `CONTACTO` = el `Email` del admin: `SELECT Email FROM User WHERE Username = '<username de org display>'`;
   - `CERTIFICADO` = `jwt.crt`, junto a la clave JWT, sin las líneas `BEGIN`/`END`. No lo leas al contexto;
   - `VERSION_API` = la versión de la API de `proyecto.md` o, si no está, el `apiVersion` de `sf org display`.
3. **Desplegar.** Si el proyecto ya versiona la ECA (hay un `<ECA>.eca-meta.xml` en sus `packageDirectories`),
   despliégala desde ahí: `sf project deploy start -o <alias> --wait 30 --metadata ExternalClientApplication:<ECA>
   --metadata ExtlClntAppGlobalOauthSettings:<ECA>_glbloauth --metadata ExtlClntAppOauthSettings:<ECA>_oauth
   --metadata ExtlClntAppOauthConfigurablePolicies:<ECA>_oauthPlcy --metadata PermissionSet:<PS>`.
   Si no, rellena la plantilla en una carpeta temporal. Va con `perl` y no con `sed`: el certificado tiene
   saltos de línea, `/` y `+`.

   ```bash
   T=$(mktemp -d); cp -R <plugin>/plantillas/metadata/pruebas/. "$T"
   for f in "$T"/*/ECA[._]*; do mv "$f" "${f%/*}/<ECA>${f##*/ECA}"; done
   mv "$T/permissionsets/PS.permissionset" "$T/permissionsets/<PS>.permissionset"
   export ECA=<ECA> PS=<PS> ETIQUETA="<prefijo> Pruebas de Usuario" CONTACTO=<email> VERSION_API=<versión>
   export CERTIFICADO="$(grep -v CERTIFICATE <ruta de la clave sin .key>.crt)"
   find "$T" -type f -exec perl -pi -e 's/\{\{(\w+)\}\}/$ENV{$1} \/\/ $&/ge' {} +
   grep -rl '{{' "$T"     # no debe salir nada
   sf project deploy start --metadata-dir "$T" -o <alias> --wait 30; rm -rf "$T"
   ```

4. **Consumer key.** Se lee de la org, no del despliegue:

   ```bash
   R=$(mktemp -d)
   sf project retrieve start --metadata "ExtlClntAppGlobalOauthSettings:<ECA>_glbloauth" \
     -o <alias> --target-metadata-dir "$R" --unzip
   grep -rho '<consumerKey>[^<]*' "$R" | sed 's/<consumerKey>//'; rm -rf "$R"
   ```

   Apúntala como `clientId` en la tabla del entorno de `.sf-ui/proyecto.md`. No es secreta: se commitea.
5. **Usuarios modelo.** Comprueba que existen y están activos:
   `sf data query -o <alias> -q "SELECT Username, IsActive, LanguageLocaleKey FROM User
   WHERE Username IN ('<u1>','<u2>')"`.
   Al que no salga, corrígele el username en `proyecto.md`. Después:
   - `sf org assign permset --name <PS> --on-behalf-of <u1> --on-behalf-of <u2> -o <alias>`. Si ya lo tenía, sale
     como fallo de duplicado: no pasa nada;
   - al que tenga otro idioma que el del entorno:
     `sf data update record -s User -w "Username='<u1>'" -v "LanguageLocaleKey=<idioma>" -o <alias>`.
     Los agentes buscan las etiquetas en ese idioma.
6. **Comprobar.** Abre una sesión por usuario con `sesion.js abrir` y ciérrala. Si se queda en `/ChangePassword`,
   es el primer acceso (paso 7). Si se queda en `/_ui/identity/`, es MFA (paso 8).
7. **Primer acceso.** El usuario nunca ha entrado y la org le exige cambiar la contraseña. Ninguna contraseña pasa
   por el contexto ni se guarda:
   - genera una aleatoria en un fichero temporal con permisos `600` (`{"NewPassword":"…"}`, sin mostrarla) y fíjala
     con `sf api request rest /services/data/v<api>/sobjects/User/<Id>/password --method POST --body @<fichero> -o <alias>`;
   - en la sesión parada en `/ChangePassword`, rellena la actual leyendo el fichero dentro del bloque
     (`process.getBuiltinModule("fs").readFileSync(…)`, Node 22) y una nueva aleatoria generada en el bloque;
   - borra el fichero, cierra la sesión y repite 6.

   Si no sale, lo resuelve el desarrollador una vez a mano y se repite 6.
8. **MFA.** La org le exige registrar un método para entrar por la UI. El desarrollador le pone una contraseña
   temporal y un correo real, entra una vez, registra el método y se repite 6. Después, el JWT entra sin pararse.

**Riesgos.**

- La ECA se versiona **sin** `consumerKey`, `orgScopedExternalApp` ni `oauthLink`, que son de cada org. Si un
  `retrieve` los trae, se quitan antes de commitear.
- Tras un refresco la consumer key cambia: repite 4 aunque la ECA ya estuviera desplegada.
- El certificado caduca (`openssl x509 -enddate -noout -in <…>.crt`). Renovarlo es generar un par nuevo, repartir
  la clave y repetir 2-4.
