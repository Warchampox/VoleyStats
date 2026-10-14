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
  cuadroAtras: ',',
  cuadroAdelante: '.',
  nuevoRally: 'enter',
  cancelar: 'escape',
  cerrarSinAtaque: 'g',
  recovery: 't',
  pasaLibre: 'f',
  recibeLibre: 'b',
  calificacion: { '1': '#', '2': '+', '3': '!', '4': '-', '5': '=' },
  armada: { q: 'primer', w: 'alta', e: 'rapida', r: 'pipe' },
  golpe: { c: 'corto', v: 'largo' },
  resultado: { '1': 'punto', '2': 'error', '3': 'bloqueado', '4': 'pinchado', '5': 'rejugado', '6': 'defendido' },
  ganador: { '1': 'propio', '2': 'rival' },
};

const SALTO_SEGUNDOS = 3;
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
};

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
const VERSION_DATOS = 1;

let almacen = { version: VERSION_DATOS, actual: null, partidos: {} };
let prefs = { pausarAlMarcar: true, velocidad: 1 };

// Cada cambio futuro al formato agrega aquí un paso de migración
// (version N → N+1). Se usa al cargar localStorage y al importar archivos.
function migrar(datos) {
  if (!datos || typeof datos !== 'object' || !datos.partidos) {
    return { version: VERSION_DATOS, actual: null, partidos: {} };
  }
  if (!datos.version) datos.version = 1;
  return datos;
}

function cargarAlmacen() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) almacen = migrar(JSON.parse(crudo));
  } catch (e) { /* sin datos previos legibles */ }
  try {
    const p = localStorage.getItem(CLAVE_PREFS);
    if (p) prefs = { ...prefs, ...JSON.parse(p) };
  } catch (e) { /* preferencias por defecto */ }
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

function crearPartido({ propio, rival, fecha, scouteado }) {
  const id = 'p' + Date.now().toString(36);
  return {
    id,
    version: VERSION_DATOS,
    creado: new Date().toISOString(),
    fecha,
    equipos: { propio, rival },
    scouteado,
    video: null,
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

function nombre(equipo, p = partido()) {
  return (p && p.equipos[equipo]) || (equipo === 'propio' ? 'Propio' : 'Rival');
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

// La rotación se deriva: rotación inicial del set + correcciones manuales.
// (La rotación automática por side-out llega en la fase 3.)
function rotacionEn(set, indice, equipo) {
  let rot = set.rotInicial[equipo];
  for (const c of set.correcciones) {
    if (c.equipo === equipo && c.desde <= indice) rot = c.rot;
  }
  return rot;
}

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

function faseArmada(r, armada) {
  const i = r.acciones.indexOf(armada);
  const previa = r.acciones[i - 1];
  if (previa && previa.tipo === 'recepcion') return 'recepcion';
  if (previa && previa.tipo === 'recovery') return 'recovery';
  if (previa && previa.tipo === 'recibeLibre') return 'libre';
  return 'contra';
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

function zonaAtaque(armada) {
  return aMetros(armada.punto)[0] <= CANCHA.red ? 'Z' + zonaPunto(armada.punto) : null;
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

// "diago · Z5"; con toque: "t. corto · diago · Z3"
function textoAtaque(armada, ataque, conGolpe = true) {
  const partes = [];
  if (conGolpe && ataque.golpe !== 'remate') partes.push(GOLPES[ataque.golpe].corto);
  const d = armada && direccion(armada, ataque);
  if (d) partes.push(d);
  const z = destino(ataque);
  if (z) partes.push(z);
  return partes.join(' · ');
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
    } else if (this.fuente === 'local') {
      this.el.currentTime = t;
    }
  },
  mover(delta) { this.saltar(this.tiempo() + delta); },
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
            this.sinSubtitulos();
            resolver();
          },
          // YouTube vuelve a activar los subtítulos al reproducir si el usuario los tiene por defecto
          onStateChange: (ev) => { if (ev.data === YT.PlayerState.PLAYING) this.sinSubtitulos(); },
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
  cambiandoVideo: false,
  rallyPausado: null,
  aviso: null,
};

// Selecciones en curso que todavía no son una acción guardada.
let pendiente = nuevoPendiente();
function nuevoPendiente() {
  return { armada: null, golpe: 'remate', cerrar: false, elegirSaque: null };
}

const historial = [];
const MAX_HISTORIAL = 300;

function mutar(etiqueta, fn) {
  const p = partido();
  historial.push({ id: p.id, json: JSON.stringify(p), pendiente: { ...pendiente }, etiqueta });
  if (historial.length > MAX_HISTORIAL) historial.shift();
  fn(p);
  guardar();
  render();
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
  renderEstado();
  setTimeout(renderEstado, 2600);
}

// =====================================================================
// Captura: máquina de estados derivada de los datos
// =====================================================================

function estado() {
  const p = partido();
  if (!p) return { modo: 'sinPartido' };
  const set = setActual(p);
  if (pendiente.elegirSaque) return { modo: 'elegirSaque', p, set };
  if (partidoTerminado(p)) return { modo: 'partidoTerminado', p, set };
  if (set.final) return { modo: 'setTerminado', p, set };
  const r = rallyAbierto(set);
  if (!r) return { modo: 'esperando', p, set };
  if (pendiente.cerrar) return { modo: 'cerrar', p, set, r };
  const ultima = r.acciones[r.acciones.length - 1];
  let modo;
  if (ultima.tipo === 'saque') modo = r.saca === p.scouteado ? 'armadaTipo' : 'recepcion';
  else if (ultima.tipo === 'armada') modo = 'golpe';
  else if (ultima.tipo === 'ataque' && !ultima.resultado) modo = 'resultado';
  else modo = 'armadaTipo';
  if (modo === 'armadaTipo' && pendiente.armada) modo = 'armadaClic';
  return { modo, p, set, r, ultima };
}

function esModoClic(modo) { return modo === 'armadaClic' || modo === 'golpe'; }

// "Pausar al marcar": la primera entrada de captura del rally pausa el video.
function alMarcar(set) {
  const clave = `${set.numero}-${set.rallies.length}`;
  if (prefs.pausarAlMarcar && ui.rallyPausado !== clave && !Video.pausado()) Video.pausar();
  ui.rallyPausado = clave;
}

function tiempoActual() { return redondear(Video.tiempo(), 1); }

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

function cerrarRally(set, r, gana) {
  r.gana = gana;
  const m = marcadorTras(set);
  if (setTerminado(set, m)) set.final = m;
  pendiente = nuevoPendiente();
}

function teclaCaptura(k) {
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
        set.primerSaque = saca;
        abrirRally(set, saca, t);
      });
      return true;
    }
    if (k === TECLAS.cancelar) { mutar('Cancelar', () => { pendiente.elegirSaque = null; }); return true; }
    return false;
  }

  if (!r) return false;

  if (modo === 'cerrar') {
    if (TECLAS.ganador[k]) {
      const gana = TECLAS.ganador[k];
      alMarcar(set);
      mutar(`Gana ${nombre(gana)}`, () => cerrarRally(set, r, gana));
      return true;
    }
    if (k === TECLAS.cancelar) { mutar('Cancelar', () => { pendiente.cerrar = false; }); return true; }
    return false;
  }

  if (k === TECLAS.cerrarSinAtaque && ['recepcion', 'armadaTipo', 'armadaClic'].includes(modo)) {
    alMarcar(set);
    mutar('Cerrar rally', () => { pendiente.cerrar = true; pendiente.armada = null; });
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

  if ((modo === 'armadaTipo' || modo === 'armadaClic') && TECLAS.armada[k]) {
    const tipo = TECLAS.armada[k];
    alMarcar(set);
    mutar(`Tipo ${ARMADAS[tipo].corto.toLowerCase()}`, () => { pendiente.armada = tipo; });
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

  if (modo === 'armadaTipo' && k === TECLAS.recovery) {
    if (e.ultima.tipo === 'recovery') return true;
    const t = tiempoActual();
    alMarcar(set);
    mutar('Recovery', () => { r.acciones.push({ tipo: 'recovery', equipo: p.scouteado, t }); });
    return true;
  }

  if (modo === 'armadaClic' && k === TECLAS.cancelar) {
    mutar('Cambiar tipo', () => { pendiente.armada = null; });
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
  if (!esModoClic(modo)) return;
  const t = tiempoActual();
  alMarcar(set);
  if (modo === 'armadaClic') {
    const tipo = pendiente.armada;
    mutar(`Armada ${ARMADAS[tipo].corto.toLowerCase()}`, () => {
      r.acciones.push({ tipo: 'armada', equipo: p.scouteado, armada: tipo, punto, t });
      pendiente.armada = null;
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
    if (desde === 0) { set.rotInicial[equipo] = rot; return; }
    set.correcciones = set.correcciones.filter((c) => !(c.equipo === equipo && c.desde === desde));
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
  renderListas();
  renderCargaVideo();
  renderControles();
}

function renderCabecera() {
  const p = partido();
  if (!p) { $('partido-info').textContent = 'Sin partido'; $('scouteando').textContent = '—'; return; }
  const set = setActual(p);
  $('partido-info').innerHTML = `${esc(nombre('rival'))} vs ${esc(nombre('propio'))} · ${esc(fmtFecha(p.fecha))} · <b>Set ${set.numero}</b>`;
  $('scouteando').textContent = nombre(p.scouteado);
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
  if (!p) { $('tanteo').innerHTML = ''; $('sub-marcador').textContent = ''; $('chips-rotacion').innerHTML = ''; return; }
  const set = setActual(p);
  const r = rallyAbierto(set);
  const m = r ? r.marcador : marcadorTras(set);
  const saca = r ? r.saca : (set.final ? null : sacaSiguiente(set));
  const g = setsGanados(p);
  const punto = (eq) => `<span class="punto-saque${saca === eq ? '' : ' oculto'}"></span>`;
  $('tanteo').innerHTML =
    `<span class="equipo">${esc(nombre('propio'))}</span>` +
    `<span class="num">${m[0]}</span><span class="guion">–</span><span class="num">${m[1]}</span>` +
    `<span class="equipo">${esc(nombre('rival'))} ${punto('rival')}</span>`;
  if (saca === 'propio') $('tanteo').firstElementChild.insertAdjacentHTML('beforeend', ' ' + punto('propio'));
  $('sub-marcador').textContent =
    `Set ${set.numero} · sets ${g[0]}–${g[1]}` + (saca ? ` · saca ${nombre(saca)}` : '');

  $('rot-titulo').textContent = `Armador ${nombre(p.scouteado)}`;
  const rot = rotacionEn(set, indiceRallyVigente(set), p.scouteado);
  $('chips-rotacion').innerHTML = [1, 2, 3, 4, 5, 6]
    .map((n) => `<button data-rot="${n}" class="${rot === n ? 'activo' : ''}">P${n}</button>`).join('');
}

function kbd(tecla, principal = false) {
  return `<kbd class="${principal ? 'principal' : ''}">${esc(tecla)}</kbd>`;
}

function teclaItem(tecla, texto, extra = '', principal = false) {
  return `<div class="tecla-item">${kbd(tecla, principal)}${extra}<span>${esc(texto)}</span></div>`;
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

function celdasPasos(e) {
  const vacia = { valor: '—' };
  const c = [{ ...vacia }, { ...vacia }, { ...vacia }, { ...vacia }];
  if (!e.set) return c;
  const r = e.r || rallyMostrado(e.set);
  if (!r) return c;
  const seqs = secuencias(r);
  let indice = Math.max(0, seqs.length - 1);
  let seq = seqs[indice] || [];
  if (e.r) {
    // Rally abierto tras un ataque que sigue: empieza una secuencia nueva
    const ult = seq[seq.length - 1];
    if (ult && cierraSecuencia(ult)) { seq = []; indice = seqs.length; }
  }
  const rec = seq.find((a) => a.tipo === 'recepcion');
  const recov = seq.find((a) => a.tipo === 'recovery');
  const libreRec = seq.find((a) => a.tipo === 'recibeLibre');
  const librePasa = seq.find((a) => a.tipo === 'pasaLibre');
  const arm = seq.find((a) => a.tipo === 'armada');
  const atq = seq.find((a) => a.tipo === 'ataque');
  const scout = (e.p || partido()).scouteado;

  if (rec) c[0] = { valor: '✓ ' + rec.calif };
  else if (recov) c[0] = { valor: 'Recovery' };
  else if (libreRec) c[0] = { valor: 'Libre' };
  else if (r.saca === scout || indice > 0) c[0] = { valor: 'Contra' };

  if (arm) {
    const z = zonaAtaque(arm);
    c[1] = { valor: `✓ ${ARMADAS[arm.armada].corto}${z ? ' → ' + z : ''}` };
  }
  if (librePasa) c[1] = { valor: '✓ Pasa libre' };
  if (atq) c[2] = { valor: '✓ ' + GOLPES[atq.golpe].nombre };
  if (atq && atq.resultado) c[3] = { valor: '✓ ' + RESULTADOS[atq.resultado].nombre };

  const m = e.modo;
  if (m === 'recepcion') c[0] = { valor: 'en curso', actual: true };
  if (m === 'armadaTipo') c[1] = { valor: 'tipo', actual: true };
  if (m === 'armadaClic') c[1] = { valor: `${ARMADAS[pendiente.armada].corto} · clic`, actual: true };
  if (m === 'golpe') c[2] = { valor: pendiente.golpe === 'remate' ? 'clic' : `${GOLPES[pendiente.golpe].corto} · clic`, actual: true };
  if (m === 'resultado') c[3] = { valor: 'tecla', actual: true };
  return c;
}

function contenidoEstado(e) {
  const p = e.p;
  const deshacerTxt = historial.length ? `Deshacer «${historial[historial.length - 1].etiqueta}»` : 'Deshacer';
  const teclasVideo = [
    teclaItem('Ctrl+Z', deshacerTxt),
    teclaItem('Espacio', 'Reproducir / pausar'),
    `<div class="tecla-item">${kbd('←')}${kbd('→')}<span>−3 s / +3 s</span></div>`,
  ];
  const scoutNom = p ? nombre(p.scouteado) : '';

  switch (e.modo) {
    case 'sinPartido':
      return { tipo: '', titulo: 'Crea el partido', contexto: 'Equipos, fecha y equipo scouteado.', teclas: [], cols: 'c2' };

    case 'esperando': {
      if (!Video.fuente) {
        return { tipo: 'video', titulo: 'Carga el video del partido', contexto: 'Link de YouTube o archivo local, en el panel del video.', teclas: [], cols: 'c2' };
      }
      const set = e.set;
      const ultimo = rallyMostrado(set);
      const rot = rotacionEn(set, set.rallies.length, p.scouteado);
      const rotTxt = rot ? `armador en P${rot}` : 'fija la rotación con los chips P1–P6';
      if (!ultimo) {
        return {
          tipo: 'tecla', titulo: `Listo para el set ${set.numero}`,
          contexto: `Enter marca el saque del primer rally en el segundo actual. Antes, ${rot ? 'revisa: ' + rotTxt : rotTxt}.`,
          teclas: [teclaItem('Enter', 'Nuevo rally', '', true), ...teclasVideo], cols: 'c2',
        };
      }
      const n = set.rallies.length;
      return {
        tipo: 'tecla', titulo: `Rally ${n} cerrado · punto ${nombre(ultimo.gana)}`,
        contexto: `Enter abre el rally ${n + 1} en el segundo actual. Saca ${nombre(sacaSiguiente(set))}, ${rotTxt}.`,
        teclas: [teclaItem('Enter', 'Nuevo rally', '', true), ...teclasVideo], cols: 'c2',
      };
    }

    case 'elegirSaque':
      return {
        tipo: 'tecla', titulo: '¿Quién saca el primer rally?',
        contexto: `Set ${e.set.numero} · el rally parte en ${fmtTiempo(pendiente.elegirSaque.t)}.`,
        teclas: [teclaItem('1', nombre('propio'), '', true), teclaItem('2', nombre('rival'), '', true), teclaItem('Esc', 'Cancelar')], cols: 'c3',
      };

    case 'setTerminado': {
      const f = e.set.final;
      return {
        tipo: 'tecla', titulo: `Set ${e.set.numero} terminado · ${f[0]}–${f[1]}`,
        contexto: `Enter abre el set ${e.set.numero + 1}.`,
        teclas: [teclaItem('Enter', 'Set nuevo', '', true), ...teclasVideo], cols: 'c2',
      };
    }

    case 'partidoTerminado': {
      const g = setsGanados(p);
      return {
        tipo: '', titulo: `Partido terminado · ${g[0]}–${g[1]}`,
        contexto: 'Ctrl+Z deshace el último punto si hace falta corregir.',
        teclas: teclasVideo, cols: 'c2',
      };
    }

    case 'cerrar':
      return {
        tipo: 'tecla', titulo: '¿Quién gana el rally?',
        contexto: `Cierra el rally sin registrar otro ataque del ${scoutNom}.`,
        teclas: [teclaItem('1', nombre('propio'), '', true), teclaItem('2', nombre('rival'), '', true), teclaItem('Esc', 'Cancelar')], cols: 'c3',
      };

    case 'recepcion': {
      const saque = e.r.acciones[0];
      return {
        tipo: 'tecla', titulo: `Calificar recepción del ${scoutNom}`,
        contexto: `Primer contacto tras el saque de ${nombre(saque.equipo)} (${fmtTiempo(saque.t)}).`,
        teclas: [
          ...Object.entries(TECLAS.calificacion).map(([k, c]) => teclaItem(k, CALIF[c].nombre, califBadge(c))),
          teclaItem(nombreTecla(TECLAS.cerrarSinAtaque), 'Cerrar rally sin ataque'),
        ],
        cols: 'c3',
      };
    }

    case 'armadaTipo': {
      const ult = e.ultima;
      let fase;
      if (ult.tipo === 'recepcion') fase = `Side-out tras recepción ${ult.calif}.`;
      else if (ult.tipo === 'recovery') fase = 'Recovery.';
      else if (ult.tipo === 'recibeLibre') fase = 'Balón libre recibido.';
      else if (ult.tipo === 'pasaLibre') fase = `Pasó libre: la siguiente armada es contraataque.`;
      else if (ult.tipo === 'saque') fase = `Saca ${scoutNom}: la siguiente armada es contraataque.`;
      else fase = `Contraataque tras «${RESULTADOS[ult.resultado].nombre.toLowerCase()}».`;
      return {
        tipo: 'tecla', titulo: 'Tipo de armada',
        contexto: `${fase} Después se marca en la cancha dónde cae.`,
        teclas: [
          ...Object.entries(TECLAS.armada).map(([k, t]) => teclaItem(k.toUpperCase(), ARMADAS[t].nombre, muestra(t))),
          teclaItem(nombreTecla(TECLAS.recovery), 'Recovery'),
          teclaItem(nombreTecla(TECLAS.recibeLibre), 'Recibe balón libre'),
          teclaItem(nombreTecla(TECLAS.pasaLibre), 'Pasa balón libre'),
          teclaItem(nombreTecla(TECLAS.cerrarSinAtaque), 'Cerrar rally sin ataque'),
        ],
        cols: 'c2',
      };
    }

    case 'armadaClic': {
      const color = colorVar(ARMADAS[pendiente.armada].variable);
      return {
        tipo: 'clic en la cancha', icono: mira(color), titulo: 'Clic donde cae la armada',
        contexto: `${ARMADAS[pendiente.armada].nombre} · lado ${scoutNom}. Define la zona de ataque.`,
        teclas: [teclaItem('Esc', 'Cambiar tipo'), teclaItem('Ctrl+Z', deshacerTxt)], cols: 'c2',
      };
    }

    case 'golpe': {
      const g = pendiente.golpe;
      return {
        tipo: 'clic en la cancha', icono: mira(colorVar('--texto')), titulo: 'Clic donde pega el balón',
        contexto: g === 'remate' ? 'Remate por defecto. Modificador antes del clic si fue toque.' : `${GOLPES[g].nombre}. Clic donde pega o cae el balón.`,
        teclas: [
          teclaItem('—', 'Remate', '', g === 'remate'),
          ...Object.entries(TECLAS.golpe).map(([k, v]) => teclaItem(k.toUpperCase(), GOLPES[v].nombre, '', g === v)),
          teclaItem('Esc', g === 'remate' ? 'Volver al tipo de armada' : 'Volver a remate'),
          teclaItem('Ctrl+Z', deshacerTxt),
        ],
        cols: 'c3',
      };
    }

    case 'resultado': {
      const atq = e.ultima;
      const arm = e.r.acciones[e.r.acciones.length - 2];
      const calc = textoAtaque(arm, atq, false);
      const z = zonaAtaque(arm);
      return {
        tipo: 'tecla', titulo: 'Resultado del ataque',
        contexto: `${GOLPES[atq.golpe].nombre}${calc ? ' · ' + calc : ''}${z ? ' desde ' + z : ''}.`,
        teclas: Object.entries(TECLAS.resultado).map(([k, res]) => teclaItem(k, RESULTADOS[res].nombre, simboloMini(res))),
        cols: 'c3',
      };
    }
  }
  return { tipo: '', titulo: '', contexto: '', teclas: [], cols: 'c2' };
}

function renderEstado() {
  const e = estado();
  const celdas = celdasPasos(e);
  const nombres = ['Recepción', 'Armada', 'Golpe', 'Resultado'];
  const c = contenidoEstado(e);
  const aviso = ui.aviso && ui.aviso.hasta > Date.now() ? ui.aviso.texto : null;
  $('estado').innerHTML =
    `<div class="pasos">${celdas.map((x, i) =>
      `<div class="paso${x.actual ? ' actual' : ''}"><span class="etiqueta">${i + 1} ${nombres[i]}</span><span class="valor">${esc(x.valor)}</span></div>`).join('')}</div>` +
    `<div class="ahora">` +
      `<span class="etiqueta">Ahora${c.tipo ? ' · ' + esc(c.tipo) : ''}</span>` +
      `<h2>${c.icono || ''}${esc(c.titulo)}</h2>` +
      `<p${aviso ? ' style="color:var(--texto)"' : ''}>${esc(aviso || c.contexto)}</p>` +
    `</div>` +
    (c.teclas.length ? `<div class="teclas-paso ${c.cols}">${c.teclas.join('')}</div>` : '');
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
    case 'rejugado': s = `<path d="M0 3h15q4 0 4 3.5t-4 3.5h-6" fill="none" stroke="${t}" stroke-width="1.3"/><path d="M11.5 7.5L9 10l2.5 2" fill="none" stroke="${t}" stroke-width="1.2"/>`; break;
    case 'defendido': s = linea(18) + `<path d="M14 1.5L18.5 5 14 8.5" fill="none" stroke="${t}" stroke-width="1.3"/>`; break;
    default: s = linea(18);
  }
  return `<svg class="simbolo" viewBox="0 0 22 10" aria-hidden="true">${s}</svg>`;
}

// ---------- Cancha ----------

function baseCancha(p) {
  const L = 'var(--linea-cancha)';
  let s = '';
  s += `<rect x="20" y="20" width="180" height="90" fill="var(--superficie-cancha)" stroke="${L}" stroke-width="0.7"/>`;
  for (const y of [50, 80]) s += `<line x1="20" y1="${y}" x2="200" y2="${y}" stroke="#2E343B" stroke-width="0.4" stroke-dasharray="1.6 1.6"/>`;
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
    s += `<text x="20" y="11" font-size="4.6" fill="var(--texto-3)" letter-spacing="0.4">${esc(nombre(p.scouteado).toUpperCase())} · ataca →</text>`;
    s += `<text x="200" y="11" font-size="4.6" fill="var(--texto-3)" text-anchor="end" letter-spacing="0.4">${esc(nombre(otro(p.scouteado)).toUpperCase())}</text>`;
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
    } else if (res === 'pinchado' && nx !== null) {
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
    if (res === 'punto') {
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
      for (const j of jugadas(r)) s += dibujarJugada(j);
    }
  }
  svg.innerHTML = s;
  $('cancha-titulo').textContent = titulo;

  const clic = esModoClic(e.modo);
  svg.classList.toggle('clic', clic);
  if (e.modo === 'armadaClic') svg.style.cursor = cursorMira(colorVar(ARMADAS[pendiente.armada].variable));
  else if (e.modo === 'golpe') svg.style.cursor = cursorMira(colorVar('--texto'));
  else svg.style.cursor = '';
}

function renderLeyenda() {
  const arm = Object.entries(TECLAS.armada).map(([k, t]) =>
    `<span class="ley">${muestra(t)}${esc(ARMADAS[t].corto === '1er t.' ? '1er tiempo' : ARMADAS[t].corto)} ${kbd(k.toUpperCase())}</span>`).join('');
  const res = Object.keys(RESULTADOS).map((r) =>
    `<span class="ley">${simboloMini(r)}${esc(RESULTADOS[r].nombre)}</span>`).join('');
  $('leyenda').innerHTML =
    `<div class="leyenda-fila"><span class="etiqueta">Armada</span>${arm}</div>` +
    `<div class="leyenda-fila"><span class="etiqueta">Resultado</span>${res}</div>`;
}

// ---------- Listas ----------

function botonIr(t) { return `<button class="ir" data-t="${t}" title="Ir a ${fmtTiempo(t)}">▶</button>`; }

function filaAccion(r, a) {
  let tipo = '', det = '';
  const p = partido();
  switch (a.tipo) {
    case 'saque': tipo = 'Saque'; det = `<span style="font-family:var(--sans)">${esc(nombre(a.equipo))}</span>`; break;
    case 'recepcion': tipo = 'Recepción'; det = `${califBadge(a.calif)}<span style="font-family:var(--sans)">${CALIF[a.calif].nombre}</span>`; break;
    case 'recovery': tipo = 'Recovery'; det = `<span class="calc">${esc(nombre(p.scouteado))}</span>`; break;
    case 'recibeLibre': tipo = 'Libre'; det = '<span class="calc">recibe balón libre</span>'; break;
    case 'pasaLibre': tipo = 'Libre'; det = '<span class="calc">pasa al otro lado</span>'; break;
    case 'armada': {
      tipo = 'Armada';
      const z = zonaAtaque(a);
      const fase = faseArmada(r, a);
      det = `${muestra(a.armada)}<span>${ARMADAS[a.armada].corto}</span>` +
        (z ? `<span class="calc">→ ${z}</span>` : '') +
        (fase !== 'recepcion' ? `<span class="calc">· ${fase}</span>` : '');
      break;
    }
    case 'ataque': {
      tipo = 'Ataque';
      const i = r.acciones.indexOf(a);
      const arm = r.acciones[i - 1];
      const calc = textoAtaque(arm, a, false);
      det = `<span>${a.golpe === 'remate' ? 'Remate' : GOLPES[a.golpe].corto}</span>` + (calc ? `<span class="calc">· ${esc(calc)}</span>` : '') +
        (a.resultado ? `${simboloMini(a.resultado)}<span>${RESULTADOS[a.resultado].nombre}</span>` : '<span class="calc">…</span>');
      break;
    }
  }
  return `<div class="fila fila-accion"><span class="t">${fmtTiempo(a.t)}</span><span>${tipo}</span><span class="detalle">${det}</span>${botonIr(a.t)}</div>`;
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
  } else if (rec && rec.calif === '=') {
    s += '<span class="tenue">error de recepción</span>';
  } else {
    s += `<span class="tenue">sin ataque ${esc(nombre(p.scouteado).toLowerCase())}</span>`;
  }
  return s;
}

function renderListas() {
  const p = partido();
  if (!p) {
    $('rally-titulo').textContent = 'Rally · acciones';
    $('rally-info').textContent = '';
    $('rally-acciones').innerHTML = '';
    $('rally-pie').hidden = true;
    $('rallies-anteriores').innerHTML = '';
    $('anteriores-cuenta').textContent = '';
    return;
  }
  const set = setActual(p);
  const r = rallyMostrado(set);
  if (r) {
    const idx = set.rallies.indexOf(r);
    const rot = rotacionEn(set, idx, p.scouteado);
    $('rally-titulo').textContent = `Rally ${idx + 1} · acciones`;
    $('rally-info').textContent = `saca ${nombre(r.saca)} · ${r.marcador[0]}–${r.marcador[1]}` + (rot ? ` · P${rot}` : '');
    $('rally-acciones').innerHTML = r.acciones.map((a) => filaAccion(r, a)).join('');
    const pie = $('rally-pie');
    pie.hidden = false;
    if (r.gana) {
      const m = [r.marcador[0] + (r.gana === 'propio' ? 1 : 0), r.marcador[1] + (r.gana === 'rival' ? 1 : 0)];
      pie.innerHTML = `<span>Gana <b>${esc(nombre(r.gana))}</b></span><span class="mono">${m[0]}–${m[1]}</span>`;
    } else {
      pie.innerHTML = `<span class="tenue">En curso</span><span class="mono">${r.marcador[0]}–${r.marcador[1]}</span>`;
    }
    const lista = $('rally-acciones');
    lista.scrollTop = lista.scrollHeight;
  } else {
    $('rally-titulo').textContent = 'Rally · acciones';
    $('rally-info').textContent = '';
    $('rally-acciones').innerHTML = '<div class="vacio">Todavía no hay rallies en este set.</div>';
    $('rally-pie').hidden = true;
  }

  $('anteriores-titulo').textContent = `Rallies anteriores · set ${set.numero}`;
  const cerrados = set.rallies.filter((x) => x.gana);
  $('anteriores-cuenta').textContent = `${cerrados.length} ${cerrados.length === 1 ? 'rally' : 'rallies'}`;
  const anteriores = set.rallies.map((x, i) => ({ x, i })).filter(({ x }) => x.gana && x !== r).reverse();
  const corto = (eq) => nombre(eq).slice(0, 3);
  $('rallies-anteriores').innerHTML = anteriores.length
    ? anteriores.map(({ x, i }) => {
      const rot = rotacionEn(set, i, p.scouteado);
      return `<div class="fila fila-rally"><span class="tenue">${i + 1}</span><span class="tenue">${fmtMinuto(x.t)}</span>` +
        `<span class="resumen">${resumenRally(x, p)}</span><span class="tenue">${rot ? 'P' + rot : '—'}</span>` +
        `<span class="${x.gana === p.scouteado ? 'gana-scout' : 'gana-otro'}">${esc(corto(x.gana))}</span>${botonIr(x.t)}</div>`;
    }).join('')
    : '<div class="vacio">Aquí aparecen los rallies cerrados del set.</div>';
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
  const chip = $('chip-fuente');
  chip.hidden = !Video.fuente;
  if (Video.fuente) chip.textContent = Video.fuente === 'youtube' ? 'YouTube' : `Archivo local · ${p && p.video ? p.video.nombre : ''}`;
}

function renderControles() {
  $('grupo-velocidad').innerHTML = VELOCIDADES
    .map((v) => `<button data-vel="${v}" class="${v === Video.vel ? 'activo' : ''}">${fmtVelocidad(v)}</button>`).join('');
  const cuadro = Video.puedeCuadro();
  for (const id of ['btn-cuadro-atras', 'btn-cuadro-adelante']) $(id).disabled = !cuadro;
  $('pausar-al-marcar').checked = !!prefs.pausarAlMarcar;
}

function actualizarVideoUI() {
  const t = Video.tiempo();
  const d = Video.duracion();
  const pausado = Video.pausado();
  $('tiempo-grande').textContent = fmtTiempo(t);
  $('lt-actual').textContent = fmtTiempo(t);
  $('lt-duracion').textContent = fmtMinuto(d);
  $('badge-pausado').hidden = !Video.fuente || !pausado;
  $('play-texto').textContent = pausado ? '▶ Reproducir' : '❚❚ Pausar';
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

  if ((ev.ctrlKey || ev.metaKey) && k === 'z' && !ev.shiftKey) { ev.preventDefault(); deshacer(); return; }
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

  if (k === TECLAS.reproducir) { ev.preventDefault(); if (!ev.repeat) Video.alternar(); return; }
  if (k === TECLAS.atras) { ev.preventDefault(); Video.mover(-SALTO_SEGUNDOS); return; }
  if (k === TECLAS.adelante) { ev.preventDefault(); Video.mover(SALTO_SEGUNDOS); return; }
  if (k === TECLAS.cuadroAtras) { ev.preventDefault(); Video.cuadro(-1); return; }
  if (k === TECLAS.cuadroAdelante) { ev.preventDefault(); Video.cuadro(1); return; }

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

function confirmar({ titulo, texto, aceptar = 'Aceptar' }) {
  return new Promise((resolver) => {
    abrirModal(
      `<h2>${esc(titulo)}</h2><p>${esc(texto)}</p>` +
      `<div class="acciones"><button class="btn" data-r="no">Cancelar</button><button class="btn principal" data-r="si">${esc(aceptar)}</button></div>`,
      true,
    );
    $('modal').querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
      cerrarModal();
      resolver(b.dataset.r === 'si');
    }));
  });
}

function dialogoPartido({ nuevo, cancelable }) {
  const p = partido();
  const datos = nuevo
    ? { propio: 'Propio', rival: 'Rival', fecha: hoyIso(), scouteado: 'rival' }
    : { propio: p.equipos.propio, rival: p.equipos.rival, fecha: p.fecha, scouteado: p.scouteado };
  const otros = Object.values(almacen.partidos).filter((x) => !p || x.id !== p.id);
  const selectorOtros = !nuevo && otros.length
    ? `<hr><label><span class="etiqueta">Abrir otro partido guardado</span><select class="campo" id="d-otro"><option value="">—</option>${
      otros.map((x) => `<option value="${x.id}">${esc(x.equipos.rival)} vs ${esc(x.equipos.propio)} · ${esc(fmtFecha(x.fecha))}</option>`).join('')}</select></label>`
    : '';
  abrirModal(
    `<h2>${nuevo ? 'Partido nuevo' : 'Datos del partido'}</h2>` +
    `<form id="form-partido" style="display:flex;flex-direction:column;gap:14px">` +
    `<div class="fila-campos">` +
    `<label><span class="etiqueta">Equipo propio</span><input class="campo" id="d-propio" value="${esc(datos.propio)}" required></label>` +
    `<label><span class="etiqueta">Equipo rival</span><input class="campo" id="d-rival" value="${esc(datos.rival)}" required></label>` +
    `</div>` +
    `<div class="fila-campos">` +
    `<label><span class="etiqueta">Fecha</span><input class="campo" id="d-fecha" type="date" value="${esc(datos.fecha)}" required></label>` +
    `<label><span class="etiqueta">Equipo scouteado</span>` +
    (nuevo
      ? `<select class="campo" id="d-scout"><option value="rival">Rival</option><option value="propio">Propio</option></select>`
      : `<input class="campo" value="${esc(nombre(datos.scouteado))}" disabled>`) +
    `</label></div>` +
    selectorOtros +
    `<div class="acciones">` +
    (!nuevo ? `<button type="button" class="btn izq" id="d-nuevo">Partido nuevo…</button>` : '') +
    (cancelable ? `<button type="button" class="btn" id="d-cancelar">Cancelar</button>` : '') +
    `<button type="submit" class="btn principal">${nuevo ? 'Crear partido' : 'Guardar'}</button>` +
    `</div></form>`,
    cancelable,
  );

  if (cancelable) $('d-cancelar').addEventListener('click', cerrarModal);
  if (!nuevo) {
    $('d-nuevo').addEventListener('click', async () => {
      const ok = await confirmar({
        titulo: '¿Empezar un partido nuevo?',
        texto: 'El partido actual queda guardado en este navegador y puedes volver a abrirlo desde «Datos del partido».',
        aceptar: 'Empezar partido nuevo',
      });
      if (ok) dialogoPartido({ nuevo: true, cancelable: true });
    });
    const sel = $('d-otro');
    if (sel) sel.addEventListener('change', () => {
      if (!sel.value) return;
      cambiarPartido(sel.value);
      cerrarModal();
    });
  }

  $('form-partido').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const propio = $('d-propio').value.trim() || 'Propio';
    const rival = $('d-rival').value.trim() || 'Rival';
    const fecha = $('d-fecha').value || hoyIso();
    if (nuevo) {
      const np = crearPartido({ propio, rival, fecha, scouteado: $('d-scout').value });
      almacen.partidos[np.id] = np;
      cambiarPartido(np.id);
    } else {
      p.equipos.propio = propio;
      p.equipos.rival = rival;
      p.fecha = fecha;
      guardar();
      render();
    }
    cerrarModal();
  });
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
  if (p.video && p.video.tipo === 'youtube') cargarVideoYouTube(p.video.url, false);
  render();
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

function conectarEventos() {
  $('partido-info').addEventListener('click', () => { if (partido()) dialogoPartido({ nuevo: false, cancelable: true }); });

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
  $('chip-fuente').addEventListener('click', () => {
    ui.cambiandoVideo = true;
    const p = partido();
    if (p && p.video && p.video.tipo === 'youtube') $('input-youtube').value = p.video.url;
    render();
  });
  $('video-capa').addEventListener('click', () => Video.alternar());

  $('btn-atras').addEventListener('click', () => Video.mover(-SALTO_SEGUNDOS));
  $('btn-adelante').addEventListener('click', () => Video.mover(SALTO_SEGUNDOS));
  $('btn-play').addEventListener('click', () => Video.alternar());
  $('btn-cuadro-atras').addEventListener('click', () => Video.cuadro(-1));
  $('btn-cuadro-adelante').addEventListener('click', () => Video.cuadro(1));
  $('grupo-velocidad').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-vel]');
    if (!b) return;
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
    const b = ev.target.closest('.ir');
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
  conectarEventos();
  renderLeyenda();
  render();
  setInterval(actualizarVideoUI, 100);
  setInterval(renderGuardado, 1000);

  const p = partido();
  if (!p) {
    dialogoPartido({ nuevo: true, cancelable: false });
  } else if (p.video && p.video.tipo === 'youtube') {
    cargarVideoYouTube(p.video.url, false);
  }
}

cargarAlmacen();
iniciar();
