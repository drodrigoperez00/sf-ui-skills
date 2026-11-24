#!/usr/bin/env node
// Sesión de navegador viva para manejar Lightning con bloques de código Playwright,
// sin arrancar Chromium ni cargar Lightning en frío en cada intento. Una sesión por
// etiqueta: varios agentes trabajan a la vez sin pisarse.
//   node <plugin>/scripts/sesion.js abrir    <alias> <username> <etiqueta> --client-id <id> --clave <ruta>
//   node <plugin>/scripts/sesion.js ejecutar <etiqueta> <fichero.js | ->
//   node <plugin>/scripts/sesion.js cerrar   <etiqueta>
// `abrir` comprueba con el alias de admin que la org es un sandbox, entra como el
// usuario modelo por JWT y deja vivo un servidor con un `page`; el token no sale
// de este proceso. El bloque es el cuerpo de una función async con `page`,
// `context`, `expect` (timeout de 5 s), `ui` (las funciones de
// .sf-ui/lightning.local.js, recargadas en cada bloque), `mem` (se conserva entre
// bloques) y `captura` (una captura con marcas numeradas). Devuelve `valor`, o el error con el árbol accesible de la página. La
// sesión se cierra sola tras 30 minutos sin uso. Se lanza desde la raíz del proyecto.
"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");

const RAIZ = process.cwd();
const DIR_ESTADO = path.join(RAIZ, ".sf-ui", ".estado");
const LOCAL = path.join(RAIZ, ".sf-ui", "lightning.local.js");
const TIMEOUT_ACCION_MS = 5_000;
const TIMEOUT_BLOQUE_MS = 180_000;
const INACTIVIDAD_MS = 30 * 60 * 1000;
const LOGIN_MS = 180_000;
const MAX_TEXTO = 4000;

const ficheroMeta = (etiqueta) => path.join(DIR_ESTADO, `sesion-${etiqueta}.json`);
const recortar = (t, max = MAX_TEXTO) =>
  t && t.length > max ? `${t.slice(0, max)}…[recortado]` : t;

// Nada de lo que se imprime lleva un token ni un frontdoor.
const sanear = (texto) =>
  String(texto)
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/([?&](?:sid|otp|oauth_token|access_token|startURL)=)[^&\s"]+/gi, "$1[oculto]")
    .replace(/00D[A-Za-z0-9]{12,15}(?:!|%21)[A-Za-z0-9._-]+/g, "[sesión oculta]");

function salir(objeto, codigo = 0) {
  process.stdout.write(`${sanear(JSON.stringify(objeto))}\n`);
  process.exit(codigo);
}

// sf con --json. Dos agentes a la vez pueden pisarse en ~/.sfdx: se reintenta una vez.
function sf(args) {
  for (let intento = 0; ; intento++) {
    const res = spawnSync(
      "sf",
      [...args, "--json"].map((a) => (/[\s"&|<>^()]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)),
      {
        shell: true,
        windowsHide: true,
        encoding: "utf8",
        timeout: 120_000,
        env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", SF_AUTOUPDATE_DISABLE: "true" }
      }
    );
    let json;
    try {
      json = JSON.parse(res.stdout);
    } catch {
      json = { status: 1, message: `sin respuesta JSON (código ${res.status})` };
    }
    if (json.status === 0) return json.result;
    if (intento) throw new Error(`sf ${args.slice(0, 3).join(" ")}: ${json.message}`);
    spawnSync(process.execPath, ["-e", "setTimeout(()=>{},2000)"]);
  }
}

// La guarda: el alias de admin es un sandbox, y el usuario modelo entra en esa misma org.
function guarda(alias) {
  const org = sf(["org", "display", "--target-org", alias]);
  const { records } = sf([
    "data", "query", "--target-org", alias, "--query", "SELECT IsSandbox FROM Organization"
  ]);
  if (!records.length || records[0].IsSandbox !== true)
    throw new Error(`GUARDA: ${alias} es una org de producción. No se ejecuta nada.`);
  return org;
}

function entrar(alias, username, clientId, clave) {
  const org = guarda(alias);
  if (!fs.existsSync(clave)) throw new Error(`Falta la clave JWT en ${clave}.`);
  sf([
    "org", "login", "jwt", "--client-id", clientId, "--jwt-key-file", clave,
    "--username", username, "--instance-url", org.instanceUrl
  ]);
  if (sf(["org", "display", "--target-org", username]).id !== org.id)
    throw new Error(`GUARDA: ${username} no está en la org de ${alias}. No se ejecuta nada.`);
  return sf(["org", "open", "--url-only", "--path", "/lightning/page/home", "--target-org", username]).url;
}

// El árbol accesible del modal abierto o, si no hay, del contenido principal.
async function foto(page) {
  const modal = page.locator('[role="dialog"][aria-modal="true"]:visible').last();
  const zona = (await modal.count()) ? modal : page.getByRole("main").filter({ visible: true }).first();
  return recortar(await zona.ariaSnapshot({ timeout: 5_000 }), 6000);
}

function cargarLocal() {
  if (!fs.existsSync(LOCAL)) return {};
  delete require.cache[LOCAL];
  try {
    return require(LOCAL);
  } catch (err) {
    throw new SyntaxError(`.sf-ui/lightning.local.js no carga: ${String(err.stack).split("\n")[0]} ${err.message}`);
  }
}

// Los logins de un mismo usuario, de uno en uno: varios frontdoor a la vez del mismo
// usuario se quedan colgados. Un cerrojo de más de LOGIN_MS es de un proceso muerto.
async function turnoDeLogin(username) {
  const cerrojo = path.join(DIR_ESTADO, `login-${username.replace(/[^\w.@-]/g, "_")}.lock`);
  for (const limite = Date.now() + 2 * LOGIN_MS; ; ) {
    try {
      fs.closeSync(fs.openSync(cerrojo, "wx"));
      return () => fs.rmSync(cerrojo, { force: true });
    } catch {
      const edad = Date.now() - (fs.statSync(cerrojo, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
      if (edad > LOGIN_MS) fs.rmSync(cerrojo, { force: true });
      else if (Date.now() > limite) throw new Error(`Otro login de ${username} no termina: mira .sf-ui/.estado/.`);
      else await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

// Recuadro rojo y número sobre cada marca, en una capa fija encima de la página: no
// toca los elementos (ni su shadow DOM ni el overflow de sus contenedores). El número,
// dentro del marco de la captura.
function pintarMarcas({ cajas, marco }) {
  const capa = document.createElement("div");
  capa.id = "sfui-marcas";
  Object.assign(capa.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: 2147483647 });
  for (const { x, y, width, height, n } of cajas) {
    const r = document.createElement("div");
    Object.assign(r.style, { position: "fixed", left: `${x - 3}px`, top: `${y - 3}px`, width: `${width + 6}px`,
      height: `${height + 6}px`, border: "3px solid #d4351c", borderRadius: "4px", boxSizing: "border-box" });
    const b = document.createElement("span");
    b.textContent = n;
    Object.assign(b.style, { position: "fixed", left: `${Math.max(marco.x, x - 14)}px`, top: `${Math.max(marco.y, y - 14)}px`,
      background: "#d4351c", color: "#fff", font: "bold 13px sans-serif", borderRadius: "50%", width: "22px",
      height: "22px", display: "flex", alignItems: "center", justifyContent: "center" });
    capa.append(r, b);
  }
  document.body.appendChild(capa);
}

// captura(ruta, { marcas, mask, zona }): `marcas` son locators, numerados en orden (o
// { locator, n }); `zona` recorta a un locator; `mask` tapa datos. Falla si una marca no
// se ve en la captura o si otro elemento la tapa (un desplegable abierto), en vez de dejar
// un recuadro a ciegas. Las marcas se quitan siempre.
// Si lo que hay en el centro de la parte visible del elemento es él o algo suyo, atravesando shadow DOM.
function encima(el) {
  const r = el.getBoundingClientRect();
  const x = (Math.max(r.left, 0) + Math.min(r.right, innerWidth)) / 2;
  const y = (Math.max(r.top, 0) + Math.min(r.bottom, innerHeight)) / 2;
  let h = document.elementFromPoint(x, y);
  while (h && h.shadowRoot) {
    const dentro = h.shadowRoot.elementFromPoint(x, y);
    if (!dentro || dentro === h) break;
    h = dentro;
  }
  for (let n = h; n; n = n.parentNode || n.host) if (n === el) return true;
  return false;
}

async function captura(page, ruta, { marcas = [], mask = [], zona } = {}) {
  const destino = path.resolve(RAIZ, ruta);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  // Un Locator también tiene `.locator` (una función): { locator, n } es el que no la tiene.
  const lista = marcas.map((m, i) =>
    typeof m.locator === "function" ? { locator: m, n: i + 1 } : { n: i + 1, ...m });
  if (lista.length) await lista[0].locator.scrollIntoViewIfNeeded();
  if (zona) await zona.scrollIntoViewIfNeeded();
  const marco = zona ? await zona.boundingBox() : { x: 0, y: 0, ...page.viewportSize() };
  const cajas = [];
  for (const { locator, n } of lista) {
    const c = await locator.boundingBox();
    const ancho = c && Math.min(marco.x + marco.width, c.x + c.width) - Math.max(marco.x, c.x);
    const alto = c && Math.min(marco.y + marco.height, c.y + c.height) - Math.max(marco.y, c.y);
    if (!c || ancho <= 0 || alto <= 0 || ancho * alto < (c.width * c.height) / 2)
      throw new Error(`captura: la marca ${n} no se ve en la captura. Desplázala a la vista o recorta con zona.`);
    if (!(await locator.evaluate(encima)))
      throw new Error(`captura: la marca ${n} está tapada por otro elemento (¿un desplegable abierto?). Ciérralo antes de capturar.`);
    cajas.push({ ...c, n });
  }
  try {
    if (cajas.length) await page.evaluate(pintarMarcas, { cajas, marco });
    await (zona || page).screenshot({ path: destino, animations: "disabled", caret: "hide", mask, maskColor: "#d8dde6" });
  } finally {
    await page.evaluate(() => document.getElementById("sfui-marcas")?.remove()).catch(() => {});
  }
  return path.relative(RAIZ, destino);
}

async function servidor(etiqueta, alias, username, clientId, clave) {
  const meta = ficheroMeta(etiqueta);
  let soltar = () => {};
  try {
    soltar = await turnoDeLogin(username);
    const url = entrar(alias, username, clientId, clave);
    const { chromium, expect } = require("@playwright/test");
    const navegador = await chromium.launch({
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]
    });
    const context = await navegador.newContext({
      viewport: { width: 1440, height: 900 },
      permissions: ["microphone"]
    });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT_ACCION_MS);
    page.setDefaultNavigationTimeout(60_000);
    await page.goto(url);
    await page.waitForURL(/\.lightning\.force\.com\/lightning\/|\/ChangePassword|\/_ui\/identity\//, { timeout: 90_000 });
    soltar();
    // Rutas relativas en page.goto («/lightning/r/Case/…»): contra el dominio en que entró.
    const origen = new URL(page.url()).origin;
    const irA = page.goto.bind(page);
    page.goto = (destino, opciones) => irA(new URL(destino, origen).href, opciones);
    const mem = {};
    const token = crypto.randomBytes(24).toString("hex");
    let cola = Promise.resolve();
    let temporizador;
    const cerrar = async () => {
      await navegador.close().catch(() => {});
      fs.rmSync(meta, { force: true });
      process.exit(0);
    };
    const reprogramar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(cerrar, INACTIVIDAD_MS);
    };

    async function ejecutar(codigo) {
      const inicio = Date.now();
      let respuesta;
      try {
        const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
        const fn = new AsyncFunction("page", "context", "expect", "ui", "mem", "captura", codigo);
        let limite;
        const valor = await Promise.race([
          fn(page, context, expect.configure({ timeout: TIMEOUT_ACCION_MS }), cargarLocal(), mem,
            (ruta, opciones) => captura(page, ruta, opciones)),
          new Promise((_, no) => {
            limite = setTimeout(() => no(new Error(`El bloque superó ${TIMEOUT_BLOQUE_MS / 1000} s.`)), TIMEOUT_BLOQUE_MS);
          })
        ]).finally(() => clearTimeout(limite));
        respuesta = {
          estado: "ok",
          valor: valor === undefined ? undefined : recortar(typeof valor === "string" ? valor : JSON.stringify(valor, null, 1))
        };
      } catch (err) {
        const mensaje = String(err && err.message ? err.message : err)
          .replace(/\u001b\[[0-9;]*m/g, "")
          .split("\n").filter((l) => !/^\s*at /.test(l)).join("\n");
        const deCodigo = err instanceof SyntaxError || err instanceof ReferenceError || err instanceof TypeError;
        respuesta = {
          estado: "error",
          error: recortar(mensaje, 1500),
          foto: deCodigo ? undefined : await foto(page).catch(() => undefined)
        };
      }
      return { ...respuesta, ms: Date.now() - inicio, url: new URL(page.url()).pathname };
    }

    const server = http.createServer((req, res) => {
      if (req.headers["x-token"] !== token) return res.writeHead(403).end();
      let cuerpo = "";
      req.on("data", (t) => (cuerpo += t));
      req.on("end", () => {
        reprogramar();
        const responder = (obj) => res.writeHead(200).end(sanear(JSON.stringify(obj)));
        if (req.url === "/estado") return responder({ estado: "ok" });
        if (req.url === "/cerrar") {
          responder({ estado: "cerrada" });
          return setTimeout(cerrar, 100);
        }
        cola = cola.then(() => ejecutar(JSON.parse(cuerpo || "{}").codigo || "")).then(responder);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const destino = new URL(page.url()).pathname;
      fs.writeFileSync(
        meta,
        JSON.stringify({ estado: "lista", puerto: server.address().port, token, username, destino }),
        { mode: 0o600 }
      );
      reprogramar();
    });
  } catch (err) {
    soltar();
    fs.writeFileSync(meta, JSON.stringify({ estado: "error", mensaje: sanear(err.message) }), { mode: 0o600 });
    process.exit(1);
  }
}

function peticion(info, ruta, cuerpo) {
  return new Promise((resolver, rechazar) => {
    const req = http.request(
      {
        host: "127.0.0.1", port: info.puerto, path: ruta, method: "POST",
        headers: { "x-token": info.token }, timeout: TIMEOUT_BLOQUE_MS + 30_000
      },
      (res) => {
        let datos = "";
        res.on("data", (t) => (datos += t));
        res.on("end", () => {
          try {
            resolver(JSON.parse(datos));
          } catch {
            rechazar(new Error(`Respuesta no válida de la sesión (${res.statusCode}).`));
          }
        });
      }
    );
    req.on("error", rechazar);
    req.on("timeout", () => req.destroy(new Error("La sesión no responde.")));
    req.end(cuerpo ? JSON.stringify(cuerpo) : undefined);
  });
}

async function sesionViva(etiqueta) {
  const meta = ficheroMeta(etiqueta);
  if (!fs.existsSync(meta)) return null;
  const info = JSON.parse(fs.readFileSync(meta, "utf8"));
  if (info.estado !== "lista") return null;
  try {
    await peticion(info, "/estado");
    return info;
  } catch {
    fs.rmSync(meta, { force: true });
    return null;
  }
}

async function abrir(etiqueta, alias, username, clientId, clave) {
  const viva = await sesionViva(etiqueta);
  if (viva) return { estado: "ok", etiqueta, username: viva.username, reutilizada: true };
  const meta = ficheroMeta(etiqueta);
  fs.mkdirSync(DIR_ESTADO, { recursive: true });
  fs.rmSync(meta, { force: true });
  const log = fs.openSync(path.join(DIR_ESTADO, `sesion-${etiqueta}.log`), "w");
  spawn(process.execPath, [__filename, "_servidor", etiqueta, alias, username, clientId, clave], {
    cwd: RAIZ, detached: true, windowsHide: true, stdio: ["ignore", log, log]
  }).unref();
  // Con otros logins del mismo usuario en cola, el arranque puede tardar varios turnos.
  for (const limite = Date.now() + 2 * LOGIN_MS + 30_000; Date.now() < limite; ) {
    await new Promise((r) => setTimeout(r, 500));
    if (!fs.existsSync(meta)) continue;
    const info = JSON.parse(fs.readFileSync(meta, "utf8"));
    if (info.estado === "error") throw new Error(info.mensaje);
    if (info.estado === "lista") {
      const respuesta = { estado: "ok", etiqueta, username };
      // Primer acceso o MFA: la sesión queda abierta en esa pantalla para resolverlo por la UI.
      if (!/^\/lightning\//.test(info.destino))
        respuesta.aviso = `Salesforce interrumpe el acceso en ${info.destino} (cambio de contraseña o MFA).`;
      return respuesta;
    }
  }
  throw new Error(`La sesión no arrancó a tiempo: mira .sf-ui/.estado/sesion-${etiqueta}.log.`);
}

const opcion = (args, nombre) => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : undefined;
};

if (require.main === module) {
  const [orden, ...args] = process.argv.slice(2);
  if (orden === "_servidor") {
    servidor(...args);
  } else {
    const ordenes = {
      abrir: () => {
        const [alias, username, etiqueta] = args;
        const clientId = opcion(args, "--client-id");
        const clave = opcion(args, "--clave");
        if (!etiqueta || etiqueta.startsWith("--") || !clientId || !clave) return null;
        return abrir(etiqueta, alias, username, clientId, path.resolve(clave.replace(/^~(?=\/|\\|$)/, require("os").homedir())));
      },
      ejecutar: async () => {
        const [etiqueta, origen = "-"] = args;
        if (!etiqueta) return null;
        const info = await sesionViva(etiqueta);
        if (!info) throw new Error(`No hay sesión abierta con la etiqueta ${etiqueta}.`);
        const codigo = fs.readFileSync(origen === "-" ? 0 : path.resolve(origen), "utf8");
        return peticion(info, "/ejecutar", { codigo });
      },
      cerrar: async () => {
        const [etiqueta] = args;
        if (!etiqueta) return null;
        const info = await sesionViva(etiqueta);
        if (!info) return { estado: "ok", mensaje: "No había sesión abierta." };
        return peticion(info, "/cerrar");
      }
    };
    const uso = () =>
      salir({
        estado: "error",
        mensaje: "Uso: sesion.js abrir <alias> <username> <etiqueta> --client-id <id> --clave <ruta> | ejecutar <etiqueta> <fichero.js | -> | cerrar <etiqueta>"
      }, 2);
    if (!ordenes[orden]) uso();
    Promise.resolve()
      .then(ordenes[orden])
      .then((r) => (r ? salir(r, r.estado === "error" ? 1 : 0) : uso()))
      .catch((err) => salir({ estado: "error", mensaje: err.message }, 1));
  }
}
