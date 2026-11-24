---
name: documentar
description: Genera documentación funcional (un manual de usuario, una guía de un rol) en Word con capturas marcadas, navegando un sandbox de Salesforce como un usuario modelo. Parte de las fuentes que dé el usuario (plan de pruebas, diseño funcional, notas, issues, código) y orquesta agentes - ingesta-documentacion (guiones por segmento), ui-documentador (uno por segmento, en paralelo) y ensamblador-documentacion (el Word con pandoc).
argument-hint: "<qué documentar y con qué fuentes> [entorno] [modelo]"
---

# /documentar: un manual navegando la org como un usuario real

Invocación: `/documentar <qué documentar y con qué fuentes> [entorno] [modelo]`. Por ejemplo:

```text
/documentar manual del agente de soporte para usuarios nuevos, desde docs/plan-pruebas.md y la carpeta ~/notas/soporte
/documentar guía rápida del supervisor a partir de las issues 120 y 131, con la plantilla ~/plantillas/empresa.docx
```

- **Fuentes**: cualquier combinación de documentos, carpetas, issues o código. Sin ninguna, pregúntalas.
- **Alcance, audiencia y nivel de detalle**: los que dé el usuario, directa o indirectamente. Viajan en cada brief.
- **Plantilla** (`.docx`) y **ruta de salida**: opcionales.
- **Entorno**: una fila de la tabla de entornos de `proyecto.md`. Por defecto, el que diga, o el único.
- **Modelo de los documentadores**: `sonnet` por defecto. La ingesta y el ensamblado, `sonnet` salvo que se pida otro.

Tú eres el **padre**: orquestas y lanzas a todos los agentes (un agente no puede lanzar a otros). Los agentes te
devuelven ficheros y un resumen corto: las fuentes, los guiones, las capturas y las narraciones **no los lees**.

En cada brief, con rutas absolutas: la raíz del plugin (`${CLAUDE_PLUGIN_ROOT}`), la del proyecto, la de
`proyecto.md`, el entorno y el directorio de trabajo.

## 1. Preparación

- Sigue `${CLAUDE_PLUGIN_ROOT}/referencias/preparacion.md`; en ella, `<plugin>` es `${CLAUDE_PLUGIN_ROOT}`. Las
  extensiones, cuando sepas qué segmentos las usan (§4).
- Comprueba que está `pandoc` (`pandoc --version`). Si no, dile al usuario cómo instalarlo y para.
- Directorio de trabajo: `.sf-ui/resultados/documentacion/<AAAAMMDD-HHMM>-<slug>/`, que git ignora.

## 2. Ingesta

Lanza `ingesta-documentacion` (`subagent_type: sf-ui-skills:ingesta-documentacion`) con las fuentes tal como las dio
el usuario, el alcance con sus palabras, la audiencia y el nivel de detalle. Deja `guiones/<id>.md` y
`segmentos.json`. Lee **solo** `segmentos.json`.

## 3. Revisión por el usuario

Una sola tabla, una fila por segmento, con el lote que propones (§4):

| #   | Flujo                    | Rol        | Remite a | Variantes    | Lote               |
| --- | ------------------------ | ---------- | -------- | ------------ | ------------------ |
| T1  | Entrar en la consola     | agente     | —        | —            | 1                  |
| 1   | Atender un chat escalado | agente     | T1       | caso crítico | 2                  |
| 2   | Atender una llamada      | agente     | T1       | —            | no ejecutable: voz |

Debajo, lo relevante del resumen de la ingesta en pocas líneas, y una línea con lo que puede responder: «ok», o qué
sobra, falta, se parte o se une. **Espera su visto bueno.** Si corrige, relanza la ingesta (`SendMessage` al mismo
agente si sigue disponible) y vuelve a enseñar la tabla.

## 4. Plan y datos de demo

- Lotes según `${CLAUDE_PLUGIN_ROOT}/referencias/lotes.md`, con los `recursos` de `segmentos.json`. Usuario modelo:
  el del `rol` del segmento. Etiqueta de sesión: `D<id>`.
- **Datos de demo comunes**: siémbralos tú, una vez, antes del primer lote, según
  `${CLAUDE_PLUGIN_ROOT}/referencias/datos.md`, y déjalos en `<trabajo>/datos-demo.json`.

## 5. Documentación

Por cada lote, un `ui-documentador` por segmento ejecutable, en el mismo turno
(`subagent_type: sf-ui-skills:ui-documentador`, `model` explícito). Brief de cada uno:

- rol, username y etiqueta de sesión (fijos);
- rutas del guion, de `datos-demo.json` y de su carpeta de salida (`<trabajo>/segmentos/<id>/`);
- los registros que se gastan asignados a ese segmento y a cada variante;
- los transversales a los que remite, con su flujo;
- las variantes que el usuario dejó;
- la audiencia y el nivel de detalle.

Si uno vuelve **bloqueado**, resuélvelo o relánzalo antes del ensamblado; si vuelve **parcial** o con variantes sin
cubrir, sigue y díselo al usuario en la entrega.

## 6. Ensamblado

Lanza `ensamblador-documentacion` (`subagent_type: sf-ui-skills:ensamblador-documentacion`) con el directorio de
trabajo, la ruta de salida (la del usuario o `<trabajo>/manual.docx`), la plantilla si la dio, un título, la
audiencia y el nivel de detalle. Deja el Word, `manual.md`, `discrepancias.md` y `pendientes.md`.

## 7. Entrega

- **Limpia** los datos de demo según `datos.md`, y si hay `<trabajo>/restaurar.json`, devuelve cada valor.
- Comparte la ruta completa del documento y la de `discrepancias.md`, y ofrécele abrirlos.
- Si hubo plantilla, recuérdale que la portada (autor, fecha, código del documento) se completa a mano: `pandoc`
  hereda los estilos, no los marcadores.
- Resume las discrepancias (una línea cada una) y lo que quedó fuera o sin captura (`pendientes.md`). El documento
  cuenta lo que se ve: si la funcionalidad tiene un bug, sale en el documento y lo detecta él en las discrepancias.
- Las trampas que hayan apuntado los documentadores en `.sf-ui/lightning.local.js`: que las revise y las commitee.
