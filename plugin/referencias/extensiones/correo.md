# Extensión `correo`: el cliente por correo

El cliente se simula por API: se crea el caso como lo dejaría Email-to-Case, con su correo entrante, y a partir
de ahí corren de verdad los flows y triggers del proyecto. El agente trabaja por UI. Si el caso le llega por
Omni, sigue también `enrutado.md`. Todos los comandos van con `-o <alias>`, el alias del entorno.

## Qué hace falta de `proyecto.md`

Debajo de la tabla de entornos, en su apartado de correo:

- el **buzón** al que escribe el cliente (obligatorio);
- la **Org-Wide Address** desde la que responde el agente, si la hay;
- la **cola de entrada** (DeveloperName) y el **origen** del caso (por defecto, `Email`);
- otros **campos** que pone el Email-to-Case del proyecto;
- `<api>`: la versión de la API de `proyecto.md`;
- cuánto tarda un caso en llegar a quien lo atiende: cuéntalo en el presupuesto de tiempo.

## Antes de lanzar (el padre)

Solo si el agente **envía** correo, no si solo lo recibe:

- La org deja enviar: `echo 'Messaging.reserveSingleEmailCapacity(1);' | sf apex run -o <alias>`.
  Si falla, se activa a mano en Setup › Capacidad de entrega › «Todo el correo electrónico».
- El remitente existe y está verificado:
  `sf data query -o <alias> -q "SELECT IsVerified FROM OrgWideEmailAddress WHERE Address = '<remitente>'"`.
- Si algo falla, **para** y díselo al usuario. Si cambia la capacidad de entrega, que apunte el nivel que tenía
  para dejarlo igual al terminar. Si prefiere no activarlo, el envío sale NO CONCLUYENTE.
- Lo que envía el agente sale de verdad: los clientes de prueba llevan correos en `@ejemplo.test`.

## En la sesión (el agente, desde Bash)

1. Id de la cola: `sf data query -o <alias> -q "SELECT Id FROM Group WHERE Type = 'Queue' AND DeveloperName = '<cola>'"`.
2. Cuenta del cliente: busca `Account` con `IsPersonAccount = true AND PersonEmail = '<correo>'`. Solo si sale
   **una**, pon `AccountId` y `ContactId` (= `PersonContactId`), como el nativo.
3. Crea caso y correo en una sola petición, para que un flow asíncrono que lea el correo lo encuentre. Escribe
   `caso.json` en tu carpeta de trabajo:

   ```json
   { "records": [ { "attributes": { "type": "Case", "referenceId": "caso" },
     "Origin": "Email", "OwnerId": "<id cola>", "Subject": "<asunto>", "Description": "<cuerpo>",
     "SuppliedEmail": "marta.ibanez@ejemplo.test", "SuppliedName": "Marta Ibáñez",
     "EmailMessages": { "records": [ { "attributes": { "type": "EmailMessage", "referenceId": "correo" },
       "Incoming": true, "Status": "0", "FromAddress": "marta.ibanez@ejemplo.test", "FromName": "Marta Ibáñez",
       "ToAddress": "<buzón>", "Subject": "<asunto>", "TextBody": "<cuerpo>", "HtmlBody": "<p><cuerpo></p>",
       "MessageDate": "<ahora ISO>", "MessageIdentifier": "<1731500000.a1b2@ejemplo.test>",
       "ThreadIdentifier": "<el mismo>" } ] } } ] }
   ```

   `sf api request rest /services/data/v<api>/composite/tree/Case --method POST --body @caso.json -o <alias>`
   devuelve los ids de `caso` y `correo`. Añade los campos de `proyecto.md`.
4. **Entrega**: cada 5 s, hasta 3 min, `SELECT Owner.Name, Status FROM Case WHERE Id = '<caso>'`. Ha llegado
   cuando el propietario deja de ser la cola.
5. **Respuesta del agente**: cada 5 s, hasta 2 min,
   `SELECT Id, Subject, TextBody, ToAddress, MessageIdentifier, ThreadIdentifier FROM EmailMessage WHERE ParentId = '<caso>' AND Incoming = false ORDER BY CreatedDate`.
6. **El cliente contesta**: `POST /services/data/v<api>/sobjects/EmailMessage` con `ParentId`, `Incoming: true`,
   `Status: "0"`, un `MessageIdentifier` nuevo, el `ThreadIdentifier` del hilo,
   `ReplyToEmailMessageId` = el último correo, asunto `RE: …` y
   `Headers: "In-Reply-To: <id del último>\nReferences: <id del último>"`.
7. **Historial de partida** (un caso que empieza a mitad de hilo): el mismo POST con `Incoming: false`,
   `Status: "3"` y el remitente como `FromAddress`. No se envía.
8. **Limpiar**: `sf data delete record -o <alias> -s Case -i <caso>`; sus correos se van con él.

- No imprimas los cuerpos enteros si traen datos reales: basta el asunto y lo que compruebes.
- Lo interno del Email-to-Case nativo (asignación por dirección, respuesta automática, enhebrado por cabeceras de
  un correo real) no se reproduce así: es MANUAL.
- En la UI, lo que suele costar es el editor de correo del caso (va en iframes anidados y trae el original citado).
