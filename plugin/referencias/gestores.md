# Gestores de issues: leer, etiquetar y subir capturas

Referencia de `/probar`. Cómo leer la HU, ver sus MR o PR, poner la etiqueta de probado y subir las capturas de
la evidencia, sin scripts del plugin: con `glab`, `gh` o `curl`.

## De dónde sale cada dato

Todo lo apunta `.sf-ui/proyecto.md`, en su sección «Desarrollo y gestor de issues»:

- el gestor: `gitlab`, `github`, `jira` o `ninguno`;
- GitLab y GitHub: el proyecto o repo (`grupo/proyecto`, `dueño/repo`), si no es el del directorio actual;
- Jira: la URL base (`https://<sitio>.atlassian.net`) y la clave del proyecto (`ABC`);
- el texto de la etiqueta de probado, por ejemplo `Probado dev`.

`glab` y `gh` usan su propio login. En Jira, el correo y el token van en `JIRA_EMAIL` y `JIRA_API_TOKEN` del entorno
del usuario. **Nunca imprimas el token**: ni `echo`, ni `env`, ni `curl -v`. Si falta, pídeselo al usuario y que lo
exporte él.

Solo escribe en el gestor (etiqueta, subida) en el cierre de `/probar`. Para explorar, solo lecturas.

## GitLab (`glab`)

Con `-R grupo/proyecto` si no estás en el repo. En `glab api`, `:fullpath` es el proyecto actual.

- Buscar por código funcional: `glab issue list --search "HU-205" -O json -P 20`.
- Leer: `glab issue view <iid> -F json` (título, `description`, `labels`).
- Comentarios: `glab api "projects/:fullpath/issues/<iid>/notes?sort=asc&per_page=100"`. Descarta los `system: true`.
- MR relacionadas: `glab api projects/:fullpath/issues/<iid>/related_merge_requests`.
  Rama: `source_branch`; último commit: `sha` (los 7 primeros).
- Etiqueta: `glab issue update <iid> --label "Probado dev"`. Si no existe, GitLab la crea.
- Captura: `glab api --method POST projects/:fullpath/uploads --form "file=@<ruta.png>"`.
  Devuelve `url` (relativa al proyecto) y `markdown`, que sirven en issues y MR del mismo proyecto.

## GitHub (`gh`)

Con `-R dueño/repo` si no estás en el repo.

- Buscar: `gh issue list --search "HU-205" --state all --json number,title,state,url`.
- Leer: `gh issue view <n> --json number,title,state,url,labels,body,comments`.
- PR relacionadas (las que la cierran o están en «Development»):
  `gh issue view <n> --json closedByPullRequestsReferences`, y por cada una
  `gh pr view <pr> --json number,title,state,url,body,headRefName,headRefOid`.
- Etiqueta: `gh` no la crea al ponerla. Primero `gh label create "Probado dev" --force --color 0E8A16`, luego
  `gh issue edit <n> --add-label "Probado dev"`.
- Captura: **no hay API** para subir imágenes. Deja las capturas en local y dile al usuario que las arrastre al
  comentario o a la descripción de la PR.

## Jira (`curl`, API REST v3)

Prefijo común (no lo imprimas expandido):
`curl -sS -u "$JIRA_EMAIL:$JIRA_API_TOKEN" -H "Accept: application/json" "<URL base>/rest/api/3/..."`.

- Buscar: `GET /search/jql?jql=<project = ABC AND text ~ "HU-205" ORDER BY updated DESC, codificado>&fields=summary,status&maxResults=20`.
- Leer: `GET /issue/<ABC-123>?fields=summary,status,labels,description,comment`.
  La descripción y los comentarios vienen en ADF (JSON): saca el texto de los nodos `text`.
- MR o PR relacionadas: la API REST no las da. Si la descripción o los comentarios enlazan una, léela con `glab` o
  `gh`; si no, busca la rama por la clave: `git branch -a --list "*ABC-123*"`.
- Etiqueta: sin espacios (`Probado-dev`).
  `PUT /issue/<clave>` con `-H "Content-Type: application/json" -d '{"update":{"labels":[{"add":"Probado-dev"}]}}'`.
- Captura: adjunto de la issue.
  `POST /issue/<clave>/attachments` con `-H "X-Atlassian-Token: no-check" -F "file=@<ruta.png>"`.
  Devuelve una lista; la URL es `content` del primero.

## Sin gestor (`ninguno`)

- La HU llega en un fichero (título en la primera línea) o pegada en la conversación. No hay búsqueda.
- No hay MR relacionadas: el diff es el de la rama actual.
- No se etiqueta. Las capturas se quedan en local, con rutas relativas a `evidencia.md`.

## Evidencias en markdown

Al cerrar, por cada `<resultados>/evidencias/<HU>/evidencia.md`:

1. sube cada `.png` que enlaza con el comando del gestor (en Jira, a la issue de esa carpeta);
2. cambia la ruta local por la URL devuelta en `![...](...)`;
3. junta las HU bajo `## Pruebas de usuario`, para la descripción de la MR o PR o un comentario de la issue.

Si una subida falla o el gestor no sube (GitHub, `ninguno`), deja la ruta local y avísalo en el resumen.
