# Datos de demo para /documentar

El padre siembra una vez, antes del primer lote, los datos comunes que piden las `precondiciones` de
`segmentos.json` (y las de las variantes que el usuario dejó), y los borra al final. Todo con el alias de admin del
entorno, que ya pasó la guarda.

## Sembrar

- **Todo en una llamada**, no registro a registro: un `sf data import tree --plan <plan.json> -o <alias> --json`
  para los relacionados (una cuenta con sus contactos y casos), o un Apex anónimo (`sf apex run --file <trabajo>/
  sembrar.apex -o <alias> --json`) que lo cree todo y escriba los ids con `System.debug`. Si un flow o un trigger
  tarda en dejar los registros listos, espera en un solo Bash (`for i in $(seq 1 24); do …; sleep 5; done`), no
  con una consulta por turno.
- Lo que tenga que ser de un usuario modelo (propietario, visibilidad), créalo como él (`-o <username>`) o
  asígnale el `OwnerId` al crearlo.
- **Nombres creíbles y ficticios**: personas, cuentas y asuntos que parezcan reales pero no lo sean, sin `QA` ni
  `prueba`. Correos en `@ejemplo.test`, cada uno en una sola cuenta. Documentos de identidad con letra válida y
  números bajos, que no son de nadie.
- Ningún dato real: no reutilices clientes ni casos existentes de la org.
- **Comprueba las precondiciones antes de lanzar**: consulta lo sembrado y míralo contra cada guion (el estado, el
  propietario, lo que una integración o un flow haya añadido al crear). Si algo no cumple, corrige la siembra (otro
  registro, otro valor) y, si no se puede, díselo al usuario. No lances a un documentador sabiendo que su punto de
  partida no es el del guion: lo descubre a mitad y lo repite entero.
- Las precondiciones con `uso: "gasta"` llevan un registro por segmento y variante; las de `"comparte"`, uno para
  todos. Lo que solo necesita un segmento lo siembra su documentador.

Apunta todo en `<trabajo>/datos-demo.json`, que es lo que leen los documentadores y lo que se limpia:

```json
{
  "datos": {
    "cliente": { "id": "001…", "nombre": "Lucía Ferrer Gil" },
    "segmentos": { "1": { "caso": { "id": "500…", "asunto": "No puedo acceder a mi cuenta" } } }
  },
  "creados": [{ "objeto": "Case", "id": "500…" }, { "objeto": "Account", "id": "001…" }]
}
```

## Limpiar

Al final, borra lo de `creados` en orden inverso (hijos antes que padres):
`sf data delete record -s <objeto> -i <id> -o <alias> --json`. Un `ENTITY_IS_DELETED` cuenta como borrado. Lo que no
se pueda borrar, díselo al usuario con su objeto e id.

Si `proyecto.md` dice que una integración necesita preparación propia (altas en otro sistema, valores prestados a
un usuario modelo), síguelo y apunta en `<trabajo>/restaurar.json` lo que haya que devolver a su valor al terminar.
