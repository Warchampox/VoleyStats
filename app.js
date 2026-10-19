// VoleyStats — pantalla de captura (fase 2 del SPEC).
// Secciones: configuración · utilidades · datos · geometría · video ·
// deshacer · captura · render · teclado · diálogos · arranque.

'use strict';

// =====================================================================
// Configuración (teclas provisorias: se ajustan probando el prototipo)
// =====================================================================

const TECLAS = {
  reproducir: ' ',
  atras: 'arrowleft',
  adelante: 'arrowright',
  atrasLargo: 'j', // también Shift+←
  adelanteLargo: 'l', // también Shift+→
  silencio: 'm',
  foco: 'o', // entra y sale del modo foco
  jugador: 'n', // N y el número: asigna jugador; N N lo quita
  ayuda: '?',
  cuadroAtras: ',',
  cuadroAdelante: '.',
  nuevoRally: 'enter',
  cancelar: 'escape',
  cerrarSinAtaque: 'g',
  // 't' queda libre: la cobertura (recovery) se deduce sola tras un «rejugado»
  pasaLibre: 'f',
  recibeLibre: 'b',
  zaguero: 'z', // modificador en el clic de armada
  // 1–5: recepción, y defensa (en contraataque) en el paso de armada
  calificacion: { '1': '#', '2': '+', '3': '!', '4': '-', '5': '=' },
  armada: { q: 'primer', w: 'alta', e: 'rapida', r: 'pipe', a: 'emergencia', s: 'segunda' },
  golpe: { c: 'corto', v: 'largo' },
  resultado: { '1': 'punto', '2': 'error', '3': 'bloqueado', '4': 'pinchado', '5': 'rejugado', '6': 'defendido', '7': 'usaBloque' },
  ganador: { '1': 'propio', '2': 'rival' },
  // Cierre con G: 1/2 ganador genérico; 3–5 con motivo (el ganador se deduce)
  cierre: { '1': { gana: 'propio' }, '2': { gana: 'rival' }, '3': { motivo: 'ace' }, '4': { motivo: 'errorSaque' }, '5': { motivo: 'bloqueo' } },
};

// Teclas que pertenecen a la captura: si no aplican al paso actual, se avisa
const TECLAS_CAPTURA = new Set([
  TECLAS.nuevoRally, TECLAS.cancelar, TECLAS.cerrarSinAtaque, TECLAS.pasaLibre, TECLAS.recibeLibre, TECLAS.zaguero,
  ...Object.keys(TECLAS.calificacion), ...Object.keys(TECLAS.armada), ...Object.keys(TECLAS.golpe),
  ...Object.keys(TECLAS.resultado), ...Object.keys(TECLAS.cierre),
]);

const MOTIVOS = {
  ace: { nombre: 'Ace' },
  errorSaque: { nombre: 'Error de saque' },
  bloqueo: { nombre: 'Punto de bloqueo' },
};

const SALTO_SEGUNDOS = 3;
const SALTO_LARGO_SEGUNDOS = 10;
const CUADRO_SEGUNDOS = 1 / 30;
const VELOCIDADES = [0.25, 0.5, 1, 1.5, 2];

// Ángulo respecto a la banda: calle < 20°, diago 20°–50°, diago corta > 50°.
const UMBRALES_DIRECCION = { calle: 20, diago: 50 };

const CALIF = {
  '#': { nombre: 'perfecta', clase: 'calif-perfecta' },
  '+': { nombre: 'buena', clase: 'calif-buena' },
  '!': { nombre: 'regular', clase: 'calif-regular' },
  '-': { nombre: 'mala', clase: 'calif-mala' },
  '=': { nombre: 'error', clase: 'calif-error' },
};

const ARMADAS = {
  primer: { nombre: 'Primer tiempo', corto: '1er t.', variable: '--armada-primer' },
  alta: { nombre: 'Pelota alta', corto: 'Alta', variable: '--armada-alta' },
  rapida: { nombre: 'Rápida', corto: 'Rápida', variable: '--armada-rapida' },
  pipe: { nombre: 'Pipe', corto: 'Pipe', variable: '--armada-pipe' },
  // No las hace el armador en una jugada normal: van aparte en la distribución
  emergencia: { nombre: 'Emergencia', corto: 'Emerg.', variable: '--armada-emergencia', especial: true },
  segunda: { nombre: 'Segunda del armador', corto: '2da', variable: '--armada-segunda', especial: true },
};

const GOLPES = {
  remate: { nombre: 'Remate', corto: 'remate' },
  corto: { nombre: 'Toque corto', corto: 't. corto' },
  largo: { nombre: 'Toque largo', corto: 't. largo' },
};

// gana: 'scout' = gana el equipo scouteado, 'otro' = gana el contrario,
// null = el rally sigue.
const RESULTADOS = {
  punto: { nombre: 'Punto', gana: 'scout' },
  error: { nombre: 'Error', gana: 'otro' },
  bloqueado: { nombre: 'Bloqueado', gana: 'otro' },
  pinchado: { nombre: 'Pinchado', gana: null },
  rejugado: { nombre: 'Rejugado', gana: null },
  defendido: { nombre: 'Defendido', gana: null },
  usaBloque: { nombre: 'Usa el bloque', gana: 'scout' }, // block-out: pega en el bloque y sale
};

// Ataques que terminan en punto del equipo que ataca (punto directo o usa el bloque)
function esPuntoDeAtaque(res) {
  return !!res && RESULTADOS[res].gana === 'scout';
}

// Área normalizada 0–1 = 22 × 13 m (cancha 18 × 9 más 2 m de zona libre).
// x = 0 es el fondo detrás del equipo scouteado; la red queda en x = 0,5.
// y = 0 es la banda izquierda del equipo scouteado mirando a la red.
const AREA = { ancho: 22, alto: 13 };
const CANCHA = { x0: 2, x1: 20, y0: 2, y1: 11, red: 11, ataqueScout: 8, ataqueOtro: 14 };
const VB = 10; // unidades del viewBox por metro

// =====================================================================
// Utilidades
// =====================================================================

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function dos(n) { return String(n).padStart(2, '0'); }

// mm:ss,d (o h:mm:ss,d)
function fmtTiempo(t) {
  const decimas = Math.max(0, Math.round((t || 0) * 10));
  const d = decimas % 10;
  const seg = Math.floor(decimas / 10);
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
  return h ? `${h}:${dos(m)}:${dos(s)},${d}` : `${m}:${dos(s)},${d}`;
}

function fmtMinuto(t) {
  const seg = Math.max(0, Math.floor(t || 0));
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
  return h ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
function fmtFecha(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
}

function hoyIso() {
  const h = new Date();
  return `${h.getFullYear()}-${dos(h.getMonth() + 1)}-${dos(h.getDate())}`;
}

function fmtVelocidad(v) { return String(v).replace('.', ',') + '×'; }

function redondear(n, dec) { const f = 10 ** dec; return Math.round(n * f) / f; }

function colorVar(nombre) {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

function otro(equipo) { return equipo === 'propio' ? 'rival' : 'propio'; }

// =====================================================================
// Datos y localStorage
// =====================================================================

const CLAVE = 'voleystats';
const CLAVE_PREFS = 'voleystats:prefs';
const CLAVE_EQUIPOS = 'voleystats:equipos'; // planteles reutilizables por nombre de equipo

const POSICIONES = {
  armador: { nombre: 'Armador', corto: 'A' },
  central: { nombre: 'Central', corto: 'C' },
  punta: { nombre: 'Punta', corto: 'P' },
  opuesto: { nombre: 'Opuesto', corto: 'O' },
  libero: { nombre: 'Líbero', corto: 'L' },
};

// Acciones a las que se les puede asignar jugador
const ACCIONES_CON_JUGADOR = ['recepcion', 'defensa', 'ataque'];
// v2: los equipos son una entidad propia (almacen.equipos) y cada partido
// referencia los ids de sus dos equipos. Internamente cada partido sigue con
// dos lados, 'propio' (A) y 'rival' (B); la interfaz siempre muestra nombres.
const VERSION_DATOS = 2;
const CLAVE_RESPALDO_V1 = 'voleystats:respaldo-v1';

let almacen = { version: VERSION_DATOS, actual: null, partidos: {}, equipos: {} };
let prefs = { pausarAlMarcar: true, velocidad: 1, leyenda: false, silencio: false };

const LADOS = ['propio', 'rival'];

function nuevoId(prefijo) { return prefijo + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Busca un equipo por nombre o alias (sin mayúsculas ni tildes)
function buscarEquipo(texto, equipos = almacen.equipos) {
  const s = slug(texto || '');
  if (!s) return null;
  return Object.values(equipos).find((e) => slug(e.nombre) === s || (e.alias || []).some((a) => slug(a) === s)) || null;
}

function crearEquipo(nombreEquipo, equipos = almacen.equipos) {
  const e = { id: nuevoId('e'), nombre: nombreEquipo.trim(), alias: [], plantel: [] };
  equipos[e.id] = e;
  return e;
}

function equipoPorNombre(texto, equipos = almacen.equipos) {
  return buscarEquipo(texto, equipos) || crearEquipo(texto, equipos);
}

// Une planteles por número: lo que ya tiene el destino manda; completa nombre y posición
function unirPlantel(destino, origen) {
  for (const j of origen || []) {
    if (j.num == null || j.num === '') continue;
    const num = Number(j.num);
    const ya = destino.find((x) => x.num === num);
    if (!ya) destino.push({ ...j, num });
    else {
      if (!ya.nombre && j.nombre) ya.nombre = j.nombre;
      if (!ya.pos && j.pos) ya.pos = j.pos;
    }
  }
  destino.sort((a, b) => a.num - b.num);
  return destino;
}

// Asocia un partido a sus equipos (creándolos si no existen) y une su plantel al del equipo
function asociarEquipos(p, equipos = almacen.equipos) {
  p.equipoIds = p.equipoIds || {};
  p.equipos = p.equipos || {};
  for (const lado of LADOS) {
    let eq = p.equipoIds[lado] && equipos[p.equipoIds[lado]];
    if (!eq) eq = equipoPorNombre(p.equipos[lado] || (lado === 'propio' ? 'Equipo A' : 'Equipo B'), equipos);
    p.equipoIds[lado] = eq.id;
    p.equipos[lado] = eq.nombre;
    unirPlantel(eq.plantel, p.plantel && p.plantel[lado]);
  }
  return p;
}

// Cada cambio al formato agrega aquí su paso. Se usa al cargar localStorage y al importar.
function migrar(datos) {
  if (!datos || typeof datos !== 'object' || !datos.partidos) {
    return { version: VERSION_DATOS, actual: null, partidos: {}, equipos: {} };
  }
  if (!datos.equipos || typeof datos.equipos !== 'object') datos.equipos = {};
  for (const e of Object.values(datos.equipos)) {
    e.alias = Array.isArray(e.alias) ? e.alias : [];
    e.plantel = Array.isArray(e.plantel) ? e.plantel : [];
  }
  for (const id of Object.keys(datos.partidos)) {
    datos.partidos[id] = asociarEquipos(migrarPartido(datos.partidos[id]), datos.equipos);
  }
  datos.version = VERSION_DATOS;
  return datos;
}

function migrarPartido(p) {
  if (!p.version) p.version = 1;
  // Plantel agregado después de la primera versión: los partidos viejos parten vacíos
  if (!p.plantel) p.plantel = { propio: [], rival: [] };
  for (const st of p.sets) {
    if (!st.rotInicial) st.rotInicial = { propio: null, rival: null };
    if (!Array.isArray(st.correcciones)) st.correcciones = [];
  }
  // v1 → v2: los ids de equipo los pone asociarEquipos()
  if (p.version < 2) p.version = 2;
  return p;
}

function cargarAlmacen() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) {
      const datos = JSON.parse(crudo);
      const eraV1 = (datos.version || 1) < 2;
      // Antes de migrar, una copia exacta de los datos de la versión anterior
      if (eraV1 && !localStorage.getItem(CLAVE_RESPALDO_V1)) {
        try { localStorage.setItem(CLAVE_RESPALDO_V1, crudo); } catch (e) { /* sin espacio: se migra igual */ }
      }
      almacen = migrar(datos);
      if (eraV1) {
        migrarPlantelesConocidos();
        guardarSinAviso();
      }
    }
  } catch (e) { /* sin datos previos legibles */ }
  try {
    const p = localStorage.getItem(CLAVE_PREFS);
    if (p) prefs = { ...prefs, ...JSON.parse(p) };
  } catch (e) { /* preferencias por defecto */ }
}

// Los planteles recordados por nombre (clave vieja) pasan al plantel de cada equipo
function migrarPlantelesConocidos() {
  let conocidos = {};
  try { conocidos = JSON.parse(localStorage.getItem(CLAVE_EQUIPOS)) || {}; } catch (e) { conocidos = {}; }
  for (const c of Object.values(conocidos)) {
    if (!c || !c.nombre || !Array.isArray(c.jugadores)) continue;
    unirPlantel(equipoPorNombre(c.nombre).plantel, c.jugadores);
  }
  try { localStorage.removeItem(CLAVE_EQUIPOS); } catch (e) { /* no crítico */ }
}

function guardarSinAviso() {
  try { localStorage.setItem(CLAVE, JSON.stringify(almacen)); } catch (e) { /* se reintenta al guardar */ }
}

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(almacen));
    ui.guardadoEn = Date.now();
    ui.errorGuardado = false;
  } catch (e) {
    ui.errorGuardado = true;
  }
  renderGuardado();
}

function guardarPrefs() {
  try { localStorage.setItem(CLAVE_PREFS, JSON.stringify(prefs)); } catch (e) { /* no crítico */ }
}

function partido() { return almacen.partidos[almacen.actual] || null; }

// Lado A ('propio') y lado B ('rival'): nombres de equipo; si no existen, se crean
function crearPartido({ equipoA, equipoB, fecha, scouteado, competencia }) {
  const a = equipoPorNombre(equipoA), b = equipoPorNombre(equipoB);
  return {
    id: nuevoId('p'),
    version: VERSION_DATOS,
    creado: new Date().toISOString(),
    fecha,
    competencia: competencia || '',
    equipoIds: { propio: a.id, rival: b.id },
    equipos: { propio: a.nombre, rival: b.nombre }, // copia legible de los nombres
    scouteado,
    video: null,
    // copia del plantel de cada equipo (la referencia es el plantel del equipo)
    plantel: { propio: a.plantel.map((j) => ({ ...j })), rival: b.plantel.map((j) => ({ ...j })) },
    sets: [crearSet(1)],
  };
}

function crearSet(numero) {
  return {
    numero,
    primerSaque: null,
    rotInicial: { propio: null, rival: null },
    correcciones: [], // { equipo, desde (índice de rally), rot }
    rallies: [],
    final: null,
  };
}

function equipoDe(lado, p = partido()) {
  return (p && p.equipoIds && almacen.equipos[p.equipoIds[lado]]) || null;
}

function nombre(lado, p = partido()) {
  const eq = equipoDe(lado, p);
  return eq ? eq.nombre : (p && p.equipos && p.equipos[lado]) || (lado === 'propio' ? 'Equipo A' : 'Equipo B');
}

function setActual(p = partido()) { return p.sets[p.sets.length - 1]; }

function rallyAbierto(set) {
  const r = set.rallies[set.rallies.length - 1];
  return r && !r.gana ? r : null;
}

function marcadorTras(set) {
  const m = [0, 0];
  for (const r of set.rallies) {
    if (r.gana === 'propio') m[0]++;
    else if (r.gana === 'rival') m[1]++;
  }
  return m;
}

function setTerminado(set, m) {
  const meta = set.numero === 5 ? 15 : 25;
  return Math.max(m[0], m[1]) >= meta && Math.abs(m[0] - m[1]) >= 2;
}

function setsGanados(p) {
  const g = [0, 0];
  for (const s of p.sets) {
    if (!s.final) continue;
    if (s.final[0] > s.final[1]) g[0]++; else g[1]++;
  }
  return g;
}

function partidoTerminado(p) { const g = setsGanados(p); return g[0] >= 3 || g[1] >= 3; }

function sacaSiguiente(set) {
  const ultimo = set.rallies[set.rallies.length - 1];
  return ultimo ? ultimo.gana : set.primerSaque;
}

// Orden de rotación del armador: P1 → P6 → P5 → P4 → P3 → P2 → P1.
function rotar(rot) { return rot === 1 ? 6 : rot - 1; }

// La rotación se deriva: rotación inicial del set, un giro por cada side-out
// ganado por el equipo y las correcciones manuales (fijan la rotación del
// rally «desde»; desde ahí sigue rotando sola). Nada de esto se guarda por rally.
function rotacionEn(set, indice, equipo) {
  let rot = set.rotInicial[equipo];
  for (let i = 0; i <= indice; i++) {
    for (const c of set.correcciones) {
      if (c.equipo === equipo && c.desde === i) rot = c.rot;
    }
    if (i === indice) break;
    const r = set.rallies[i];
    if (rot && r && r.gana === equipo && r.saca !== equipo) rot = rotar(rot);
  }
  return rot;
}

function fueSideOut(r, equipo) { return r.gana === equipo && r.saca !== equipo; }

function indiceRallyVigente(set) {
  return rallyAbierto(set) ? set.rallies.length - 1 : set.rallies.length;
}

// Secuencias de un rally: cada una termina en un ataque con resultado
// o en un balón libre pasado al otro lado.
function cierraSecuencia(a) {
  return (a.tipo === 'ataque' && a.resultado) || a.tipo === 'pasaLibre';
}

function secuencias(r) {
  const res = [];
  let actual = [];
  for (const a of r.acciones) {
    if (a.tipo === 'saque') continue;
    actual.push(a);
    if (cierraSecuencia(a)) { res.push(actual); actual = []; }
  }
  if (actual.length) res.push(actual);
  return res;
}

// Fase de una armada según lo que pasó antes en el rally:
// tras recepción → 'recepcion'; tras un ataque propio «rejugado» → 'recovery'
// (se muestra como «Cobertura»); tras recibir libre → 'libre'; si no, 'contra'.
// Una defensa calificada no cambia la fase: se mira lo que hubo antes de ella.
// Las acciones 'recovery' de datos viejos (tecla T, ya eliminada) siguen valiendo.
function faseArmada(r, armada) {
  let i = r.acciones.indexOf(armada) - 1;
  if (r.acciones[i] && r.acciones[i].tipo === 'recepcion') return 'recepcion';
  while (i >= 0 && r.acciones[i].tipo === 'defensa') i--;
  const previa = r.acciones[i];
  if (!previa) return 'contra';
  if (previa.tipo === 'recovery') return 'recovery';
  if (previa.tipo === 'recibeLibre') return 'libre';
  if (previa.tipo === 'ataque' && previa.resultado === 'rejugado') return 'recovery';
  return 'contra';
}

// Primer contacto que da el pase de una armada: la recepción o la defensa justo antes
function contactoDeArmada(r, armada) {
  const previa = r.acciones[r.acciones.indexOf(armada) - 1];
  return previa && (previa.tipo === 'recepcion' || previa.tipo === 'defensa') ? previa : null;
}

// =====================================================================
// Geometría (lo calculado nunca se guarda)
// =====================================================================

function aMetros(p) { return [p[0] * AREA.ancho, p[1] * AREA.alto]; }
function aVB(p) { return [p[0] * AREA.ancho * VB, p[1] * AREA.alto * VB]; }

function tercio(y) { return y < 5 ? 0 : y < 8 ? 1 : 2; }

function zonaPunto(p) {
  const [x, y] = aMetros(p);
  const f = tercio(y);
  if (x <= CANCHA.red) return x >= CANCHA.ataqueScout ? [4, 3, 2][f] : [5, 6, 1][f];
  return x <= CANCHA.ataqueOtro ? [2, 3, 4][f] : [1, 6, 5][f];
}

function dentro(p) {
  const [x, y] = aMetros(p);
  return x >= CANCHA.x0 && x <= CANCHA.x1 && y >= CANCHA.y0 && y <= CANCHA.y1;
}

// Zona de ataque según la banda donde cae la armada. Es delantera (Z4/Z3/Z2)
// salvo que sea de zaguero: la pipe siempre, o una armada marcada con la tecla Z
// (Z5/Z6/Z1). La distancia a la red no cuenta. Se calcula, nunca se guarda.
function esZaguero(armada) { return armada.armada === 'pipe' || !!armada.zaguero; }

function zonaAtaque(armada) {
  const f = tercio(aMetros(armada.punto)[1]);
  return 'Z' + (esZaguero(armada) ? [5, 6, 1][f] : [4, 3, 2][f]);
}

function direccion(armada, ataque) {
  const [ax, ay] = aMetros(armada.punto);
  const [ix, iy] = aMetros(ataque.punto);
  const dx = ix - ax, dy = iy - ay;
  if (dx <= 0.3) return null;
  const ang = Math.atan2(Math.abs(dy), dx) * 180 / Math.PI;
  if (ang < UMBRALES_DIRECCION.calle) return 'calle';
  if (ang <= UMBRALES_DIRECCION.diago) return 'diago';
  return 'diago corta';
}

function destino(ataque) {
  if (aMetros(ataque.punto)[0] <= CANCHA.red) return null;
  return dentro(ataque.punto) ? 'Z' + zonaPunto(ataque.punto) : 'fuera';
}

// "diago, Z5"; con toque: "t. corto, diago, Z3"
function textoAtaque(armada, ataque, conGolpe = true) {
  const partes = [];
  if (conGolpe && ataque.golpe !== 'remate') partes.push(GOLPES[ataque.golpe].corto);
  const d = armada && direccion(armada, ataque);
  if (d) partes.push(d);
  const z = destino(ataque);
  if (z) partes.push(z);
  return partes.join(', ');
}

// Pares armada → ataque de un rally
function jugadas(r) {
  const res = [];
  r.acciones.forEach((a, i) => {
    if (a.tipo !== 'armada') return;
    const sig = r.acciones[i + 1];
    res.push({ armada: a, ataque: sig && sig.tipo === 'ataque' ? sig : null });
  });
  return res;
}

// =====================================================================
// Video: YouTube y archivo local detrás de una misma interfaz
// =====================================================================

let promesaApiYT = null;
function cargarApiYT() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (!promesaApiYT) {
    promesaApiYT = new Promise((resolver, rechazar) => {
      window.onYouTubeIframeAPIReady = resolver;
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { promesaApiYT = null; rechazar(new Error('api')); };
      document.head.appendChild(s);
    });
  }
  return promesaApiYT;
}

function idYouTube(texto) {
  const t = (texto || '').trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  try {
    const u = new URL(t.startsWith('http') ? t : 'https://' + t);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1, 12) || null;
    if (host.endsWith('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/);
      if (m) return m[2];
    }
  } catch (e) { /* no es URL */ }
  return null;
}

const Video = {
  fuente: null, // 'youtube' | 'local'
  yt: null,
  ytListo: false,
  el: null,
  urlObjeto: null,
  vel: 1,
  mudo: false,

  tiempo() {
    if (this.fuente === 'youtube' && this.ytListo) return this.yt.getCurrentTime() || 0;
    if (this.fuente === 'local') return this.el.currentTime || 0;
    return 0;
  },
  duracion() {
    if (this.fuente === 'youtube' && this.ytListo) return this.yt.getDuration() || 0;
    if (this.fuente === 'local') return this.el.duration || 0;
    return 0;
  },
  pausado() {
    if (this.fuente === 'youtube' && this.ytListo) {
      const e = this.yt.getPlayerState();
      return e !== YT.PlayerState.PLAYING && e !== YT.PlayerState.BUFFERING;
    }
    if (this.fuente === 'local') return this.el.paused;
    return true;
  },
  reproducir() {
    if (this.fuente === 'youtube' && this.ytListo) this.yt.playVideo();
    else if (this.fuente === 'local') this.el.play().catch(() => {});
  },
  pausar() {
    if (this.fuente === 'youtube' && this.ytListo) this.yt.pauseVideo();
    else if (this.fuente === 'local') this.el.pause();
  },
  alternar() { this.pausado() ? this.reproducir() : this.pausar(); },
  saltar(t) {
    const d = this.duracion();
    t = Math.max(0, d ? Math.min(t, d - 0.05) : t);
    if (this.fuente === 'youtube' && this.ytListo) {
      const estaba = this.pausado();
      this.yt.seekTo(t, true);
      // seekTo reproduce si el video estaba en "cued"; se respeta la pausa
      if (estaba) this.yt.pauseVideo();
      setTimeout(() => this.sinSubtitulos(), 400);
    } else if (this.fuente === 'local') {
      this.el.currentTime = t;
    }
  },
  mover(delta) { this.saltar(this.tiempo() + delta); },
  silenciar(mudo) {
    this.mudo = mudo;
    if (this.fuente === 'youtube' && this.ytListo) { if (mudo) this.yt.mute(); else this.yt.unMute(); }
    else if (this.fuente === 'local') this.el.muted = mudo;
  },
  velocidad(v) {
    this.vel = v;
    if (this.fuente === 'youtube' && this.ytListo) this.yt.setPlaybackRate(v);
    else if (this.fuente === 'local') this.el.playbackRate = v;
  },
  puedeCuadro() { return this.fuente === 'local'; },
  cuadro(dir) {
    if (!this.puedeCuadro()) return;
    this.el.pause();
    this.el.currentTime = Math.max(0, this.el.currentTime + dir * CUADRO_SEGUNDOS);
  },

  async cargarYouTube(id) {
    this.soltarLocal();
    this.fuente = 'youtube';
    await cargarApiYT();
    if (this.yt) {
      this.yt.getIframe().hidden = false;
      this.yt.cueVideoById(id);
      // Esperar a que YouTube cargue el video nuevo antes de permitir saltos
      for (let i = 0; i < 50; i++) {
        const datos = this.yt.getVideoData && this.yt.getVideoData();
        if (datos && datos.video_id === id && this.yt.getDuration() > 0) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      return;
    }
    this.ytListo = false;
    await new Promise((resolver, rechazar) => {
      this.yt = new YT.Player('yt-host', {
        videoId: id,
        playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1, modestbranding: 1, iv_load_policy: 3, fs: 0, cc_load_policy: 0 },
        events: {
          onReady: () => {
            this.ytListo = true;
            this.yt.getIframe().setAttribute('tabindex', '-1');
            this.velocidad(this.vel);
            this.silenciar(this.mudo);
            this.sinSubtitulos();
            resolver();
          },
          // YouTube vuelve a activar los subtítulos al reproducir si el usuario los tiene por defecto
          // y también los recarga tras un salto o una pausa: se apagan en cada cambio de estado
          onStateChange: () => this.sinSubtitulos(),
          onError: () => rechazar(new Error('video')),
        },
      });
    });
  },

  sinSubtitulos() {
    try { this.yt.unloadModule('captions'); this.yt.unloadModule('cc'); } catch (e) { /* sin módulo */ }
  },

  cargarArchivo(archivo) {
    if (this.fuente === 'youtube' && this.ytListo) { this.yt.pauseVideo(); this.yt.getIframe().hidden = true; }
    this.soltarLocal();
    this.fuente = 'local';
    this.urlObjeto = URL.createObjectURL(archivo);
    this.el.src = this.urlObjeto;
    this.el.hidden = false;
    this.el.playbackRate = this.vel;
    this.el.muted = !!this.mudo;
  },

  soltarLocal() {
    if (!this.el) return;
    this.el.pause();
    this.el.hidden = true;
    if (this.urlObjeto) { URL.revokeObjectURL(this.urlObjeto); this.urlObjeto = null; }
    this.el.removeAttribute('src');
  },
};

// =====================================================================
// Estado de la interfaz y deshacer
// =====================================================================

const ui = {
  guardadoEn: null,
  errorGuardado: false,
  vista: 'rally',
  modo: 'captura', // 'captura' | 'stats'
  cambiandoVideo: false,
  rallyPausado: null,
  aviso: null,
};

// Selecciones en curso que todavía no son una acción guardada.
let pendiente = nuevoPendiente();
function nuevoPendiente() {
  // puntoPara: punto directo { gana?, motivo? } pendiente de saber quién saca (primer rally del set)
  // zaguero: modificador Z del clic de armada
  return { armada: null, golpe: 'remate', zaguero: false, cerrar: false, elegirSaque: null, elegirRotacion: null, puntoPara: null };
}

const historial = [];
const MAX_HISTORIAL = 300;

function mutar(etiqueta, fn) {
  const p = partido();
  ui.aviso = null; // una acción válida reemplaza cualquier aviso pendiente
  historial.push({ id: p.id, json: JSON.stringify(p), pendiente: { ...pendiente }, etiqueta });
  if (historial.length > MAX_HISTORIAL) historial.shift();
  fn(p);
  guardar();
  render();
}

// El historial vive en memoria; al recargar la pestaña se conserva en
// sessionStorage para que Ctrl+Z siga funcionando después de un F5.
const CLAVE_HISTORIAL = 'voleystats:historial';
const MAX_HISTORIAL_SESION = 60;

function guardarHistorialSesion() {
  try {
    sessionStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(historial.slice(-MAX_HISTORIAL_SESION)));
  } catch (e) { /* sin espacio: se pierde solo el deshacer tras recargar */ }
}

function restaurarHistorialSesion() {
  try {
    const crudo = sessionStorage.getItem(CLAVE_HISTORIAL);
    sessionStorage.removeItem(CLAVE_HISTORIAL);
    const lista = crudo ? JSON.parse(crudo) : [];
    for (const h of lista) if (h && almacen.partidos[h.id]) historial.push(h);
  } catch (e) { /* historial ilegible: se parte vacío */ }
}

function deshacer() {
  const h = historial.pop();
  if (!h) { avisar('No hay nada que deshacer'); return; }
  almacen.partidos[h.id] = JSON.parse(h.json);
  almacen.actual = h.id;
  pendiente = h.pendiente;
  guardar();
  render();
}

function avisar(texto) {
  ui.aviso = { texto, hasta: Date.now() + 2500 };
  const pintar = () => (ui.modo === 'stats' ? renderAvisoStats() : renderEstado());
  pintar();
  setTimeout(pintar, 2600);
}

// =====================================================================
// Captura: máquina de estados derivada de los datos
// =====================================================================

function estado() {
  const p = partido();
  if (!p) return { modo: 'sinPartido' };
  const set = setActual(p);
  if (pendiente.elegirSaque) return { modo: 'elegirSaque', p, set };
  if (pendiente.elegirRotacion) return { modo: 'elegirRotacion', p, set };
  if (partidoTerminado(p)) return { modo: 'partidoTerminado', p, set };
  if (set.final) return { modo: 'setTerminado', p, set };
  const r = rallyAbierto(set);
  if (pendiente.cerrar) return { modo: 'cerrar', p, set, r };
  if (!r) return { modo: 'esperando', p, set };
  const ultima = r.acciones[r.acciones.length - 1];
  let modo;
  if (ultima.tipo === 'saque') modo = r.saca === p.scouteado ? 'armadaTipo' : 'recepcion';
  else if (ultima.tipo === 'armada') modo = 'golpe';
  else if (ultima.tipo === 'ataque' && !ultima.resultado) modo = 'resultado';
  else modo = 'armadaTipo';
  if (modo === 'armadaTipo' && pendiente.armada) modo = 'armadaClic';
  return { modo, p, set, r, ultima };
}

// En «Tipo de armada», si la acción anterior es una recepción o defensa sin
// posición, un clic en la cancha marca dónde queda el pase (opcional).
function puedeMarcarPase(e) {
  return e.modo === 'armadaTipo' && ['recepcion', 'defensa'].includes(e.ultima.tipo) && !e.ultima.punto;
}

// En contraataque (la acción anterior no es recepción ni defensa) 1–5 califica la defensa
function puedeCalificarDefensa(e) {
  return e.modo === 'armadaTipo' && !['recepcion', 'defensa'].includes(e.ultima.tipo);
}

function esModoClic(e) { return e.modo === 'armadaClic' || e.modo === 'golpe' || puedeMarcarPase(e); }

// "Pausar al marcar": la primera entrada de captura del rally pausa el video.
function alMarcar(set) {
  const clave = `${set.numero}-${set.rallies.length}`;
  if (prefs.pausarAlMarcar && ui.rallyPausado !== clave && !Video.pausado()) Video.pausar();
  ui.rallyPausado = clave;
}

function tiempoActual() { return redondear(Video.tiempo(), 1); }

// Ganador de un cierre con motivo: el ace lo gana quien saca, el error de saque
// quien recibe y el punto de bloqueo el equipo scouteado.
function ganadorPorMotivo(motivo, saca, scout) {
  if (motivo === 'ace') return saca;
  if (motivo === 'errorSaque') return otro(saca);
  return scout;
}

function etiquetaPunto(gana, motivo) {
  return motivo ? `${MOTIVOS[motivo].nombre} · gana ${nombre(gana)}` : `Punto ${nombre(gana)}`;
}

// Abre el rally y, si había un punto directo pendiente, lo cierra de inmediato
function abrirRallyPendiente(set, saca, t, scout) {
  const para = pendiente.puntoPara;
  abrirRally(set, saca, t);
  if (!para) return;
  // Compatibilidad: historiales de deshacer anteriores guardaban solo el equipo
  const { gana, motivo } = typeof para === 'string' ? { gana: para, motivo: null } : para;
  cerrarRally(set, set.rallies[set.rallies.length - 1], gana || ganadorPorMotivo(motivo, saca, scout), motivo);
}

// Punto sin jugada: un rally con solo el saque y su ganador (y motivo, si se dio).
// Marcador, saque y rotación se siguen derivando de los rallies como siempre.
function puntoDirecto(gana, motivo = null) {
  const e = estado();
  const { modo, p, set, r } = e;
  if (modo === 'sinPartido' || ui.modo === 'stats') return;
  if (['elegirSaque', 'elegirRotacion'].includes(modo)) { avisar('Primero termina de abrir el set'); return; }
  if (modo === 'setTerminado' || modo === 'partidoTerminado') { avisar('El set ya terminó: Enter abre el siguiente'); return; }
  const t = tiempoActual();
  if (r) {
    const g = gana || ganadorPorMotivo(motivo, r.saca, p.scouteado);
    mutar(etiquetaPunto(g, motivo), () => cerrarRally(set, r, g, motivo));
  } else if (!set.rallies.length && !set.primerSaque) {
    mutar(motivo ? MOTIVOS[motivo].nombre : `Punto ${nombre(gana)}`, () => {
      pendiente.elegirSaque = { t };
      pendiente.puntoPara = { gana, motivo };
    });
  } else {
    const saca = sacaSiguiente(set);
    const g = gana || ganadorPorMotivo(motivo, saca, p.scouteado);
    mutar(etiquetaPunto(g, motivo), () => {
      abrirRally(set, saca, t);
      cerrarRally(set, set.rallies[set.rallies.length - 1], g, motivo);
    });
  }
}

function abrirRally(set, saca, t) {
  set.rallies.push({
    saca,
    marcador: marcadorTras(set),
    t,
    acciones: [{ tipo: 'saque', equipo: saca, t }],
    gana: null,
  });
  pendiente = nuevoPendiente();
}

function cerrarRally(set, r, gana, motivo = null) {
  r.gana = gana;
  if (motivo) r.motivo = motivo;
  const m = marcadorTras(set);
  if (setTerminado(set, m)) set.final = m;
  pendiente = nuevoPendiente();
}

// Si la tecla es de captura pero no corresponde al paso actual, se avisa en el panel
function teclaCaptura(k) {
  if (ui.modo !== 'captura' || !partido()) return false;
  if (teclaCapturaPaso(k)) return true;
  if (TECLAS_CAPTURA.has(k)) {
    avisar(`Esa tecla no aplica ahora (${nombreTecla(k)}): estás en «${contenidoEstado(estado()).titulo}».`);
    return true;
  }
  return false;
}

function teclaCapturaPaso(k) {
  const e = estado();
  const { modo, p, set, r } = e;
  if (modo === 'sinPartido') return false;

  if (k === TECLAS.nuevoRally) {
    if (modo === 'esperando') {
      if (!Video.fuente) { avisar('Primero carga el video del partido'); return true; }
      const t = tiempoActual();
      if (!set.rallies.length && !set.primerSaque) {
        mutar('Nuevo rally', () => { pendiente.elegirSaque = { t }; });
      } else {
        mutar('Nuevo rally', () => abrirRally(set, sacaSiguiente(set), t));
      }
      return true;
    }
    if (modo === 'setTerminado') {
      const t = tiempoActual();
      mutar('Set nuevo', (pp) => { pp.sets.push(crearSet(set.numero + 1)); pendiente.elegirSaque = { t }; });
      return true;
    }
    return false;
  }

  if (modo === 'elegirSaque') {
    if (TECLAS.ganador[k]) {
      const saca = TECLAS.ganador[k];
      mutar(`Saca ${nombre(saca)}`, () => {
        const t = pendiente.elegirSaque.t;
        if (set.rotInicial[p.scouteado]) {
          set.primerSaque = saca;
          abrirRallyPendiente(set, saca, t, p.scouteado);
        } else {
          pendiente.elegirSaque = null;
          pendiente.elegirRotacion = { t, saca };
        }
      });
      return true;
    }
    if (k === TECLAS.cancelar) { mutar('Cancelar', () => { pendiente.elegirSaque = null; pendiente.puntoPara = null; }); return true; }
    return false;
  }

  if (modo === 'elegirRotacion') {
    const rot = Number(k);
    if (rot >= 1 && rot <= 6) {
      mutar(`Armador en P${rot}`, () => {
        const { t, saca } = pendiente.elegirRotacion;
        set.rotInicial[p.scouteado] = rot;
        set.primerSaque = saca;
        abrirRallyPendiente(set, saca, t, p.scouteado);
      });
      return true;
    }
    if (k === TECLAS.cancelar) { mutar('Cancelar', () => { pendiente.elegirRotacion = null; pendiente.puntoPara = null; }); return true; }
    return false;
  }

  if (modo === 'esperando' && k === TECLAS.cerrarSinAtaque) {
    mutar('Punto sin jugada', () => { pendiente.cerrar = true; });
    return true;
  }

  if (modo === 'cerrar') {
    const cierre = TECLAS.cierre[k];
    if (cierre) {
      if (r) alMarcar(set);
      pendiente.cerrar = false;
      puntoDirecto(cierre.gana || null, cierre.motivo || null);
      return true;
    }
    if (k === TECLAS.cancelar) { mutar('Cancelar', () => { pendiente.cerrar = false; }); return true; }
    return false;
  }

  if (!r) return false;

  if (k === TECLAS.cerrarSinAtaque && ['recepcion', 'armadaTipo', 'armadaClic'].includes(modo)) {
    alMarcar(set);
    mutar('Cerrar rally', () => { pendiente.cerrar = true; pendiente.armada = null; pendiente.zaguero = false; });
    return true;
  }

  if (modo === 'recepcion' && TECLAS.calificacion[k]) {
    const calif = TECLAS.calificacion[k];
    const t = tiempoActual();
    alMarcar(set);
    mutar(`Recepción ${calif}`, () => {
      r.acciones.push({ tipo: 'recepcion', equipo: p.scouteado, calif, t });
      if (calif === '=') cerrarRally(set, r, otro(p.scouteado));
    });
    return true;
  }

  if (puedeCalificarDefensa(e) && TECLAS.calificacion[k]) {
    const calif = TECLAS.calificacion[k];
    const t = tiempoActual();
    alMarcar(set);
    mutar(`Defensa ${calif}`, () => { r.acciones.push({ tipo: 'defensa', equipo: p.scouteado, calif, t }); });
    return true;
  }

  if ((modo === 'armadaTipo' || modo === 'armadaClic') && TECLAS.armada[k]) {
    const tipo = TECLAS.armada[k];
    alMarcar(set);
    mutar(`Tipo ${ARMADAS[tipo].corto.toLowerCase()}`, () => { pendiente.armada = tipo; });
    return true;
  }

  if (modo === 'armadaClic' && k === TECLAS.zaguero) {
    if (pendiente.armada === 'pipe') { avisar('La pipe ya es ataque de zaguero.'); return true; }
    mutar(pendiente.zaguero ? 'Quitar zaguero' : 'Zaguero', () => { pendiente.zaguero = !pendiente.zaguero; });
    return true;
  }

  if (modo === 'armadaTipo' && k === TECLAS.pasaLibre) {
    const t = tiempoActual();
    alMarcar(set);
    mutar('Pasa libre', () => { r.acciones.push({ tipo: 'pasaLibre', equipo: p.scouteado, t }); });
    return true;
  }

  if (modo === 'armadaTipo' && k === TECLAS.recibeLibre) {
    if (e.ultima.tipo === 'recibeLibre') return true;
    const t = tiempoActual();
    alMarcar(set);
    mutar('Recibe libre', () => { r.acciones.push({ tipo: 'recibeLibre', equipo: p.scouteado, t }); });
    return true;
  }

  if (modo === 'armadaClic' && k === TECLAS.cancelar) {
    mutar('Cambiar tipo', () => { pendiente.armada = null; pendiente.zaguero = false; });
    return true;
  }

  if (modo === 'golpe') {
    if (TECLAS.golpe[k]) {
      const g = TECLAS.golpe[k];
      alMarcar(set);
      mutar(GOLPES[g].nombre, () => { pendiente.golpe = pendiente.golpe === g ? 'remate' : g; });
      return true;
    }
    if (k === TECLAS.cancelar) {
      if (pendiente.golpe !== 'remate') {
        mutar('Remate', () => { pendiente.golpe = 'remate'; });
      } else {
        mutar('Volver al tipo', () => { r.acciones.pop(); pendiente.armada = null; });
      }
      return true;
    }
  }

  if (modo === 'resultado' && TECLAS.resultado[k]) {
    const res = TECLAS.resultado[k];
    alMarcar(set);
    mutar(RESULTADOS[res].nombre, () => {
      e.ultima.resultado = res;
      const g = RESULTADOS[res].gana;
      if (g === 'scout') cerrarRally(set, r, p.scouteado);
      else if (g === 'otro') cerrarRally(set, r, otro(p.scouteado));
      else pendiente = nuevoPendiente();
    });
    return true;
  }

  return false;
}

function clicCancha(punto) {
  const e = estado();
  const { modo, p, set, r } = e;
  if (!esModoClic(e)) return;
  const t = tiempoActual();
  alMarcar(set);
  if (puedeMarcarPase(e)) {
    mutar('Posición del pase', () => { e.ultima.punto = punto; });
  } else if (modo === 'armadaClic') {
    const tipo = pendiente.armada;
    const zaguero = pendiente.zaguero && tipo !== 'pipe';
    mutar(`Armada ${ARMADAS[tipo].corto.toLowerCase()}`, () => {
      const armada = { tipo: 'armada', equipo: p.scouteado, armada: tipo, punto, t };
      if (zaguero) armada.zaguero = true;
      r.acciones.push(armada);
      pendiente.armada = null;
      pendiente.zaguero = false;
      pendiente.golpe = 'remate';
    });
  } else {
    const golpe = pendiente.golpe;
    mutar(GOLPES[golpe].nombre, () => {
      r.acciones.push({ tipo: 'ataque', equipo: p.scouteado, golpe, punto, t, resultado: null });
      pendiente.golpe = 'remate';
    });
  }
}

function corregirRotacion(rot) {
  const p = partido();
  if (!p) return;
  const set = setActual(p);
  const equipo = p.scouteado;
  const desde = indiceRallyVigente(set);
  mutar(`Rotación P${rot}`, () => {
    set.correcciones = set.correcciones.filter((c) => !(c.equipo === equipo && c.desde === desde));
    if (desde === 0) { set.rotInicial[equipo] = rot; return; }
    // Solo se guarda si difiere de lo que da la rotación automática
    if (rotacionEn(set, desde, equipo) === rot) return;
    set.correcciones.push({ equipo, desde, rot });
    set.correcciones.sort((a, b) => a.desde - b.desde);
  });
}

// =====================================================================
// Render
// =====================================================================

function render() {
  renderCabecera();
  renderMarcador();
  renderEstado();
  renderCancha();
  renderHistorial();
  renderAnteriores();
  renderCargaVideo();
  renderControles();
  renderJugadores();
  if (ui.modo === 'stats') renderStats();
  if (ui.modo === 'equipos') renderEquipos();
}

// Primero el equipo scouteado
function tituloPartido(x = partido()) {
  return x ? `${nombre(x.scouteado, x)} vs ${nombre(otro(x.scouteado), x)} · ${fmtFecha(x.fecha)}` : 'Sin partido';
}

function renderCabecera() {
  $('partido-info').textContent = tituloPartido();
}

function renderGuardado() {
  const el = $('guardado');
  el.classList.toggle('falla', ui.errorGuardado);
  if (ui.errorGuardado) { el.textContent = 'No se pudo guardar · almacenamiento lleno'; return; }
  if (!ui.guardadoEn) { el.textContent = partido() ? 'Guardado en este equipo' : ''; return; }
  const s = Math.round((Date.now() - ui.guardadoEn) / 1000);
  const hace = s < 60 ? `hace ${s} s` : s < 3600 ? `hace ${Math.floor(s / 60)} min` : `hace ${Math.floor(s / 3600)} h`;
  el.textContent = `Guardado en este equipo · ${hace}`;
}

function renderMarcador() {
  const p = partido();
  if (!p) {
    for (const id of ['tanteo', 'chips-rotacion', 'marcador-linea', 'menu-marcador']) $(id).innerHTML = '';
    $('sub-marcador').textContent = '';
    return;
  }
  const set = setActual(p);
  const r = rallyAbierto(set);
  const m = r ? r.marcador : marcadorTras(set);
  const saca = r ? r.saca : (set.final ? null : sacaSiguiente(set));
  const g = setsGanados(p);
  const punto = (eq) => (saca === eq ? '<span class="punto-saque"></span>' : '');
  $('tanteo').innerHTML =
    `<span class="equipo" title="${esc(nombre('propio'))}">${punto('propio')}${esc(nombre('propio'))}</span>` +
    `<span class="num">${m[0]}</span><span class="guion">–</span><span class="num">${m[1]}</span>` +
    `<span class="equipo" title="${esc(nombre('rival'))}">${punto('rival')}${esc(nombre('rival'))}</span>`;
  $('sub-marcador').textContent = `Set ${set.numero} · sets ${g[0]}–${g[1]}`;
  // Menú del marcador: sumar un punto sin jugada (G sigue funcionando igual)
  $('menu-marcador').innerHTML = ['propio', 'rival'].map((eq) =>
    `<button data-punto="${eq}">+1 ${esc(nombre(eq))} <span class="tenue">· sin jugada</span></button>`).join('');

  $('rot-titulo').textContent = `Armador ${nombre(p.scouteado)}`;
  const rot = rotacionEn(set, indiceRallyVigente(set), p.scouteado);
  $('chips-rotacion').innerHTML = [1, 2, 3, 4, 5, 6]
    .map((n) => `<button data-rot="${n}" class="${rot === n ? 'activo' : ''}" title="Corregir: armador en P${n}">P${n}</button>`).join('');
  // Modo foco: el marcador en una sola línea
  $('marcador-linea').innerHTML = `<b>${m[0]}–${m[1]}</b>&ensp;${saca ? `saca ${esc(nombre(saca))}, ` : ''}set ${set.numero}` +
    (rot ? `, armador <b>P${rot}</b>` : '');
}

function kbd(tecla, principal = false) {
  return `<kbd class="${principal ? 'principal' : ''}">${esc(tecla)}</kbd>`;
}

function califBadge(c) { return `<span class="calif ${CALIF[c].clase}">${esc(c)}</span>`; }

function muestra(tipo) { return `<span class="muestra" style="background:var(${ARMADAS[tipo].variable})"></span>`; }

function mira(color) {
  return `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6" fill="none" stroke="${color}" stroke-width="1.8"/><path d="M10 0v5M10 15v5M0 10h5M15 10h5" stroke="${color}" stroke-width="1.8"/></svg>`;
}

function nombreTecla(k) {
  return ({ ' ': 'Espacio', enter: 'Enter', escape: 'Esc', arrowleft: '←', arrowright: '→' }[k]) || k.toUpperCase();
}

function teclaDe(mapa, valor) { return Object.keys(mapa).find((k) => mapa[k] === valor).toUpperCase(); }

function rallyMostrado(set) {
  return set.rallies[set.rallies.length - 1] || null;
}

// Contenido del panel «Ahora»: título, una línea de contexto, las teclas
// principales del paso (2 columnas, 3 si hay más de 6) y una línea secundaria.
function principal(tecla, texto, extra = '', activa = false) {
  return { tecla, texto, extra, activa };
}

function secundaria(teclas, texto, activa = false) {
  return { teclas: [].concat(teclas), texto, activa };
}

// Distancia del pase a la red, en palabras
function textoPase(punto) {
  const d = CANCHA.red - aMetros(punto)[0];
  if (d <= 1.5) return 'cerca de la red';
  if (d <= 3) return 'a media distancia de la red';
  return 'lejos de la red';
}

function contenidoEstado(e) {
  const p = e.p;
  const deshacer = historial.length ? secundaria('Ctrl+Z', `deshacer «${historial[historial.length - 1].etiqueta}»`) : null;
  const scoutNom = p ? nombre(p.scouteado) : '';
  // Orden del diseño en 2 columnas: Q W E a la izquierda, A S R a la derecha
  const ORDEN_TIPOS = ['primer', 'emergencia', 'alta', 'segunda', 'rapida', 'pipe'];
  const tiposArmada = (activo = null) => Object.entries(TECLAS.armada)
    .sort((a, b) => ORDEN_TIPOS.indexOf(a[1]) - ORDEN_TIPOS.indexOf(b[1]))
    .map(([k, t]) => principal(k.toUpperCase(), ARMADAS[t].nombre === 'Segunda del armador' ? 'Segunda' : ARMADAS[t].nombre === 'Pelota alta' ? 'Alta' : ARMADAS[t].nombre, muestra(t), activo === t));
  const base = { tipo: 'tecla', titulo: '', contexto: '', principales: [], secundarias: [] };

  switch (e.modo) {
    case 'sinPartido':
      return { ...base, tipo: '', titulo: 'Crea el partido', contexto: 'Equipos, fecha y equipo scouteado.' };

    case 'esperando': {
      if (!Video.fuente) {
        return { ...base, tipo: 'video', titulo: 'Carga el video', contexto: 'Link de YouTube o archivo local, en el panel del video.',
          secundarias: [secundaria(nombreTecla(TECLAS.cerrarSinAtaque), 'punto sin jugada')] };
      }
      const set = e.set;
      const ultimo = rallyMostrado(set);
      const rot = rotacionEn(set, set.rallies.length, p.scouteado);
      const rotTxt = rot ? `armador en P${rot}` : 'fija la rotación con P1–P6';
      const sec = [secundaria(nombreTecla(TECLAS.cerrarSinAtaque), 'punto sin jugada'), deshacer].filter(Boolean);
      if (!ultimo) {
        return { ...base, titulo: `Listo para el set ${set.numero}`,
          contexto: `Enter marca el saque del primer rally. ${rot ? 'Revisa: ' + rotTxt : 'Antes, ' + rotTxt}.`,
          principales: [principal('Enter', 'Nuevo rally', '', true)], secundarias: sec };
      }
      const n = set.rallies.length;
      const giro = rot && fueSideOut(ultimo, p.scouteado) ? `Side-out: el armador pasa a P${rot}. ` : '';
      return { ...base,
        titulo: ultimo.motivo ? `Rally ${n} · ${MOTIVOS[ultimo.motivo].nombre.toLowerCase()}, punto ${nombre(ultimo.gana)}` : `Rally ${n} cerrado · punto ${nombre(ultimo.gana)}`,
        contexto: `${giro}Saca ${nombre(sacaSiguiente(set))}${giro ? '' : ', ' + rotTxt}.`,
        principales: [principal('Enter', `Nuevo rally ${n + 1} en el segundo actual`, '', true)], secundarias: sec };
    }

    case 'elegirSaque':
      return { ...base, titulo: '¿Quién saca el primer rally?',
        contexto: `Set ${e.set.numero} · el rally parte en ${fmtTiempo(pendiente.elegirSaque.t)}.`,
        principales: [principal('1', nombre('propio')), principal('2', nombre('rival'))],
        secundarias: [secundaria('Esc', 'cancelar')] };

    case 'elegirRotacion':
      return { ...base, titulo: `¿Dónde parte el armador?`,
        contexto: `${scoutNom} · rotación inicial del set ${e.set.numero}. Después rota sola en cada side-out.`,
        principales: [1, 2, 3, 4, 5, 6].map((n) => principal(String(n), `P${n}`)),
        secundarias: [secundaria('Esc', 'cancelar')] };

    case 'setTerminado': {
      const f = e.set.final;
      return { ...base, titulo: `Set ${e.set.numero} terminado · ${f[0]}–${f[1]}`,
        contexto: `Enter abre el set ${e.set.numero + 1}.`,
        principales: [principal('Enter', 'Set nuevo', '', true)], secundarias: [deshacer].filter(Boolean) };
    }

    case 'partidoTerminado': {
      const g = setsGanados(p);
      return { ...base, tipo: '', titulo: `Partido terminado · ${g[0]}–${g[1]}`,
        contexto: 'Ctrl+Z deshace el último punto si hace falta corregir.', secundarias: [deshacer].filter(Boolean) };
    }

    case 'cerrar': {
      const saca = e.r ? e.r.saca : sacaSiguiente(e.set);
      return { ...base, titulo: e.r ? '¿Quién gana el rally?' : '¿Quién gana el punto?',
        contexto: e.r ? `Cierra el rally sin otro ataque del ${scoutNom}; 3–5 guardan el motivo.` : 'Suma el punto sin jugada; 3–5 guardan el motivo.',
        principales: [
          principal('1', nombre('propio')),
          principal('2', nombre('rival')),
          principal('3', saca ? `Ace · ${nombre(saca)}` : 'Ace'),
          principal('4', saca ? `Err. saque · ${nombre(saca)}` : 'Error de saque'),
          principal('5', `Bloqueo · ${scoutNom}`),
        ],
        secundarias: [secundaria('Esc', 'cancelar')] };
    }

    case 'recepcion': {
      const saque = e.r.acciones[0];
      return { ...base, titulo: 'Calificar recepción',
        contexto: `${scoutNom} recibe el saque de ${nombre(saque.equipo)} (${fmtTiempo(saque.t)}).`,
        principales: Object.entries(TECLAS.calificacion).map(([k, c]) => principal(k, CALIF[c].nombre, califBadge(c))),
        secundarias: [secundaria(nombreTecla(TECLAS.cerrarSinAtaque), 'cerrar rally (ace, error de saque…)')] };
    }

    case 'armadaTipo': {
      const ult = e.ultima;
      const pase = puedeMarcarPase(e);
      const defensa = puedeCalificarDefensa(e);
      let fase;
      if (ult.tipo === 'recepcion') fase = `${scoutNom} recibió ${ult.calif}${ult.punto ? ' con el pase ' + textoPase(ult.punto) : ''}`;
      else if (ult.tipo === 'defensa') fase = `Defensa ${ult.calif}${ult.punto ? ' con el pase ' + textoPase(ult.punto) : ''}`;
      else if (ult.tipo === 'recovery') fase = 'Cobertura';
      else if (ult.tipo === 'recibeLibre') fase = 'Balón libre recibido';
      else if (ult.tipo === 'pasaLibre') fase = 'Pasó libre: la siguiente armada es contraataque';
      else if (ult.tipo === 'saque') fase = `Saca ${scoutNom}: la siguiente armada es contraataque`;
      else if (ult.resultado === 'rejugado') fase = 'Cobertura tras «rejugado»';
      else fase = `Contraataque tras «${RESULTADOS[ult.resultado].nombre.toLowerCase()}»`;
      return { ...base, tipo: pase ? 'tecla o clic opcional' : 'tecla', titulo: 'Tipo de armada',
        contexto: fase + (pase ? ' · clic donde queda el pase (opcional)' : ''),
        principales: tiposArmada(),
        secundarias: [
          defensa ? secundaria(['1', '5'], 'defensa') : null,
          secundaria([nombreTecla(TECLAS.pasaLibre), nombreTecla(TECLAS.recibeLibre)], 'balón libre'),
          secundaria(nombreTecla(TECLAS.cerrarSinAtaque), 'cerrar rally'),
        ].filter(Boolean) };
    }

    case 'armadaClic': {
      const tipo = pendiente.armada;
      const color = colorVar(ARMADAS[tipo].variable);
      const zag = tipo === 'pipe' ? 'la pipe siempre es de zaguero' : pendiente.zaguero ? 'ataque de zaguero (Z5, Z6, Z1)' : 'ataque delantero (Z4, Z3, Z2)';
      return { ...base, tipo: 'clic en la cancha', icono: mira(color),
        titulo: tipo === 'segunda' ? 'Clic donde toca el armador' : 'Clic donde cae la armada',
        contexto: `${ARMADAS[tipo].nombre} · ${zag}`,
        principales: tiposArmada(tipo),
        secundarias: [
          secundaria(nombreTecla(TECLAS.zaguero), 'zaguero', tipo !== 'pipe' && pendiente.zaguero),
          secundaria('Esc', 'volver al tipo'),
        ] };
    }

    case 'golpe': {
      const g = pendiente.golpe;
      const segunda = e.ultima.armada === 'segunda';
      return { ...base, tipo: 'clic en la cancha', icono: mira(colorVar('--tinta')),
        titulo: segunda ? 'Clic donde cae el balón' : 'Clic donde pega el balón',
        contexto: (segunda ? 'Segunda del armador · ' : '') + (g === 'remate' ? 'remate por defecto; C o V antes del clic si fue toque' : `${GOLPES[g].nombre}: clic donde pega o cae`),
        principales: [
          principal('—', 'Remate', '', g === 'remate'),
          ...Object.entries(TECLAS.golpe).map(([k, v]) => principal(k.toUpperCase(), GOLPES[v].nombre, '', g === v)),
        ],
        secundarias: [secundaria('Esc', g === 'remate' ? 'volver al tipo de armada' : 'volver a remate')] };
    }

    case 'resultado': {
      const atq = e.ultima;
      const arm = e.r.acciones[e.r.acciones.length - 2];
      const calc = textoAtaque(arm, atq, false);
      const z = zonaAtaque(arm);
      return { ...base, titulo: 'Resultado del ataque',
        contexto: `${GOLPES[atq.golpe].nombre}${calc ? ' · ' + calc : ''}${z ? ' desde ' + z : ''}`,
        principales: Object.entries(TECLAS.resultado).map(([k, res]) => principal(k, RESULTADOS[res].nombre, simboloMini(res))),
        secundarias: (() => {
          const sug = sugerenciaJugador();
          return [sug ? secundaria(['N', 'Enter'], `¿${etiquetaJugador(sug.num)}?`) : secundaria(nombreTecla(TECLAS.jugador), 'jugador'), deshacer].filter(Boolean);
        })() };
    }
  }
  return base;
}

// ---------- Plantel: fila de jugadores ----------

// El plantel de referencia es el del equipo; la copia del partido es el respaldo
function jugadoresDe(lado, p = partido()) {
  const eq = equipoDe(lado, p);
  const lista = eq ? eq.plantel : (p && p.plantel && p.plantel[lado]) || [];
  return lista.slice().sort((a, b) => a.num - b.num);
}

// Etiqueta corta: «#7 Pérez» si el plantel del equipo tiene nombre, si no «#7».
// En estadísticas se usa el equipo analizado (un número = un jugador en todos sus partidos).
function etiquetaJugador(num, eq = null) {
  const equipo = eq || (ui.modo === 'stats' ? equipoStats() : null) || (partido() && equipoDe(partido().scouteado));
  const j = equipo && equipo.plantel.find((x) => x.num === num);
  return j && j.nombre ? `#${num} ${j.nombre}` : `#${num}`;
}

function textoJugador(num, p = partido()) {
  const j = p && jugadoresDe(p.scouteado, p).find((x) => x.num === num);
  if (!j) return `#${num}`;
  const resto = [j.nombre, j.pos && POSICIONES[j.pos].nombre.toLowerCase()].filter(Boolean).join(', ');
  return resto ? `#${num} ${resto}` : `#${num}`;
}

const DESTINO_JUGADOR = { recepcion: 'Última recepción', defensa: 'Última defensa', ataque: 'Último ataque' };

// Última recepción, defensa o ataque del rally en pantalla: a ella se asigna el jugador
function accionParaJugador() {
  const p = partido();
  if (!p) return null;
  const r = rallyMostrado(setActual(p));
  if (!r) return null;
  for (let i = r.acciones.length - 1; i >= 0; i--) {
    if (ACCIONES_CON_JUGADOR.includes(r.acciones[i].tipo)) return r.acciones[i];
  }
  return null;
}

// Menú desplegable en el encabezado de la cancha
function renderJugadores() {
  const boton = $('btn-jugador');
  const pop = $('jug-popover');
  const p = partido();
  if (!p) { boton.hidden = true; pop.hidden = true; return; }
  boton.hidden = false;
  const lista = jugadoresDe(p.scouteado);
  const accion = accionParaJugador();
  const asignado = accion && accion.jugador != null ? etiquetaJugador(accion.jugador) : '—';
  boton.innerHTML = `Jugador <b>${accion ? asignado : ''}</b> ▾`;
  boton.title = !accion ? 'No hay recepción, defensa ni ataque para asignar' : `Asignar jugador a: ${DESTINO_JUGADOR[accion.tipo].toLowerCase()}`;
  boton.classList.toggle('con-jugador', !!(accion && accion.jugador != null));
  if (pop.hidden) return;
  const destino = accion ? DESTINO_JUGADOR[accion.tipo] : 'Sin recepción, defensa ni ataque';
  const chips = lista.length
    ? lista.map((j) =>
      `<button class="jug-chip${accion && accion.jugador === j.num ? ' activo' : ''}" data-jug="${j.num}" ${accion ? '' : 'disabled'} title="${esc(textoJugador(j.num))}">` +
      `${j.num}${j.pos ? `<small>${POSICIONES[j.pos].corto}</small>` : ''}</button>`).join('')
    : `<span class="tenue">Sin plantel del ${esc(nombre(p.scouteado))}.</span>`;
  pop.innerHTML =
    `<span class="etiqueta">${destino}</span>` +
    `<div class="jug-chips">${chips}</div>` +
    `<button class="btn chico" id="jug-editar">${lista.length ? 'Editar plantel' : 'Agregar jugadores'}</button>`;
}

function alternarMenuJugador(abrir = $('jug-popover').hidden) {
  $('jug-popover').hidden = !abrir;
  renderJugadores();
}

// ---------- Asignar jugador con el teclado: N + número ----------

const ESPERA_NUMERO_MS = 600;
const NOMBRE_ACCION_JUGADOR = { ataque: 'al ataque', recepcion: 'a la recepción', defensa: 'a la defensa' };

function terminarEntradaJugador() {
  if (ui.entradaJugador) clearTimeout(ui.entradaJugador.timer);
  ui.entradaJugador = null;
  ui.aviso = null;
  renderEstado();
}

function confirmarEntradaJugador() {
  const ent = ui.entradaJugador;
  if (!ent) return;
  terminarEntradaJugador();
  if (ent.digitos) asignarJugadorA(Number(ent.digitos));
}

// Devuelve true si la tecla se usó en la entrada del número
function manejarTeclaJugador(k) {
  const ent = ui.entradaJugador;
  if (k === TECLAS.jugador) {
    if (ent && !ent.digitos) { terminarEntradaJugador(); asignarJugadorA(null); return true; }
    if (ent) confirmarEntradaJugador();
    const accion = accionParaJugador();
    if (!accion) { avisar('No hay recepción, defensa ni ataque para asignar.'); return true; }
    ui.entradaJugador = { digitos: '', timer: null };
    const sug = sugerenciaJugador();
    ui.aviso = { texto: `Jugador ${NOMBRE_ACCION_JUGADOR[accion.tipo]}: escribe el número${sug ? `, o Enter para ${etiquetaJugador(sug.num)}` : ''} (N otra vez quita)`, hasta: Infinity };
    renderEstado();
    return true;
  }
  if (!ent) return false;
  if (/^[0-9]$/.test(k)) {
    ent.digitos += k;
    clearTimeout(ent.timer);
    if (ent.digitos.length >= 2) { confirmarEntradaJugador(); return true; }
    ent.timer = setTimeout(confirmarEntradaJugador, ESPERA_NUMERO_MS);
    ui.aviso = { texto: `Jugador #${ent.digitos}…`, hasta: Infinity };
    renderEstado();
    return true;
  }
  if (k === 'enter') {
    if (ent.digitos) { confirmarEntradaJugador(); return true; }
    const sug = sugerenciaJugador();
    terminarEntradaJugador();
    if (sug) asignarJugadorA(sug.num); else avisar('Escribe el número del jugador después de N.');
    return true;
  }
  terminarEntradaJugador();
  return k === 'escape'; // Esc solo cancela; cualquier otra tecla sigue su curso
}

function asignarJugadorA(num) {
  const accion = accionParaJugador();
  if (!accion) { avisar('No hay recepción, defensa ni ataque para asignar.'); return; }
  const r = rallyMostrado(setActual(partido()));
  const i = r.acciones.indexOf(accion);
  if (num == null) {
    if (accion.jugador == null) { avisar(`Sin jugador asignado ${NOMBRE_ACCION_JUGADOR[accion.tipo]}.`); return; }
    const antes = etiquetaJugador(accion.jugador);
    mutar(`Quitar ${antes}`, () => { delete r.acciones[i].jugador; });
    avisar(`${antes} quitado ${NOMBRE_ACCION_JUGADOR[accion.tipo]}`.replace(' al ', ' del ').replace(' a la ', ' de la '));
    return;
  }
  mutar(`Jugador ${etiquetaJugador(num)}`, () => { r.acciones[i].jugador = num; });
  avisar(`${etiquetaJugador(num)} asignado ${NOMBRE_ACCION_JUGADOR[accion.tipo]}`);
}

// Jugador probable en el paso Resultado: el más frecuente en la misma rotación y zona
// de ataque en los rallies anteriores del equipo. Solo sugiere; nunca asigna solo.
function sugerenciaJugador() {
  const e = estado();
  if (e.modo !== 'resultado' || e.ultima.jugador != null) return null;
  const armada = e.r.acciones[e.r.acciones.length - 2];
  const rot = rotacionEn(e.set, e.set.rallies.indexOf(e.r), e.p.scouteado);
  const zona = zonaAtaque(armada);
  const eq = equipoDe(e.p.scouteado, e.p);
  const cuenta = {};
  for (const j of recolectar(eq ? partidosDelEquipo(eq.id) : [e.p]).jugadas) {
    if (j.ataque && j.ataque !== e.ultima && j.jugador != null && j.rot === rot && j.zona === zona) cuenta[j.jugador] = (cuenta[j.jugador] || 0) + 1;
  }
  const mejor = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0];
  return mejor ? { num: Number(mejor[0]), veces: mejor[1], rot, zona } : null;
}

function asignarJugador(num) {
  const accion = accionParaJugador();
  if (!accion) return;
  const p = partido();
  const r = rallyMostrado(setActual(p));
  const i = r.acciones.indexOf(accion);
  const quitar = accion.jugador === num;
  mutar(quitar ? `Quitar #${num}` : `Jugador #${num}`, () => {
    const a = r.acciones[i];
    if (quitar) delete a.jugador; else a.jugador = num;
  });
}

function renderEstado() {
  const e = estado();
  const c = contenidoEstado(e);
  const aviso = ui.aviso && ui.aviso.hasta > Date.now() ? ui.aviso.texto : null;
  const kbdTecla = (t) => `<kbd>${esc(t)}</kbd>`;
  const prin = c.principales.map((x) =>
    `<div class="tecla-p${x.activa ? ' activa' : ''}">${kbd(x.tecla, x.activa)}${x.extra}<span title="${esc(x.texto)}">${esc(x.texto)}</span></div>`).join('');
  const sec = c.secundarias.map((x) =>
    `<span class="item${x.activa ? ' activa' : ''}">${x.teclas.length === 2 && x.texto === 'defensa' ? `${kbdTecla(x.teclas[0])}–${kbdTecla(x.teclas[1])}` : x.teclas.map(kbdTecla).join('')} ${esc(x.texto)}</span>`).join('');
  $('estado').innerHTML =
    `<div class="ahora-cab"><span class="etiqueta">Ahora${c.tipo ? ' · ' + esc(c.tipo) : ''}</span>` +
    `<button class="atajos" id="btn-atajos" title="Atajos de teclado (?)">${kbd('?')} atajos</button></div>` +
    `<h2>${c.icono || ''}${esc(c.titulo)}</h2>` +
    `<p class="contexto${aviso ? ' aviso' : ''}">${esc(aviso || c.contexto)}</p>` +
    `<div class="ahora-teclas${c.principales.length > 6 ? ' c3' : ''}${c.principales.length === 1 ? ' una' : ''}">${prin}</div>` +
    (sec ? `<div class="ahora-sec">${sec}</div>` : '');
}

// ---------- Ayuda «?» ----------

function renderAyuda() {
  const fila = (teclas, texto) => `<div class="ayuda-fila"><span class="teclas">${teclas.map((t) => kbd(t)).join('')}</span><span>${esc(texto)}</span></div>`;
  const T = TECLAS;
  $('ayuda').innerHTML =
    `<div class="ayuda-cab"><h3>Atajos</h3><span>${kbd('?')} o ${kbd('Esc')} cierra</span></div>` +
    `<h4>Video</h4>` +
    fila([nombreTecla(T.reproducir)], 'Reproducir / pausar') +
    fila([nombreTecla(T.atras), nombreTecla(T.adelante)], `−${SALTO_SEGUNDOS} s / +${SALTO_SEGUNDOS} s`) +
    fila([nombreTecla(T.atrasLargo), nombreTecla(T.adelanteLargo)], `−${SALTO_LARGO_SEGUNDOS} s / +${SALTO_LARGO_SEGUNDOS} s (también Shift + flechas)`) +
    fila([T.cuadroAtras, T.cuadroAdelante], 'Cuadro a cuadro (archivo local)') +
    fila([nombreTecla(T.silencio)], 'Silencio') +
    `<h4>Captura</h4>` +
    fila(['Ctrl+Z'], 'Deshacer el último paso') +
    fila([nombreTecla(T.nuevoRally)], 'Rally nuevo en el segundo actual') +
    fila([nombreTecla(T.cerrarSinAtaque)], 'Cerrar rally sin ataque') +
    fila([nombreTecla(T.jugador), '7'], 'Jugador a la última recepción, defensa o ataque (N N quita)') +
    fila(['Esc'], 'Volver un paso de clic') +
    fila([nombreTecla(T.foco)], 'Modo foco') +
    `<div class="ayuda-pie">Las teclas del paso actual están siempre en «Ahora».</div>`;
}

function alternarAyuda(abrir = $('ayuda').hidden) {
  if (abrir) renderAyuda();
  $('ayuda').hidden = !abrir;
}

// ---------- Símbolos de resultado ----------

function simboloMini(res) {
  const t = 'var(--texto)';
  const linea = (x2) => `<line x1="0" y1="5" x2="${x2}" y2="5" stroke="${t}" stroke-width="1.3"/>`;
  let s;
  switch (res) {
    case 'punto': s = linea(14) + `<circle cx="16" cy="5" r="3" fill="${t}"/>`; break;
    case 'error': s = linea(12) + `<circle cx="16" cy="5" r="3.2" fill="none" stroke="${t}" stroke-width="1.2"/><line x1="13.8" y1="7.4" x2="18.2" y2="2.6" stroke="${t}" stroke-width="1.2"/>`; break;
    case 'bloqueado': s = linea(11) + `<path d="M12 2l6 6M18 2l-6 6" stroke="${t}" stroke-width="1.3"/>`; break;
    case 'pinchado': s = linea(10) + `<path d="M13 1.5L16.5 5 13 8.5 9.5 5Z" fill="none" stroke="${t}" stroke-width="1.2"/><line x1="17" y1="5" x2="22" y2="5" stroke="${t}" stroke-width="1.2" stroke-dasharray="1.6 1.4"/>`; break;
    case 'usaBloque': s = linea(6) + `<path d="M9 2L12 5 9 8 6 5Z" fill="none" stroke="${t}" stroke-width="1.2"/><line x1="12.5" y1="5" x2="17" y2="5" stroke="${t}" stroke-width="1.2" stroke-dasharray="1.6 1.4"/><circle cx="19.5" cy="5" r="2.5" fill="${t}"/>`; break;
    case 'rejugado': s = `<path d="M0 3h15q4 0 4 3.5t-4 3.5h-6" fill="none" stroke="${t}" stroke-width="1.3"/><path d="M11.5 7.5L9 10l2.5 2" fill="none" stroke="${t}" stroke-width="1.2"/>`; break;
    case 'defendido': s = linea(18) + `<path d="M14 1.5L18.5 5 14 8.5" fill="none" stroke="${t}" stroke-width="1.3"/>`; break;
    default: s = linea(18);
  }
  return `<svg class="simbolo" viewBox="0 0 22 10" aria-hidden="true">${s}</svg>`;
}

// ---------- Cancha ----------

// otroTexto: nombre del contrario a mostrar (p. ej. «rivales» si se suman varios partidos)
function baseCancha(p, otroTexto = null) {
  const L = 'var(--linea-cancha)';
  let s = '';
  s += `<rect x="20" y="20" width="180" height="90" fill="var(--superficie-cancha)" stroke="${L}" stroke-width="0.7"/>`;
  for (const y of [50, 80]) s += `<line x1="20" y1="${y}" x2="200" y2="${y}" stroke="var(--borde-control)" stroke-width="0.4" stroke-dasharray="1.6 1.6"/>`;
  for (const x of [80, 140]) s += `<line x1="${x}" y1="20" x2="${x}" y2="110" stroke="${L}" stroke-width="0.45" opacity="0.75"/>`;
  const zonas = [
    [20, [5, 6, 1]], [80, [4, 3, 2]], [110, [2, 3, 4]], [140, [1, 6, 5]],
  ];
  for (const [x, nums] of zonas) {
    nums.forEach((n, i) => {
      s += `<text x="${x + 2.5}" y="${20 + i * 30 + 27}" font-size="4.6" fill="var(--zona-numero)">${n}</text>`;
    });
  }
  s += `<line x1="110" y1="14" x2="110" y2="116" stroke="var(--texto)" stroke-width="1.1"/>`;
  s += `<circle cx="110" cy="14" r="1.1" fill="var(--texto)"/><circle cx="110" cy="116" r="1.1" fill="var(--texto)"/>`;
  if (p) {
    s += `<text x="20" y="11" font-size="5.4" font-weight="600" fill="var(--texto-3)">${esc(nombre(p.scouteado, p))} ataca →</text>`;
    s += `<text x="200" y="11" font-size="5.4" font-weight="600" fill="var(--texto-3)" text-anchor="end">${esc(otroTexto || nombre(otro(p.scouteado), p))}</text>`;
  }
  return s;
}

function dibujarJugada({ armada, ataque }, opacidad = 1, etiquetas = true) {
  const color = `var(${ARMADAS[armada.armada].variable})`;
  const T = 'var(--texto)';
  const [ax, ay] = aVB(armada.punto);
  let s = `<g opacity="${opacidad}">`;
  if (ataque) {
    const [ix, iy] = aVB(ataque.punto);
    const red = CANCHA.red * VB;
    let nx = null, ny = null;
    if ((ax - red) * (ix - red) < 0) {
      const f = (red - ax) / (ix - ax);
      nx = red; ny = ay + f * (iy - ay);
    }
    const linea = (x1, y1, x2, y2, extra = '') =>
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.6" stroke-linecap="round" ${extra}/>`;
    const res = ataque.resultado;
    if (res === 'bloqueado' && nx !== null) {
      s += linea(ax, ay, nx - 1.5, ny);
      s += `<path d="M${nx - 2.6} ${ny - 2.6}l5.2 5.2M${nx + 2.6} ${ny - 2.6}l-5.2 5.2" stroke="${T}" stroke-width="1.2"/>`;
    } else if ((res === 'pinchado' || res === 'usaBloque') && nx !== null) {
      s += linea(ax, ay, nx, ny);
      s += linea(nx, ny, ix, iy, 'stroke-dasharray="2.4 2"');
      s += `<path d="M${nx} ${ny - 3.2}L${nx + 3.2} ${ny} ${nx} ${ny + 3.2} ${nx - 3.2} ${ny}Z" fill="var(--superficie-cancha)" stroke="${T}" stroke-width="1"/>`;
    } else if (res === 'rejugado' && nx !== null) {
      s += linea(ax, ay, nx, ny);
      s += `<path d="M${nx} ${ny}q3 0 3 4t-6 5h-5" fill="none" stroke="${T}" stroke-width="1.1"/>`;
      s += `<path d="M${nx - 6} ${ny + 6.5}l-2.4 2.5 2.4 2.4" fill="none" stroke="${T}" stroke-width="1"/>`;
    } else {
      s += linea(ax, ay, ix, iy);
    }
    if (res === 'punto' || res === 'usaBloque') {
      s += `<circle cx="${ix}" cy="${iy}" r="2.6" fill="${T}"/>`;
    } else if (res === 'error') {
      s += `<circle cx="${ix}" cy="${iy}" r="2.6" fill="var(--superficie-cancha)" stroke="${T}" stroke-width="1"/>`;
      s += `<line x1="${ix - 1.9}" y1="${iy + 1.9}" x2="${ix + 1.9}" y2="${iy - 1.9}" stroke="${T}" stroke-width="1"/>`;
    } else if (res === 'defendido') {
      const ang = Math.atan2(iy - ay, ix - ax);
      const p1 = [ix - 4.2 * Math.cos(ang - 0.5), iy - 4.2 * Math.sin(ang - 0.5)];
      const p2 = [ix - 4.2 * Math.cos(ang + 0.5), iy - 4.2 * Math.sin(ang + 0.5)];
      s += `<path d="M${p1[0]} ${p1[1]}L${ix} ${iy}L${p2[0]} ${p2[1]}" fill="none" stroke="${T}" stroke-width="1.1"/>`;
    } else if (!res) {
      s += `<circle cx="${ix}" cy="${iy}" r="1.4" fill="${color}"/>`;
    } else if (res === 'pinchado' || (nx === null && res !== 'rejugado')) {
      s += `<circle cx="${ix}" cy="${iy}" r="1.1" fill="var(--texto-3)"/>`;
    }
    if (etiquetas) {
      const txt = textoAtaque(armada, ataque);
      if (txt) {
        // En un bloqueo la línea termina en la red: la etiqueta va junto a la X
        const [lx, ly] = res === 'bloqueado' && nx !== null ? [nx, ny] : [ix, iy];
        const derecha = lx > 175;
        s += `<text x="${derecha ? lx - 4 : lx + 4}" y="${ly + 6.5}" font-size="4.4" fill="var(--texto-2)" text-anchor="${derecha ? 'end' : 'start'}">${esc(txt)}</text>`;
      }
    }
  }
  s += `<circle cx="${ax}" cy="${ay}" r="2.6" fill="var(--superficie-cancha)" stroke="${color}" stroke-width="1.3"/>`;
  if (etiquetas) {
    const z = zonaAtaque(armada);
    if (z) s += `<text x="${ax - 3.2}" y="${ay - 3.6}" font-size="4.4" fill="var(--texto-2)" text-anchor="end">${z}</text>`;
  }
  return s + '</g>';
}

function cursorMira(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M12 1v8M12 15v8M1 12h8M15 12h8" stroke="#0F1114" stroke-width="3.5"/><path d="M12 1v8M12 15v8M1 12h8M15 12h8" stroke="${color}" stroke-width="1.6"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, crosshair`;
}

function renderCancha() {
  const svg = $('cancha');
  const p = partido();
  const e = estado();
  let s = baseCancha(p);
  let titulo = 'Cancha';
  if (p) {
    const set = setActual(p);
    const r = e.r || rallyMostrado(set);
    if (ui.vista === 'set') {
      titulo = `Cancha · set ${set.numero}`;
      for (const otroR of set.rallies) {
        if (otroR === r) continue;
        for (const j of jugadas(otroR)) if (j.ataque) s += dibujarJugada(j, 0.4, false);
      }
    }
    if (r) {
      if (ui.vista === 'rally') titulo = `Cancha · rally ${set.rallies.indexOf(r) + 1}`;
      s += dibujarPases(r);
      for (const j of jugadas(r)) s += dibujarJugada(j);
    }
  }
  svg.innerHTML = s;
  $('cancha-titulo').textContent = titulo;

  const clic = esModoClic(e);
  svg.classList.toggle('clic', clic);
  if (e.modo === 'armadaClic') svg.style.cursor = cursorMira(colorVar(ARMADAS[pendiente.armada].variable));
  else if (e.modo === 'golpe') svg.style.cursor = cursorMira(colorVar('--texto'));
  else if (clic) svg.style.cursor = cursorMira(colorVar('--texto-2'));
  else svg.style.cursor = '';
}

// Posición del pase (recepción o defensa): rombo chico con el color de su
// calificación (así la nota se lee en la cancha) y línea fina hasta la armada.
function dibujarPases(r) {
  let s = '';
  r.acciones.forEach((a, i) => {
    if (!['recepcion', 'defensa'].includes(a.tipo) || !a.punto) return;
    const [x, y] = aVB(a.punto);
    const sig = r.acciones[i + 1];
    if (sig && sig.tipo === 'armada') {
      const [ax, ay] = aVB(sig.punto);
      s += `<line x1="${x}" y1="${y}" x2="${ax}" y2="${ay}" stroke="var(--texto-3)" stroke-width="0.5" stroke-dasharray="1.2 1"/>`;
    }
    const relleno = { '#': 'var(--calif-perfecta)', '+': 'var(--calif-buena)', '!': 'var(--calif-regular)' }[a.calif];
    const borde = a.calif === '=' ? 'var(--error)' : relleno || 'var(--calif-mala)';
    s += `<path d="M${x} ${y - 2.6}L${x + 2.6} ${y} ${x} ${y + 2.6} ${x - 2.6} ${y}Z" fill="${relleno || 'var(--superficie-cancha)'}" stroke="${borde}" stroke-width="0.8"/>`;
    s += `<text x="${x}" y="${y - 4}" font-size="4.2" fill="var(--texto-2)" text-anchor="middle">pase ${esc(a.calif)}</text>`;
  });
  return s;
}

function aplicarLeyenda() {
  $('leyenda').hidden = !prefs.leyenda;
  $('btn-leyenda').textContent = `${prefs.leyenda ? '▾' : '▸'} símbolos`;
  $('ley-pase').innerHTML = `<svg class="simbolo" viewBox="0 0 22 10" aria-hidden="true"><path d="M11 1.5L14.5 5 11 8.5 7.5 5Z" fill="var(--calif-buena)"/></svg>pase (color = nota)`;
}

function renderLeyenda() {
  const arm = Object.entries(TECLAS.armada).map(([k, t]) =>
    `<span class="ley">${muestra(t)}${esc(ARMADAS[t].corto === '1er t.' ? '1er tiempo' : ARMADAS[t].corto)} ${kbd(k.toUpperCase())}</span>`).join('');
  const res = Object.keys(RESULTADOS).map((r) =>
    `<span class="ley">${simboloMini(r)}${esc(RESULTADOS[r].nombre)}</span>`).join('');
  const pase = `<span class="ley"><svg class="simbolo" viewBox="0 0 22 10" aria-hidden="true"><rect x="7" y="2" width="6" height="6" fill="none" stroke="var(--texto-2)" stroke-width="1.2"/></svg>Pase</span>`;
  $('leyenda').innerHTML =
    `<div class="leyenda-fila"><span class="etiqueta">Armada</span>${arm}${pase}</div>` +
    `<div class="leyenda-fila"><span class="etiqueta">Resultado</span>${res}</div>`;
}

// ---------- Listas ----------

function botonIr(t) { return `<button class="ir" data-t="${t}" title="Ir a ${fmtTiempo(t)}">▶</button>`; }

// Tipo y detalle de una acción, para el historial del rally
function detalleAccion(r, a) {
  let tipo = '', det = '';
  const p = partido();
  switch (a.tipo) {
    case 'saque': tipo = 'Saque'; det = `<span>${esc(nombre(a.equipo))}</span>`; break;
    case 'recepcion':
    case 'defensa':
      tipo = a.tipo === 'recepcion' ? 'Recepción' : 'Defensa';
      det = `<span>${esc(nombre(a.equipo))}</span>${jugadorBadge(a)}${califBadge(a.calif)}` +
        (a.punto ? `<span class="calc">pase ${textoPase(a.punto)}</span>` : '');
      break;
    case 'recovery': tipo = 'Cobertura'; det = `<span class="calc">${esc(nombre(p.scouteado))}</span>`; break;
    case 'recibeLibre': tipo = 'Libre'; det = '<span class="calc">recibe balón libre</span>'; break;
    case 'pasaLibre': tipo = 'Libre'; det = '<span class="calc">pasa al otro lado</span>'; break;
    case 'armada': {
      tipo = 'Armada';
      const z = zonaAtaque(a);
      const fase = faseArmada(r, a);
      det = `${muestra(a.armada)}<span>${ARMADAS[a.armada].corto}</span>` +
        (z ? `<span class="calc">→ ${z}${a.zaguero ? ' (zag.)' : ''}</span>` : '') +
        (fase !== 'recepcion' ? `<span class="calc">· ${FASES[fase].toLowerCase()}</span>` : '');
      break;
    }
    case 'ataque': {
      tipo = 'Ataque';
      const i = r.acciones.indexOf(a);
      const arm = r.acciones[i - 1];
      const calc = textoAtaque(arm, a, false);
      det = jugadorBadge(a) + `<span>${a.golpe === 'remate' ? 'Remate' : GOLPES[a.golpe].corto}</span>` + (calc ? `<span class="calc">· ${esc(calc)}</span>` : '') +
        (a.resultado ? `${simboloMini(a.resultado)}<span>${RESULTADOS[a.resultado].nombre}</span>` : '<span class="calc">…</span>');
      break;
    }
  }
  return { tipo, det };
}

function jugadorBadge(a) {
  return a.jugador != null ? `<span class="jug" title="${esc(textoJugador(a.jugador))}">${a.jugador}</span>` : '';
}

function resumenRally(r, p) {
  let s = '';
  const rec = r.acciones.find((a) => a.tipo === 'recepcion');
  if (rec) s += califBadge(rec.calif);
  const js = jugadas(r).filter((j) => j.ataque);
  const ult = js[js.length - 1];
  if (ult) {
    const z = zonaAtaque(ult.armada);
    s += muestra(ult.armada.armada) + `<span>${ARMADAS[ult.armada.armada].corto}${z ? ' ' + z : ''}` +
      (ult.ataque.resultado ? ` · ${RESULTADOS[ult.ataque.resultado].nombre}` : '') + '</span>';
  } else if (r.motivo) {
    s += `<span class="tenue">${MOTIVOS[r.motivo].nombre.toLowerCase()}</span>`;
  } else if (r.acciones.length === 1) {
    s += '<span class="tenue">sin jugada</span>';
  } else if (rec && rec.calif === '=') {
    s += '<span class="tenue">error de recepción</span>';
  } else {
    s += `<span class="tenue">sin ataque ${esc(nombre(p.scouteado).toLowerCase())}</span>`;
  }
  return s;
}

// Nombre del paso pendiente, para la última fila tenue del historial
const PASO_PENDIENTE = { recepcion: 'Recepción', armadaTipo: 'Armada', armadaClic: 'Armada', golpe: 'Ataque', resultado: 'Resultado', cerrar: 'Cierre' };

function renderHistorial() {
  const cont = $('historial');
  const p = partido();
  if (!p) { cont.innerHTML = ''; return; }
  const set = setActual(p);
  const r = rallyMostrado(set);
  if (!r) { cont.innerHTML = `<div class="hist-cab"><b>Set ${set.numero}</b>todavía sin rallies</div>`; return; }
  const idx = set.rallies.indexOf(r);
  const rot = rotacionEn(set, idx, p.scouteado);
  const e = estado();
  const filas = r.acciones.map((a) => {
    const { tipo, det } = detalleAccion(r, a);
    return `<div class="hist-fila"><span class="t">${fmtTiempo(a.t)}</span><span>${tipo}</span><span class="detalle">${det}</span></div>`;
  }).join('');
  const pendiente = e.r === r && PASO_PENDIENTE[e.modo]
    ? `<div class="hist-fila pendiente"><span class="t">—</span><span>${PASO_PENDIENTE[e.modo]}</span><span>en espera</span></div>` : '';
  let pie = '';
  if (r.gana) {
    const m = [r.marcador[0] + (r.gana === 'propio' ? 1 : 0), r.marcador[1] + (r.gana === 'rival' ? 1 : 0)];
    pie = `<div class="hist-pie">Gana ${esc(nombre(r.gana))}${r.motivo ? ' (' + MOTIVOS[r.motivo].nombre.toLowerCase() + ')' : ''} · ${m[0]}–${m[1]}</div>`;
  }
  cont.innerHTML = `<div class="hist-cab"><b>Rally ${idx + 1}</b>saca ${esc(nombre(r.saca))}, ${r.marcador[0]}–${r.marcador[1]}${rot ? ', P' + rot : ''}</div>` +
    filas + pendiente + pie;
  cont.scrollTop = cont.scrollHeight;
}

// Cadena de armadas de un rally: «Pipe · Z6 → Alta · Z4»
function cadenaArmadas(r) {
  const js = jugadas(r);
  if (!js.length) return '';
  return js.map((j) => `${muestra(j.armada.armada)}<span>${ARMADAS[j.armada.armada].corto} · ${zonaAtaque(j.armada)}</span>`)
    .join('<span class="sep-cadena">→</span>');
}

function textoResultadoRally(r) {
  const res = jugadas(r).filter((j) => j.ataque && j.ataque.resultado).map((j) => RESULTADOS[j.ataque.resultado].nombre);
  if (r.motivo) res.push(MOTIVOS[r.motivo].nombre.toLowerCase());
  else if (res.length && !RESULTADOS[jugadas(r).filter((j) => j.ataque).pop().ataque.resultado || 'defendido'].gana) res.push('cerrado con G');
  if (!res.length) {
    const rec = r.acciones.find((a) => a.tipo === 'recepcion');
    return rec && rec.calif === '=' ? 'error de recepción' : r.acciones.length === 1 ? 'sin jugada' : '—';
  }
  return res.join(' · ');
}

function resumenUltimoRally(set, p) {
  const cerrados = set.rallies.filter((x) => x.gana);
  const r = cerrados[cerrados.length - 1];
  if (!r) return '';
  const n = set.rallies.indexOf(r) + 1;
  const ult = jugadas(r).filter((j) => j.ataque).pop();
  const como = r.motivo ? MOTIVOS[r.motivo].nombre.toLowerCase()
    : ult && ult.ataque.resultado ? `${RESULTADOS[ult.ataque.resultado].nombre.toLowerCase()} desde ${zonaAtaque(ult.armada)}` : 'punto';
  return `R${n}  ${nombre(r.gana, p)}, ${como}`;
}

function filaAnterior(set, r, i, p) {
  const rot = rotacionEn(set, i, p.scouteado);
  const rec = r.acciones.find((a) => a.tipo === 'recepcion');
  const cadena = cadenaArmadas(r);
  return `<div class="fila-ant"><span class="num">${i + 1}</span><span class="t">${fmtMinuto(r.t)}</span>` +
    `<span>${esc(nombre(r.saca))}</span><span class="tenue">${rot ? 'P' + rot : '—'}</span>` +
    `<span>${rec ? califBadge(rec.calif) : ''}</span>` +
    `<span class="cadena">${cadena || `<span class="tenue">sin ataque de ${esc(nombre(p.scouteado))}</span>`}</span>` +
    `<span>${esc(textoResultadoRally(r))}</span>` +
    `<span class="${r.gana === p.scouteado ? 'gana-scout' : 'gana-otro'}">${esc(nombre(r.gana))}</span>${botonIr(r.t)}</div>`;
}

function renderAnteriores() {
  const p = partido();
  const cab = $('anteriores-cab');
  if (!p) { cab.innerHTML = ''; $('anteriores-lista').innerHTML = ''; return; }
  const set = setActual(p);
  const total = p.sets.reduce((n, st) => n + st.rallies.filter((r) => r.gana).length, 0);
  const abierta = !!prefs.listaAbierta;
  const actual = indiceRallyVigente(set) + 1;
  cab.innerHTML = `<span class="flecha">${abierta ? '▾' : '▸'}</span><span class="titulo">${total} ${total === 1 ? 'rally anterior' : 'rallies anteriores'}</span>` +
    (abierta
      ? `<span class="pista">▶ salta al video</span><button class="btn-tenue chico volver" id="btn-volver-rally">Volver al rally ${actual}</button>`
      : `<span class="resumen-pleg">${esc(resumenUltimoRally(set, p))}</span>`);
  $('nota-volver').textContent = `Al cerrarla vuelve al rally en curso (R${actual}).`;
  if (!abierta) { $('anteriores-lista').innerHTML = ''; return; }

  let html = '';
  [...p.sets].reverse().forEach((st) => {
    const filas = st.rallies.map((r, i) => ({ r, i })).filter(({ r }) => r.gana).reverse();
    const enCurso = st === set && !st.final;
    if (st === set) {
      html += `<div class="grupo-set">Set ${st.numero}${enCurso ? ' · en curso' : ''}</div>`;
      html += filas.length ? filas.map(({ r, i }) => filaAnterior(st, r, i, p)).join('') : '<div class="vacio">Sin rallies cerrados en este set.</div>';
    } else {
      const m = st.final || marcadorTras(st);
      const ganaSet = m[0] > m[1] ? 'propio' : 'rival';
      const abiertoSet = !!(ui.setsAbiertos && ui.setsAbiertos[st.numero]);
      html += `<div class="set-plegado" data-set-plegado="${st.numero}"><span class="flecha">${abiertoSet ? '▾' : '▸'}</span>` +
        `Set ${st.numero} · ${esc(nombre(ganaSet))} ${Math.max(...m)}–${Math.min(...m)}, ${filas.length} rallies</div>`;
      if (abiertoSet) html += filas.map(({ r, i }) => filaAnterior(st, r, i, p)).join('');
    }
  });
  $('anteriores-lista').innerHTML = html;
}

function alternarListaAnteriores(abrir = !prefs.listaAbierta) {
  if (abrir) ui.tiempoAntesLista = Video.tiempo();
  prefs.listaAbierta = abrir;
  guardarPrefs();
  document.body.classList.toggle('lista-abierta', abrir);
  renderAnteriores();
}

function volverAlRally() {
  const t = ui.tiempoAntesLista;
  alternarListaAnteriores(false);
  if (t != null && Video.fuente) Video.saltar(t);
}

// ---------- Video: panel de carga y controles ----------

function renderCargaVideo() {
  const p = partido();
  const mostrar = !Video.fuente || ui.cambiandoVideo;
  $('video-carga').hidden = !mostrar;
  $('btn-cancelar-carga').hidden = !(ui.cambiandoVideo && Video.fuente);
  const local = p && p.video && p.video.tipo === 'local' && !Video.fuente;
  $('carga-titulo').textContent = local ? 'Abre de nuevo el archivo de video' : 'Carga el video del partido';
  $('carga-texto').textContent = local
    ? `Este partido usa «${p.video.nombre}». Ábrelo otra vez desde tu equipo; el archivo nunca se sube.`
    : 'Pega el link de YouTube o abre el archivo descargado. El archivo no se sube a ningún lado.';
  renderSonido();
}

const ICONOS = {
  play: '<svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true"><path d="M2 1.5v13l11-6.5z" fill="currentColor"/></svg>',
  pausa: '<svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true"><path d="M2 1.5h3.5v13H2zM8.5 1.5H12v13H8.5z" fill="currentColor"/></svg>',
  sonido: '<svg width="18" height="16" viewBox="0 0 18 16" aria-hidden="true"><path d="M1.5 5.5h3l4-3.5v12l-4-3.5h-3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 5a4 4 0 0 1 0 6M14.2 3a7 7 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  mudo: '<svg width="18" height="16" viewBox="0 0 18 16" aria-hidden="true"><path d="M1.5 5.5h3l4-3.5v12l-4-3.5h-3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 5.5l5 5M17 5.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  anterior: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2v10M12 2L5 7l7 5z" fill="currentColor" stroke="currentColor" stroke-width="1.4"/></svg>',
  siguiente: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M12 2v10M2 2l7 5-7 5z" fill="currentColor" stroke="currentColor" stroke-width="1.4"/></svg>',
};

function renderSonido() {
  const b = $('btn-sonido');
  b.innerHTML = Video.mudo ? ICONOS.mudo : ICONOS.sonido;
  b.title = Video.mudo ? 'Activar sonido (M)' : 'Silenciar (M)';
}

function alternarSilencio() {
  Video.silenciar(!Video.mudo);
  prefs.silencio = Video.mudo;
  guardarPrefs();
  renderSonido();
}

function renderControles() {
  $('btn-velocidad').textContent = `${fmtVelocidad(Video.vel)} ▾`;
  $('menu-velocidad').innerHTML = VELOCIDADES.slice().reverse()
    .map((v) => `<button data-vel="${v}" class="${v === Video.vel ? 'activo' : ''}">${fmtVelocidad(v)}</button>`).join('');
  $('pausar-al-marcar').checked = !!prefs.pausarAlMarcar;
}

function actualizarVideoUI() {
  const t = Video.tiempo();
  const d = Video.duracion();
  const pausado = Video.pausado();
  $('tiempo-grande').textContent = fmtTiempo(t);
  $('lt-duracion').textContent = fmtMinuto(d);
  $('badge-pausado').hidden = !Video.fuente || !pausado;
  if (ui.iconoPlay !== pausado) {
    ui.iconoPlay = pausado;
    $('btn-play').innerHTML = pausado ? ICONOS.play : ICONOS.pausa;
    renderLateralCtl();
  }
  seguirClips(t);
  const frac = d ? Math.min(1, t / d) : 0;
  $('barra-avance').style.width = `${frac * 100}%`;
  $('barra-cabezal').style.left = `${frac * 100}%`;
  const p = partido();
  const marca = $('barra-set');
  const inicio = p && setActual(p).rallies[0];
  if (inicio && d) {
    marca.hidden = false;
    marca.style.left = `${Math.min(1, inicio.t / d) * 100}%`;
  } else {
    marca.hidden = true;
  }
}


// =====================================================================
// Estadísticas (fase 5): vistas, filtros combinables y clips
// =====================================================================

const stats = {
  partidos: null, // Set de ids a sumar; null = solo el partido abierto
  filtros: { set: [], rot: [], pase: [], fase: [], momento: [], armada: [], zona: [], golpe: [], resultado: [], jugador: [] },
  vista: 'equipo', // equipo | ataque | sideout | saque
  mapa: 'trayectorias', // trayectorias | calor
};

const VISTAS = {
  equipo: 'Equipo',
  jugadores: 'Jugadores',
  ataque: 'Ataque',
  sideout: 'Side-out y recepción',
  saque: 'Saque y bloqueo',
  comparar: 'Comparar',
};

const MOMENTOS = { inicio: 'Inicio', medio: 'Medio', final: 'Final' };

// Momento del set según el mayor de los dos marcadores antes del rally:
// 0–9 inicio, 10–19 medio, 20+ final (en el 5.º set: 0–4, 5–9, 10+)
function momentoDe(numeroSet, marcador) {
  const m = Math.max(marcador[0], marcador[1]);
  const [a, b] = numeroSet === 5 ? [5, 10] : [10, 20];
  return m < a ? 'inicio' : m < b ? 'medio' : 'final';
}

const FASES = { recepcion: 'Recepción', contra: 'Contra', recovery: 'Cobertura', libre: 'Libre' }; // 'recovery' se muestra como «Cobertura»
const ORDEN_ZONAS = ['Z4', 'Z3', 'Z2', 'Z1', 'Z6', 'Z5'];
const CALIFS = ['#', '+', '!', '-', '='];

// Qué filtros aplican a cada tipo de dato
const DIMS_DATOS = {
  jugadas: ['set', 'rot', 'pase', 'fase', 'momento', 'armada', 'zona', 'golpe', 'resultado', 'jugador'],
  recepciones: ['set', 'rot', 'pase', 'momento', 'jugador'],
  rallies: ['set', 'rot', 'pase', 'momento'],
  todos: ['set', 'rot', 'momento'],
};
const DATOS_VISTA = { equipo: 'jugadas', jugadores: 'jugadas', ataque: 'jugadas', sideout: 'rallies', saque: 'todos', comparar: 'jugadas' };

// Alcance de las estadísticas: un EQUIPO y los partidos en que se lo scoutea.
// La selección se recuerda por equipo como lista de partidos quitados (los nuevos entran solos).
function equipoStats() {
  if (stats.equipoId && almacen.equipos[stats.equipoId]) return almacen.equipos[stats.equipoId];
  const p = partido();
  const eq = p && equipoDe(p.scouteado, p);
  if (eq) { stats.equipoId = eq.id; return eq; }
  return null;
}

function partidosQuitados(eid) { return (prefs.seleccion && prefs.seleccion[eid]) || []; }

function alternarPartidoStats(pid) {
  const eq = equipoStats();
  if (!eq) return;
  prefs.seleccion = prefs.seleccion || {};
  const quitados = new Set(partidosQuitados(eq.id));
  if (quitados.has(pid)) quitados.delete(pid); else quitados.add(pid);
  prefs.seleccion[eq.id] = [...quitados];
  guardarPrefs();
  ui.clipsOverride = null;
  renderStats();
}

function partidosIncluidos() {
  const eq = equipoStats();
  if (!eq) return [];
  const quitados = partidosQuitados(eq.id);
  return partidosDelEquipo(eq.id).filter((x) => !quitados.includes(x.id));
}

// Partido de referencia para nombres en las vistas (todos comparten el equipo scouteado)
function partidoRef() {
  return partidosIncluidos()[0] || partidosDelEquipo((equipoStats() || {}).id)[0] || partido();
}

function recolectar(partidos) {
  const jugadas = [], recepciones = [], rallies = [], todos = [];
  for (const p of partidos) {
    const scout = p.scouteado;
    for (const set of p.sets) {
      set.rallies.forEach((r, idx) => {
        const base = { pid: p.id, set: set.numero, rally: idx + 1, rot: rotacionEn(set, idx, scout), momento: momentoDe(set.numero, r.marcador) };
        const rec = r.acciones.find((a) => a.tipo === 'recepcion');
        if (r.saca !== scout && r.gana) {
          const primerAtaque = r.acciones.find((a) => a.tipo === 'ataque');
          rallies.push({
            ...base, t: r.t, gana: r.gana, sideOut: r.gana === scout,
            pase: rec ? rec.calif : null,
            primerPunto: !!(rec && primerAtaque && esPuntoDeAtaque(primerAtaque.resultado) && faseArmada(r, r.acciones[r.acciones.indexOf(primerAtaque) - 1]) === 'recepcion'),
          });
        }
        if (rec) {
          recepciones.push({ ...base, t: Math.max(0, rec.t - 2), pase: rec.calif, jugador: rec.jugador ?? null, gana: r.gana });
        }
        if (r.gana) {
          // Saque y bloqueo. Ace del que saca: motivo «ace» o recepción «=» del scouteado.
          const sacaScout = r.saca === scout, ganaScout = r.gana === scout;
          let evento = null;
          if (r.motivo === 'bloqueo') evento = 'bloqueo';
          else if (r.motivo === 'errorSaque') evento = sacaScout ? 'errorScout' : 'errorOtro';
          else if (r.motivo === 'ace' || (rec && rec.calif === '=')) evento = sacaScout ? 'aceScout' : 'aceOtro';
          todos.push({ ...base, t: r.t, sacaScout, ganaScout, evento, pid: p.id });
        }
        r.acciones.forEach((a, i) => {
          if (a.tipo !== 'armada') return;
          const contacto = contactoDeArmada(r, a);
          const fase = faseArmada(r, a);
          const sig = r.acciones[i + 1];
          const ataque = sig && sig.tipo === 'ataque' ? sig : null;
          jugadas.push({
            ...base,
            t: Math.max(0, (contacto ? contacto.t : a.t) - 2),
            fase,
            // Calidad del pase: recepción o defensa calificada justo antes de la armada
            pase: contacto ? contacto.calif : null,
            armada: a.armada,
            zona: zonaAtaque(a),
            golpe: ataque ? ataque.golpe : null,
            resultado: ataque ? ataque.resultado : null,
            dir: ataque ? direccion(a, ataque) : null,
            destino: ataque ? destino(ataque) : null,
            jugador: ataque ? ataque.jugador ?? null : null,
            armadaObj: a,
            ataque,
          });
        });
      });
    }
  }
  return { jugadas, recepciones, rallies, todos };
}

function filtrar(lista, tipo) {
  const dims = DIMS_DATOS[tipo].filter((d) => stats.filtros[d].length);
  return lista.filter((x) => dims.every((d) => stats.filtros[d].includes(x[d])));
}

function hayFiltros() { return Object.values(stats.filtros).some((v) => v.length); }

function alternarFiltro(dim, valor) {
  const arr = stats.filtros[dim];
  const i = arr.indexOf(valor);
  if (i >= 0) arr.splice(i, 1); else arr.push(valor);
  renderStats();
}

// Clic en una celda: fija exactamente esos valores (o los quita si ya estaban)
function fijarFiltros(obj) {
  const yaEstan = Object.entries(obj).every(([d, v]) => stats.filtros[d].length === 1 && stats.filtros[d][0] === v);
  for (const [d, v] of Object.entries(obj)) stats.filtros[d] = yaEstan ? [] : [v];
  renderStats();
}

function pct(a, b) { return b ? Math.round((100 * a) / b) : null; }
const ESPACIO_FINO = '\u202F';
function txtPct(n) { return n == null ? '—' : `${n}${ESPACIO_FINO}%`; }

// Sombra según proporción: los colores salen del tema (claro al imprimir, oscuro en pantalla)
function celda(frac, contenido, attrs = '', clase = '') {
  const sombra = frac > 0 ? ` sombra${frac > 0.6 ? ' fuerte' : ''}` : '';
  const estilo = frac > 0 ? `--f:${frac.toFixed(3)}` : '';
  return `<td class="num${sombra}${clase}" style="${estilo}" ${attrs}>${contenido}</td>`;
}

function marcaFiltro(obj) {
  const e = Object.entries(obj);
  return e.length && e.every(([d, v]) => stats.filtros[d].includes(v)) ? ' sel' : '';
}

// ---------- Cálculos compartidos (pantalla y resumen PDF) ----------

function resumenAtaques(lista) {
  const conRes = lista.filter((j) => j.resultado);
  const pts = lista.filter((j) => esPuntoDeAtaque(j.resultado)).length;
  const malos = lista.filter((j) => j.resultado === 'error' || j.resultado === 'bloqueado').length;
  const ef = conRes.length ? Math.round((100 * (pts - malos)) / conRes.length) : null;
  return { n: lista.length, conRes: conRes.length, pts, malos, ef };
}

function txtEficacia(ef) { return ef == null ? '—' : (ef > 0 ? '+' : '') + ef + ESPACIO_FINO + '%'; }

// Indicadores generales con los filtros activos
function indicadores(d) {
  const rallies = filtrar(d.rallies, 'rallies');
  const recs = filtrar(d.recepciones, 'recepciones');
  const ataques = filtrar(d.jugadas, 'jugadas').filter((j) => j.ataque);
  const pos = recs.filter((r) => r.pase === '#' || r.pase === '+').length;
  return {
    sideOut: pct(rallies.filter((r) => r.sideOut).length, rallies.length),
    rallies: rallies.length,
    recPositiva: pct(pos, recs.length),
    recepciones: recs.length,
    eficacia: resumenAtaques(ataques).ef,
    ataques: ataques.length,
    primerAtaque: pct(rallies.filter((r) => r.primerPunto).length, rallies.length),
  };
}

// ---------- Partes de las vistas ----------

function tablaZonas(filas, titulo) {
  // filas: [{ etiqueta, jugadas, filtro: {dim: valor} }]
  const cab = `<tr><th>${titulo}</th>${ORDEN_ZONAS.map((z) => `<th>${z}</th>`).join('')}<th>n</th></tr>`;
  const cuerpo = filas.map((f) => {
    const n = f.jugadas.length;
    const cuentas = ORDEN_ZONAS.map((z) => f.jugadas.filter((j) => j.zona === z).length);
    const max = Math.max(...cuentas);
    const celdas = ORDEN_ZONAS.map((z, i) => {
      const c = cuentas[i];
      const filtro = { ...f.filtro, zona: z };
      return celda(n ? c / n : 0, c ? txtPct(pct(c, n)) : '·',
        `data-fijar='${JSON.stringify(filtro)}' title="${c} de ${n}"`, ` clic${c && c === max ? ' max' : ''}${marcaFiltro(filtro)}`);
    }).join('');
    return `<tr${f.etiqueta === 'Total' ? ' class="total"' : ''}><th class="clic${marcaFiltro(f.filtro)}" data-fijar='${JSON.stringify(f.filtro)}'>${f.etiqueta}</th>${celdas}<td class="num tenue">${n}</td></tr>`;
  }).join('');
  return `<table class="tabla">${cab}${cuerpo}</table>`;
}

function canchaMini(contenido, p) {
  const otroTexto = partidosIncluidos().length > 1 ? 'rivales' : null;
  return `<svg class="cancha-mini" viewBox="0 0 220 130">${baseCancha(p, otroTexto)}${contenido}</svg>`;
}

function partesArmador(d, p) {
  const todas = filtrar(d.jugadas, 'jugadas');
  // La distribución es la del armador en jugadas normales: emergencia y segunda van aparte
  const js = todas.filter((j) => !ARMADAS[j.armada].especial);
  const emerg = todas.filter((j) => j.armada === 'emergencia').length;
  const buenas = (lista) => lista.filter((j) => j.pase === '#' || j.pase === '+');
  const filaSegunda = (etiqueta, lista) => {
    const seg = lista.filter((j) => j.armada === 'segunda');
    const b = buenas(lista);
    const segB = buenas(seg).length;
    return `<tr><th>${etiqueta}</th><td class="num">${seg.length || '·'}</td><td class="num tenue">${b.length}</td>` +
      `<td class="num"><b>${b.length ? txtPct(pct(segB, b.length)) : '—'}</b></td></tr>`;
  };
  const segunda = `<table class="tabla"><tr><th>Rot.</th><th>Segundas</th><th>Armadas # +</th><th>% segunda</th></tr>` +
    [1, 2, 3, 4, 5, 6].map((r) => filaSegunda(`P${r}`, todas.filter((j) => j.rot === r))).join('') +
    filaSegunda('Total', todas) + `</table>`;
  const porRot = [1, 2, 3, 4, 5, 6].map((r) => ({ etiqueta: `P${r}`, jugadas: js.filter((j) => j.rot === r), filtro: { rot: r } }));
  porRot.push({ etiqueta: 'Total', jugadas: js, filtro: {} });
  const porPase = ['#', '+', '!', '-'].map((c) => ({ etiqueta: c, jugadas: js.filter((j) => j.pase === c), filtro: { pase: c } }));
  const puntos = todas.map((j) => {
    const [x, y] = aVB(j.armadaObj.punto);
    return `<circle cx="${x}" cy="${y}" r="2.2" fill="none" stroke="var(${ARMADAS[j.armada].variable})" stroke-width="1.1" opacity="0.85"/>`;
  }).join('');
  const porTipo = Object.keys(ARMADAS).filter((t) => !ARMADAS[t].especial).map((t) => {
    const c = js.filter((j) => j.armada === t).length;
    return `<span class="ley clic${marcaFiltro({ armada: t })}" data-fijar='${JSON.stringify({ armada: t })}'>${muestra(t)}${ARMADAS[t].corto} <b>${txtPct(pct(c, js.length))}</b></span>`;
  }).join('');
  return {
    n: js.length,
    porRot: tablaZonas(porRot, 'Rot.'),
    porPase: tablaZonas(porPase, 'Pase'),
    porTipo: `<div class="leyenda-fila">${porTipo}</div>`,
    // Emergencias sobre el total de armadas (incluidas emergencia y segunda)
    emergencias: `<p class="stats-nota">${muestra('emergencia')} Emergencias: <b>${emerg}</b> (${txtPct(pct(emerg, todas.length))} de ${todas.length} armadas)</p>`,
    segunda,
    cancha: canchaMini(puntos, p),
  };
}

function partesAtaque(d, p, mapaModo) {
  const js = filtrar(d.jugadas, 'jugadas').filter((j) => j.ataque);
  const fila = (etiqueta, lista, filtro) => {
    const r = resumenAtaques(lista);
    const remates = lista.filter((j) => j.golpe === 'remate');
    const dirPct = (dir) => {
      const c = remates.filter((j) => j.dir === dir).length;
      return celda(remates.length ? c / remates.length : 0, c ? txtPct(pct(c, remates.length)) : '·');
    };
    const toques = lista.filter((j) => j.golpe !== 'remate').length;
    return `<tr><th class="clic${marcaFiltro(filtro)}" data-fijar='${JSON.stringify(filtro)}'>${etiqueta}</th>` +
      `<td class="num tenue">${r.n}</td>${dirPct('calle')}${dirPct('diago')}${dirPct('diago corta')}` +
      `<td class="num">${toques ? txtPct(pct(toques, r.n)) : '·'}</td>` +
      `<td class="num">${txtPct(pct(r.pts, r.conRes))}</td><td class="num">${txtPct(pct(r.malos, r.conRes))}</td>` +
      `<td class="num"><b>${txtEficacia(r.ef)}</b></td></tr>`;
  };
  const filas = ORDEN_ZONAS.map((z) => fila(z, js.filter((j) => j.zona === z), { zona: z })).join('') + fila('Total', js, {});
  let mapa;
  if (mapaModo === 'calor') {
    const bins = {};
    let max = 0;
    for (const j of js) {
      const [x, y] = aMetros(j.ataque.punto);
      const k = `${Math.floor(x)},${Math.floor(y)}`;
      bins[k] = (bins[k] || 0) + 1;
      max = Math.max(max, bins[k]);
    }
    mapa = Object.entries(bins).map(([k, c]) => {
      const [x, y] = k.split(',').map(Number);
      return `<rect x="${x * VB}" y="${y * VB}" width="${VB}" height="${VB}" fill="var(--texto)" opacity="${(0.12 + 0.7 * (c / max)).toFixed(2)}"/>`;
    }).join('');
  } else {
    const op = js.length > 40 ? 0.35 : js.length > 15 ? 0.55 : 0.85;
    mapa = js.map((j) => dibujarJugada({ armada: j.armadaObj, ataque: j.ataque }, op, false)).join('');
  }
  return {
    n: js.length,
    tabla: `<table class="tabla"><tr><th>Zona</th><th>n</th><th>Calle</th><th>Diago</th><th>D. corta</th><th>Toque</th><th>Punto</th><th>Err+Bl</th><th>Efic.</th></tr>${filas}</table>`,
    cancha: canchaMini(mapa, p),
  };
}

function partesSideout(d) {
  const rs = filtrar(d.rallies, 'rallies');
  const fila = (etiqueta, lista, filtro) => {
    const n = lista.length;
    const so = lista.filter((r) => r.sideOut).length;
    const pp = lista.filter((r) => r.primerPunto).length;
    const p100 = pct(so, n);
    return `<tr${etiqueta === 'Total' ? ' class="total"' : ''}><th class="clic${marcaFiltro(filtro)}" data-fijar='${JSON.stringify(filtro)}'>${etiqueta}</th>` +
      `<td class="num">${n}</td><td class="num">${so}</td><td class="num max">${txtPct(p100)}</td>` +
      `<td class="barra-celda"><span style="width:${p100 || 0}%"></span></td><td class="num">${txtPct(pct(pp, n))}</td></tr>`;
  };
  const cab = (t) => `<tr><th>${t}</th><th>Recibe</th><th>Gana</th><th>Side-out</th><th></th><th>1er ataque</th></tr>`;
  const porRot = [1, 2, 3, 4, 5, 6].map((r) => fila(`P${r}`, rs.filter((x) => x.rot === r), { rot: r })).join('') + fila('Total', rs, {});
  const porPase = CALIFS.map((c) => fila(c, rs.filter((x) => x.pase === c), { pase: c })).join('');
  return {
    porRot: `<table class="tabla">${cab('Rot.')}${porRot}</table>`,
    porPase: `<table class="tabla">${cab('Pase')}${porPase}</table>`,
  };
}

function partesRecepcion(d) {
  const rs = filtrar(d.recepciones, 'recepciones');
  const n = rs.length;
  const cuenta = (c) => rs.filter((r) => r.pase === c).length;
  const barra = CALIFS.map((c) => {
    const k = cuenta(c);
    return k ? `<span class="seg ${CALIF[c].clase}" style="flex:${k}" data-fijar='${JSON.stringify({ pase: c })}' title="${c}: ${k}">${c} ${txtPct(pct(k, n))}</span>` : '';
  }).join('');
  const pos = cuenta('#') + cuenta('+');
  const kpis = `<div class="kpis"><div><b>${n}</b><span>recepciones</span></div>` +
    `<div><b>${txtPct(pct(pos, n))}</b><span>positiva (# +)</span></div>` +
    `<div><b>${txtPct(pct(cuenta('#'), n))}</b><span>perfecta</span></div>` +
    `<div><b>${txtPct(pct(cuenta('='), n))}</b><span>error</span></div></div>`;
  const fila = (etiqueta, lista, filtro) => {
    const m = lista.length;
    const k = (c) => lista.filter((r) => r.pase === c).length;
    return `<tr><th class="clic${marcaFiltro(filtro)}" data-fijar='${JSON.stringify(filtro)}'>${etiqueta}</th><td class="num tenue">${m}</td>` +
      CALIFS.map((c) => celda(m ? k(c) / m : 0, k(c) || '·')).join('') +
      `<td class="num max">${txtPct(pct(k('#') + k('+'), m))}</td><td class="num">${txtPct(pct(k('='), m))}</td></tr>`;
  };
  const cab = (t) => `<tr><th>${t}</th><th>n</th>${CALIFS.map((c) => `<th>${c}</th>`).join('')}<th>Posit.</th><th>Error</th></tr>`;
  const conJugador = [...new Set(rs.filter((r) => r.jugador != null).map((r) => r.jugador))].sort((a, b) => a - b);
  const porRot = [1, 2, 3, 4, 5, 6].map((r) => fila(`P${r}`, rs.filter((x) => x.rot === r), { rot: r })).join('');
  return {
    n,
    kpis,
    barra: n ? `<div class="barra-calif">${barra}</div>` : '',
    porJugador: conJugador.length
      ? `<table class="tabla">${cab('Jug.')}${conJugador.map((j) => fila(esc(etiquetaJugador(j)), rs.filter((r) => r.jugador === j), { jugador: j })).join('')}</table>`
      : '',
    porRot: `<table class="tabla">${cab('Rot.')}${porRot}</table>`,
  };
}

function partesSaque(d, p) {
  const rs = filtrar(d.todos, 'todos');
  const cols = ['aceScout', 'errorScout', 'bloqueo', 'aceOtro', 'errorOtro'];
  const fila = (etiqueta, lista, filtro) => {
    const n = (ev) => lista.filter((r) => r.evento === ev).length;
    return `<tr><th class="clic${marcaFiltro(filtro)}" data-fijar='${JSON.stringify(filtro)}'>${etiqueta}</th>` +
      `<td class="num tenue">${lista.filter((r) => r.sacaScout).length}</td>` +
      cols.map((c, i) => `<td class="num${i === 3 ? ' sep' : ''}">${n(c) || '·'}</td>`).join('') +
      `<td class="num tenue">${lista.filter((r) => !r.sacaScout).length}</td></tr>`;
  };
  const scoutNom = esc(nombre(p.scouteado, p));
  const otroNom = esc(partidosIncluidos().length > 1 ? 'Rivales' : nombre(otro(p.scouteado), p));
  const cab = (t) => `<tr><th></th><th colspan="4" class="grupo-col">${scoutNom}</th><th colspan="3" class="grupo-col sep">${otroNom}</th></tr>` +
    `<tr><th>${t}</th><th>Saques</th><th>Aces</th><th>Err. saque</th><th>Bloqueos</th><th class="sep">Aces</th><th>Err. saque</th><th>Saques</th></tr>`;
  const sets = [...new Set(rs.map((r) => r.set))].sort((a, b) => a - b);
  return {
    porSet: `<table class="tabla">${cab('Set')}${sets.map((st) => fila(`Set ${st}`, rs.filter((r) => r.set === st), { set: st })).join('')}${fila('Total', rs, {})}</table>`,
    porRot: `<table class="tabla">${cab('Rot.')}${[1, 2, 3, 4, 5, 6].map((r) => fila(`P${r}`, rs.filter((x) => x.rot === r), { rot: r })).join('')}</table>`,
  };
}

// ---------- Vistas en pantalla ----------

function vistaSideout(d) {
  const a = partesSideout(d);
  return `<p class="stats-nota">Rallies en que el ${esc(nombre(partidoRef().scouteado, partidoRef()))} recibe. «1er ataque» = punto directo en el primer ataque tras la recepción.</p>` +
    `<h3>Por rotación</h3>${a.porRot}` +
    `<h3>Por calidad de pase</h3>${a.porPase}`;
}

function vistaSaque(d) {
  const a = partesSaque(d, partidoRef());
  return `<p class="stats-nota">Aces y errores de saque de cada equipo, y puntos de bloqueo del ${esc(nombre(partidoRef().scouteado, partidoRef()))}. ` +
    `Se registran al cerrar con G (3 ace, 4 error de saque, 5 bloqueo); una recepción «=» cuenta como ace del que saca. ` +
    `La rotación es la del armador scouteado.</p>` +
    `<h3>Por set</h3>${a.porSet}<h3>Por rotación</h3>${a.porRot}`;
}

function vistaRecepcion(d) {
  const a = partesRecepcion(d);
  return a.kpis + a.barra +
    (a.porJugador ? `<h3>Por jugador</h3>${a.porJugador}` : '<p class="stats-nota">Asigna jugadores a las recepciones para ver la tabla por jugador.</p>') +
    `<h3>Por rotación</h3>${a.porRot}`;
}

// ---------- Resumen en PDF (window.print con hoja @media print) ----------

function textoFiltro(dim, v) {
  switch (dim) {
    case 'set': return `set ${v}`;
    case 'rot': return `P${v}`;
    case 'pase': return `pase ${v}`;
    case 'fase': return FASES[v].toLowerCase();
    case 'armada': return ARMADAS[v].nombre.toLowerCase();
    case 'zona': return v;
    case 'golpe': return GOLPES[v].nombre.toLowerCase();
    case 'resultado': return RESULTADOS[v].nombre.toLowerCase();
    case 'jugador': return etiquetaJugador(v);
    case 'momento': return MOMENTOS[v].toLowerCase();
    default: return String(v);
  }
}

function leyendaResultados() {
  return `<div class="leyenda-fila">${Object.keys(RESULTADOS).map((r) =>
    `<span class="ley">${simboloMini(r)}${esc(RESULTADOS[r].nombre)}</span>`).join('')}</div>`;
}

// Línea por partido, desde el punto de vista del equipo scouteado
function lineaPartido(x) {
  const scout = x.scouteado;
  const i = scout === 'propio' ? 0 : 1;
  const g = setsGanados(x);
  const sets = x.sets.filter((st) => st.rallies.length).map((st) => {
    const m = st.final || marcadorTras(st);
    return `${m[i]}-${m[1 - i]}${st.final ? '' : '*'}`;
  });
  const rallies = x.sets.reduce((n, st) => n + st.rallies.filter((r) => r.gana).length, 0);
  return `<div><b>vs ${esc(nombre(otro(scout), x))}</b>, ${esc(fmtFecha(x.fecha))}: ` +
    `<b>${g[i]}–${g[1 - i]}</b>${sets.length ? ' (' + sets.join(' ') + ')' : ''}, ${rallies} rallies</div>`;
}

// Tabla compacta por jugador para el PDF
function tablaJugadoresPdf(d) {
  const lista = resumenJugadores(d).filter((x) => x.ataques.length);
  if (!lista.length) return '';
  const top = (l, clave, nombres) => {
    const c = {};
    for (const x of l) if (x[clave] != null) c[x[clave]] = (c[x[clave]] || 0) + 1;
    const tot = Object.values(c).reduce((a, b) => a + b, 0);
    const [k, v] = Object.entries(c).sort((a, b) => b[1] - a[1])[0] || [];
    return k == null ? '—' : `${nombres(k)} ${txtPct(pct(v, tot))}`;
  };
  return `<table class="tabla"><tr><th>Jugador</th><th>Ataques</th><th>Zonas</th><th>Dirección dominante</th><th>Golpe</th><th>Punto</th></tr>` +
    lista.map(({ num, ataques }) => {
      const r = resumenAtaques(ataques);
      const zonas = mezcla(ataques, 'zona', (z) => z, 2).replace(/<\/?b>/g, '');
      const rem = ataques.filter((j) => j.golpe === 'remate' && j.dir);
      return `<tr><th>${esc(etiquetaJugador(num))}</th><td class="clave">${ataques.length}</td><td>${zonas}</td>` +
        `<td>${top(rem, 'dir', (x) => NOMBRE_DIR[x])}</td><td>${top(ataques, 'golpe', (g) => GOLPES[g].corto)}</td>` +
        `<td class="clave">${txtPct(pct(r.pts, r.conRes))}</td></tr>`;
    }).join('') + `</table>`;
}

function htmlResumen(d, partidos) {
  const p = partidoRef();
  const scoutNom = nombre(p.scouteado, p);
  const k = indicadores(d);
  const filtros = Object.entries(stats.filtros).flatMap(([dim, vals]) => vals.map((v) => textoFiltro(dim, v)));
  const arm = partesArmador(d, p);
  const atq = partesAtaque(d, p, 'trayectorias');
  const so = partesSideout(d);
  const rec = partesRecepcion(d);
  const enCurso = partidos.some((x) => x.sets.some((st) => st.rallies.length && !st.final));
  const kpi = (valor, nombreKpi, detalle) => `<div><b>${valor}</b><span>${nombreKpi}</span><small>${detalle}</small></div>`;
  return `<div class="hoja">` +
    `<header class="r-cab"><div class="r-marca">VoleyStats · Resumen de scouting</div>` +
    `<h1>${esc(scoutNom)}</h1>` +
    `<div class="r-partidos">${partidos.map(lineaPartido).join('')}</div>` +
    `<div class="r-meta">Marcadores desde el punto de vista de ${esc(scoutNom)}${enCurso ? ' (* set sin terminar)' : ''} · ` +
    `<b>${filtros.length ? 'Filtros: ' + esc(filtros.join(', ')) : 'Todas las jugadas'}</b></div></header>` +
    `<div class="r-kpis">` +
    kpi(txtPct(k.sideOut), 'Side-out', `${k.rallies} rallies recibiendo`) +
    kpi(txtPct(k.recPositiva), 'Recepción positiva (# +)', `${k.recepciones} recepciones`) +
    kpi(txtEficacia(k.eficacia), 'Eficacia de ataque', `${k.ataques} ataques`) +
    kpi(txtPct(k.primerAtaque), 'Punto en 1er ataque', 'tras recepción') +
    `</div>` +
    `<section class="r-sec"><h2>Distribución del armador <span>${arm.n} armadas (sin emergencia ni segunda) · % de cada fila por zona de ataque</span></h2>` +
    `<div class="r-2col"><div><h3>Por rotación</h3>${arm.porRot}</div>` +
    `<div><h3>Por calidad de pase (recepción y defensa)</h3>${arm.porPase}${arm.emergencias}` +
    `<h3>Segunda del armador (% sobre armadas con pase # o +)</h3>${arm.segunda}</div></div></section>` +
    `<section class="r-sec"><h2>Dónde cae la armada <span>${esc(scoutNom)} a la izquierda, atacando hacia la derecha</span></h2>` +
    `<div class="r-cancha">${arm.cancha}</div>${arm.porTipo}` +
    `<div class="leyenda-fila">${['emergencia', 'segunda'].map((t) => `<span class="ley">${muestra(t)}${ARMADAS[t].nombre}</span>`).join('')}</div></section>` +
    `</div>` +
    `<div class="hoja salto">` +
    `<section class="r-sec"><h2>Ataque por zona <span>${atq.n} ataques; dirección sobre remates; eficacia = (puntos − errores − bloqueos) / ataques con resultado</span></h2>` +
    `${atq.tabla}<div class="r-cancha chica">${atq.cancha}</div>${leyendaResultados()}</section>` +
    `<section class="r-sec"><h2>Side-out <span>rallies en que ${esc(scoutNom)} recibe · 1er ataque = punto directo tras la recepción</span></h2>` +
    `<div class="r-2col"><div><h3>Por rotación</h3>${so.porRot}</div><div><h3>Por calidad de pase</h3>${so.porPase}</div></div></section>` +
    `<section class="r-sec"><h2>Recepción <span>${rec.n} recepciones</span></h2>${rec.barra}` +
    `<div class="r-2col"><div><h3>Por rotación</h3>${rec.porRot}</div>` +
    (rec.porJugador ? `<div><h3>Por jugador</h3>${rec.porJugador}</div>` : '') + `</div></section>` +
    `<section class="r-sec"><h2>¿A quién le arman? <span>% de los ataques con jugador asignado</span></h2>` +
    `<div class="r-2col"><div>${tablaAQuien(d)}</div><div>${tablaJugadoresPdf(d)}</div></div></section>` +
    `<footer class="r-pie">Generado con VoleyStats · ${esc(fmtFecha(hoyIso()))}</footer>` +
    `</div>`;
}

function imprimirResumen() {
  const p = partidoRef();
  if (!p || !equipoStats()) return;
  const partidos = partidosIncluidos();
  const d = recolectar(partidos);
  $('resumen').innerHTML = htmlResumen(d, partidos);
  const fechas = partidos.map((x) => x.fecha).filter(Boolean).sort();
  const fecha = !fechas.length ? hoyIso() : fechas[0] === fechas[fechas.length - 1] ? fechas[0] : `${fechas[0]} a ${fechas[fechas.length - 1]}`;
  const titulo = document.title;
  document.title = `VoleyStats - ${nombre(p.scouteado, p)} - ${fecha}`;
  const restaurar = () => { document.title = titulo; window.removeEventListener('afterprint', restaurar); };
  window.addEventListener('afterprint', restaurar);
  window.print();
}

// ---------- Filtros: barra segmentada siempre visible + «Más filtros» ----------

// Filtros sin un grupo (la ficha por rotación necesita todas las rotaciones)
function filtrarSin(lista, tipo, dimExcluida) {
  const dims = DIMS_DATOS[tipo].filter((d) => d !== dimExcluida && stats.filtros[d].length);
  return lista.filter((x) => dims.every((d) => stats.filtros[d].includes(x[d])));
}

const DIMS_MAS = ['armada', 'zona', 'golpe', 'resultado', 'jugador'];

function mismoConjunto(a, b) { return a.length === b.length && a.every((x) => b.includes(x)); }

function gruposSegmentados(d) {
  const sets = [...new Set(d.jugadas.map((j) => j.set).concat(d.todos.map((r) => r.set)))].sort((a, b) => a - b);
  return [
    { k: 'rot', nombre: 'Rotación', opciones: [{ t: 'Todas', v: [] }, ...[1, 2, 3, 4, 5, 6].map((n) => ({ t: `P${n}`, v: [n] }))] },
    { k: 'fase', nombre: 'Fase', opciones: [{ t: 'Todo', v: [] }, { t: 'Side-out', v: ['recepcion'] }, { t: 'Contra', v: ['contra', 'recovery', 'libre'] }] },
    { k: 'pase', nombre: 'Pase', opciones: [{ t: 'Todo', v: [] }, { t: 'Bueno # +', v: ['#', '+'] }, { t: 'Malo ! -', v: ['!', '-'] }] },
    { k: 'set', nombre: 'Set', opciones: [{ t: 'Todos', v: [] }, ...sets.map((n) => ({ t: String(n), v: [n] }))] },
    { k: 'momento', nombre: 'Momento', opciones: [{ t: 'Todo', v: [] }, ...Object.entries(MOMENTOS).map(([k, t]) => ({ t, v: [k] }))] },
  ];
}

// Texto corto de los filtros activos («P1, Side-out, 2 filtros más»)
function textoFiltrosActivos(d) {
  const partes = [];
  for (const g of gruposSegmentados(d)) {
    const actual = stats.filtros[g.k];
    if (!actual.length) continue;
    const op = g.opciones.find((o) => mismoConjunto(o.v, actual));
    partes.push(op ? (g.k === 'set' ? `Set ${op.t}` : g.k === 'pase' ? `pase ${op.t.split(' ')[0].toLowerCase()}` : op.t) : `${g.nombre.toLowerCase()}: varios`);
  }
  const mas = DIMS_MAS.flatMap((k) => stats.filtros[k].map((v) => textoFiltro(k, v)));
  if (mas.length > 2) partes.push(`${mas.length} filtros más`);
  else partes.push(...mas);
  return partes;
}

function renderFiltros(d) {
  const html = gruposSegmentados(d).map((g) => {
    const actual = stats.filtros[g.k];
    const op = g.opciones.find((o) => mismoConjunto(o.v, actual));
    const botones = g.opciones.map((o) =>
      `<button data-seg='${JSON.stringify({ k: g.k, v: o.v })}' class="${op === o ? 'activo' : ''}">${esc(o.t)}</button>`).join('') +
      (op ? '' : '<button class="activo" disabled>Varios</button>');
    return `<div class="seg-grupo${actual.length ? ' filtrado' : ''}"><span class="etiqueta">${g.nombre}</span><div class="segmento">${botones}</div></div>`;
  }).join('');
  const mas = DIMS_MAS.reduce((n, k) => n + stats.filtros[k].length, 0);
  $('stats-filtros').innerHTML = html +
    `<button class="btn-mas${stats.masFiltros ? ' activo' : ''}" id="btn-mas-filtros">+ Más filtros${mas ? ` (${mas})` : ''}</button>` +
    (hayFiltros() ? '<button class="btn-tenue limpiar" id="limpiar-filtros">Limpiar</button>' : '');

  const jugadores = [...new Set(d.jugadas.map((x) => x.jugador).filter((x) => x != null))].sort((a, b) => a - b);
  const filas = [
    ['armada', 'Armada', Object.keys(ARMADAS), (v) => `${muestra(v)}${ARMADAS[v].corto}`],
    ['zona', 'Zona', ORDEN_ZONAS, (v) => v],
    ['golpe', 'Golpe', Object.keys(GOLPES), (v) => (v === 'remate' ? 'Remate' : GOLPES[v].corto)],
    ['resultado', 'Resultado', Object.keys(RESULTADOS), (v) => RESULTADOS[v].nombre],
    ['jugador', 'Jugador', jugadores, (v) => esc(etiquetaJugador(v))],
  ];
  $('mas-filtros').hidden = !stats.masFiltros;
  $('mas-filtros').innerHTML = `<div class="filtros">${filas.map(([k, nom, vals, et]) =>
    `<div class="filtro-fila"><span class="etiqueta">${nom}</span><div class="filtro-chips">` +
    (vals.length ? vals.map((v) =>
      `<button class="fchip${stats.filtros[k].includes(v) ? ' activo' : ''}" data-dim="${k}" data-val='${JSON.stringify(v)}'>${et(v)}</button>`).join('')
      : '<span class="tenue">—</span>') +
    `</div></div>`).join('')}</div>`;
}

function alternarMasFiltros(abrir = !stats.masFiltros) {
  stats.masFiltros = abrir;
  renderStats();
}

// ---------- Tira del video plegado y alcance ----------

function renderTira() {
  const eq = equipoStats();
  const todos = eq ? partidosDelEquipo(eq.id) : [];
  const quitados = eq ? partidosQuitados(eq.id) : [];
  const chips = todos.slice().reverse().map((x) =>
    `<button class="chip-partido${quitados.includes(x.id) ? '' : ' activo'}" data-partido-stats="${x.id}" title="${esc(`${fmtFecha(x.fecha)} vs ${rivalDe(x)}${x.competencia ? ', ' + x.competencia : ''}`)}">` +
    `${esc(fmtFecha(x.fecha).replace(/ \d{4}$/, ''))} <b>${esc(rivalDe(x))}</b></button>`).join('');
  $('stats-tira').innerHTML =
    (ui.lateral ? '' : '<button class="btn-tenue fondo" id="btn-mostrar-video">▶ Mostrar video</button>') +
    `<span class="titulo-equipo">${esc(eq ? eq.nombre : 'Sin equipo')}</span>` +
    `<div class="chips-partidos">${chips}</div>`;
}

// ---------- Pestaña Equipo ----------

const ARMADOR_MEDIA = [84, 66];
const DESTINO_ZONA = { Z4: [82, 9], Z3: [80, 40], Z2: [84, 87], Z5: [48, 12], Z6: [48, 45], Z1: [48, 80] };
let idSvg = 0;

// Tipo de armada que más aparece en una lista (define el color de la flecha)
function armadaPredominante(lista) {
  const c = {};
  for (const j of lista) c[j.armada] = (c[j.armada] || 0) + 1;
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0];
}

function marcadores(id) {
  return `<defs>${Object.entries(ARMADAS).map(([t, a]) =>
    `<marker id="${id}-${t}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" markerUnits="userSpaceOnUse" orient="auto">` +
    `<path d="M0 0L10 5 0 10z" fill="var(${a.variable})"/></marker>`).join('')}</defs>`;
}

// Curva cuadrática con el control desplazado `desvio` unidades en perpendicular, hacia `haciaX`
function curva(a, b, desvio, lado = -1) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const largo = Math.hypot(dx, dy) || 1;
  let nx = -dy / largo, ny = dx / largo;
  if (Math.sign(nx || 1) !== lado) { nx = -nx; ny = -ny; }
  return `M${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${(mx + nx * desvio).toFixed(1)} ${(my + ny * desvio).toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
}

// Media cancha del equipo scouteado (red a la derecha) con flechas armador → zona
function mediaCancha(js, { ancho, alto, k, etiquetas, armador = true }) {
  const id = `mc${++idSvg}`;
  const n = js.length;
  const porZona = Object.keys(DESTINO_ZONA).map((z) => ({ z, lista: js.filter((j) => j.zona === z) })).filter((x) => x.lista.length);
  const max = Math.max(0, ...porZona.map((x) => x.lista.length));
  let s = marcadores(id);
  s += `<rect x="0" y="0" width="90" height="90" fill="var(--superficie-cancha)" stroke="var(--linea-cancha)" stroke-width="0.5"/>`;
  s += `<line x1="60" y1="0" x2="60" y2="90" stroke="var(--linea-cancha)" stroke-width="0.35" opacity="0.7"/>`;
  for (const y of [30, 60]) s += `<line x1="0" y1="${y}" x2="90" y2="${y}" stroke="var(--borde-control)" stroke-width="0.3" stroke-dasharray="1.4 1.4"/>`;
  [[3, [5, 6, 1]], [63, [4, 3, 2]]].forEach(([x, nums]) => nums.forEach((num, i) => {
    s += `<text x="${x}" y="${i * 30 + 27}" font-size="4.2" fill="var(--zona-numero)">${num}</text>`;
  }));
  s += `<line x1="90" y1="-6" x2="90" y2="96" stroke="var(--texto-2)" stroke-width="1.3"/>`;
  // Las flechas finas primero, la mayoritaria encima
  porZona.sort((a, b) => a.lista.length - b.lista.length).forEach(({ z, lista }) => {
    const p100 = (100 * lista.length) / n;
    const tipo = armadaPredominante(lista);
    const mayor = lista.length === max;
    s += `<path d="${curva(ARMADOR_MEDIA, DESTINO_ZONA[z], 11, -1)}" fill="none" stroke="var(${ARMADAS[tipo].variable})" ` +
      `stroke-width="${(0.6 + p100 * k).toFixed(2)}" stroke-linecap="round" opacity="${mayor ? 1 : 0.42}" marker-end="url(#${id}-${tipo})"/>`;
  });
  porZona.forEach(({ z, lista }) => {
    const mayor = lista.length === max;
    if (etiquetas === 'mayor' && !mayor) return;
    const [x, y] = DESTINO_ZONA[z];
    const delantera = x > 70;
    s += `<text x="${delantera ? x - 5 : x}" y="${y < 20 ? y - 3 : y + 7}" font-size="5.6" text-anchor="${delantera ? 'end' : 'middle'}" ` +
      `fill="var(${mayor ? '--texto' : '--texto-3'})" font-weight="${mayor ? 600 : 400}">${z} ${txtPct(Math.round((100 * lista.length) / n))}</text>`;
  });
  s += `<circle cx="${ARMADOR_MEDIA[0]}" cy="${ARMADOR_MEDIA[1]}" r="2.8" fill="var(--fondo)" stroke="var(--texto)" stroke-width="1.2"/>`;
  if (armador) s += `<text x="${ARMADOR_MEDIA[0] - 4}" y="${ARMADOR_MEDIA[1] + 9}" font-size="4.4" fill="var(--texto-3)" text-anchor="middle">armador</text>`;
  return `<svg class="media-cancha" width="${ancho}" height="${alto}" viewBox="-4 -11 104 113">${s}</svg>`;
}

function contarPorZona(js) {
  const c = {};
  for (const j of js) c[j.zona] = (c[j.zona] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}

// Frases de lectura generadas con plantillas fijas
function frasesEquipo(d, js, todas) {
  ui.listasVer = [];
  const ver = (lista, titulo) => { ui.listasVer.push({ lista, titulo }); return `<button data-ver="${ui.listasVer.length - 1}">ver jugadas</button>`; };
  const chica = (n) => (n >= 5 && n <= 9 ? ', muestra chica' : '');
  const rot = stats.filtros.rot.length === 1 ? `En P${stats.filtros.rot[0]} arma` : 'Arma';
  const frases = [];
  const n = js.length;
  if (n >= 5) {
    const [[za, ca], segunda] = contarPorZona(js);
    const texto = segunda
      ? `${rot} <b>${txtPct(pct(ca, n))} a ${za}</b> y <b>${txtPct(pct(segunda[1], n))} a ${segunda[0]}</b>.`
      : `${rot} <b>${txtPct(100)} a ${za}</b>.`;
    const lista = js.filter((j) => j.zona === za || (segunda && j.zona === segunda[0]));
    frases.push({ texto, conteo: `${segunda ? `${ca} y ${segunda[1]}` : ca} de ${n} armadas${chica(n)} · ${ver(lista, `Armadas a ${za}${segunda ? ' y ' + segunda[0] : ''}`)}` });
  }
  const mala = js.filter((j) => j.pase === '!' || j.pase === '-');
  if (mala.length >= 5) {
    const [[z, c]] = contarPorZona(mala);
    frases.push({ texto: `Con pase malo se va a <b>${z}: ${txtPct(pct(c, mala.length))}</b>.`,
      conteo: `${c} de ${mala.length} con pase ! o -${chica(mala.length)} · ${ver(mala.filter((j) => j.zona === z), `Pase malo a ${z}`)}` });
  }
  const ataques = filtrar(d.jugadas, 'jugadas').filter((j) => j.ataque && j.dir);
  if (ataques.length >= 5) {
    const dirs = ['diago', 'calle', 'diago corta'].map((x) => ({ x, c: ataques.filter((j) => j.dir === x).length })).sort((a, b) => b.c - a.c);
    const corta = dirs.find((x) => x.x === 'diago corta');
    const texto = dirs[1].c
      ? `Ataca más <b>${dirs[0].x} (${txtPct(pct(dirs[0].c, ataques.length))})</b> que ${dirs[1].x} (${txtPct(pct(dirs[1].c, ataques.length))}).`
      : `Ataca <b>${dirs[0].x} (${txtPct(100)})</b>.`;
    frases.push({ texto, conteo: `${ataques.length} ataques, d. corta ${txtPct(pct(corta.c, ataques.length))}${chica(ataques.length)} · <button data-tab="ataque">ver Ataque</button>` });
  }
  const segundas = todas.filter((j) => j.armada === 'segunda');
  if (segundas.length) {
    const buenas = todas.filter((j) => j.pase === '#' || j.pase === '+');
    const segB = buenas.filter((j) => j.armada === 'segunda').length;
    frases.push({ texto: `Segunda del armador: <b>${txtPct(pct(segB, buenas.length))}</b> con pase bueno.`,
      conteo: `${segB} de ${buenas.length} con pase # o + · ${ver(segundas, 'Segundas del armador')}` });
  }
  if (!frases.length) return '<p class="stats-nota">Con los filtros actuales hay muy pocas jugadas para sacar una lectura (se necesitan 5 o más).</p>';
  return frases.map((f) => `<div class="frase"><p>${f.texto}</p><div class="conteo">${f.conteo}</div></div>`).join('');
}

function vistaEquipo(d) {
  const todas = filtrar(d.jugadas, 'jugadas');
  const js = todas.filter((j) => !ARMADAS[j.armada].especial);
  const rotSel = stats.filtros.rot.length === 1 ? stats.filtros.rot[0] : null;
  const sinRot = filtrarSin(d.jugadas, 'jugadas', 'rot').filter((j) => !ARMADAS[j.armada].especial);
  const fichas = [1, 2, 3, 4, 5, 6].map((r) => {
    const lista = sinRot.filter((j) => j.rot === r);
    const z = contarPorZona(lista);
    const pie = lista.length
      ? `<b>${z[0][0]} ${txtPct(pct(z[0][1], lista.length))}</b>${z[1] ? `, ${z[1][0]} ${txtPct(pct(z[1][1], lista.length))}` : ''}&ensp;n=${lista.length}`
      : 'sin armadas';
    return `<div class="ficha${rotSel === r ? ' sel' : ''}" data-ficha="${r}" title="Clic: filtrar P${r}"><span class="nombre">P${r}</span>` +
      (lista.length ? mediaCancha(lista, { ancho: 138, alto: 150, k: 0.09, etiquetas: 'mayor', armador: false }) : '<svg viewBox="-4 -11 104 113"></svg>') +
      `<span class="pie">${pie}</span></div>`;
  }).join('');
  const tabla = vistaArmadorTablas(d);
  return `<div class="bloque-titulo">Tendencia${rotSel ? ' · P' + rotSel : ' general'}</div>` +
    `<div class="tendencia"><div>${js.length ? mediaCancha(js, { ancho: 258, alto: 280, k: 0.075, etiquetas: 'todas' }) : '<p class="stats-nota">Sin armadas con estos filtros.</p>'}` +
    `<div class="nota-color">color = armada predominante</div></div>` +
    `<div class="frases">${frasesEquipo(d, js, todas)}</div></div>` +
    `<div class="bloque-titulo">¿A quién le arman?<span>todo, con pase malo y en el final del set</span></div>` + tablaAQuien(d) +
    `<div class="bloque-titulo">Ficha por rotación<span>${rotSel ? `P${rotSel} filtrada` : 'clic en una cancha = filtra esa rotación'}</span></div>` +
    `<div class="fichas${rotSel ? ' filtrada' : ''}">${fichas}</div>` +
    plegable('tablaEquipo', 'Ver tabla · rotación × zona', tabla);
}

function plegable(clave, titulo, contenido, resumen = '') {
  const abierto = !!(prefs.plegables && prefs.plegables[clave]);
  return `<div class="plegable" data-pleg="${clave}"><span class="flecha">${abierto ? '▾' : '▸'}</span><span class="titulo">${titulo}</span>` +
    (resumen ? `<span class="resumen-pleg">${resumen}</span>` : '') + `</div>` + (abierto ? `<div>${contenido}</div>` : '');
}

function vistaArmadorTablas(d) {
  const a = partesArmador(d, partidoRef());
  return `<p class="stats-nota">${a.n} armadas del armador (sin emergencia ni segunda). Porcentaje de cada fila según zona de ataque. Clic en una celda filtra las jugadas.</p>` +
    `<div class="dos-col"><div><h3>Por rotación</h3>${a.porRot}</div>` +
    `<div><h3>Por calidad de pase (recepción y defensa)</h3>${a.porPase}${a.emergencias}` +
    `<h3>Segunda del armador por rotación</h3>${a.segunda}</div></div>`;
}

// ---------- Pestaña Ataque ----------

const ORIGEN_Y = { Z4: 12, Z5: 12, Z3: 45, Z6: 45, Z2: 78, Z1: 78 };
const GRISES_DIR = ['#C9CDD2', '#7E8792', '#4A515A'];
const NOMBRE_DIR = { calle: 'Calle', diago: 'Diago', 'diago corta': 'D. corta' };

// Impacto (coordenadas normalizadas) llevado a la cancha rival de la tarjeta (red en x = 0)
function aRival(punto) {
  const [x, y] = aMetros(punto);
  return [(x - CANCHA.red) * VB, (y - CANCHA.y0) * VB];
}

function tarjetaZona(z, lista) {
  const id = `ta${++idSvg}`;
  const zaguero = ['Z5', 'Z6', 'Z1'].includes(z);
  const origen = [zaguero ? -14 : -6, ORIGEN_Y[z]];
  const r = resumenAtaques(lista);
  let s = marcadores(id);
  s += `<rect x="0" y="0" width="90" height="90" fill="var(--superficie-cancha)" stroke="var(--linea-cancha)" stroke-width="0.5"/>`;
  s += `<line x1="30" y1="0" x2="30" y2="90" stroke="var(--linea-cancha)" stroke-width="0.35" opacity="0.7"/>`;
  s += `<line x1="0" y1="-7" x2="0" y2="97" stroke="var(--texto-2)" stroke-width="1.2"/>`;
  const agregado = lista.length >= 15;
  if (agregado) {
    const rem = lista.filter((j) => j.golpe === 'remate' && j.dir);
    const dirs = ['calle', 'diago', 'diago corta'].map((x) => ({ x, l: rem.filter((j) => j.dir === x) })).filter((x) => x.l.length);
    const max = Math.max(0, ...dirs.map((x) => x.l.length));
    const tipo = armadaPredominante(lista);
    const arriba = origen[1] < 45, abajo = origen[1] > 45;
    // Para Z3/Z6 la diagonal va hacia el lado donde caen más diagonales
    const ladoDiago = (() => {
      const dg = rem.filter((j) => j.dir !== 'calle');
      if (!dg.length) return 1;
      return dg.reduce((a, j) => a + aRival(j.ataque.punto)[1], 0) / dg.length < 45 ? -1 : 1;
    })();
    const destino = (dir) => {
      if (arriba) return { calle: [80, 8], diago: [80, 82], 'diago corta': [26, 84] }[dir];
      if (abajo) return { calle: [80, 82], diago: [80, 8], 'diago corta': [26, 6] }[dir];
      return { calle: [80, 45], diago: [80, ladoDiago < 0 ? 8 : 82], 'diago corta': [26, ladoDiago < 0 ? 6 : 84] }[dir];
    };
    dirs.sort((a, b) => a.l.length - b.l.length).forEach(({ x, l }) => {
      const p100 = (100 * l.length) / rem.length;
      const mayor = l.length === max;
      const fin = destino(x);
      s += `<path d="${curva(origen, fin, 5, 1)}" fill="none" stroke="var(${ARMADAS[tipo].variable})" stroke-width="${(0.5 + p100 * 0.085).toFixed(2)}" ` +
        `stroke-linecap="round" opacity="${mayor ? 1 : 0.42}" marker-end="url(#${id}-${tipo})"/>`;
      s += `<text x="${Math.min(fin[0], 84)}" y="${fin[1] < 45 ? fin[1] + 9 : fin[1] - 5}" font-size="5.6" text-anchor="end" ` +
        `fill="var(${mayor ? '--texto' : '--texto-3'})" font-weight="${mayor ? 600 : 400}">${NOMBRE_DIR[x]} ${txtPct(Math.round(p100))}</text>`;
    });
  } else {
    for (const j of lista) {
      const [x, y] = aRival(j.ataque.punto);
      const color = `var(${ARMADAS[j.armada].variable})`;
      s += `<line x1="${origen[0]}" y1="${origen[1]}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="0.9"/>`;
      s += esPuntoDeAtaque(j.resultado)
        ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="${color}"/>`
        : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" fill="var(--superficie-cancha)" stroke="${color}" stroke-width="0.9"/>`;
    }
  }
  s += `<circle cx="${origen[0]}" cy="${origen[1]}" r="2.6" fill="var(--fondo)" stroke="var(--texto)" stroke-width="1.1"/>`;
  return `<div class="tarjeta" data-fijar='${JSON.stringify({ zona: z })}' title="Clic: filtrar ${z}">` +
    `<div class="cab"><b>${z}</b>n=${lista.length}<span class="efic">efic. ${txtEficacia(r.ef)}</span></div>` +
    `<svg viewBox="-18 -9 116 106">${s}</svg>` +
    `<div class="pie">${agregado ? 'agregado' : 'n<15 · relleno = punto'}</div></div>`;
}

// Tabla de ataque: n · calle · diago · d. corta · punto · error · bloq. · efic. (en %, sin el signo)
function tablaAtaque(filas, titulo) {
  const fila = ({ etiqueta, lista, filtro }) => {
    const rem = lista.filter((j) => j.golpe === 'remate' && j.dir);
    const dir = ['calle', 'diago', 'diago corta'].map((x) => rem.filter((j) => j.dir === x).length);
    const maxDir = Math.max(...dir);
    const conRes = lista.filter((j) => j.resultado);
    const n = (f) => conRes.filter(f).length;
    const r = resumenAtaques(lista);
    const num = (v, b) => (b ? Math.round((100 * v) / b) : '·');
    return `<tr${etiqueta === 'Total' ? ' class="total"' : ''}><th class="clic${marcaFiltro(filtro)}" data-fijar='${JSON.stringify(filtro)}'>${etiqueta}</th>` +
      `<td>${lista.length}</td>` +
      dir.map((v) => `<td class="${v && v === maxDir ? 'max' : ''}">${num(v, rem.length)}</td>`).join('') +
      `<td>${num(r.pts, conRes.length)}</td><td>${num(n((j) => j.resultado === 'error'), conRes.length)}</td>` +
      `<td>${num(n((j) => j.resultado === 'bloqueado'), conRes.length)}</td>` +
      `<td class="clave">${r.ef == null ? '—' : (r.ef > 0 ? '+' : '') + r.ef}</td></tr>`;
  };
  return `<table class="tabla"><tr><th>${titulo}</th><th>n</th><th>Calle</th><th>Diago</th><th>D. corta</th><th>Punto</th><th>Error</th><th>Bloq.</th><th>Efic.</th></tr>` +
    filas.map(fila).join('') + `</table>`;
}

function vistaAtaqueV2(d) {
  const js = filtrar(d.jugadas, 'jugadas').filter((j) => j.ataque);
  if (!js.length) return '<p class="stats-nota">No hay ataques con estos filtros.</p>';
  const rem = js.filter((j) => j.golpe === 'remate' && j.dir);
  const dirs = ['diago', 'calle', 'diago corta'].map((x) => ({ x, c: rem.filter((j) => j.dir === x).length })).sort((a, b) => b.c - a.c);
  const barra = dirs.map((x, i) => (x.c ? `<span style="flex:${x.c};background:${GRISES_DIR[i]}"></span>` : '')).join('');
  const textos = dirs.map((x, i) => `${i === 0 ? '<b>' : ''}${NOMBRE_DIR[x.x]} ${txtPct(pct(x.c, rem.length))}${i === 0 ? '</b>' : ''}`).join('<span></span>');
  const r = resumenAtaques(js);
  const zonas = ['Z4', 'Z3', 'Z2', 'Z1', 'Z6', 'Z5'].map((z) => ({ z, l: js.filter((j) => j.zona === z) })).filter((x) => x.l.length);
  const porZona = zonas.map(({ z, l }) => ({ etiqueta: z, lista: l, filtro: { zona: z } }));
  porZona.push({ etiqueta: 'Total', lista: js, filtro: {} });
  const jugs = [...new Set(js.map((j) => j.jugador).filter((x) => x != null))]
    .map((n) => ({ etiqueta: esc(etiquetaJugador(n)), lista: js.filter((j) => j.jugador === n), filtro: { jugador: n } }))
    .sort((a, b) => b.lista.length - a.lista.length);
  const porJug = jugs.length
    ? tablaAtaque([...jugs, { etiqueta: 'Total', lista: js.filter((j) => j.jugador != null), filtro: {} }], 'Jugador')
    : '<p class="stats-nota">Asigna jugadores a los ataques (menú «Jugador» en la cancha) para ver esta tabla.</p>';
  const impactos = partesAtaque(d, partidoRef(), stats.mapa);
  return `<div class="ataque-resumen"><div class="barra-dir">${barra}</div><div class="dir-textos">${textos}</div>` +
    `<div class="efic-total">Eficacia <b>${txtEficacia(r.ef)}</b></div></div>` +
    `<div class="bloque-titulo">Dirección por zona de origen<span>grosor = % · con menos de 15 jugadas se ven las trayectorias una a una</span></div>` +
    `<div class="tarjetas-ataque">${zonas.map(({ z, l }) => tarjetaZona(z, l)).join('')}</div>` +
    `<div class="dos-col"><div><div class="bloque-titulo">Eficacia por zona</div>${tablaAtaque(porZona, 'Zona')}</div>` +
    `<div><div class="bloque-titulo">Por jugador</div>${porJug}</div></div>` +
    plegable('impactos', 'Ver impactos en la cancha',
      `<div class="fila-titulo"><span class="stats-nota">${impactos.n} ataques</span><div class="selector" id="selector-mapa">` +
      `<button data-mapa="trayectorias" class="${stats.mapa === 'trayectorias' ? 'activo' : ''}">Trayectorias</button>` +
      `<button data-mapa="calor" class="${stats.mapa === 'calor' ? 'activo' : ''}">Calor</button></div></div>` +
      `<div style="max-width:620px">${impactos.cancha}</div>`);
}

function vistaSideoutRecepcion(d) {
  return vistaSideout(d) + `<div class="bloque-titulo">Recepción</div>` + vistaRecepcion(d);
}

// ---------- Tendencias de jugadores ----------

const MIN_ACCIONES_FICHA = 5;
const MIN_JUGADAS_GRUPO = 8;
const DIFERENCIA_DESTACADA = 15; // puntos porcentuales

// «¿A quién le arman?»: reparto de los ataques con jugador asignado
function repartoAtaques(lista) {
  const conJug = lista.filter((j) => j.ataque && j.jugador != null);
  const c = {};
  for (const j of conJug) c[j.jugador] = (c[j.jugador] || 0) + 1;
  return { n: conJug.length, porJugador: c };
}

function tablaAQuien(d) {
  const ataques = filtrar(d.jugadas, 'jugadas').filter((j) => j.ataque);
  const cols = [
    { t: 'Todo', l: ataques },
    { t: 'Con pase malo (! -)', l: ataques.filter((j) => j.pase === '!' || j.pase === '-') },
    { t: 'Final de set', l: ataques.filter((j) => j.momento === 'final') },
  ].map((c) => ({ ...c, r: repartoAtaques(c.l) }));
  const total = cols[0].r;
  if (!total.n) return '<p class="stats-nota">Asigna jugadores a los ataques (N y el número, o el menú «Jugador») para ver a quién le arman.</p>';
  const jugadores = Object.keys(total.porJugador).map(Number).sort((a, b) => total.porJugador[b] - total.porJugador[a]).slice(0, 8);
  const maxCol = cols.map((c) => Math.max(0, ...jugadores.map((n) => c.r.porJugador[n] || 0)));
  return `<table class="tabla tabla-aquien"><tr><th>Jugador</th>${cols.map((c) => `<th>${c.t} <span class="n">n=${c.r.n}</span></th>`).join('')}</tr>` +
    jugadores.map((n) => `<tr><th class="clic" data-fijar='${JSON.stringify({ jugador: n })}'>${esc(etiquetaJugador(n))}</th>` +
      cols.map((c, i) => {
        const v = c.r.porJugador[n] || 0;
        return `<td class="${v && v === maxCol[i] ? 'max' : 'clave'}">${c.r.n ? txtPct(pct(v, c.r.n)) : '—'}</td>`;
      }).join('') + '</tr>').join('') +
    `</table><p class="stats-nota">Porcentaje de los ataques con jugador asignado en cada columna. Resaltado: el más buscado.</p>`;
}

// Mini cancha rival con los ataques de un jugador: desde cada zona, flechas por dirección (grosor = %)
function canchaJugador(lista) {
  const id = `cj${++idSvg}`;
  const rem = lista.filter((j) => j.golpe === 'remate' && j.dir);
  let s = marcadores(id);
  s += `<rect x="0" y="0" width="90" height="90" fill="var(--superficie-cancha)" stroke="var(--linea-cancha)" stroke-width="0.5"/>`;
  s += `<line x1="30" y1="0" x2="30" y2="90" stroke="var(--linea-cancha)" stroke-width="0.35" opacity="0.7"/>`;
  s += `<line x1="0" y1="-7" x2="0" y2="97" stroke="var(--texto-2)" stroke-width="1.2"/>`;
  const destino = (y, dir) => {
    const arriba = y < 45, abajo = y > 45;
    if (dir === 'calle') return [80, arriba ? 8 : abajo ? 82 : 45];
    if (dir === 'diago') return [80, arriba ? 82 : 8];
    return [26, arriba ? 84 : 6];
  };
  const grupos = [];
  for (const z of ['Z4', 'Z3', 'Z2', 'Z1', 'Z6', 'Z5']) {
    for (const dir of ['calle', 'diago', 'diago corta']) {
      const l = rem.filter((j) => j.zona === z && j.dir === dir);
      // Solo las combinaciones que pesan (≥ 5 %), para que la cancha se lea
      if (l.length && l.length / rem.length >= 0.05) grupos.push({ z, dir, l });
    }
  }
  const max = Math.max(0, ...grupos.map((g) => g.l.length));
  grupos.sort((a, b) => a.l.length - b.l.length).forEach(({ z, dir, l }) => {
    const origen = [['Z5', 'Z6', 'Z1'].includes(z) ? -14 : -6, ORIGEN_Y[z]];
    const tipo = armadaPredominante(l);
    const p100 = (100 * l.length) / rem.length;
    s += `<path d="${curva(origen, destino(origen[1], dir), 5, 1)}" fill="none" stroke="var(${ARMADAS[tipo].variable})" stroke-width="${(0.5 + p100 * 0.085).toFixed(2)}" ` +
      `stroke-linecap="round" opacity="${l.length === max ? 1 : 0.5}" marker-end="url(#${id}-${tipo})"/>`;
  });
  return `<svg viewBox="-18 -9 116 106">${s}</svg>`;
}

function mezcla(lista, clave, nombres, limite = 3) {
  const c = {};
  for (const x of lista) if (x[clave] != null) c[x[clave]] = (c[x[clave]] || 0) + 1;
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, limite)
    .map(([k, v], i) => `${i === 0 ? '<b>' : ''}${esc(nombres(k))} ${txtPct(pct(v, total))}${i === 0 ? '</b>' : ''}`).join(', ') || '—';
}

// Datos por jugador (para fichas, PDF y comparar)
function resumenJugadores(d) {
  const ataques = filtrar(d.jugadas, 'jugadas').filter((j) => j.ataque && j.jugador != null);
  const recs = filtrar(d.recepciones, 'recepciones').filter((r) => r.jugador != null);
  const nums = [...new Set([...ataques.map((j) => j.jugador), ...recs.map((r) => r.jugador)])];
  return nums.map((num) => {
    const a = ataques.filter((j) => j.jugador === num), r = recs.filter((x) => x.jugador === num);
    return { num, ataques: a, recepciones: r, acciones: a.length + r.length };
  }).filter((x) => x.acciones >= MIN_ACCIONES_FICHA)
    .sort((x, y) => y.ataques.length - x.ataques.length || y.acciones - x.acciones);
}

function vistaJugadores(d) {
  const lista = resumenJugadores(d);
  if (!lista.length) return `<p class="stats-nota">Todavía no hay jugadores con ${MIN_ACCIONES_FICHA} o más acciones asignadas con estos filtros. Asigna jugadores con N y el número (o el menú «Jugador» en la cancha).</p>`;
  const nombreZona = (z) => z;
  const fichas = lista.map(({ num, ataques, recepciones }) => {
    const eq = equipoStats();
    const pj = eq && eq.plantel.find((x) => x.num === num);
    const r = resumenAtaques(ataques);
    const golpes = mezcla(ataques, 'golpe', (g) => (g === 'remate' ? 'remate' : GOLPES[g].corto));
    const n = recepciones.length;
    const k = (c) => recepciones.filter((x) => x.pase === c).length;
    const barra = n ? `<div class="barra-calif chica">${CALIFS.map((c) => (k(c) ? `<span class="seg ${CALIF[c].clase}" style="flex:${k(c)}" title="${c}: ${k(c)}">${c}</span>` : '')).join('')}</div>` : '';
    return `<div class="ficha-jugador" data-fijar='${JSON.stringify({ jugador: num })}' title="Clic: filtrar ${esc(etiquetaJugador(num))}">` +
      `<div class="fj-cab"><b>${esc(etiquetaJugador(num))}</b>${pj && pj.pos ? `<span>${esc(POSICIONES[pj.pos].nombre.toLowerCase())}</span>` : ''}` +
      `<span class="n">${ataques.length} ataques${n ? `, ${n} recepciones` : ''}</span></div>` +
      (ataques.length ? canchaJugador(ataques) : '') +
      (ataques.length ? `<dl>` +
        `<dt>Desde</dt><dd>${mezcla(ataques, 'zona', nombreZona)}</dd>` +
        `<dt>Armadas</dt><dd>${mezcla(ataques, 'armada', (t) => ARMADAS[t].corto)}</dd>` +
        `<dt>Golpe</dt><dd>${golpes}</dd>` +
        `<dt>Resultado</dt><dd>punto ${txtPct(pct(r.pts, r.conRes))}, error + bloq. ${txtPct(pct(r.malos, r.conRes))}</dd></dl>` : '') +
      (n ? `<div class="fj-rec"><span>Recepción</span>${barra}<span class="tenue">${txtPct(pct(k('#') + k('+'), n))} positiva</span></div>` : '') +
      `</div>`;
  }).join('');
  return `<p class="stats-nota">Jugadores con ${MIN_ACCIONES_FICHA} o más acciones asignadas, ordenados por cantidad de ataques. Flechas: hacia dónde ataca desde cada zona (grosor = %, color = armada más frecuente).</p>` +
    `<div class="fichas-jugadores">${fichas}</div>`;
}

// ---------- Comparar grupos (set, momento o partido) ----------

function gruposComparar(d) {
  const dim = stats.comparar || 'set';
  if (dim === 'momento') return Object.entries(MOMENTOS).map(([k, t]) => ({ t, f: (x) => x.momento === k }));
  if (dim === 'partido') {
    const conDatos = new Set(filtrar(d.jugadas, 'jugadas').map((j) => j.pid));
    return partidosIncluidos().filter((x) => conDatos.has(x.id)).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).slice(0, 4).map((x) => ({ t: `${fmtFecha(x.fecha).replace(/ \d{4}$/, '')} vs ${rivalDe(x)}`, f: (j) => j.pid === x.id }));
  }
  const sets = [...new Set(filtrar(d.jugadas, 'jugadas').map((j) => j.set))].sort((a, b) => a - b).slice(0, 4);
  return sets.map((n) => ({ t: `Set ${n}`, f: (x) => x.set === n }));
}

function vistaComparar(d) {
  const dim = stats.comparar || 'set';
  const selector = `<div class="seg-grupo"><span class="etiqueta">Comparar por</span><div class="segmento">` +
    [['set', 'Set'], ['momento', 'Momento'], ['partido', 'Partido']].map(([k, t]) =>
      `<button data-comparar="${k}" class="${dim === k ? 'activo' : ''}">${t}</button>`).join('') + `</div></div>`;
  const grupos = gruposComparar(d);
  if (grupos.length < 2) return selector + '<p class="stats-nota">Hacen falta al menos 2 grupos con datos para comparar (por ejemplo, 2 sets o 2 partidos).</p>';
  const js = filtrar(d.jugadas, 'jugadas');
  const rs = filtrar(d.rallies, 'rallies');
  const datos = grupos.map((g) => {
    const jg = js.filter(g.f);
    const normales = jg.filter((j) => !ARMADAS[j.armada].especial);
    const rem = jg.filter((j) => j.ataque && j.golpe === 'remate' && j.dir);
    const rg = rs.filter(g.f);
    return { ...g, n: jg.length, normales, rem, rallies: rg, reparto: repartoAtaques(jg), poco: jg.length < MIN_JUGADAS_GRUPO };
  });
  // Filas: [etiqueta, función que da el % de un grupo (o null)]
  const filas = [];
  filas.push({ titulo: 'Distribución del armador' });
  for (const z of ORDEN_ZONAS) filas.push({ t: z, v: (g) => (g.normales.length ? (100 * g.normales.filter((j) => j.zona === z).length) / g.normales.length : null) });
  filas.push({ titulo: 'Dirección de ataque (remates)' });
  for (const dir of ['calle', 'diago', 'diago corta']) filas.push({ t: NOMBRE_DIR[dir], v: (g) => (g.rem.length ? (100 * g.rem.filter((j) => j.dir === dir).length) / g.rem.length : null) });
  filas.push({ titulo: 'Side-out' });
  filas.push({ t: 'Side-out', v: (g) => (g.rallies.length ? (100 * g.rallies.filter((r) => r.sideOut).length) / g.rallies.length : null) });
  filas.push({ titulo: '¿A quién le arman?' });
  const totalReparto = repartoAtaques(js.filter((j) => datos.some((g) => g.f(j))));
  Object.keys(totalReparto.porJugador).map(Number).sort((a, b) => totalReparto.porJugador[b] - totalReparto.porJugador[a]).slice(0, 5)
    .forEach((num) => filas.push({ t: etiquetaJugador(num), v: (g) => (g.reparto.n ? (100 * (g.reparto.porJugador[num] || 0)) / g.reparto.n : null) }));

  const cuerpo = filas.map((f) => {
    if (f.titulo) return `<tr class="sub"><th colspan="${datos.length + 1}">${f.titulo}</th></tr>`;
    const valores = datos.map((g) => f.v(g));
    const validos = datos.map((g, i) => (!g.poco && valores[i] != null ? valores[i] : null)).filter((v) => v != null);
    const max = Math.max(...validos), min = Math.min(...validos);
    const destacar = validos.length >= 2 && max - min >= DIFERENCIA_DESTACADA;
    return `<tr><th>${esc(f.t)}</th>${valores.map((v, i) => {
      if (v == null) return '<td class="poco">—</td>';
      const r = Math.round(v);
      const marca = destacar && !datos[i].poco && (v === max ? ' ▲' : v === min ? ' ▼' : '');
      return `<td class="${datos[i].poco ? 'poco' : marca ? 'dif' : 'clave'}">${txtPct(r)}${marca || ''}</td>`;
    }).join('')}</tr>`;
  }).join('');
  return selector +
    `<table class="tabla tabla-comparar"><tr><th></th>${datos.map((g) => `<th>${esc(g.t)}<span class="n">${g.n} jugadas${g.poco ? ', pocos datos' : ''}</span></th>`).join('')}</tr>${cuerpo}</table>` +
    `<p class="stats-nota">▲ ▼ diferencias de ${DIFERENCIA_DESTACADA} puntos o más entre grupos. Grupos con menos de ${MIN_JUGADAS_GRUPO} jugadas: tenues («pocos datos»). Los filtros generales aplican a todos los grupos.</p>`;
}

// ---------- Lista de jugadas y video lateral ----------

const DURACION_CLIP = 8; // segundos que se reproduce cada clip con «Seguir solo»

function listaClips(d) {
  if (ui.clipsOverride) return ui.clipsOverride;
  const tipo = DATOS_VISTA[stats.vista];
  let base = tipo === 'todos' ? d.todos.filter((r) => r.evento) : d[tipo];
  if (stats.vista === 'ataque') base = base.filter((j) => j.ataque);
  const lista = filtrar(base, tipo).slice().sort((a, b) =>
    a.pid === b.pid ? a.set - b.set || a.rally - b.rally || a.t - b.t : a.pid.localeCompare(b.pid));
  return { lista, titulo: null, tipo };
}

function filaClip(c, tipo, i) {
  let det = '', res = '';
  if (tipo === 'jugadas') {
    det = `${muestra(c.armada)}<span>${ARMADAS[c.armada].corto} · ${c.zona}</span>` + (c.pase ? califBadge(c.pase) : '') +
      (c.jugador != null ? `<span class="calc">${esc(etiquetaJugador(c.jugador))}</span>` : '');
    res = c.resultado ? RESULTADOS[c.resultado].nombre : c.ataque ? '…' : 'sin ataque';
  } else if (tipo === 'recepciones') {
    det = `${califBadge(c.pase)}<span>${CALIF[c.pase].nombre}</span>`;
    res = `gana ${nombre(c.gana, almacen.partidos[c.pid])}`;
  } else if (tipo === 'todos') {
    const x = almacen.partidos[c.pid];
    const textos = { aceScout: 'Ace', errorScout: 'Error de saque', aceOtro: 'Ace rival', errorOtro: 'Error de saque rival', bloqueo: 'Bloqueo' };
    det = `<span>${textos[c.evento]}</span>`;
    res = nombre(c.ganaScout ? x.scouteado : otro(x.scouteado), x);
  } else {
    det = (c.pase ? califBadge(c.pase) : '<span class="tenue">sin recepción</span>') + (c.primerPunto ? '<span class="calc">1er ataque</span>' : '');
    res = c.sideOut ? 'Side-out' : 'Punto rival';
  }
  const varios = partidosIncluidos().length > 1;
  const ref = `${varios ? fmtFecha(almacen.partidos[c.pid].fecha).replace(/ \d{4}$/, '') + ' ' : ''}S${c.set} R${c.rally}`;
  return `<div class="fila-clip${ui.clipIdx === i ? ' actual' : ''}" data-clip="${i}">` +
    `<span class="ref">${esc(ref)}</span><span class="t">${fmtMinuto(c.t)}</span>` +
    `<span class="detalle">${det}</span><span class="res">${esc(res)}</span><span class="tenue">▶</span></div>`;
}

function renderLateral(d) {
  const { lista, titulo, tipo } = listaClips(d);
  ui.clipsActuales = { lista, tipo };
  const x = partido();
  $('lateral-cab').innerHTML = `<span class="titulo">${esc(tituloPartido(x))}</span>` +
    `<button class="btn-tenue chico" id="btn-esconder-video">✕ Esconder</button>`;
  renderLateralCtl();
  const filtros = textoFiltrosActivos(d);
  $('clips-titulo').textContent = titulo || `${lista.length} jugadas${filtros.length ? ': ' + filtros.join(', ') : ''}`;
  $('clips-cuenta').textContent = titulo ? `${lista.length}` : '';
  $('clips-lista').innerHTML = lista.length ? lista.map((c, i) => filaClip(c, tipo, i)).join('') : '<div class="vacio">No hay jugadas con estos filtros.</div>';
  renderAvisoStats();
}

function renderLateralCtl() {
  if (ui.modo !== 'stats' || !ui.lateral) return;
  const n = ui.clipsActuales ? ui.clipsActuales.lista.length : 0;
  $('lateral-ctl').innerHTML =
    `<button class="ctl" data-clipnav="-1" title="Clip anterior">${ICONOS.anterior}</button>` +
    `<button class="ctl" data-clipnav="0" title="Reproducir / pausar">${Video.pausado() ? ICONOS.play : ICONOS.pausa}</button>` +
    `<button class="ctl" data-clipnav="1" title="Clip siguiente">${ICONOS.siguiente}</button>` +
    `<span class="clip-n">${ui.clipIdx != null && n ? `clip ${ui.clipIdx + 1} de ${n}` : `${n} jugadas`}</span>` +
    `<label class="casilla"><input type="checkbox" id="seguir-solo" ${prefs.seguirSolo ? 'checked' : ''}> Seguir solo</label>`;
}

function abrirLateral(abrir = true) {
  ui.lateral = abrir;
  document.body.classList.toggle('lateral', abrir && ui.modo === 'stats');
  if (!abrir) { Video.pausar(); ui.clipIdx = null; ui.clipActivo = null; ui.clipsOverride = null; }
  renderStats();
}

async function reproducirIndice(i) {
  const c = ui.clipsActuales && ui.clipsActuales.lista[i];
  if (!c) return;
  ui.clipIdx = i;
  ui.clipActivo = { t: c.t };
  if (!ui.lateral) abrirLateral(true);
  $('clips-lista').querySelectorAll('.fila-clip').forEach((f) => f.classList.toggle('actual', Number(f.dataset.clip) === i));
  await reproducirClip(c.pid, c.t);
  renderLateral(recolectar(partidosIncluidos()));
}

// «Seguir solo»: pasado el clip, salta al siguiente
function seguirClips(t) {
  if (ui.modo !== 'stats' || !ui.lateral || !prefs.seguirSolo || !ui.clipActivo || Video.pausado()) return;
  if (t < ui.clipActivo.t + DURACION_CLIP) return;
  const n = ui.clipsActuales ? ui.clipsActuales.lista.length : 0;
  if (ui.clipIdx != null && ui.clipIdx + 1 < n) reproducirIndice(ui.clipIdx + 1);
  else { Video.pausar(); ui.clipActivo = null; }
}

function renderAvisoStats() {
  const el = $('clips-aviso');
  if (!el) return;
  el.textContent = ui.aviso && ui.aviso.hasta > Date.now() ? ui.aviso.texto : '';
}

// ---------- Render de estadísticas ----------

function unidadesVista(d) {
  // Equipo: armadas del armador (sin emergencia ni segunda), igual que las frases y la distribución
  const normales = (l) => l.filter((j) => !ARMADAS[j.armada].especial);
  if (stats.vista === 'equipo') return [normales(filtrar(d.jugadas, 'jugadas')).length, normales(d.jugadas).length, 'armadas'];
  if (stats.vista === 'jugadores') return [resumenJugadores(d).length, resumenJugadores(d).length, 'jugadores con ficha'];
  if (stats.vista === 'comparar') return [filtrar(d.jugadas, 'jugadas').length, d.jugadas.length, 'jugadas'];
  if (stats.vista === 'ataque') return [filtrar(d.jugadas, 'jugadas').filter((j) => j.ataque).length, d.jugadas.filter((j) => j.ataque).length, 'ataques'];
  if (stats.vista === 'sideout') return [filtrar(d.rallies, 'rallies').length, d.rallies.length, `rallies recibiendo`];
  return [filtrar(d.todos, 'todos').length, d.todos.length, 'rallies'];
}

function renderStats() {
  const p = partidoRef();
  if (!p || !equipoStats()) return;
  document.body.classList.toggle('lateral', !!ui.lateral);
  const d = recolectar(partidosIncluidos());
  renderTira();
  renderFiltros(d);
  $('stats-tabs').innerHTML = Object.entries(VISTAS)
    .map(([k, v]) => `<button data-vistastats="${k}" class="${stats.vista === k ? 'activo' : ''}">${v}</button>`).join('');
  const [n, total, unidad] = unidadesVista(d);
  const filtrosTxt = textoFiltrosActivos(d);
  $('stats-resumen').textContent = `${nombre(p.scouteado, p)}${filtrosTxt.length ? ', ' + filtrosTxt.join(', ') : ''} · ${n === total ? n : `${n} de ${total}`} ${unidad}`;
  const vistas = { equipo: vistaEquipo, jugadores: vistaJugadores, ataque: vistaAtaqueV2, sideout: vistaSideoutRecepcion, saque: vistaSaque, comparar: vistaComparar };
  const cont = $('stats-contenido');
  const scroll = cont.scrollTop;
  cont.innerHTML = vistas[stats.vista](d);
  cont.scrollTop = scroll;
  if (ui.lateral) renderLateral(d);
}

async function reproducirClip(pid, t) {
  if (pid !== almacen.actual) {
    if (!almacen.partidos[pid]) return;
    await cambiarPartido(pid);
  }
  if (!Video.fuente) {
    const x = partido();
    avisar(x.video && x.video.tipo === 'local'
      ? `Abre el archivo «${x.video.nombre}» y vuelve a hacer clic en el clip.`
      : 'Carga el video de este partido y vuelve a hacer clic en el clip.');
    return;
  }
  Video.saltar(t);
  Video.reproducir();
}

function cambiarModo(modo) {
  if (modo === 'captura' && !partido()) modo = 'equipos';
  // Desde captura, las estadísticas muestran al equipo del partido abierto
  if (modo === 'stats' && ui.modo === 'captura' && partido()) stats.equipoId = (equipoDe(partido().scouteado) || {}).id || stats.equipoId;
  if (modo === 'stats' && !equipoStats()) modo = 'equipos';
  ui.modo = modo;
  prefs.modo = modo;
  guardarPrefs();
  document.body.classList.toggle('modo-stats', modo === 'stats');
  document.body.classList.toggle('modo-equipos', modo === 'equipos');
  document.body.classList.toggle('lateral', modo === 'stats' && !!ui.lateral);
  $('selector-modo').querySelectorAll('button').forEach((b) => b.classList.toggle('activo', b.dataset.modo === modo));
  alternarAyuda(false);
  cerrarMenus();
  aplicarFoco();
  if (modo === 'captura') { ui.clipActivo = null; ui.clipsOverride = null; }
  else Video.pausar();
  render();
}

function conectarStats() {
  $('selector-modo').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-modo]');
    if (b) cambiarModo(b.dataset.modo);
  });
  $('resumen-pdf').addEventListener('click', imprimirResumen);
  $('stats').addEventListener('click', (ev) => {
    const t = ev.target;
    const seg = t.closest('[data-seg]');
    if (seg) {
      const { k, v } = JSON.parse(seg.dataset.seg);
      stats.filtros[k] = v.slice();
      ui.clipsOverride = null;
      renderStats();
      return;
    }
    const chip = t.closest('[data-dim]');
    if (chip) { ui.clipsOverride = null; alternarFiltro(chip.dataset.dim, JSON.parse(chip.dataset.val)); return; }
    const ficha = t.closest('[data-ficha]');
    if (ficha) {
      const r = Number(ficha.dataset.ficha);
      stats.filtros.rot = stats.filtros.rot.length === 1 && stats.filtros.rot[0] === r ? [] : [r];
      ui.clipsOverride = null;
      renderStats();
      return;
    }
    const verLista = t.closest('[data-ver]');
    if (verLista) {
      const v = ui.listasVer[Number(verLista.dataset.ver)];
      ui.clipsOverride = { lista: v.lista, titulo: v.titulo, tipo: 'jugadas' };
      ui.clipIdx = null;
      abrirLateral(true);
      return;
    }
    const irTab = t.closest('[data-tab]');
    if (irTab) { stats.vista = irTab.dataset.tab; ui.clipsOverride = null; renderStats(); return; }
    const fij = t.closest('[data-fijar]');
    if (fij) {
      ui.clipsOverride = null;
      ui.lateral = true;
      fijarFiltros(JSON.parse(fij.dataset.fijar));
      return;
    }
    const tab = t.closest('[data-vistastats]');
    if (tab) { stats.vista = tab.dataset.vistastats; ui.clipsOverride = null; ui.clipIdx = null; renderStats(); return; }
    const cmp = t.closest('[data-comparar]');
    if (cmp) { stats.comparar = cmp.dataset.comparar; renderStats(); return; }
    const mapa = t.closest('[data-mapa]');
    if (mapa) { stats.mapa = mapa.dataset.mapa; renderStats(); return; }
    const pleg = t.closest('[data-pleg]');
    if (pleg) {
      prefs.plegables = prefs.plegables || {};
      prefs.plegables[pleg.dataset.pleg] = !prefs.plegables[pleg.dataset.pleg];
      guardarPrefs();
      renderStats();
      return;
    }
    if (t.closest('#btn-mas-filtros')) { alternarMasFiltros(); return; }
    if (t.closest('#limpiar-filtros')) { for (const k of Object.keys(stats.filtros)) stats.filtros[k] = []; ui.clipsOverride = null; renderStats(); return; }
    if (t.closest('#btn-mostrar-video')) { abrirLateral(true); return; }
    const chipP = t.closest('[data-partido-stats]');
    if (chipP) alternarPartidoStats(chipP.dataset.partidoStats);
  });
  $('lateral-cab').addEventListener('click', (ev) => { if (ev.target.closest('#btn-esconder-video')) abrirLateral(false); });
  $('lateral-ctl').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-clipnav]');
    if (!b) return;
    const paso = Number(b.dataset.clipnav);
    if (paso === 0) { Video.alternar(); return; }
    const n = ui.clipsActuales ? ui.clipsActuales.lista.length : 0;
    if (!n) return;
    const i = ui.clipIdx == null ? 0 : Math.min(n - 1, Math.max(0, ui.clipIdx + paso));
    reproducirIndice(i);
  });
  $('lateral-ctl').addEventListener('change', (ev) => {
    if (ev.target.id !== 'seguir-solo') return;
    prefs.seguirSolo = ev.target.checked;
    guardarPrefs();
  });
  $('clips-lista').addEventListener('click', (ev) => {
    const f = ev.target.closest('.fila-clip');
    if (f) reproducirIndice(Number(f.dataset.clip));
  });
}

// =====================================================================
// Teclado
// =====================================================================

function esCampoTexto(el) {
  if (!el || !el.tagName) return false;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable) return true;
  return el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'file'].includes(el.type);
}

document.addEventListener('keydown', (ev) => {
  if (!$('modal').hidden) {
    if (ev.key === 'Escape' && modalCancelable) { ev.preventDefault(); cerrarModal(); }
    return;
  }
  if (esCampoTexto(ev.target)) return;
  const k = ev.key.toLowerCase();

  // Ayuda y menús primero: Esc solo los cierra
  if (ev.key === TECLAS.ayuda && ui.modo === 'captura') { ev.preventDefault(); alternarAyuda(); return; }
  if (ev.key === 'Escape') {
    if (!$('ayuda').hidden) { ev.preventDefault(); alternarAyuda(false); return; }
    if (hayMenuAbierto()) { ev.preventDefault(); cerrarMenus(); return; }
    if (ui.modo === 'stats' && !$('mas-filtros').hidden) { ev.preventDefault(); alternarMasFiltros(false); return; }
  }

  if ((ev.ctrlKey || ev.metaKey) && k === 'z' && !ev.shiftKey) {
    ev.preventDefault();
    if (ui.modo === 'captura') deshacer();
    return;
  }
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

  if (ui.modo === 'captura' && !ev.repeat && (k === TECLAS.jugador || ui.entradaJugador)) {
    if (manejarTeclaJugador(k)) { ev.preventDefault(); return; }
  }
  if (k === TECLAS.reproducir) { ev.preventDefault(); if (!ev.repeat) Video.alternar(); return; }
  if (k === TECLAS.atras) { ev.preventDefault(); Video.mover(ev.shiftKey ? -SALTO_LARGO_SEGUNDOS : -SALTO_SEGUNDOS); return; }
  if (k === TECLAS.adelante) { ev.preventDefault(); Video.mover(ev.shiftKey ? SALTO_LARGO_SEGUNDOS : SALTO_SEGUNDOS); return; }
  if (k === TECLAS.atrasLargo) { ev.preventDefault(); Video.mover(-SALTO_LARGO_SEGUNDOS); return; }
  if (k === TECLAS.adelanteLargo) { ev.preventDefault(); Video.mover(SALTO_LARGO_SEGUNDOS); return; }
  if (k === TECLAS.silencio) { ev.preventDefault(); if (!ev.repeat) alternarSilencio(); return; }
  if (k === TECLAS.cuadroAtras) { ev.preventDefault(); Video.cuadro(-1); return; }
  if (k === TECLAS.cuadroAdelante) { ev.preventDefault(); Video.cuadro(1); return; }
  if (k === TECLAS.foco && ui.modo === 'captura' && !ev.repeat) { ev.preventDefault(); alternarFoco(); return; }

  if (ev.repeat) return;
  if (teclaCaptura(k)) ev.preventDefault();
});

// Un botón con foco no debe volver a activarse con Espacio.
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('button, input[type=checkbox]');
  if (b && !b.closest('.modal') && !b.closest('.video-carga')) b.blur();
});

// =====================================================================
// Diálogos propios (nunca confirm() nativo)
// =====================================================================

let modalCancelable = false;

function abrirModal(html, cancelable) {
  modalCancelable = cancelable;
  $('modal').innerHTML = `<div class="dialogo" role="dialog" aria-modal="true">${html}</div>`;
  $('modal').hidden = false;
  const primero = $('modal').querySelector('input, select, button.principal');
  if (primero) primero.focus();
}

function cerrarModal() {
  $('modal').hidden = true;
  $('modal').innerHTML = '';
}

function confirmar({ titulo, texto, aceptar = 'Aceptar', soloAceptar = false }) {
  return new Promise((resolver) => {
    abrirModal(
      `<h2>${esc(titulo)}</h2><p>${esc(texto)}</p>` +
      `<div class="acciones">${soloAceptar ? '' : '<button class="btn" data-r="no">Cancelar</button>'}<button class="btn principal" data-r="si">${esc(aceptar)}</button></div>`,
      true,
    );
    $('modal').querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
      cerrarModal();
      resolver(b.dataset.r === 'si');
    }));
  });
}

// ---------- Partido nuevo y datos del partido ----------

function nombresConocidos() {
  return [...new Set(Object.values(almacen.equipos).flatMap((e) => [e.nombre, ...(e.alias || [])]))].sort((a, b) => a.localeCompare(b));
}

function competenciasUsadas() {
  return [...new Set(Object.values(almacen.partidos).map((x) => (x.competencia || '').trim()).filter(Boolean))].sort();
}

// Partido nuevo: equipo A y B con autocompletar (si no existe se crea), cuál se scoutea,
// fecha y competencia. Editar: fecha y competencia (los nombres se cambian en Equipos).
function dialogoPartido({ nuevo, cancelable, equipoA = '' }) {
  const p = partido();
  const lista = (id, valores) => `<datalist id="${id}">${valores.map((v) => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
  const scout = nuevo ? 'propio' : p.scouteado;
  abrirModal(
    `<h2>${nuevo ? 'Partido nuevo' : 'Datos del partido'}</h2>` +
    `<form id="form-partido" style="display:flex;flex-direction:column;gap:14px">` +
    lista('dl-equipos', nombresConocidos()) + lista('dl-competencias', competenciasUsadas()) +
    `<div class="fila-campos">` +
    `<label><span class="etiqueta">Equipo A</span><input class="campo" id="d-a" list="dl-equipos" autocomplete="off" value="${esc(nuevo ? equipoA : nombre('propio'))}" ${nuevo ? 'required' : 'disabled'}></label>` +
    `<label><span class="etiqueta">Equipo B</span><input class="campo" id="d-b" list="dl-equipos" autocomplete="off" value="${esc(nuevo ? '' : nombre('rival'))}" ${nuevo ? 'required' : 'disabled'}></label>` +
    `</div>` +
    `<div class="opciones-scout"><span class="etiqueta">Se scoutea a</span>` +
    `<label class="opcion"><input type="radio" name="d-scout" value="propio" ${scout === 'propio' ? 'checked' : ''} ${nuevo ? '' : 'disabled'}> <span id="d-scout-a">${esc(nuevo ? (equipoA || 'Equipo A') : nombre('propio'))}</span></label>` +
    `<label class="opcion"><input type="radio" name="d-scout" value="rival" ${scout === 'rival' ? 'checked' : ''} ${nuevo ? '' : 'disabled'}> <span id="d-scout-b">${esc(nuevo ? 'Equipo B' : nombre('rival'))}</span></label></div>` +
    `<div class="fila-campos">` +
    `<label><span class="etiqueta">Fecha</span><input class="campo" id="d-fecha" type="date" value="${esc(nuevo ? hoyIso() : p.fecha)}" required></label>` +
    `<label><span class="etiqueta">Competencia (opcional)</span><input class="campo" id="d-competencia" list="dl-competencias" autocomplete="off" value="${esc(nuevo ? '' : p.competencia || '')}"></label>` +
    `</div>` +
    (nuevo ? '' : `<p class="tenue">Los nombres de los equipos se cambian desde Equipos (Renombrar / alias).</p>`) +
    `<div class="carga-error" id="d-error"></div>` +
    `<div class="acciones">` +
    (nuevo ? `<button type="button" class="btn izq" id="d-importar-nuevo" title="Abrir partidos desde archivos exportados">Importar…</button>` : '') +
    (cancelable ? `<button type="button" class="btn" id="d-cancelar">Cancelar</button>` : '') +
    `<button type="submit" class="btn principal">${nuevo ? 'Crear partido' : 'Guardar'}</button>` +
    `</div></form>`,
    cancelable,
  );

  if (cancelable) $('d-cancelar').addEventListener('click', cerrarModal);
  if (nuevo) {
    $('d-importar-nuevo').addEventListener('click', () => $('input-importar').click());
    // Las opciones de «se scoutea a» muestran los nombres que se van escribiendo
    const sync = () => {
      $('d-scout-a').textContent = $('d-a').value.trim() || 'Equipo A';
      $('d-scout-b').textContent = $('d-b').value.trim() || 'Equipo B';
    };
    $('d-a').addEventListener('input', sync);
    $('d-b').addEventListener('input', sync);
  }

  $('form-partido').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const fecha = $('d-fecha').value || hoyIso();
    const competencia = $('d-competencia').value.trim();
    if (nuevo) {
      const a = $('d-a').value.trim(), b = $('d-b').value.trim();
      if (!a || !b) { $('d-error').textContent = 'Escribe los dos equipos.'; return; }
      if (slug(a) === slug(b) || (buscarEquipo(a) && buscarEquipo(a) === buscarEquipo(b))) { $('d-error').textContent = 'Los dos equipos no pueden ser el mismo.'; return; }
      const scouteado = $('modal').querySelector('input[name="d-scout"]:checked').value;
      const np = crearPartido({ equipoA: a, equipoB: b, fecha, scouteado, competencia });
      almacen.partidos[np.id] = np;
      cerrarModal();
      cambiarPartido(np.id);
      cambiarModo('captura');
      const conPlantel = LADOS.filter((l) => np.plantel[l].length).map((l) => `${nombre(l, np)} (${np.plantel[l].length})`);
      if (conPlantel.length) avisar(`Plantel cargado: ${conPlantel.join(', ')}`);
    } else {
      p.fecha = fecha;
      p.competencia = competencia;
      guardar();
      render();
      cerrarModal();
    }
  });
}

// ---------- Exportar e importar ----------

const FORMATO_ARCHIVO = 'voleystats-partido';
const FORMATO_PAQUETE = 'voleystats-paquete';
const FORMATO_RESPALDO = 'voleystats-respaldo';

function slug(t) {
  return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function descargar(nombreArchivo, objeto) {
  const blob = new Blob([JSON.stringify(objeto, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function equiposDePartidos(partidos) {
  const ids = new Set(partidos.flatMap((x) => LADOS.map((l) => x.equipoIds && x.equipoIds[l]).filter(Boolean)));
  return Object.fromEntries([...ids].filter((id) => almacen.equipos[id]).map((id) => [id, almacen.equipos[id]]));
}

function exportarPartido(id) {
  const x = almacen.partidos[id];
  if (!x) return;
  descargar(`voleystats-${slug(nombre('rival', x))}-vs-${slug(nombre('propio', x))}-${x.fecha || 'sin-fecha'}.json`, {
    formato: FORMATO_ARCHIVO, version: VERSION_DATOS, exportado: new Date().toISOString(),
    partido: x, equipos: equiposDePartidos([x]),
  });
}

// Paquete de un equipo: el equipo, su plantel y todos los partidos en que se lo scoutea
function exportarPaquete(eid) {
  const e = almacen.equipos[eid];
  if (!e) return;
  const partidos = partidosDelEquipo(eid);
  descargar(`voleystats-paquete-${slug(e.nombre)}-${hoyIso()}.json`, {
    formato: FORMATO_PAQUETE, version: VERSION_DATOS, exportado: new Date().toISOString(),
    equipo: eid, equipos: { ...equiposDePartidos(partidos), [eid]: e }, partidos,
  });
}

function exportarRespaldo() {
  descargar(`voleystats-respaldo-${hoyIso()}.json`, {
    formato: FORMATO_RESPALDO, version: VERSION_DATOS, exportado: new Date().toISOString(),
    equipos: almacen.equipos, partidos: Object.values(almacen.partidos),
  });
}

function partidoValido(x) {
  return x && typeof x === 'object' && x.id && Array.isArray(x.sets) && ['rival', 'propio'].includes(x.scouteado) &&
    (x.equipos || x.equipoIds) &&
    x.sets.every((st) => Array.isArray(st.rallies) && st.rallies.every((r) => Array.isArray(r.acciones)));
}

// Lee un archivo: partido suelto (viejo o nuevo), paquete o respaldo → { equipos, partidos }
function leerArchivo(texto) {
  let datos;
  try { datos = JSON.parse(texto); } catch (e) { throw new Error('no es un JSON válido'); }
  if (!datos || typeof datos !== 'object') throw new Error('no parece un archivo de VoleyStats');
  if ((datos.version || 1) > VERSION_DATOS || (datos.partido && (datos.partido.version || 1) > VERSION_DATOS)) {
    throw new Error('viene de una versión más nueva de VoleyStats (recarga la página e intenta de nuevo)');
  }
  let partidos, equipos = {};
  if (datos.formato === FORMATO_PAQUETE || datos.formato === FORMATO_RESPALDO) {
    partidos = Array.isArray(datos.partidos) ? datos.partidos : Object.values(datos.partidos || {});
    equipos = datos.equipos || {};
  } else if (datos.formato === FORMATO_ARCHIVO) {
    partidos = [datos.partido];
    equipos = datos.equipos || {};
  } else {
    partidos = [datos]; // partido suelto sin envoltorio
  }
  if (!partidos.length || !partidos.every(partidoValido)) throw new Error('no parece un partido de VoleyStats');
  return { equipos, partidos };
}

// Conflicto de id: Reemplazar / Guardar como copia / Omitir, con «aplicar a todos»
function elegirConflicto(x) {
  return new Promise((resolver) => {
    const existente = almacen.partidos[x.id];
    abrirModal(
      `<h2>Este partido ya está guardado</h2>` +
      `<p>${esc(x.equipos ? `${x.equipos.propio} vs ${x.equipos.rival}` : '')}, ${esc(fmtFecha(x.fecha))}</p>` +
      `<p class="tenue">Guardado: ${esc(resumenPartido(existente))}</p>` +
      `<label class="opcion"><input type="checkbox" id="c-todos"> Aplicar a todos los siguientes</label>` +
      `<div class="acciones"><button class="btn izq" data-r="omitir">Omitir</button>` +
      `<button class="btn" data-r="copia">Guardar como copia</button>` +
      `<button class="btn principal" data-r="reemplazar">Reemplazar</button></div>`,
      false,
    );
    $('modal').querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
      const todos = $('c-todos').checked;
      cerrarModal();
      resolver({ accion: b.dataset.r, todos });
    }));
  });
}

// Importa varios archivos a la vez. Los equipos se asocian por id, nombre o alias.
async function importarArchivos(archivos) {
  const errores = [], entrantes = [];
  for (const f of archivos) {
    try { entrantes.push(leerArchivo(await f.text())); } catch (e) { errores.push(`${f.name}: ${e.message}`); }
  }
  const mapa = {}; // id de equipo en el archivo → id local
  let equiposNuevos = 0;
  for (const { equipos } of entrantes) {
    for (const [id, e] of Object.entries(equipos)) {
      if (mapa[id]) continue;
      const local = almacen.equipos[id] || buscarEquipo(e.nombre) || (e.alias || []).map((a) => buscarEquipo(a)).find(Boolean);
      if (local) {
        local.alias = [...new Set([...(local.alias || []), ...(e.alias || []), ...(slug(e.nombre) !== slug(local.nombre) ? [e.nombre] : [])])];
        unirPlantel(local.plantel, e.plantel);
        mapa[id] = local.id;
      } else {
        const nuevo = { id, nombre: e.nombre, alias: e.alias || [], plantel: (e.plantel || []).map((j) => ({ ...j })) };
        almacen.equipos[id] = nuevo;
        mapa[id] = id;
        equiposNuevos++;
      }
    }
  }
  let importados = 0, omitidos = 0, decisionTodos = null;
  const tocados = [];
  for (const { partidos } of entrantes) {
    for (const original of partidos) {
      const x = migrarPartido(JSON.parse(JSON.stringify(original)));
      if (x.equipoIds) for (const l of LADOS) x.equipoIds[l] = mapa[x.equipoIds[l]] || x.equipoIds[l];
      const antes = Object.keys(almacen.equipos).length;
      asociarEquipos(x);
      equiposNuevos += Object.keys(almacen.equipos).length - antes;
      if (almacen.partidos[x.id]) {
        let accion = decisionTodos;
        if (!accion) {
          const r = await elegirConflicto(x);
          accion = r.accion;
          if (r.todos) decisionTodos = accion;
        }
        if (accion === 'omitir') { omitidos++; continue; }
        if (accion === 'copia') { x.id = nuevoId('p'); x.creado = new Date().toISOString(); }
      }
      almacen.partidos[x.id] = x;
      tocados.push(x);
      importados++;
    }
  }
  guardar();
  const eq = tocados.length ? equipoDe(tocados[0].scouteado, tocados[0]) : null;
  if (eq) ui.equipoSel = eq.id;
  cambiarModo('equipos');
  const lineas = [`${importados} ${importados === 1 ? 'partido importado' : 'partidos importados'}`];
  if (equiposNuevos) lineas.push(`${equiposNuevos} ${equiposNuevos === 1 ? 'equipo nuevo' : 'equipos nuevos'}`);
  if (omitidos) lineas.push(`${omitidos} omitido${omitidos === 1 ? '' : 's'}`);
  await confirmar({
    titulo: errores.length && !importados ? 'No se pudo importar' : 'Importación lista',
    texto: lineas.join(', ') + '.' + (errores.length ? ` No se pudieron leer: ${errores.join('; ')}.` : ''),
    aceptar: 'Entendido', soloAceptar: true,
  });
  render();
}

function dialogoPlantel() {
  const p = partido();
  if (!p) return;
  const borrador = { propio: jugadoresDe('propio').map((j) => ({ ...j })), rival: jugadoresDe('rival').map((j) => ({ ...j })) };
  let equipo = p.scouteado;

  const opcionesPos = (sel) => `<option value="">—</option>` +
    Object.entries(POSICIONES).map(([k, v]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${v.nombre}</option>`).join('');

  function leerFilas() {
    borrador[equipo] = [...$('modal').querySelectorAll('.plantel-fila')].map((f) => ({
      num: f.querySelector('.p-num').value.trim(),
      nombre: f.querySelector('.p-nombre').value.trim(),
      pos: f.querySelector('.p-pos').value,
    }));
  }

  function pintar(enfocarUltimo = false) {
    const filas = borrador[equipo].map((j, i) =>
      `<div class="plantel-fila" data-i="${i}">` +
      `<input class="campo p-num" type="number" min="0" max="99" inputmode="numeric" placeholder="Nº" value="${esc(j.num)}">` +
      `<input class="campo p-nombre" type="text" placeholder="Nombre (opcional)" value="${esc(j.nombre || '')}">` +
      `<select class="campo p-pos">${opcionesPos(j.pos)}</select>` +
      `<button type="button" class="ir p-quitar" title="Quitar">✕</button></div>`).join('');
    abrirModal(
      `<h2>Plantel</h2>` +
      `<div class="selector plantel-tabs">${['rival', 'propio'].map((eq) =>
        `<button type="button" data-eq="${eq}" class="${eq === equipo ? 'activo' : ''}">${esc(nombre(eq))}${eq === p.scouteado ? ' · scouteado' : ''}</button>`).join('')}</div>` +
      `<div class="plantel-lista">${filas || '<div class="vacio">Sin jugadores todavía.</div>'}</div>` +
      `<button type="button" class="btn" id="p-agregar">+ Agregar jugador</button>` +
      `<div class="carga-error" id="p-error"></div>` +
      `<p class="tenue">Es el plantel del equipo: se usa en todos sus partidos.</p>` +
      `<div class="acciones"><button type="button" class="btn" id="p-cancelar">Cancelar</button><button type="button" class="btn principal" id="p-guardar">Guardar</button></div>`,
      true,
    );
    const nums = $('modal').querySelectorAll('.p-num');
    if (enfocarUltimo && nums.length) nums[nums.length - 1].focus();
    else if (!nums.length) $('p-agregar').focus();

    $('modal').querySelectorAll('[data-eq]').forEach((b) => b.addEventListener('click', () => {
      leerFilas(); equipo = b.dataset.eq; pintar();
    }));
    $('modal').querySelectorAll('.p-quitar').forEach((b) => b.addEventListener('click', () => {
      leerFilas(); borrador[equipo].splice(Number(b.closest('.plantel-fila').dataset.i), 1); pintar();
    }));
    $('p-agregar').addEventListener('click', () => {
      leerFilas(); borrador[equipo].push({ num: '', nombre: '', pos: '' }); pintar(true);
    });
    // Enter en una fila agrega otra: cargar números rápido
    $('modal').querySelectorAll('.plantel-fila input').forEach((inp) => inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); $('p-agregar').click(); }
    }));
    $('p-cancelar').addEventListener('click', cerrarModal);
    $('p-guardar').addEventListener('click', guardarPlantel);
  }

  function limpiar(lista) {
    const res = [];
    for (const j of lista) {
      if (j.num === '' || j.num == null) continue;
      const num = Number(j.num);
      if (!Number.isInteger(num) || num < 0 || num > 99) throw new Error(`«${j.num}» no es un número de camiseta válido (0 a 99).`);
      if (res.some((x) => x.num === num)) throw new Error(`El número ${num} está repetido.`);
      const jug = { num };
      if (j.nombre) jug.nombre = j.nombre;
      if (j.pos) jug.pos = j.pos;
      res.push(jug);
    }
    return res.sort((a, b) => a.num - b.num);
  }

  function guardarPlantel() {
    leerFilas();
    let limpio;
    try {
      limpio = { propio: limpiar(borrador.propio), rival: limpiar(borrador.rival) };
    } catch (e) {
      $('p-error').textContent = e.message;
      return;
    }
    // El plantel del equipo es la referencia; el partido guarda una copia
    for (const lado of LADOS) {
      const eq = equipoDe(lado, p);
      if (eq) eq.plantel = limpio[lado].map((j) => ({ ...j }));
    }
    mutar('Plantel', (pp) => { pp.plantel = limpio; });
    cerrarModal();
  }

  pintar();
}

// ---------- Equipos: datos derivados ----------

// Partidos en que se scoutea a un equipo, del más reciente al más antiguo
function partidosDelEquipo(eid) {
  return Object.values(almacen.partidos)
    .filter((x) => x.equipoIds && x.equipoIds[x.scouteado] === eid)
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.creado || '').localeCompare(a.creado || ''));
}

function partidosComoRival(eid) {
  return Object.values(almacen.partidos).filter((x) => x.equipoIds && LADOS.some((l) => l !== x.scouteado && x.equipoIds[l] === eid));
}

function ralliesDe(x) { return x.sets.reduce((n, st) => n + st.rallies.filter((r) => r.gana).length, 0); }

function resumenPartido(x) {
  const g = setsGanados(x);
  const rallies = ralliesDe(x);
  return `Scouteando ${nombre(x.scouteado, x)}, sets ${g[0]}–${g[1]}, ${rallies} ${rallies === 1 ? 'rally' : 'rallies'}`;
}

// Resultado por sets desde el punto de vista del equipo scouteado: «3–1 (25-20 22-25 …)»
function resultadoSets(x) {
  const i = x.scouteado === 'propio' ? 0 : 1;
  const g = setsGanados(x);
  const sets = x.sets.filter((st) => st.final).map((st) => `${st.final[i]}-${st.final[1 - i]}`);
  return sets.length ? `${g[i]}–${g[1 - i]} (${sets.join(' ')})` : '—';
}

// Estado calculado: «Completo», «En curso · set 2, 14–11» o «Sin empezar»
function estadoPartido(x) {
  if (!ralliesDe(x)) return 'Sin empezar';
  if (partidoTerminado(x)) return 'Completo';
  const st = x.sets[x.sets.length - 1];
  const i = x.scouteado === 'propio' ? 0 : 1;
  if (st.final) { const g = setsGanados(x); return `En curso · sets ${g[i]}–${g[1 - i]}`; }
  const m = marcadorTras(st);
  return `En curso · set ${st.numero}, ${m[i]}–${m[1 - i]}`;
}

function rivalDe(x) { return nombre(otro(x.scouteado), x); }

// ---------- Equipos: acciones ----------

function eliminarPartido(id) {
  delete almacen.partidos[id];
  historial.length = 0; // deshacer no debe revivir un partido eliminado
  if (almacen.actual === id) {
    almacen.actual = null;
    Video.soltarLocal();
    if (Video.yt && Video.ytListo) { Video.yt.stopVideo(); Video.yt.getIframe().hidden = true; }
    Video.fuente = null;
    pendiente = nuevoPendiente();
  }
  guardar();
  render();
}

async function confirmarEliminarPartido(id) {
  const x = almacen.partidos[id];
  const ok = await confirmar({
    titulo: '¿Eliminar este partido?',
    texto: `${nombre(x.scouteado, x)} vs ${rivalDe(x)}, ${fmtFecha(x.fecha)}. Se borran todas sus jugadas de este navegador y no se puede deshacer.`,
    aceptar: 'Eliminar',
  });
  if (ok) eliminarPartido(id);
}

async function confirmarEliminarEquipo(eid) {
  const e = almacen.equipos[eid];
  const comoRival = partidosComoRival(eid).length;
  if (comoRival) {
    await confirmar({
      titulo: 'No se puede eliminar todavía',
      texto: `${e.nombre} aparece como rival en ${comoRival} ${comoRival === 1 ? 'partido' : 'partidos'} de otros equipos. Júntalo con otro equipo o elimina esos partidos primero.`,
      aceptar: 'Entendido', soloAceptar: true,
    });
    return;
  }
  const propios = partidosDelEquipo(eid);
  const ok = await confirmar({
    titulo: `¿Eliminar ${e.nombre}?`,
    texto: propios.length
      ? `Se borran el equipo, su plantel y sus ${propios.length} ${propios.length === 1 ? 'partido' : 'partidos'} de este navegador. No se puede deshacer; si quieres, exporta antes el paquete.`
      : 'Se borran el equipo y su plantel de este navegador.',
    aceptar: 'Eliminar',
  });
  if (!ok) return;
  for (const x of propios) {
    delete almacen.partidos[x.id];
    if (almacen.actual === x.id) eliminarPartido(x.id);
  }
  delete almacen.equipos[eid];
  historial.length = 0;
  ui.equipoSel = null;
  guardar();
  render();
}

function dialogoRenombrar(eid) {
  const e = almacen.equipos[eid];
  abrirModal(
    `<h2>Renombrar / alias</h2>` +
    `<label><span class="etiqueta">Nombre</span><input class="campo" id="r-nombre" value="${esc(e.nombre)}"></label>` +
    `<label><span class="etiqueta">Alias (otros nombres con que aparece, separados por coma)</span>` +
    `<input class="campo" id="r-alias" value="${esc((e.alias || []).join(', '))}"></label>` +
    `<p class="tenue">Al importar o crear un partido, cualquiera de estos nombres se asocia a este equipo.</p>` +
    `<div class="carga-error" id="r-error"></div>` +
    `<div class="acciones"><button class="btn" id="r-cancelar">Cancelar</button><button class="btn principal" id="r-ok">Guardar</button></div>`,
    true,
  );
  $('r-cancelar').addEventListener('click', cerrarModal);
  $('r-ok').addEventListener('click', () => {
    const nuevoNombre = $('r-nombre').value.trim();
    const alias = [...new Set($('r-alias').value.split(',').map((a) => a.trim()).filter((a) => a && slug(a) !== slug(nuevoNombre)))];
    if (!nuevoNombre) { $('r-error').textContent = 'El nombre no puede quedar vacío.'; return; }
    const choca = [nuevoNombre, ...alias].map((t) => buscarEquipo(t)).find((x) => x && x.id !== eid);
    if (choca) { $('r-error').textContent = `«${choca.nombre}» ya usa ese nombre o alias. Si es el mismo equipo, usa «Juntar con…».`; return; }
    e.nombre = nuevoNombre;
    e.alias = alias;
    for (const x of Object.values(almacen.partidos)) for (const l of LADOS) if (x.equipoIds && x.equipoIds[l] === eid) x.equipos[l] = nuevoNombre;
    guardar();
    cerrarModal();
    render();
  });
}

// Juntar: los partidos del otro equipo pasan a este; se unen planteles y alias
function dialogoJuntar(eid) {
  const e = almacen.equipos[eid];
  const otros = Object.values(almacen.equipos).filter((x) => x.id !== eid).sort((a, b) => a.nombre.localeCompare(b.nombre));
  if (!otros.length) { confirmar({ titulo: 'Juntar con…', texto: 'No hay otros equipos guardados.', aceptar: 'Entendido', soloAceptar: true }); return; }
  abrirModal(
    `<h2>Juntar ${esc(e.nombre)} con…</h2>` +
    `<p>Úsalo cuando el mismo equipo quedó guardado con dos nombres (por ejemplo «Católica» y «U. Católica»).</p>` +
    `<label><span class="etiqueta">Otro equipo</span><select class="campo" id="j-otro">${otros.map((x) =>
      `<option value="${x.id}">${esc(x.nombre)} · ${partidosDelEquipo(x.id).length + partidosComoRival(x.id).length} partidos</option>`).join('')}</select></label>` +
    `<div class="opciones-scout"><span class="etiqueta">Nombre que queda</span>` +
    `<label class="opcion"><input type="radio" name="j-nombre" value="este" checked> <span>${esc(e.nombre)}</span></label>` +
    `<label class="opcion"><input type="radio" name="j-nombre" value="otro"> <span id="j-otro-nombre">${esc(otros[0].nombre)}</span></label></div>` +
    `<p class="tenue">El otro nombre queda como alias. Los planteles se unen por número.</p>` +
    `<div class="acciones"><button class="btn" id="j-cancelar">Cancelar</button><button class="btn principal" id="j-ok">Juntar</button></div>`,
    true,
  );
  $('j-otro').addEventListener('change', () => { $('j-otro-nombre').textContent = almacen.equipos[$('j-otro').value].nombre; });
  $('j-cancelar').addEventListener('click', cerrarModal);
  $('j-ok').addEventListener('click', () => {
    const otroEq = almacen.equipos[$('j-otro').value];
    const queda = $('modal').querySelector('input[name="j-nombre"]:checked').value === 'este' ? e.nombre : otroEq.nombre;
    juntarEquipos(eid, otroEq.id, queda);
    cerrarModal();
    ui.equipoSel = eid;
    render();
  });
}

function juntarEquipos(destinoId, origenId, nombreFinal) {
  const destino = almacen.equipos[destinoId], origen = almacen.equipos[origenId];
  const nombres = [destino.nombre, origen.nombre, ...(destino.alias || []), ...(origen.alias || [])];
  destino.nombre = nombreFinal;
  destino.alias = [...new Map(nombres.filter((n) => slug(n) !== slug(nombreFinal)).map((n) => [slug(n), n])).values()];
  unirPlantel(destino.plantel, origen.plantel);
  for (const x of Object.values(almacen.partidos)) {
    for (const l of LADOS) {
      if (!x.equipoIds) continue;
      if (x.equipoIds[l] === origenId) x.equipoIds[l] = destinoId;
      if (x.equipoIds[l] === destinoId) x.equipos[l] = nombreFinal;
    }
  }
  if (prefs.seleccion && prefs.seleccion[origenId]) {
    prefs.seleccion[destinoId] = [...new Set([...(prefs.seleccion[destinoId] || []), ...prefs.seleccion[origenId]])];
    delete prefs.seleccion[origenId];
    guardarPrefs();
  }
  delete almacen.equipos[origenId];
  historial.length = 0;
  guardar();
}

function dialogoPlantelEquipo(eid) {
  // Se edita desde un partido del equipo si hay uno abierto de ese equipo; si no, directo
  const e = almacen.equipos[eid];
  const opcionesPos = (sel) => `<option value="">—</option>` +
    Object.entries(POSICIONES).map(([k, v]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${v.nombre}</option>`).join('');
  let borrador = e.plantel.map((j) => ({ ...j }));
  const leer = () => {
    borrador = [...$('modal').querySelectorAll('.plantel-fila')].map((f) => ({
      num: f.querySelector('.p-num').value.trim(), nombre: f.querySelector('.p-nombre').value.trim(), pos: f.querySelector('.p-pos').value,
    }));
  };
  const pintar = (enfocar = false) => {
    abrirModal(
      `<h2>Plantel de ${esc(e.nombre)}</h2>` +
      `<div class="plantel-lista">${borrador.map((j, i) =>
        `<div class="plantel-fila" data-i="${i}"><input class="campo p-num" type="number" min="0" max="99" placeholder="Nº" value="${esc(j.num)}">` +
        `<input class="campo p-nombre" type="text" placeholder="Nombre (opcional)" value="${esc(j.nombre || '')}">` +
        `<select class="campo p-pos">${opcionesPos(j.pos)}</select><button type="button" class="ir p-quitar" title="Quitar">✕</button></div>`).join('') || '<div class="vacio">Sin jugadores todavía.</div>'}</div>` +
      `<button type="button" class="btn" id="p-agregar">+ Agregar jugador</button><div class="carga-error" id="p-error"></div>` +
      `<div class="acciones"><button class="btn" id="p-cancelar">Cancelar</button><button class="btn principal" id="p-guardar">Guardar</button></div>`,
      true,
    );
    const nums = $('modal').querySelectorAll('.p-num');
    if (enfocar && nums.length) nums[nums.length - 1].focus();
    $('modal').querySelectorAll('.p-quitar').forEach((b) => b.addEventListener('click', () => { leer(); borrador.splice(Number(b.closest('.plantel-fila').dataset.i), 1); pintar(); }));
    $('p-agregar').addEventListener('click', () => { leer(); borrador.push({ num: '', nombre: '', pos: '' }); pintar(true); });
    $('modal').querySelectorAll('.plantel-fila input').forEach((inp) => inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); $('p-agregar').click(); } }));
    $('p-cancelar').addEventListener('click', cerrarModal);
    $('p-guardar').addEventListener('click', () => {
      leer();
      const res = [];
      for (const j of borrador) {
        if (j.num === '') continue;
        const num = Number(j.num);
        if (!Number.isInteger(num) || num < 0 || num > 99) { $('p-error').textContent = `«${j.num}» no es un número válido (0 a 99).`; return; }
        if (res.some((x) => x.num === num)) { $('p-error').textContent = `El número ${num} está repetido.`; return; }
        res.push({ num, ...(j.nombre ? { nombre: j.nombre } : {}), ...(j.pos ? { pos: j.pos } : {}) });
      }
      e.plantel = res.sort((a, b) => a.num - b.num);
      guardar();
      cerrarModal();
      render();
    });
  };
  pintar();
}

// ---------- Espacio usado en localStorage ----------

const CUOTA_LOCAL = 5 * 1024 * 1024; // ~5 millones de caracteres por sitio en la mayoría de los navegadores

function espacioUsado() {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      total += k.length + (localStorage.getItem(k) || '').length;
    }
  } catch (e) { /* sin acceso */ }
  return { usado: total, fraccion: total / CUOTA_LOCAL };
}

// ---------- Pantalla Equipos ----------

function renderEquipos() {
  if (ui.modo !== 'equipos') return;
  const equipos = Object.values(almacen.equipos);
  const scouteados = equipos.filter((e) => partidosDelEquipo(e.id).length)
    .sort((a, b) => (partidosDelEquipo(b.id)[0].fecha || '').localeCompare(partidosDelEquipo(a.id)[0].fecha || ''));
  const otros = equipos.filter((e) => !partidosDelEquipo(e.id).length).sort((a, b) => a.nombre.localeCompare(b.nombre));
  if (!ui.equipoSel || !almacen.equipos[ui.equipoSel]) ui.equipoSel = (scouteados[0] || otros[0] || {}).id || null;

  const fila = (e) => {
    const ps = partidosDelEquipo(e.id);
    const datos = ps.length
      ? `${ps.length} ${ps.length === 1 ? 'partido' : 'partidos'}, último ${fmtFecha(ps[0].fecha)}, ${ps.reduce((n, x) => n + ralliesDe(x), 0)} rallies`
      : `rival en ${partidosComoRival(e.id).length} ${partidosComoRival(e.id).length === 1 ? 'partido' : 'partidos'}`;
    return `<button class="eq-fila${e.id === ui.equipoSel ? ' activo' : ''}" data-equipo="${e.id}"><b>${esc(e.nombre)}</b>` +
      `<span>${esc(datos)}</span></button>`;
  };
  const esp = espacioUsado();
  const pct100 = Math.round(esp.fraccion * 100);
  $('eq-lista').innerHTML =
    `<div class="eq-lista-cab"><h1>Equipos</h1><div class="eq-botones">` +
    `<button class="btn" id="eq-nuevo">Partido nuevo</button><button class="btn" id="eq-importar">Importar…</button></div></div>` +
    (scouteados.length ? `<div class="eq-grupo">${scouteados.map(fila).join('')}</div>` : '<p class="vacio">Todavía no hay equipos scouteados. Crea un partido o importa un archivo.</p>') +
    (otros.length ? `<div class="eq-subtitulo">Solo como rival</div><div class="eq-grupo">${otros.map(fila).join('')}</div>` : '') +
    `<div class="eq-espacio${esp.fraccion >= 0.7 ? ' alerta' : ''}">` +
    `<div class="barra-espacio"><span style="width:${Math.min(100, pct100)}%"></span></div>` +
    `<span>Espacio usado: ${pct100}${ESPACIO_FINO}% (${(esp.usado / 1048576).toFixed(1).replace('.', ',')} de 5 MB)</span>` +
    (esp.fraccion >= 0.7 ? '<span class="aviso-espacio">Queda poco espacio: haz un respaldo completo y elimina partidos que ya no uses.</span>' : '') +
    `<button class="btn-tenue chico" id="eq-respaldo">Respaldo completo</button></div>`;

  const e = almacen.equipos[ui.equipoSel];
  if (!e) { $('eq-detalle').innerHTML = ''; return; }
  const ps = partidosDelEquipo(e.id);
  const filasP = ps.map((x) =>
    `<tr${x.id === almacen.actual ? ' class="actual"' : ''}><td>${esc(fmtFecha(x.fecha))}</td><td>${esc(rivalDe(x))}</td>` +
    `<td class="tenue">${esc(x.competencia || '—')}</td><td>${esc(resultadoSets(x))}</td><td>${esc(estadoPartido(x))}</td>` +
    `<td class="acciones-fila"><button class="btn chico" data-abrir="${x.id}">Abrir</button>` +
    `<button class="btn-tenue chico" data-exportar="${x.id}">Exportar</button>` +
    `<button class="btn-tenue chico" data-eliminar="${x.id}">Eliminar</button></td></tr>`).join('');
  const plantel = e.plantel.length
    ? `<div class="eq-plantel">${e.plantel.map((j) => `<span><b>#${j.num}</b> ${esc(j.nombre || '')}${j.pos ? ` <i>${esc(POSICIONES[j.pos].nombre.toLowerCase())}</i>` : ''}</span>`).join('')}</div>`
    : '<p class="vacio">Sin jugadores cargados.</p>';
  $('eq-detalle').innerHTML =
    `<div class="eq-cab"><h2>${esc(e.nombre)}</h2>${e.alias && e.alias.length ? `<span class="tenue">también: ${esc(e.alias.join(', '))}</span>` : ''}</div>` +
    `<div class="eq-acciones">` +
    `<button class="btn principal" data-analizar="${e.id}" ${ps.length ? '' : 'disabled'}>Analizar</button>` +
    `<button class="btn" data-nuevo-de="${e.id}">Partido nuevo</button>` +
    `<button class="btn" data-paquete="${e.id}" ${ps.length ? '' : 'disabled'}>Exportar paquete</button>` +
    `<button class="btn" data-renombrar="${e.id}">Renombrar / alias</button>` +
    `<button class="btn" data-juntar="${e.id}">Juntar con…</button>` +
    `<button class="btn-tenue" data-eliminar-equipo="${e.id}">Eliminar equipo</button></div>` +
    `<div class="bloque-titulo">Partidos scouteados</div>` +
    (ps.length
      ? `<table class="tabla tabla-partidos"><tr><th>Fecha</th><th>Rival</th><th>Competencia</th><th>Resultado</th><th>Estado</th><th></th></tr>${filasP}</table>`
      : '<p class="vacio">Este equipo todavía no tiene partidos scouteados.</p>') +
    `<div class="bloque-titulo">Plantel<button class="btn-tenue chico" data-plantel-equipo="${e.id}">Editar plantel</button></div>` + plantel;
}

function conectarEquipos() {
  $('pantalla-equipos').addEventListener('click', async (ev) => {
    const t = ev.target;
    const b = (sel) => t.closest(sel);
    if (b('[data-equipo]')) { ui.equipoSel = b('[data-equipo]').dataset.equipo; renderEquipos(); return; }
    if (b('#eq-nuevo')) { dialogoPartido({ nuevo: true, cancelable: true }); return; }
    if (b('#eq-importar')) { $('input-importar').click(); return; }
    if (b('#eq-respaldo')) { exportarRespaldo(); return; }
    if (b('[data-nuevo-de]')) { dialogoPartido({ nuevo: true, cancelable: true, equipoA: almacen.equipos[b('[data-nuevo-de]').dataset.nuevoDe].nombre }); return; }
    if (b('[data-analizar]')) { analizarEquipo(b('[data-analizar]').dataset.analizar); return; }
    if (b('[data-paquete]')) { exportarPaquete(b('[data-paquete]').dataset.paquete); return; }
    if (b('[data-renombrar]')) { dialogoRenombrar(b('[data-renombrar]').dataset.renombrar); return; }
    if (b('[data-juntar]')) { dialogoJuntar(b('[data-juntar]').dataset.juntar); return; }
    if (b('[data-eliminar-equipo]')) { await confirmarEliminarEquipo(b('[data-eliminar-equipo]').dataset.eliminarEquipo); return; }
    if (b('[data-plantel-equipo]')) { dialogoPlantelEquipo(b('[data-plantel-equipo]').dataset.plantelEquipo); return; }
    if (b('[data-abrir]')) { cambiarPartido(b('[data-abrir]').dataset.abrir); cambiarModo('captura'); return; }
    if (b('[data-exportar]')) { exportarPartido(b('[data-exportar]').dataset.exportar); return; }
    if (b('[data-eliminar]')) { await confirmarEliminarPartido(b('[data-eliminar]').dataset.eliminar); }
  });
}

function analizarEquipo(eid) {
  stats.equipoId = eid;
  ui.clipsOverride = null;
  cambiarModo('stats');
}

function cambiarPartido(id) {
  almacen.actual = id;
  historial.length = 0;
  pendiente = nuevoPendiente();
  ui.rallyPausado = null;
  guardar();
  const p = partido();
  Video.soltarLocal();
  if (Video.yt && Video.ytListo) { Video.yt.stopVideo(); Video.yt.getIframe().hidden = true; }
  Video.fuente = null;
  const carga = p.video && p.video.tipo === 'youtube' ? cargarVideoYouTube(p.video.url, false) : Promise.resolve();
  render();
  return carga;
}

// =====================================================================
// Carga de video
// =====================================================================

async function cargarVideoYouTube(url, guardarEnPartido = true) {
  const id = idYouTube(url);
  if (!id) { $('carga-error').textContent = 'No reconozco ese link de YouTube.'; return; }
  $('carga-error').textContent = '';
  try {
    await Video.cargarYouTube(id);
  } catch (e) {
    Video.fuente = null;
    $('carga-error').textContent = location.protocol === 'file:'
      ? 'YouTube no funciona abriendo el archivo directo: usa el sitio publicado.'
      : 'No se pudo cargar el video de YouTube. Revisa el link y la conexión.';
    render();
    return;
  }
  const p = partido();
  if (guardarEnPartido && p) { p.video = { tipo: 'youtube', url: url.trim(), id }; guardar(); }
  ui.cambiandoVideo = false;
  render();
}

function cargarVideoArchivo(archivo) {
  Video.cargarArchivo(archivo);
  const p = partido();
  if (p) { p.video = { tipo: 'local', nombre: archivo.name }; guardar(); }
  $('carga-error').textContent = '';
  ui.cambiandoVideo = false;
  render();
}

// =====================================================================
// Arranque
// =====================================================================

// ---------- Menús desplegables (header ⋯, velocidad, marcador) ----------

function hayMenuAbierto() { return [...document.querySelectorAll('.menu')].some((m) => !m.hidden); }

function cerrarMenus(excepto = null) {
  document.querySelectorAll('.menu').forEach((m) => { if (m !== excepto) m.hidden = true; });
}

function alternarMenu(id) {
  const m = $(id);
  cerrarMenus(m);
  m.hidden = !m.hidden;
}

// ---------- Modo foco: solo video, «Ahora» y cancha ----------

function aplicarFoco() {
  document.body.classList.toggle('foco', !!prefs.foco && ui.modo === 'captura');
}

function alternarFoco(activar = !prefs.foco) {
  prefs.foco = activar;
  guardarPrefs();
  aplicarFoco();
}

function conectarEventos() {
  conectarStats();
  $('partido-info').addEventListener('click', () => { if (partido()) dialogoPartido({ nuevo: false, cancelable: true }); });
  $('btn-menu').addEventListener('click', () => alternarMenu('menu-header'));
  $('menu-header').addEventListener('click', (ev) => { if (ev.target.closest('button')) cerrarMenus(); });
  conectarEquipos();
  $('btn-partidos').addEventListener('click', () => cambiarModo('equipos'));
  $('btn-respaldo').addEventListener('click', exportarRespaldo);
  $('btn-datos').addEventListener('click', () => { if (partido()) dialogoPartido({ nuevo: false, cancelable: true }); });
  $('btn-plantel').addEventListener('click', dialogoPlantel);
  $('btn-cambiar-video').addEventListener('click', () => {
    if (ui.modo === 'stats') cambiarModo('captura');
    ui.cambiandoVideo = true;
    const p = partido();
    if (p && p.video && p.video.tipo === 'youtube') $('input-youtube').value = p.video.url;
    render();
  });
  $('btn-foco').addEventListener('click', () => alternarFoco(true));
  $('btn-salir-foco').addEventListener('click', () => alternarFoco(false));
  $('btn-velocidad').addEventListener('click', () => alternarMenu('menu-velocidad'));
  $('btn-menu-marcador').addEventListener('click', () => alternarMenu('menu-marcador'));
  $('menu-marcador').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-punto]');
    if (!b) return;
    cerrarMenus();
    puntoDirecto(b.dataset.punto);
  });
  // Clic fuera de un menú lo cierra
  document.addEventListener('mousedown', (ev) => {
    if (!ev.target.closest('.menu-ancla')) cerrarMenus();
  });
  $('estado').addEventListener('click', (ev) => { if (ev.target.closest('#btn-atajos')) alternarAyuda(); });
  $('anteriores-cab').addEventListener('click', (ev) => {
    if (ev.target.closest('#btn-volver-rally')) { volverAlRally(); return; }
    alternarListaAnteriores();
  });
  $('anteriores-lista').addEventListener('click', (ev) => {
    const g = ev.target.closest('[data-set-plegado]');
    if (!g) return;
    ui.setsAbiertos = ui.setsAbiertos || {};
    ui.setsAbiertos[g.dataset.setPlegado] = !ui.setsAbiertos[g.dataset.setPlegado];
    renderAnteriores();
  });
  $('btn-jugador').addEventListener('click', () => alternarMenuJugador());
  $('btn-leyenda').addEventListener('click', () => {
    prefs.leyenda = !prefs.leyenda;
    guardarPrefs();
    aplicarLeyenda();
  });
  $('jug-popover').addEventListener('click', (ev) => {
    if (ev.target.closest('#jug-editar')) { alternarMenuJugador(false); dialogoPlantel(); return; }
    const b = ev.target.closest('[data-jug]');
    if (b) { alternarMenuJugador(false); asignarJugador(Number(b.dataset.jug)); }
  });
  // Clic fuera del menú lo cierra
  document.addEventListener('mousedown', (ev) => {
    if (!$('jug-popover').hidden && !ev.target.closest('.jug-menu')) alternarMenuJugador(false);
  });
  $('btn-exportar').addEventListener('click', () => { if (partido()) exportarPartido(almacen.actual); });
  $('btn-importar').addEventListener('click', () => $('input-importar').click());
  $('input-importar').addEventListener('change', (ev) => {
    const archivos = [...ev.target.files];
    ev.target.value = '';
    if (archivos.length) importarArchivos(archivos);
  });

  $('form-youtube').addEventListener('submit', (ev) => {
    ev.preventDefault();
    cargarVideoYouTube($('input-youtube').value);
    $('input-youtube').blur();
  });
  $('btn-archivo').addEventListener('click', () => $('input-archivo').click());
  $('input-archivo').addEventListener('change', (ev) => {
    const f = ev.target.files[0];
    if (f) cargarVideoArchivo(f);
    ev.target.value = '';
  });
  $('btn-cancelar-carga').addEventListener('click', () => { ui.cambiandoVideo = false; render(); });
  $('video-capa').addEventListener('click', () => Video.alternar());
  $('btn-sonido').addEventListener('click', alternarSilencio);

  $('btn-atras').addEventListener('click', () => Video.mover(-SALTO_SEGUNDOS));
  $('btn-adelante').addEventListener('click', () => Video.mover(SALTO_SEGUNDOS));
  $('btn-play').addEventListener('click', () => Video.alternar());
  $('menu-velocidad').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-vel]');
    if (!b) return;
    cerrarMenus();
    Video.velocidad(Number(b.dataset.vel));
    prefs.velocidad = Video.vel;
    guardarPrefs();
    renderControles();
  });
  $('pausar-al-marcar').addEventListener('change', (ev) => {
    prefs.pausarAlMarcar = ev.target.checked;
    guardarPrefs();
  });

  $('barra').addEventListener('click', (ev) => {
    const d = Video.duracion();
    if (!d) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    Video.saltar(((ev.clientX - rect.left) / rect.width) * d);
  });

  document.body.addEventListener('click', (ev) => {
    const b = ev.target.closest('.ir[data-t]');
    if (b) Video.saltar(Number(b.dataset.t));
  });

  $('chips-rotacion').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-rot]');
    if (b) corregirRotacion(Number(b.dataset.rot));
  });

  $('selector-vista').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-vista]');
    if (!b) return;
    ui.vista = b.dataset.vista;
    $('selector-vista').querySelectorAll('button').forEach((x) => x.classList.toggle('activo', x === b));
    renderCancha();
  });

  $('cancha').addEventListener('click', (ev) => {
    const svg = ev.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
    const x = Math.min(1, Math.max(0, loc.x / (AREA.ancho * VB)));
    const y = Math.min(1, Math.max(0, loc.y / (AREA.alto * VB)));
    clicCancha([redondear(x, 3), redondear(y, 3)]);
  });
}

function iniciar() {
  Video.el = $('video-local');
  Video.vel = VELOCIDADES.includes(prefs.velocidad) ? prefs.velocidad : 1;
  Video.mudo = !!prefs.silencio;
  restaurarHistorialSesion();
  window.addEventListener('pagehide', guardarHistorialSesion);
  conectarEventos();
  renderLeyenda();
  aplicarLeyenda();
  aplicarFoco();
  document.body.classList.toggle('lista-abierta', !!prefs.listaAbierta);
  render();
  setInterval(actualizarVideoUI, 100);
  setInterval(renderGuardado, 1000);

  // Se vuelve a la pantalla en que se estaba; sin partido abierto, a Equipos
  const p = partido();
  cambiarModo(prefs.modo === 'captura' && p ? 'captura' : prefs.modo === 'stats' && p ? 'stats' : 'equipos');
  if (p && p.video && p.video.tipo === 'youtube') cargarVideoYouTube(p.video.url, false);
}

cargarAlmacen();
iniciar();
