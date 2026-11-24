# Extensión `chat`: Messaging for In-App and Web

El cliente se simula con `curl` contra la API de MIAW; el agente atiende por UI en la consola. Un solo agente
maneja los dos lados. Un chat que escala llega por Omni: sigue también `enrutado.md`. Los comandos `sf` van con
`-o <alias>`, el alias del entorno.

## Qué hace falta de `proyecto.md`

Debajo de la tabla de entornos, en su apartado de chat: el **deployment** de tipo API (DeveloperName) y el **canal de
mensajería** sobre el que se crea. En el resto del fichero: el **horario** del canal y cómo habla el bot (cómo
saluda, qué pide para identificar al cliente, cómo avisa de que transfiere).

## Antes de lanzar (el padre)

1. **El deployment existe**: `sf org list metadata -o <alias> --metadata-type EmbeddedServiceConfig`. Si falta,
   copia `<plugin>/plantillas/metadata/chat/` a una carpeta temporal y:
   - cambia `{{DEPLOYMENT}}`, `{{CANAL}}`, `{{ETIQUETA}}` («<deployment> (API, pruebas)») y `{{VERSION_API}}`;
   - renombra `DEPLOYMENT.EmbeddedServiceConfig` a `<deployment>.EmbeddedServiceConfig`;
   - `sf project deploy start -o <alias> --metadata-dir <carpeta> --wait 30`.

   No lo redespliegues si ya existe: puede obligar a publicarlo otra vez.
2. **Acepta clientes**: pide un token y mira solo el código HTTP (la petición, en «En la sesión»):
   `curl -s -o /dev/null -w '%{http_code}' …`. Si no es 200, hay que publicarlo una vez a mano en Setup ›
   Implementaciones de servicio integrado › el deployment › Publicar. Díselo al usuario.
3. **Horario**: fuera del horario de `proyecto.md`, el bot no escalará; avisa antes de lanzar. Lo que dependa del
   escalado saldrá NO CONCLUYENTE.

## En la sesión (el agente, desde Bash)

- `ORG`: los 15 primeros caracteres de `SELECT Id FROM Organization`.
- `SCRT`: la `instanceUrl` (`sf org display -o <alias> --json | jq -r .result.instanceUrl`; nunca sin `--json`,
  que imprime el token de admin) con `.my.salesforce.com` cambiado por `.my.salesforce-scrt.com`.
- **Token de invitado**: no lo imprimas nunca. Cada llamada a Bash es un shell nuevo, así que guárdalo en un
  fichero `F=.sf-ui/.estado/chat-<etiqueta>.token` con permisos 600 (`umask 077`), que git ignora, léelo con `TOKEN=$(cat "$F")`
  y bórralo al terminar.

  ```bash
  curl -s "$SCRT/iamessage/api/v2/authorization/unauthenticated/access-token" -H 'Content-Type: application/json' \
    -d '{"orgId":"'$ORG'","esDeveloperName":"<deployment>","capabilitiesVersion":"1","platform":"Web",
         "context":{"appName":"sf_ui_pruebas","clientVersion":"1.0.0"}}' | jq -r .accessToken > "$F"
  ```
- **Eventos**, antes de abrir la conversación para no perder la bienvenida. Lánzalo en segundo plano:
  `curl -sN "$SCRT/eventrouter/v1/sse" -H "Authorization: Bearer $TOKEN" -H "X-Org-Id: $ORG" -H 'Accept: text/event-stream' > sse.log`.
- **Conversación**: `CONV=$(uuidgen | tr A-Z a-z)` y `POST $SCRT/iamessage/api/v2/conversation` con
  `{"conversationId":"$CONV","esDeveloperName":"<deployment>","routingAttributes":{}}` y el `Bearer`.
- **Mensaje**: `POST $SCRT/iamessage/api/v2/conversation/$CONV/message` con
  `{"message":{"id":"<uuid nuevo>","messageType":"StaticContentMessage","staticContent":{"formatType":"Text","text":"…"}},"esDeveloperName":"<deployment>","isNewMessagingSession":false}`.
- **Leer**: las líneas `event: CONVERSATION_MESSAGE` de `sse.log` y su `data:`, por ejemplo
  `sed -n 's/^data: *//p' sse.log | jq -r 'select(.conversationEntry) | .conversationEntry | "\(.sender.role) \(.senderDisplayName): \((.entryPayload | fromjson? | .abstractMessage.staticContent.text) // .entryType)"'`.
  Los roles son `EndUser` (el cliente), `Chatbot`, `Agent` y `System`. La encuesta y las opciones llegan como
  contenido estructurado, no como `text`. `CONVERSATION_PARTICIPANT_CHANGED` y `ROUTING_*` dicen quién entra.
  Espera cada respuesta sondeando el fichero (unos 30 s; al transferir, el bot puede salir sin escribir).
- **Cerrar**: `DELETE $SCRT/iamessage/api/v2/conversation/$CONV?esDeveloperName=<deployment>`, mata el `curl`
  del SSE y borra el fichero del token.

Pautas:

- **Cada mensaje contesta a lo último que dijo el bot.** Nunca mandes una lista fija de mensajes sin leer las
  respuestas: el bot suele ir con un modelo, así que no esperes textos exactos ni un número fijo de turnos.
- El cliente es un dato más: elígelo o créalo antes de abrir el chat. Si el bot le pide identificarse, que lo haga.
- Si escaló: `SELECT Id, Status, Owner.Name FROM MessagingSession WHERE Conversation.ConversationIdentifier = '<CONV>'`
  y su `PendingServiceRouting` (`WorkItemId` = la sesión).
- Lo que recibe el cliente se comprueba en `sse.log`, no en pantalla. Anota como observación lo raro del bot.
- Termina con el chat finalizado y el agente fuera de línea: un chat abierto ocupa su capacidad.
- Si el SSE no da eventos, no hay plan B probado: el criterio que dependa de leer al bot es MANUAL. (La API tiene
  `GET …/conversation/$CONV/entries`, que el plugin nunca usó; pruébalo solo si el usuario lo pide.)
- Lo que suele costar en la UI: aceptar en la bandeja de Omni y escribir en el compositor de la pestaña correcta.
