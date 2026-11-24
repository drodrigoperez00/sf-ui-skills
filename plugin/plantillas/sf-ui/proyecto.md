# Proyecto para /probar y /documentar

Las skills y los agentes de sf-ui-skills leen este fichero entero y lo pasan en cada brief. Es todo lo que tienen
del proyecto: la configuración y lo que un tester nuevo tendría que saber para no equivocarse. Escríbelo para
alguien que conoce Salesforce pero no el proyecto. Borra las secciones que no apliquen.

## Entornos

| Entorno | Alias de admin | clientId de la ECA | Idioma | Extensiones |
| ------- | -------------- | ------------------ | ------ | ----------- |
| dev     | mp-dev         | (lo rellena la preparación del sandbox) | es | — |

- **Clave JWT**: `~/.sf-ui/mi-proyecto/jwt.key`, fuera del repo. El certificado público, `jwt.crt`, al lado.
- **Prefijo** de la metadata de pruebas (ECA y permission set): `MP`.
- **Por defecto**: `dev`.
- **Versión de la API**: `66.0`.
- **Extensiones**: `chat`, `correo` y `enrutado` si el entorno los tiene preparados; sus datos (deployment de chat,
  dirección de Email-to-Case, colas), debajo de la tabla.

## Usuarios modelo

| Rol     | Username                        | Perfil            | Cuándo usarlo |
| ------- | ------------------------------- | ----------------- | ------------- |
| agente  | agente.pruebas@empresa.com.dev  | Perfil de agente  | La HU habla de «agente» u «operador». Permisos relevantes: … |

Un rol por fila. El rol es el nombre con el que lo citan los guiones y los briefs.

## Desarrollo y gestor de issues

- **Rama base** para el diff: `origin/main`. Manifest de la tarea, si se usa: `manifest/<rama>.xml`.
- **Gestor**: `gitlab`, `github`, `jira` o `ninguno`. Proyecto o repositorio: `grupo/proyecto`. En Jira, la URL
  base y la clave del proyecto.
- **Etiqueta de probado**: `Probado <entorno>`.
- Cómo se nombran las HU (código funcional frente al id del gestor) y qué pasa con la evidencia después (quién la
  sube, a dónde).

## Dominio

Quién usa la aplicación y con qué palabras habla de ella: roles, objetos principales y sus campos clave (con su
nombre de API), y cómo se traduce el lenguaje de las HU a los roles de arriba.

## Canales y horarios

Canales de entrada (chat, correo, teléfono…), su horario y qué pasa fuera de él. Cuánto tarda en llegar un caso o un
correo a quien lo atiende y qué automatización lo mueve.

## Integraciones

Sistemas externos y qué ve el usuario de cada uno. Para cada integración: si se simula, cómo, y qué datos de prueba
necesita (y cómo se restauran después).

## Qué es MANUAL

Lo que un agente no puede comprobar en el sandbox y queda como prueba manual (voz, SMS, sistemas sin entorno de
pruebas…).

## Datos de prueba

Convenciones para crear datos: prefijos, valores obligatorios que no salen en el page layout, registros que no se
deben tocar.
