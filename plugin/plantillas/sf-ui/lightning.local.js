// Trampas de Lightning de este proyecto: lo que ha hecho fallar un locator
// razonable en esta org y cómo salvarlo. Lo leen y lo mantienen los agentes de
// sf-ui-skills (ver referencias/lightning.md del plugin). Se versiona.
//
// Cada trampa lleva una cabecera, que es de donde sale el índice
// (`grep -n '// ──' .sf-ui/lightning.local.js`), y 3-4 líneas:
//   // ── Título ──
//   // Síntoma: … Causa: … Qué hacer: …
// Si hace falta código, una función en el objeto de abajo, citada en la trampa
// como `ui.<nombre>`. El bloque de la sesión la recibe en `ui`.
"use strict";

module.exports = {};
