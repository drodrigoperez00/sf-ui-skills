# Las trampas de Lightning del proyecto

`.sf-ui/lightning.local.js` es lo que este proyecto ha aprendido de su org: lo que hace fallar un locator razonable
(campos que no existen hasta que bajas, picklists que se cierran, guardados sin aviso…) y cómo salvarlo. El plugin
no trae trampas: cada proyecto apunta las suyas, y lo que no ha necesitado no está. Se versiona en el repo del
proyecto.

## Consultar

- **Al abrir la sesión**, saca el índice: `grep -n '// ──' .sf-ui/lightning.local.js`. Una línea por trampa, con su
  título y la línea donde empieza.
- **Antes de manejar un elemento que sale en el índice** (un lookup, una picklist, editar en línea, guardar…), lee
  esa trampa con Read desde su línea (`offset`): son unas pocas líneas.
- **Cuando falla un locator**, mira el índice antes de improvisar.
- Si la trampa trae función, úsala en el bloque como `ui.<nombre>`.

## Apuntar

Cuando algo te ha costado **más de un intento** y has dado con la solución, apúntalo en ese momento, con Edit
(reescribirlo desde PowerShell lo guarda en ANSI y rompe los acentos):

```js
// ── Picklist que se cierra al escribir ──
// Síntoma: el combobox se abre y se cierra sin elegir. Causa: el foco salta al
// buscador. Qué hacer: pulsar el combobox y elegir con getByRole("option").
```

- Título, síntoma, causa y qué hacer, en 3-4 líneas. Si ya hay una del mismo tema, amplía esa.
- Código solo si no basta con decirlo: una función en el objeto que exporta el fichero, citada en la trampa como
  `ui.<nombre>` y probada en la sesión (se recarga en cada bloque).
- Nada propio de una HU o un segmento: solo lo que le volvería a pasar a otro agente en esta org.
- **Nunca coordenadas** (`mouse.click(x, y)`, `clip`): cambian con la pantalla y no dicen qué se pulsa. Si un
  elemento no tiene nombre accesible, búscalo en el árbol de su contenedor (`ariaSnapshot`) o por su título o texto.
- Si una trampa ya no funciona como dice (una release de Salesforce cambió la pantalla), corrígela.
- Si otro agente está editando el fichero a la vez, toca solo tu trampa.
- En tu respuesta, una línea por trampa añadida o corregida.
