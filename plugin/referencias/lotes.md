# Lotes: varios agentes de navegador a la vez

Referencia de las skills que lanzan varios agentes de navegador contra el mismo entorno (`/documentar` hoy, y
`/probar` en modo masivo cuando llegue). Un agente no puede lanzar a otros: los lotes los lanza la skill.
`<plugin>` es la raíz del plugin.

## Qué va en cada lote

Los lotes los marcan los **recursos compartidos**, no el orden funcional:

- **`omni`, `chat` o `correo`**: la unidad (segmento o caso) va **sola** con su usuario. El estado de Omni es del
  usuario, no de la sesión: a otra sesión del mismo usuario le llegaría el trabajo enrutado (el caso de un correo
  también llega por Omni). Dos de estas no van en el mismo lote salvo con usuarios distintos.
- **`envio`** (el agente envía un correo): antes del primer lote, la comprobación de
  `<plugin>/referencias/extensiones/correo.md`.
- **Horario**: si `proyecto.md` declara horario de un canal y las unidades con ese canal caen fuera, avisa antes de
  lanzar.
- **El resto, en paralelo** en el mismo lote. Tope: 4 agentes a la vez, salvo que el usuario pida otro.
- Lanza los agentes de un lote en el mismo turno, y espera a que acabe el lote antes de lanzar el siguiente.

## Contrato común

- **Un usuario modelo fijo por rol** en toda la ejecución, elegido por la skill, no por cada agente.
- **Una etiqueta de sesión por agente** (p. ej. `D1`): cada uno tiene su navegador y
  sus bloques aunque compartan usuario.
- **Contrato visual**: el viewport y el zoom de `sesion.js`, iguales para todos. Ningún agente los cambia.
- **Datos comunes** (lo que necesitan varias unidades), sembrados por la skill una vez antes del primer lote; lo que
  solo necesita una unidad lo siembra su agente.
- **`model` explícito** en cada lanzamiento: el que pidió el usuario o el de por defecto de la skill.

## Coste y tiempo

Cada agente de navegador tarda unos 15-20 minutos. Antes de lanzar más de un lote, di cuántos lotes y agentes son
y una estimación de tiempo, para que el usuario decida si sigue o recorta.
