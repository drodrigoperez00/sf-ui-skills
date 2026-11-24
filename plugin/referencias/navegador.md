# El navegador: sesión, bloques y capturas

Referencia común de `ui-tester` y `ui-documentador`. Lo que dice `.sf-ui/proyecto.md` prevalece sobre los ejemplos
de aquí. `<plugin>` es la raíz del plugin: la ruta que te dio quien te remitió aquí.

## Reglas

- **Nunca contra producción.** `abrir` lleva la guarda. Cualquier `sf` que lances va con el alias del entorno que te
  da el brief, que ya pasó la guarda; si algo menciona `GUARDA`, para y repórtalo.
- **El navegador se maneja con código, por tramos.** Nada de Playwright MCP ni de una acción por turno: cada bloque
  hace un tramo entero (abrir, rellenar, guardar y comprobar) y devuelve lo que necesitas ver.
- **Nunca pasas por la pantalla de login** ni tecleas credenciales. No lees la clave JWT ni imprimes tokens o URLs
  de frontdoor (`sf org open` sin `--url-only` tampoco).
- **Locators semánticos**: `getByRole`, `getByLabel`, `getByText`, `getByTitle`. Nada de XPath, ids generados ni
  clases `slds-*`, salvo que una trampa del proyecto diga otra cosa.

## Abrir, ejecutar y cerrar

Desde la raíz del proyecto (la carpeta con `.sf-ui/`):

```bash
node <plugin>/scripts/sesion.js abrir <alias> <username> <etiqueta> --client-id <clientId> --clave <ruta de la clave JWT>
node <plugin>/scripts/sesion.js ejecutar <etiqueta> - <<'EOF'
…bloque…
EOF
node <plugin>/scripts/sesion.js cerrar <etiqueta>
```

- El alias, el `clientId` y la ruta de la clave salen de la tabla de entornos de `proyecto.md`; el username, de la
  de usuarios; la etiqueta te la da el brief. La etiqueta es tuya: nadie más la usa.
- `abrir` tarda unos 15 s. Si trae `aviso` (cambio de contraseña o MFA), la página está en esa pantalla: el cambio
  de contraseña lo resuelves por la UI con una contraseña nueva que no apuntas en ningún sitio; el MFA no, repórtalo.
- En Windows, con la herramienta PowerShell: `@'` … `'@ | node <plugin>/scripts/sesion.js ejecutar <etiqueta> -`,
  con `'@` en la columna 0.
- La salida es un JSON de una línea; no la recortes con `tail` ni `head`.
- La sesión se cierra sola tras 30 minutos sin uso. Ciérrala tú al terminar.

## El bloque

Es el cuerpo de una función async con `page`, `context`, `expect` (aserciones con 5 s de margen), `ui` (las
funciones de `.sf-ui/lightning.local.js`, recargadas en cada bloque), `mem` (un objeto que se conserva entre los
bloques de tu sesión) y `captura` (ver «Capturas»). Lo que devuelvas con `return` sale en `valor`. `page.goto` acepta
rutas relativas (`/lightning/…`).

```js
await page.goto(`/lightning/r/Case/${mem.caso}/view`);
await page.getByRole("button", { name: "Editar Prioridad" }).click();
await page.getByRole("combobox", { name: "Prioridad" }).click();
await page.getByRole("option", { name: "Media" }).click();
await page.getByRole("button", { name: "Guardar" }).click();
await expect(page.getByText("Media", { exact: true }).first()).toBeVisible();
return await page.getByRole("main").ariaSnapshot();
```

- Timeouts de 5 s: un locator equivocado falla enseguida. Si el error viene de la pantalla, la respuesta trae `foto`,
  el árbol accesible del modal o del contenido principal. Corrige y reenvía **solo el tramo que falló**: la página
  sigue donde estaba.
- Para mirar sin actuar, devuelve `await page.getByRole("main").ariaSnapshot()` (o el de un modal o desplegable).
  Una captura solo si el árbol no basta (iconos, estilos), y la lees.
- Comprueba con `expect` (nunca `waitForTimeout`); con varias comprobaciones independientes, `expect.soft`.
- Para pasar un dato a otra sesión, devuélvelo con `return` y escríbelo en el bloque de la otra.
- **Tras guardar o lanzar una acción, lee los avisos** en el mismo bloque, justo tras el clic (el toast se va solo):
  `page.locator('[role="alert"], [role="alertdialog"], .toastContainer').filter({ visible: true }).allInnerTexts()`,
  y mira la cabecera de la ficha, no solo el campo. Un error o un rechazo es un resultado (en `/probar`) o una discrepancia (en `/documentar`), aunque
  el valor se haya guardado.
- **En la consola**, el primer bloque cierra las pestañas que restaura de otras ejecuciones: en la navegación
  «Espacios de trabajo», pulsa los botones con título «Cerrar …» (`getByTitle(/^Cerrar/)`) hasta que no quede
  ninguno, con «Descartar cambios» si lo pide. Esa barra está oculta al árbol accesible: `ariaSnapshot` no la enseña.

## Datos, fuera del navegador

Los datos se leen, preparan y limpian desde Bash con `sf`, no dentro del bloque. Siempre con `--json 2>/dev/null`
(los avisos de actualización de `sf` van a stderr y rompen `jq`), los filtros de `jq` entre comillas simples y, para
varios ids, un bucle sobre una lista explícita (`for id in 500A 500B; do …; done`), no sobre una variable sin comillas:

- Como el usuario modelo, para lo que tiene que ser suyo (propiedad, visibilidad) o para comprobar un permiso:
  `sf data create record -s Case -v "Subject='…'" -o <username> --json`, `sf data query -q "…" -o <username> --json`.
- Como admin (el alias del entorno), para preparar el estado de partida y limpiar; nunca para comprobar lo que ve o
  puede hacer el usuario.
- La API no exige los campos obligatorios del layout: rellénalos si luego se va a guardar en línea.
- **Nada se queda en la org**: apunta cada id que crees y bórralo al terminar (`sf data delete record -s <objeto>
  -i <id> -o <alias>`), también si algo falló. Lo que no se pueda borrar, dilo en tu respuesta.
- Las convenciones del proyecto (prefijos, registros que no se tocan) están en `proyecto.md`.

Para entender una record page o un flow, busca en el XML del proyecto lo que necesitas en vez de leerlo entero:
`grep -n "<fieldItem>\|<label>" force-app/**/flexipages/<Nombre>.flexipage-meta.xml`.

## Capturas

Con `captura`, dentro del bloque que demuestra lo que se captura, justo tras el `expect`:

```js
const guardar = page.getByRole("button", { name: "Guardar" }).filter({ visible: true }).first();
await captura("<carpeta del brief>/03-guardar.png", {
  marcas: [guardar],                  // recuadro rojo y número, en este orden: (1), (2)…
  mask: [page.getByRole("grid")],     // datos que no deben salir
  zona: page.getByRole("dialog")      // opcional: recorta a un modal o panel
});
```

- `marcas` son locators, numerados en el orden en que van; `{ locator, n }` fija el número. Se pintan encima de la
  página y se quitan solas. Sin marcas, es una captura sin más (la evidencia de `/probar`).
- Si una marca no se ve en la captura o la tapa otro elemento (un desplegable abierto), `captura` falla:
  desplázala, cierra lo que la tapa, abre lo que la contiene o recorta con `zona`.
  Si no falla, la marca está donde debe: **no abras el PNG para comprobarla**.
- Nada de coordenadas: ni `clip`, ni `mouse.click(x, y)`. Para recortar, `zona`.
- Lo pasajero (un aviso que se cierra solo) y lo irreversible (un mensaje enviado) se capturan en el mismo bloque,
  antes de cualquier paso que pueda fallar. Si se pierde, repite el escenario con otro registro; nunca captures otra
  cosa en su lugar.
- No cambies el viewport (1440 × 900) ni el zoom: todas las capturas tienen que casar.
