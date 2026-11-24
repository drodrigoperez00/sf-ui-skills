# Extensión `enrutado`: Omni-Channel en un sandbox

Para lo que necesita al usuario modelo conectado a Omni-Channel o recibiendo trabajo enrutado: chats y casos que
llegan por Omni. Todos los comandos van con `-o <alias>`, el alias del entorno.

## Qué hace falta de `proyecto.md`

Debajo de la tabla de entornos, en su apartado de enrutado:

- las **colas** (DeveloperName) donde reciben trabajo los agentes modelo, y su **routing config**, si la hay;
- qué **usuarios modelo** atienden esas colas y qué compañeros del **equipo** también prueban a mano;
- el **estado** al que se pueden cancelar casos viejos y tras cuántos **minutos**. Si no lo dice, no se cancela
  nada: solo se avisa;
- los nombres de los **estados de presencia** («Disponible», «Fuera de línea»…), que son de cada org.

Sin apartado de enrutado, el proyecto reparte con otro sistema: `proyecto.md` dice cómo le llega el trabajo al
agente, y de aquí solo vale la comprobación de quién está conectado.

## Antes de lanzar (el padre)

1. **Quién está conectado**:
   `sf data query -o <alias> -q "SELECT User.Name, User.Username, ServicePresenceStatus.MasterLabel, StatusStartDate FROM UserServicePresence WHERE IsCurrentState = true"`.
   Si sale alguien que no es usuario modelo, podría llevarse el trabajo de la prueba. **Para**, enséñale la lista
   al usuario y no lances nada hasta que te diga que sigas.
2. **Colas**: `SELECT Id, DeveloperName, QueueRoutingConfigId FROM Group WHERE Type = 'Queue' AND DeveloperName IN (...)`.
   - Routing config: `sf data query --use-tooling-api -q "SELECT Id FROM QueueRoutingConfig WHERE DeveloperName = '<rc>'"`.
     Si un despliegue se la quitó a una cola: `sf data update record -s Group -i <cola> -v "QueueRoutingConfigId=<id>"`.
   - Miembros: `SELECT GroupId, UserOrGroupId FROM GroupMember WHERE GroupId IN (...)`. El que falte:
     `sf data create record -s GroupMember -v "GroupId=<cola> UserOrGroupId=<usuario>"`.
3. **Trabajo que ocupa capacidad**: Omni solo ofrece trabajo a un agente con capacidad libre.
   - Casos en cola: `SELECT Id, CaseNumber, Subject, LastModifiedDate FROM Case WHERE IsClosed = false AND OwnerId IN (<ids de cola>)`.
   - Abiertos por los modelo: `SELECT WorkItemId, Status, User.Username FROM AgentWork WHERE Status IN ('Assigned', 'Opened') AND User.Username IN (...)`.
   - Pendientes de enrutar: `SELECT WorkItemId, QueueId, IsReadyForRouting, CreatedDate FROM PendingServiceRouting WHERE QueueId IN (...)`.
   - Los que llevan más de los minutos de `proyecto.md` sin tocar pásalos a su estado con `sf data update record`.
     Los recientes pueden ser de otra persona: no los toques y avisa. Si al agente le llega uno de esos en vez del
     trabajo de la prueba, la prueba es NO CONCLUYENTE.

**En paralelo**: el estado de Omni es del usuario, no de la sesión. Dos agentes con el mismo usuario y trabajo
enrutado no van a la vez.

## En la sesión (el agente)

- Conecta al agente por UI justo antes de provocar el trabajo y desconéctalo al terminar, también si algo falla:
  un agente conectado sigue recibiendo trabajo de otras pruebas.
- Comprueba que quedó fuera de línea con la consulta de `UserServicePresence` de arriba, filtrada por su username:
  no debe salir.
- A quién se ofreció algo: `SELECT UserId, Status FROM AgentWork WHERE WorkItemId = '<id>'` y su
  `PendingServiceRouting`.
- **Limpiar**: borra o cierra el trabajo que hayas creado; un `AgentWork` «Assigned» sin aceptar le sigue ocupando
  capacidad al agente en la prueba siguiente.
- **Omni en la UI** (nombres en español; en inglés, entre paréntesis):
  - El botón de la barra de utilidades se llama «Omni-Channel» u «OmniCanal (Con conexión)», según el estado, y con
    trabajo pendiente empieza por «●»: búscalo con `getByRole("button", { name: /Omni-?Channel|OmniCanal/ })`, sin
    anclar. Si solo enseña un candado, Omni vive en la barra lateral de la consola: ábrela con «Conmutar barra
    lateral» («Toggle sidebar»).
  - El estado se cambia con el botón «Cambie su estado de OmniCanal» («Change your Omni-Channel status») y un
    `menuitem` con el nombre exacto del estado de `proyecto.md`. Comprueba el cambio en el texto del botón de Omni.
  - El trabajo entrante está en la pestaña «Bandeja de entrada (n)» («Inbox»): un `article` por elemento, con su
    botón «Aceptar» («Accept»).
  - Un `page.goto` recarga la consola y deja a Omni sin conexión: vuelve a ponerlo Disponible y espera unos segundos.
  - Si el agente ya estaba disponible antes de escalar, Omni puede no reofrecer el trabajo hasta pasar por fuera de
    línea y volver.
- **Si Omni no te deja llegar** al punto de partida (no consigues ponerte Disponible, el trabajo no llega) y lo que
  se prueba no es el enrutado, sino lo que viene después: pon el registro en su estado con admin (`sf data update
  record`: el propietario, el estado) y sigue por la UI desde ahí. Dilo en el informe. Si lo que se prueba es el
  propio enrutado, es NO CONCLUYENTE.
