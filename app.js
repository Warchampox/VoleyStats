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
  resultado: { '1': 'punto', '2': 'error', '3': 'bloqueado', '4': 'pinchado', '5': 'rejugado', '6': 'defendido', '7': 'usaBloque' },
  ganador: { '1': 'propio', '2': 'rival' },
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
const ACCIONES_CON_JUGADOR = ['recepcion', 'ataque'];
const VERSION_DATOS = 1;

let almacen = { version: VERSION_DATOS, actual: null, partidos: {} };
let prefs = { pausarAlMarcar: true, velocidad: 1, leyenda: false, silencio: false };

// Cada cambio futuro al formato agrega en migrarPartido un paso
// (version N → N+1). Se usa al cargar localStorage y al importar archivos.
function migrar(datos) {
  if (!datos || typeof datos !== 'object' || !datos.partidos) {
    return { version: VERSION_DATOS, actual: null, partidos: {} };
  }
  for (const id of Object.keys(datos.partidos)) datos.partidos[id] = migrarPartido(datos.partidos[id]);
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
  // if (p.version === 1) { ...; p.version = 2; }
  return p;
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
    plantel: { propio: [], rival: [] }, // [{ num, nombre, pos }]
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
  // puntoPara: punto directo pendiente de saber quién saca (primer rally del set)
  return { armada: null, golpe: 'remate', cerrar: false, elegirSaque: null, elegirRotacion: null, puntoPara: null };
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

function esModoClic(modo) { return modo === 'armadaClic' || modo === 'golpe'; }

// "Pausar al marcar": la primera entrada de captura del rally pausa el video.
function alMarcar(set) {
  const clave = `${set.numero}-${set.rallies.length}`;
  if (prefs.pausarAlMarcar && ui.rallyPausado !== clave && !Video.pausado()) Video.pausar();
  ui.rallyPausado = clave;
}

function tiempoActual() { return redondear(Video.tiempo(), 1); }

// Abre el rally y, si había un punto directo pendiente, lo cierra de inmediato
function abrirRallyPendiente(set, saca, t) {
  const para = pendiente.puntoPara;
  abrirRally(set, saca, t);
  if (para) cerrarRally(set, set.rallies[set.rallies.length - 1], para);
}

// Punto sin jugada: un rally con solo el saque y su ganador. Marcador, saque
// y rotación se siguen derivando de los rallies como siempre.
function puntoDirecto(gana) {
  const e = estado();
  const { modo, set, r } = e;
  if (modo === 'sinPartido' || ui.modo === 'stats') return;
  if (['elegirSaque', 'elegirRotacion'].includes(modo)) { avisar('Primero termina de abrir el set'); return; }
  if (modo === 'setTerminado' || modo === 'partidoTerminado') { avisar('El set ya terminó: Enter abre el siguiente'); return; }
  const t = tiempoActual();
  if (r) {
    mutar(`Punto ${nombre(gana)}`, () => cerrarRally(set, r, gana));
  } else if (!set.rallies.length && !set.primerSaque) {
    mutar(`Punto ${nombre(gana)}`, () => { pendiente.elegirSaque = { t }; pendiente.puntoPara = gana; });
  } else {
    mutar(`Punto ${nombre(gana)}`, () => {
      abrirRally(set, sacaSiguiente(set), t);
      cerrarRally(set, set.rallies[set.rallies.length - 1], gana);
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

function cerrarRally(set, r, gana) {
  r.gana = gana;
  const m = marcadorTras(set);
  if (setTerminado(set, m)) set.final = m;
  pendiente = nuevoPendiente();
}

function teclaCaptura(k) {
  const e = estado();
  const { modo, p, set, r } = e;
  if (modo === 'sinPartido' || ui.modo === 'stats') return false;

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
          abrirRallyPendiente(set, saca, t);
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
        abrirRallyPendiente(set, saca, t);
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
    if (TECLAS.ganador[k]) {
      const gana = TECLAS.ganador[k];
      if (r) alMarcar(set);
      pendiente.cerrar = false;
      puntoDirecto(gana);
      return true;
    }
    if (k === TECLAS.cancelar) { mutar('Cancelar', () => { pendiente.cerrar = false; }); return true; }
    return false;
  }

  if (!r) return false;

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
  renderListas();
  renderCargaVideo();
  renderControles();
  renderJugadores();
  if (ui.modo === 'stats') renderStats();
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
  if (!p) { $('tanteo').innerHTML = ''; $('sub-marcador').textContent = ''; $('chips-rotacion').innerHTML = ''; $('punto-rapido').innerHTML = ''; return; }
  const set = setActual(p);
  const r = rallyAbierto(set);
  const m = r ? r.marcador : marcadorTras(set);
  const saca = r ? r.saca : (set.final ? null : sacaSiguiente(set));
  const g = setsGanados(p);
  const punto = (eq) => `<span class="punto-saque${saca === eq ? '' : ' oculto'}"></span>`;
  $('tanteo').innerHTML =
    `<span class="equipo" title="${esc(nombre('propio'))}">${esc(nombre('propio'))}</span>` +
    `<span class="num">${m[0]}</span><span class="guion">–</span><span class="num">${m[1]}</span>` +
    `<span class="equipo" title="${esc(nombre('rival'))}">${esc(nombre('rival'))} ${punto('rival')}</span>`;
  if (saca === 'propio') $('tanteo').firstElementChild.insertAdjacentHTML('beforeend', ' ' + punto('propio'));
  $('sub-marcador').textContent =
    `Set ${set.numero} · sets ${g[0]}–${g[1]}` + (saca ? ` · saca ${nombre(saca)}` : '');
  $('punto-rapido').innerHTML = ['propio', 'rival'].map((eq) =>
    `<button class="btn chico" data-punto="${eq}" title="Sumar un punto sin registrar la jugada">+1 ${esc(nombre(eq))}</button>`).join('');

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
    `<div class="tecla-item">${kbd('J')}${kbd('L')}<span>−10 s / +10 s</span></div>`,
    teclaItem('M', Video.mudo ? 'Activar sonido' : 'Silenciar'),
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
          teclas: [teclaItem('Enter', 'Nuevo rally', '', true), teclaItem(nombreTecla(TECLAS.cerrarSinAtaque), 'Punto sin jugada'), ...teclasVideo], cols: 'c4',
        };
      }
      const n = set.rallies.length;
      const giro = rot && fueSideOut(ultimo, p.scouteado) ? `Side-out: el armador pasa a P${rot}. ` : '';
      return {
        tipo: 'tecla', titulo: `Rally ${n} cerrado · punto ${nombre(ultimo.gana)}`,
        contexto: `${giro}Enter abre el rally ${n + 1} en el segundo actual. Saca ${nombre(sacaSiguiente(set))}${giro ? '' : ', ' + rotTxt}.`,
        teclas: [teclaItem('Enter', 'Nuevo rally', '', true), teclaItem(nombreTecla(TECLAS.cerrarSinAtaque), 'Punto sin jugada'), ...teclasVideo], cols: 'c4',
      };
    }

    case 'elegirSaque':
      return {
        tipo: 'tecla', titulo: '¿Quién saca el primer rally?',
        contexto: `Set ${e.set.numero} · el rally parte en ${fmtTiempo(pendiente.elegirSaque.t)}.`,
        teclas: [teclaItem('1', nombre('propio'), '', true), teclaItem('2', nombre('rival'), '', true), teclaItem('Esc', 'Cancelar')], cols: 'c3',
      };

    case 'elegirRotacion':
      return {
        tipo: 'tecla', titulo: `¿Dónde parte el armador del ${scoutNom}?`,
        contexto: `Rotación inicial del set ${e.set.numero}. Después rota sola en cada side-out; un clic en P1–P6 corrige.`,
        teclas: [
          ...[1, 2, 3, 4, 5, 6].map((n) => teclaItem(String(n), `P${n}`, '', true)),
          teclaItem('Esc', 'Cancelar'),
        ],
        cols: 'c4',
      };

    case 'setTerminado': {
      const f = e.set.final;
      return {
        tipo: 'tecla', titulo: `Set ${e.set.numero} terminado · ${f[0]}–${f[1]}`,
        contexto: `Enter abre el set ${e.set.numero + 1}.`,
        teclas: [teclaItem('Enter', 'Set nuevo', '', true), ...teclasVideo], cols: 'c3',
      };
    }

    case 'partidoTerminado': {
      const g = setsGanados(p);
      return {
        tipo: '', titulo: `Partido terminado · ${g[0]}–${g[1]}`,
        contexto: 'Ctrl+Z deshace el último punto si hace falta corregir.',
        teclas: teclasVideo, cols: 'c3',
      };
    }

    case 'cerrar':
      return {
        tipo: 'tecla', titulo: e.r ? '¿Quién gana el rally?' : '¿Quién gana el punto?',
        contexto: e.r ? `Cierra el rally sin registrar otro ataque del ${scoutNom}.` : 'Suma el punto sin registrar la jugada.',
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
          ...Object.entries(TECLAS.armada).map(([k, t]) => teclaItem(k.toUpperCase(), t === 'primer' ? '1er tiempo' : ARMADAS[t].corto, muestra(t))),
          teclaItem(nombreTecla(TECLAS.recovery), 'Recovery'),
          teclaItem(nombreTecla(TECLAS.recibeLibre), 'Recibe libre'),
          teclaItem(nombreTecla(TECLAS.pasaLibre), 'Pasa libre'),
          teclaItem(nombreTecla(TECLAS.cerrarSinAtaque), 'Cerrar sin ataque'),
        ],
        cols: 'c4',
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
        cols: 'c3', // 7 teclas: en c4 se cortan las etiquetas; c3 suma una fila sin achicar la cancha
      };
    }
  }
  return { tipo: '', titulo: '', contexto: '', teclas: [], cols: 'c2' };
}

// ---------- Plantel: fila de jugadores ----------

function jugadoresDe(equipo, p = partido()) {
  return ((p && p.plantel && p.plantel[equipo]) || []).slice().sort((a, b) => a.num - b.num);
}

function textoJugador(num, p = partido()) {
  const j = p && jugadoresDe(p.scouteado, p).find((x) => x.num === num);
  if (!j) return `#${num}`;
  return [`#${num}`, j.nombre, j.pos && POSICIONES[j.pos].nombre].filter(Boolean).join(' · ');
}

// Última recepción o ataque del rally en pantalla: a ella se asigna el jugador
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
  const asignado = accion && accion.jugador != null ? `#${accion.jugador}` : '—';
  boton.innerHTML = `Jugador <b>${accion ? asignado : ''}</b> ▾`;
  boton.title = !accion ? 'No hay recepción ni ataque para asignar'
    : accion.tipo === 'ataque' ? 'Asignar jugador al último ataque' : 'Asignar jugador a la última recepción';
  boton.classList.toggle('con-jugador', !!(accion && accion.jugador != null));
  if (pop.hidden) return;
  const destino = accion ? (accion.tipo === 'ataque' ? 'Último ataque' : 'Última recepción') : 'Sin recepción ni ataque';
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
    case 'usaBloque': s = linea(6) + `<path d="M9 2L12 5 9 8 6 5Z" fill="none" stroke="${t}" stroke-width="1.2"/><line x1="12.5" y1="5" x2="17" y2="5" stroke="${t}" stroke-width="1.2" stroke-dasharray="1.6 1.4"/><circle cx="19.5" cy="5" r="2.5" fill="${t}"/>`; break;
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

function aplicarLeyenda() {
  $('leyenda').hidden = !prefs.leyenda;
  $('btn-leyenda').classList.toggle('activo', !!prefs.leyenda);
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
    case 'recepcion': tipo = 'Recepción'; det = `${jugadorBadge(a)}${califBadge(a.calif)}<span style="font-family:var(--sans)">${CALIF[a.calif].nombre}</span>`; break;
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
      det = jugadorBadge(a) + `<span>${a.golpe === 'remate' ? 'Remate' : GOLPES[a.golpe].corto}</span>` + (calc ? `<span class="calc">· ${esc(calc)}</span>` : '') +
        (a.resultado ? `${simboloMini(a.resultado)}<span>${RESULTADOS[a.resultado].nombre}</span>` : '<span class="calc">…</span>');
      break;
    }
  }
  return `<div class="fila fila-accion"><span class="t">${fmtTiempo(a.t)}</span><span>${tipo}</span><span class="detalle">${det}</span>${botonIr(a.t)}</div>`;
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
  } else if (r.acciones.length === 1) {
    s += '<span class="tenue">sin jugada</span>';
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
  renderSonido();
  if (Video.fuente) chip.textContent = Video.fuente === 'youtube' ? 'YouTube' : `Archivo local · ${p && p.video ? p.video.nombre : ''}`;
}

function renderSonido() {
  const b = $('btn-sonido');
  b.hidden = !Video.fuente;
  b.innerHTML = `${Video.mudo ? '🔇 Sin sonido' : '🔊 Sonido'} <kbd>M</kbd>`;
  b.title = Video.mudo ? 'Activar sonido (M)' : 'Silenciar (M)';
}

function alternarSilencio() {
  Video.silenciar(!Video.mudo);
  prefs.silencio = Video.mudo;
  guardarPrefs();
  renderSonido();
  renderEstado();
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
// Estadísticas (fase 5): vistas, filtros combinables y clips
// =====================================================================

const stats = {
  partidos: null, // Set de ids a sumar; null = solo el partido abierto
  filtros: { set: [], rot: [], pase: [], fase: [], armada: [], zona: [], golpe: [], resultado: [], jugador: [] },
  vista: 'armador', // armador | ataque | sideout | recepcion
  mapa: 'trayectorias', // trayectorias | calor
  filtrosAbiertos: false,
};

const VISTAS = {
  armador: 'Armador',
  ataque: 'Ataque',
  sideout: 'Side-out',
  recepcion: 'Recepción',
};

const FASES = { recepcion: 'Recepción', contra: 'Contra', recovery: 'Recovery', libre: 'Libre' };
const ORDEN_ZONAS = ['Z4', 'Z3', 'Z2', 'Z1', 'Z6', 'Z5'];
const CALIFS = ['#', '+', '!', '-', '='];

// Qué filtros aplican a cada tipo de dato
const DIMS_DATOS = {
  jugadas: ['set', 'rot', 'pase', 'fase', 'armada', 'zona', 'golpe', 'resultado', 'jugador'],
  recepciones: ['set', 'rot', 'pase', 'jugador'],
  rallies: ['set', 'rot', 'pase'],
};
const DATOS_VISTA = { armador: 'jugadas', ataque: 'jugadas', sideout: 'rallies', recepcion: 'recepciones' };

function equipoScout(p) { return slug(nombre(p.scouteado, p)); }

function partidosCompatibles() {
  const p = partido();
  if (!p) return [];
  const eq = equipoScout(p);
  return Object.values(almacen.partidos)
    .filter((x) => equipoScout(x) === eq)
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
}

function partidosIncluidos() {
  const p = partido();
  if (!p) return [];
  if (!stats.partidos) return [p];
  const lista = partidosCompatibles().filter((x) => stats.partidos.has(x.id));
  return lista.length ? lista : [p];
}

function recolectar(partidos) {
  const jugadas = [], recepciones = [], rallies = [];
  for (const p of partidos) {
    const scout = p.scouteado;
    for (const set of p.sets) {
      set.rallies.forEach((r, idx) => {
        const base = { pid: p.id, set: set.numero, rally: idx + 1, rot: rotacionEn(set, idx, scout) };
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
        r.acciones.forEach((a, i) => {
          if (a.tipo !== 'armada') return;
          const previa = r.acciones[i - 1];
          const fase = faseArmada(r, a);
          const sig = r.acciones[i + 1];
          const ataque = sig && sig.tipo === 'ataque' ? sig : null;
          jugadas.push({
            ...base,
            t: Math.max(0, (fase === 'recepcion' ? previa.t : a.t) - 2),
            fase,
            pase: fase === 'recepcion' ? previa.calif : null,
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
  return { jugadas, recepciones, rallies };
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
function txtPct(n) { return n == null ? '—' : `${n}%`; }

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

function txtEficacia(ef) { return ef == null ? '—' : (ef > 0 ? '+' : '') + ef + '%'; }

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
    const celdas = ORDEN_ZONAS.map((z) => {
      const c = f.jugadas.filter((j) => j.zona === z).length;
      const filtro = { ...f.filtro, zona: z };
      return celda(n ? c / n : 0, c ? txtPct(pct(c, n)) : '·',
        `data-fijar='${JSON.stringify(filtro)}' title="${c} de ${n}"`, ` clic${marcaFiltro(filtro)}`);
    }).join('');
    return `<tr><th class="clic${marcaFiltro(f.filtro)}" data-fijar='${JSON.stringify(f.filtro)}'>${f.etiqueta}</th>${celdas}<td class="num tenue">${n}</td></tr>`;
  }).join('');
  return `<table class="tabla">${cab}${cuerpo}</table>`;
}

function canchaMini(contenido, p) {
  return `<svg class="cancha-mini" viewBox="0 0 220 130">${baseCancha(p)}${contenido}</svg>`;
}

function partesArmador(d, p) {
  const js = filtrar(d.jugadas, 'jugadas');
  const porRot = [1, 2, 3, 4, 5, 6].map((r) => ({ etiqueta: `P${r}`, jugadas: js.filter((j) => j.rot === r), filtro: { rot: r } }));
  porRot.push({ etiqueta: 'Total', jugadas: js, filtro: {} });
  const porPase = ['#', '+', '!', '-'].map((c) => ({ etiqueta: c, jugadas: js.filter((j) => j.pase === c), filtro: { pase: c } }));
  const puntos = js.map((j) => {
    const [x, y] = aVB(j.armadaObj.punto);
    return `<circle cx="${x}" cy="${y}" r="2.2" fill="none" stroke="var(${ARMADAS[j.armada].variable})" stroke-width="1.1" opacity="0.85"/>`;
  }).join('');
  const porTipo = Object.keys(ARMADAS).map((t) => {
    const c = js.filter((j) => j.armada === t).length;
    return `<span class="ley clic${marcaFiltro({ armada: t })}" data-fijar='${JSON.stringify({ armada: t })}'>${muestra(t)}${ARMADAS[t].corto} <b>${txtPct(pct(c, js.length))}</b></span>`;
  }).join('');
  return {
    n: js.length,
    porRot: tablaZonas(porRot, 'Rot.'),
    porPase: tablaZonas(porPase, 'Pase'),
    porTipo: `<div class="leyenda-fila">${porTipo}</div>`,
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
    return `<tr><th class="clic${marcaFiltro(filtro)}" data-fijar='${JSON.stringify(filtro)}'>${etiqueta}</th>` +
      `<td class="num tenue">${n}</td><td class="num">${so}</td><td class="num"><b>${txtPct(p100)}</b></td>` +
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
      `<td class="num"><b>${txtPct(pct(k('#') + k('+'), m))}</b></td><td class="num">${txtPct(pct(k('='), m))}</td></tr>`;
  };
  const cab = (t) => `<tr><th>${t}</th><th>n</th>${CALIFS.map((c) => `<th>${c}</th>`).join('')}<th>Posit.</th><th>Error</th></tr>`;
  const conJugador = [...new Set(rs.filter((r) => r.jugador != null).map((r) => r.jugador))].sort((a, b) => a - b);
  const porRot = [1, 2, 3, 4, 5, 6].map((r) => fila(`P${r}`, rs.filter((x) => x.rot === r), { rot: r })).join('');
  return {
    n,
    kpis,
    barra: n ? `<div class="barra-calif">${barra}</div>` : '',
    porJugador: conJugador.length
      ? `<table class="tabla">${cab('Jug.')}${conJugador.map((j) => fila(`#${j}`, rs.filter((r) => r.jugador === j), { jugador: j })).join('')}</table>`
      : '',
    porRot: `<table class="tabla">${cab('Rot.')}${porRot}</table>`,
  };
}

// ---------- Vistas en pantalla ----------

function vistaArmador(d) {
  const a = partesArmador(d, partido());
  return `<p class="stats-nota">${a.n} armadas. Porcentaje de cada fila según zona de ataque. Clic en una celda filtra los clips.</p>` +
    `<h3>Por rotación</h3>${a.porRot}` +
    `<h3>Por calidad de pase <span class="tenue">(solo side-out)</span></h3>${a.porPase}` +
    `<h3>Tipo de armada</h3>${a.porTipo}` +
    a.cancha;
}

function vistaAtaque(d) {
  const a = partesAtaque(d, partido(), stats.mapa);
  return `<p class="stats-nota">${a.n} ataques. Dirección sobre remates; toque sobre el total de la fila. Eficacia = (puntos − errores − bloqueos) / ataques con resultado.</p>` +
    a.tabla +
    `<div class="fila-titulo"><h3>Impactos</h3><div class="selector" id="selector-mapa">` +
    `<button data-mapa="trayectorias" class="${stats.mapa === 'trayectorias' ? 'activo' : ''}">Trayectorias</button>` +
    `<button data-mapa="calor" class="${stats.mapa === 'calor' ? 'activo' : ''}">Calor</button></div></div>` +
    a.cancha;
}

function vistaSideout(d) {
  const a = partesSideout(d);
  return `<p class="stats-nota">Rallies en que el ${esc(nombre(partido().scouteado))} recibe. «1er ataque» = punto directo en el primer ataque tras la recepción.</p>` +
    `<h3>Por rotación</h3>${a.porRot}` +
    `<h3>Por calidad de pase</h3>${a.porPase}`;
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
    case 'jugador': return `#${v}`;
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
  return `<div><b>vs ${esc(nombre(otro(scout), x))}</b> · ${esc(fmtFecha(x.fecha))} · ` +
    `<b>${g[i]}–${g[1 - i]}</b>${sets.length ? ' · ' + sets.join(' ') : ''} · ${rallies} rallies</div>`;
}

function htmlResumen(d, partidos) {
  const p = partido();
  const scoutNom = nombre(p.scouteado);
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
    `<div class="r-meta">Marcadores desde el punto de vista de ${esc(scoutNom)}${enCurso ? ' · * set sin terminar' : ''} · ` +
    `<b>${filtros.length ? 'Filtros: ' + esc(filtros.join(', ')) : 'Todas las jugadas'}</b></div></header>` +
    `<div class="r-kpis">` +
    kpi(txtPct(k.sideOut), 'Side-out', `${k.rallies} rallies recibiendo`) +
    kpi(txtPct(k.recPositiva), 'Recepción positiva (# +)', `${k.recepciones} recepciones`) +
    kpi(txtEficacia(k.eficacia), 'Eficacia de ataque', `${k.ataques} ataques`) +
    kpi(txtPct(k.primerAtaque), 'Punto en 1er ataque', 'tras recepción') +
    `</div>` +
    `<section class="r-sec"><h2>Distribución del armador <span>${arm.n} armadas · % de cada fila por zona de ataque</span></h2>` +
    `<div class="r-2col"><div><h3>Por rotación</h3>${arm.porRot}</div>` +
    `<div><h3>Por calidad de pase (side-out)</h3>${arm.porPase}</div></div></section>` +
    `<section class="r-sec"><h2>Dónde cae la armada <span>${esc(scoutNom)} a la izquierda, atacando hacia la derecha</span></h2>` +
    `<div class="r-cancha">${arm.cancha}</div>${arm.porTipo}</section>` +
    `</div>` +
    `<div class="hoja salto">` +
    `<section class="r-sec"><h2>Ataque por zona <span>${atq.n} ataques · dirección sobre remates · eficacia = (puntos − errores − bloqueos) / ataques con resultado</span></h2>` +
    `${atq.tabla}<div class="r-cancha chica">${atq.cancha}</div>${leyendaResultados()}</section>` +
    `<section class="r-sec"><h2>Side-out <span>rallies en que ${esc(scoutNom)} recibe · 1er ataque = punto directo tras la recepción</span></h2>` +
    `<div class="r-2col"><div><h3>Por rotación</h3>${so.porRot}</div><div><h3>Por calidad de pase</h3>${so.porPase}</div></div></section>` +
    `<section class="r-sec"><h2>Recepción <span>${rec.n} recepciones</span></h2>${rec.barra}` +
    `<div class="r-2col"><div><h3>Por rotación</h3>${rec.porRot}</div>` +
    (rec.porJugador ? `<div><h3>Por jugador</h3>${rec.porJugador}</div>` : '') + `</div></section>` +
    `<footer class="r-pie">Generado con VoleyStats · ${esc(fmtFecha(hoyIso()))}</footer>` +
    `</div>`;
}

function imprimirResumen() {
  const p = partido();
  if (!p) return;
  const partidos = partidosIncluidos();
  const d = recolectar(partidos);
  $('resumen').innerHTML = htmlResumen(d, partidos);
  const fechas = partidos.map((x) => x.fecha).filter(Boolean).sort();
  const fecha = !fechas.length ? hoyIso() : fechas[0] === fechas[fechas.length - 1] ? fechas[0] : `${fechas[0]} a ${fechas[fechas.length - 1]}`;
  const titulo = document.title;
  document.title = `VoleyStats - ${nombre(p.scouteado)} - ${fecha}`;
  const restaurar = () => { document.title = titulo; window.removeEventListener('afterprint', restaurar); };
  window.addEventListener('afterprint', restaurar);
  window.print();
}

// ---------- Panel de filtros y alcance ----------

function renderFiltros(d) {
  const sets = [...new Set(d.jugadas.map((j) => j.set).concat(d.rallies.map((r) => r.set)))].sort();
  const jugadores = [...new Set(d.jugadas.concat(d.recepciones).map((x) => x.jugador).filter((x) => x != null))].sort((a, b) => a - b);
  const aplican = DIMS_DATOS[DATOS_VISTA[stats.vista]];
  const filas = [
    ['set', 'Set', sets, (v) => v],
    ['rot', 'Rotación', [1, 2, 3, 4, 5, 6], (v) => `P${v}`],
    ['pase', 'Pase', CALIFS, (v) => v],
    ['fase', 'Fase', Object.keys(FASES), (v) => FASES[v]],
    ['armada', 'Armada', Object.keys(ARMADAS), (v) => `${muestra(v)}${ARMADAS[v].corto}`],
    ['zona', 'Zona', ORDEN_ZONAS, (v) => v],
    ['golpe', 'Golpe', Object.keys(GOLPES), (v) => (v === 'remate' ? 'Remate' : GOLPES[v].corto)],
    ['resultado', 'Resultado', Object.keys(RESULTADOS), (v) => RESULTADOS[v].nombre],
    ['jugador', 'Jugador', jugadores, (v) => `#${v}`],
  ];
  const activos = filas.flatMap(([k, , , et]) => stats.filtros[k].map((v) =>
    `<button class="fchip activo" data-dim="${k}" data-val='${JSON.stringify(v)}' title="Quitar filtro">${et(v)} ✕</button>`));
  const n = activos.length;
  $('stats-filtros').innerHTML =
    `<div class="panel-cab"><span class="etiqueta fuerte">Filtros${n ? ` · ${n} activo${n === 1 ? '' : 's'}` : ''}</span>` +
    `<div style="display:flex;gap:6px"><button class="btn chico" id="limpiar-filtros" ${n ? '' : 'disabled'}>Limpiar</button>` +
    `<button class="btn chico" id="plegar-filtros">${stats.filtrosAbiertos ? 'Ocultar' : 'Mostrar todos'}</button></div></div>` +
    (stats.filtrosAbiertos ? '' : `<div class="filtros-activos">${n ? activos.join('') : '<span class="tenue">Sin filtros: se muestran todas las jugadas. Clic en una celda o «Mostrar todos».</span>'}</div>`) +
    (!stats.filtrosAbiertos ? '' : `<div class="filtros">${filas.map(([k, nom, vals, et]) =>
      `<div class="filtro-fila${aplican.includes(k) ? '' : ' no-aplica'}"><span class="etiqueta">${nom}</span><div class="filtro-chips">` +
      (vals.length ? vals.map((v) =>
        `<button class="fchip${stats.filtros[k].includes(v) ? ' activo' : ''}" data-dim="${k}" data-val='${JSON.stringify(v)}'>${et(v)}</button>`).join('')
        : '<span class="tenue">—</span>') +
      `</div></div>`).join('')}</div>`);
}

function renderAlcance() {
  const p = partido();
  const compat = partidosCompatibles();
  const incl = partidosIncluidos();
  $('stats-alcance').innerHTML =
    `<div><span class="etiqueta">Scouteando</span> <b>${esc(nombre(p.scouteado))}</b>` +
    `<div class="tenue mono">${incl.length === 1 ? esc(`${nombre('rival', incl[0])} vs ${nombre('propio', incl[0])} · ${fmtFecha(incl[0].fecha)}`) : `${incl.length} partidos sumados`}` +
    ` · ${compat.length} ${compat.length === 1 ? 'partido guardado' : 'partidos guardados'} de este equipo</div></div>` +
    `<div class="alcance-botones"><button class="btn" id="elegir-partidos">Elegir partidos…</button>` +
    `<button class="btn" id="resumen-pdf" title="Arma un resumen y abre el diálogo de impresión: elige «Guardar como PDF»">Resumen PDF</button></div>`;
}

function renderAvisoStats() {
  const el = $('clips-aviso');
  if (!el) return;
  const aviso = ui.aviso && ui.aviso.hasta > Date.now() ? ui.aviso.texto : '';
  el.textContent = aviso;
}

function renderClips(d) {
  const tipo = DATOS_VISTA[stats.vista];
  const lista = filtrar(d[tipo], tipo).slice().sort((a, b) =>
    a.pid === b.pid ? a.set - b.set || a.rally - b.rally || a.t - b.t : a.pid.localeCompare(b.pid));
  const varios = partidosIncluidos().length > 1;
  const corto = (pid) => {
    const x = almacen.partidos[pid];
    return x ? `${fmtFecha(x.fecha).replace(/ \d{4}$/, '')}` : '';
  };
  const filas = lista.map((c) => {
    let det;
    if (tipo === 'jugadas') {
      const calc = c.ataque ? textoAtaque(c.armadaObj, c.ataque) : '';
      det = (c.pase ? califBadge(c.pase) : `<span class="tenue">${FASES[c.fase].toLowerCase()}</span>`) +
        muestra(c.armada) + `<span>${ARMADAS[c.armada].corto}${c.zona ? ' ' + c.zona : ''}</span>` +
        (calc ? `<span class="calc">· ${esc(calc)}</span>` : '') +
        (c.resultado ? simboloMini(c.resultado) + `<span>${RESULTADOS[c.resultado].nombre}</span>` : c.ataque ? '' : '<span class="calc">sin ataque</span>') +
        (c.jugador != null ? `<span class="jug">${c.jugador}</span>` : '');
    } else if (tipo === 'recepciones') {
      det = califBadge(c.pase) + `<span style="font-family:var(--sans)">${CALIF[c.pase].nombre}</span>` +
        (c.jugador != null ? `<span class="jug">${c.jugador}</span>` : '') +
        `<span class="calc">· gana ${esc(nombre(c.gana, almacen.partidos[c.pid]))}</span>`;
    } else {
      det = (c.pase ? califBadge(c.pase) : '<span class="tenue">sin recepción</span>') +
        `<span>${c.sideOut ? 'Side-out' : 'Punto rival'}</span>` + (c.primerPunto ? '<span class="calc">· 1er ataque</span>' : '');
    }
    return `<div class="fila fila-clip" data-pid="${c.pid}" data-t="${c.t}">` +
      `<span class="tenue">${varios ? esc(corto(c.pid)) + ' · ' : ''}S${c.set}·R${c.rally}</span>` +
      `<span class="t">${fmtTiempo(c.t)}</span><span class="tenue">${c.rot ? 'P' + c.rot : '—'}</span>` +
      `<span class="detalle">${det}</span><button class="ir" title="Reproducir">▶</button></div>`;
  }).join('');
  const nombres = { jugadas: 'jugadas', recepciones: 'recepciones', rallies: 'rallies' };
  $('clips-titulo').textContent = `Clips · ${VISTAS[stats.vista]}`;
  $('clips-cuenta').textContent = `${lista.length} ${nombres[tipo]}`;
  $('clips-lista').innerHTML = filas || '<div class="vacio">No hay jugadas con estos filtros.</div>';
  renderAvisoStats();
}

function renderStats() {
  const p = partido();
  if (!p) return;
  const d = recolectar(partidosIncluidos());
  renderAlcance();
  renderFiltros(d);
  $('stats-tabs').innerHTML = Object.entries(VISTAS)
    .map(([k, v]) => `<button data-vistastats="${k}" class="${stats.vista === k ? 'activo' : ''}">${v}</button>`).join('');
  const vistas = { armador: vistaArmador, ataque: vistaAtaque, sideout: vistaSideout, recepcion: vistaRecepcion };
  $('stats-contenido').innerHTML = vistas[stats.vista](d);
  renderClips(d);
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

function dialogoElegirPartidos() {
  const compat = partidosCompatibles();
  const incl = new Set(partidosIncluidos().map((x) => x.id));
  abrirModal(
    `<h2>Partidos a sumar</h2><p>Partidos guardados en que se scoutea a ${esc(nombre(partido().scouteado))}.</p>` +
    `<div class="partidos-lista">${compat.map((x) =>
      `<label class="partido-fila check"><input type="checkbox" value="${x.id}" ${incl.has(x.id) ? 'checked' : ''}>` +
      `<div class="partido-datos"><b>${esc(nombre('rival', x))} vs ${esc(nombre('propio', x))}</b>` +
      `<span class="tenue">${esc(fmtFecha(x.fecha))} · ${esc(resumenPartido(x))}</span></div></label>`).join('')}</div>` +
    `<div class="acciones"><button class="btn izq" id="ep-todos">Todos</button><button class="btn" id="ep-cancelar">Cancelar</button><button class="btn principal" id="ep-ok">Aplicar</button></div>`,
    true,
  );
  $('ep-todos').addEventListener('click', () => $('modal').querySelectorAll('input[type=checkbox]').forEach((c) => { c.checked = true; }));
  $('ep-cancelar').addEventListener('click', cerrarModal);
  $('ep-ok').addEventListener('click', () => {
    const ids = [...$('modal').querySelectorAll('input:checked')].map((c) => c.value);
    stats.partidos = ids.length ? new Set(ids) : null;
    cerrarModal();
    renderStats();
  });
}

function cambiarModo(modo) {
  ui.modo = modo;
  document.body.classList.toggle('modo-stats', modo === 'stats');
  $('selector-modo').querySelectorAll('button').forEach((b) => b.classList.toggle('activo', b.dataset.modo === modo));
  render();
}

function conectarStats() {
  $('selector-modo').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-modo]');
    if (b && partido()) cambiarModo(b.dataset.modo);
  });
  $('stats').addEventListener('click', (ev) => {
    const t = ev.target;
    const chip = t.closest('[data-dim]');
    if (chip) { alternarFiltro(chip.dataset.dim, JSON.parse(chip.dataset.val)); return; }
    const fij = t.closest('[data-fijar]');
    if (fij) { fijarFiltros(JSON.parse(fij.dataset.fijar)); return; }
    const tab = t.closest('[data-vistastats]');
    if (tab) { stats.vista = tab.dataset.vistastats; renderStats(); return; }
    const mapa = t.closest('[data-mapa]');
    if (mapa) { stats.mapa = mapa.dataset.mapa; renderStats(); return; }
    if (t.closest('#plegar-filtros')) { stats.filtrosAbiertos = !stats.filtrosAbiertos; renderStats(); return; }
    if (t.closest('#limpiar-filtros')) { for (const k of Object.keys(stats.filtros)) stats.filtros[k] = []; renderStats(); return; }
    if (t.closest('#elegir-partidos')) { dialogoElegirPartidos(); return; }
    if (t.closest('#resumen-pdf')) imprimirResumen();
  });
  $('clips-lista').addEventListener('click', (ev) => {
    const f = ev.target.closest('.fila-clip');
    if (f) reproducirClip(f.dataset.pid, Number(f.dataset.t));
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

  if ((ev.ctrlKey || ev.metaKey) && k === 'z' && !ev.shiftKey) {
    ev.preventDefault();
    if (ui.modo === 'captura') deshacer();
    return;
  }
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

  if (k === TECLAS.reproducir) { ev.preventDefault(); if (!ev.repeat) Video.alternar(); return; }
  if (k === TECLAS.atras) { ev.preventDefault(); Video.mover(ev.shiftKey ? -SALTO_LARGO_SEGUNDOS : -SALTO_SEGUNDOS); return; }
  if (k === TECLAS.adelante) { ev.preventDefault(); Video.mover(ev.shiftKey ? SALTO_LARGO_SEGUNDOS : SALTO_SEGUNDOS); return; }
  if (k === TECLAS.atrasLargo) { ev.preventDefault(); Video.mover(-SALTO_LARGO_SEGUNDOS); return; }
  if (k === TECLAS.adelanteLargo) { ev.preventDefault(); Video.mover(SALTO_LARGO_SEGUNDOS); return; }
  if (k === TECLAS.silencio) { ev.preventDefault(); if (!ev.repeat) alternarSilencio(); return; }
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

function dialogoPartido({ nuevo, cancelable }) {
  const p = partido();
  const datos = nuevo
    ? { propio: 'Propio', rival: 'Rival', fecha: hoyIso(), scouteado: 'rival' }
    : { propio: p.equipos.propio, rival: p.equipos.rival, fecha: p.fecha, scouteado: p.scouteado };
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
    `<div class="acciones">` +
    (cancelable ? `<button type="button" class="btn" id="d-cancelar">Cancelar</button>` : '') +
    `<button type="submit" class="btn principal">${nuevo ? 'Crear partido' : 'Guardar'}</button>` +
    `</div></form>`,
    cancelable,
  );

  if (cancelable) $('d-cancelar').addEventListener('click', cerrarModal);

  $('form-partido').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const propio = $('d-propio').value.trim() || 'Propio';
    const rival = $('d-rival').value.trim() || 'Rival';
    const fecha = $('d-fecha').value || hoyIso();
    if (nuevo) {
      const np = crearPartido({ propio, rival, fecha, scouteado: $('d-scout').value });
      const cargados = cargarPlantelesConocidos(np);
      almacen.partidos[np.id] = np;
      cambiarPartido(np.id);
      if (cargados.length) avisar(`Plantel cargado: ${cargados.join(', ')}`);
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

// ---------- Exportar e importar JSON ----------

const FORMATO_ARCHIVO = 'voleystats-partido';

function slug(t) {
  return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function exportarPartido(id) {
  const x = almacen.partidos[id];
  if (!x) return;
  const archivo = {
    formato: FORMATO_ARCHIVO,
    version: VERSION_DATOS,
    exportado: new Date().toISOString(),
    partido: x,
  };
  const blob = new Blob([JSON.stringify(archivo, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `voleystats-${slug(nombre('rival', x))}-vs-${slug(nombre('propio', x))}-${x.fecha || 'sin-fecha'}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Devuelve el partido del archivo o lanza un Error con un mensaje para Martín.
function leerArchivoPartido(texto) {
  let datos;
  try { datos = JSON.parse(texto); } catch (e) { throw new Error('El archivo no es un JSON válido.'); }
  // Se aceptan el archivo exportado o un partido suelto
  const x = datos && datos.formato === FORMATO_ARCHIVO ? datos.partido : datos;
  const valido = x && typeof x === 'object' && x.id && x.equipos && Array.isArray(x.sets) &&
    ['rival', 'propio'].includes(x.scouteado) &&
    x.sets.every((st) => Array.isArray(st.rallies) && st.rallies.every((r) => Array.isArray(r.acciones)));
  if (!valido) throw new Error('El archivo no parece un partido de VoleyStats.');
  if ((x.version || 1) > VERSION_DATOS) {
    throw new Error('El archivo viene de una versión más nueva de VoleyStats. Recarga la página e intenta de nuevo.');
  }
  return migrarPartido(x);
}

function elegirImportacion(x) {
  return new Promise((resolver) => {
    const existente = almacen.partidos[x.id];
    abrirModal(
      `<h2>Este partido ya está guardado</h2>` +
      `<p>${esc(nombre('rival', x))} vs ${esc(nombre('propio', x))} · ${esc(fmtFecha(x.fecha))}</p>` +
      `<p class="tenue">Guardado: ${esc(resumenPartido(existente))}<br>Archivo: ${esc(resumenPartido(x))}</p>` +
      `<div class="acciones"><button class="btn izq" data-r="">Cancelar</button>` +
      `<button class="btn" data-r="copia">Guardar como copia</button>` +
      `<button class="btn principal" data-r="reemplazar">Reemplazar</button></div>`,
      true,
    );
    $('modal').querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
      cerrarModal();
      resolver(b.dataset.r || null);
    }));
  });
}

async function importarArchivo(archivo) {
  let x;
  try {
    x = leerArchivoPartido(await archivo.text());
  } catch (e) {
    await confirmar({ titulo: 'No se pudo importar', texto: e.message, aceptar: 'Entendido', soloAceptar: true });
    dialogoPartidos();
    return;
  }
  if (almacen.partidos[x.id]) {
    const accion = await elegirImportacion(x);
    if (!accion) { dialogoPartidos(); return; }
    if (accion === 'copia') {
      x.id = 'p' + Date.now().toString(36);
      x.creado = new Date().toISOString();
    }
  }
  almacen.partidos[x.id] = x;
  cambiarPartido(x.id);
  cerrarModal();
  avisar(`Partido importado: ${nombre('rival', x)} vs ${nombre('propio', x)}`);
}

// ---------- Plantel: equipos conocidos y editor ----------

function leerEquiposConocidos() {
  try { return JSON.parse(localStorage.getItem(CLAVE_EQUIPOS)) || {}; } catch (e) { return {}; }
}

function recordarPlantel(nombreEquipo, jugadores) {
  if (!jugadores.length) return;
  const conocidos = leerEquiposConocidos();
  conocidos[slug(nombreEquipo)] = { nombre: nombreEquipo, jugadores };
  try { localStorage.setItem(CLAVE_EQUIPOS, JSON.stringify(conocidos)); } catch (e) { /* no crítico */ }
}

// Al crear un partido, carga el plantel guardado de equipos con el mismo nombre
function cargarPlantelesConocidos(p) {
  const conocidos = leerEquiposConocidos();
  const cargados = [];
  for (const eq of ['propio', 'rival']) {
    const c = conocidos[slug(nombre(eq, p))];
    if (c && c.jugadores.length) {
      p.plantel[eq] = c.jugadores.map((j) => ({ ...j }));
      cargados.push(`${nombre(eq, p)} (${c.jugadores.length})`);
    }
  }
  return cargados;
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
      `<p class="tenue">El plantel se recuerda por nombre de equipo para los próximos partidos.</p>` +
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
    mutar('Plantel', (pp) => { pp.plantel = limpio; });
    recordarPlantel(nombre('propio'), limpio.propio);
    recordarPlantel(nombre('rival'), limpio.rival);
    cerrarModal();
  }

  pintar();
}

// ---------- Menú de partidos ----------

function resumenPartido(x) {
  const g = setsGanados(x);
  const rallies = x.sets.reduce((n, st) => n + st.rallies.filter((r) => r.gana).length, 0);
  return `Scouteando ${nombre(x.scouteado, x)} · sets ${g[0]}–${g[1]} · ${rallies} ${rallies === 1 ? 'rally' : 'rallies'}`;
}

function dialogoPartidos() {
  const lista = Object.values(almacen.partidos)
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.creado || '').localeCompare(a.creado || ''));
  const filas = lista.map((x) => {
    const actual = x.id === almacen.actual;
    return `<div class="partido-fila${actual ? ' actual' : ''}">` +
      `<div class="partido-datos"><b>${esc(nombre('rival', x))} vs ${esc(nombre('propio', x))}</b>` +
      `<span class="tenue">${esc(fmtFecha(x.fecha))} · ${esc(resumenPartido(x))}</span></div>` +
      (actual ? '<span class="etiqueta">Abierto</span>' : `<button class="btn" data-abrir="${x.id}">Abrir</button>`) +
      `<button class="btn" data-exportar="${x.id}" title="Descargar el partido como archivo JSON">Exportar</button>` +
      `<button class="btn" data-eliminar="${x.id}" title="Eliminar partido">Eliminar</button>` +
      `</div>`;
  }).join('');
  abrirModal(
    `<h2>Partidos</h2>` +
    `<p>Guardados en este navegador.</p>` +
    `<div class="partidos-lista">${filas || '<div class="vacio">Todavía no hay partidos.</div>'}</div>` +
    `<div class="acciones"><button class="btn principal" id="d-crear">Partido nuevo</button>` +
    `<button class="btn izq" id="d-importar">Importar JSON…</button>` +
    (partido() ? '<button class="btn" id="d-cerrar">Cerrar</button>' : '') + `</div>`,
    !!partido(),
  );
  if (partido()) $('d-cerrar').addEventListener('click', cerrarModal);
  $('d-crear').addEventListener('click', () => dialogoPartido({ nuevo: true, cancelable: !!partido() }));
  $('d-importar').addEventListener('click', () => $('input-importar').click());
  $('modal').querySelectorAll('[data-exportar]').forEach((b) => b.addEventListener('click', () => exportarPartido(b.dataset.exportar)));
  $('modal').querySelectorAll('[data-abrir]').forEach((b) => b.addEventListener('click', () => {
    cambiarPartido(b.dataset.abrir);
    cerrarModal();
  }));
  $('modal').querySelectorAll('[data-eliminar]').forEach((b) => b.addEventListener('click', async () => {
    const x = almacen.partidos[b.dataset.eliminar];
    const ok = await confirmar({
      titulo: '¿Eliminar este partido?',
      texto: `${nombre('rival', x)} vs ${nombre('propio', x)} · ${fmtFecha(x.fecha)}. Se borran todas sus jugadas de este navegador y no se puede deshacer.`,
      aceptar: 'Eliminar',
    });
    if (ok) eliminarPartido(x.id);
    dialogoPartidos();
  }));
}

function eliminarPartido(id) {
  delete almacen.partidos[id];
  historial.length = 0; // deshacer no debe revivir un partido eliminado
  if (almacen.actual === id) {
    const resto = Object.keys(almacen.partidos);
    if (resto.length) {
      cambiarPartido(resto[0]);
    } else {
      almacen.actual = null;
      Video.soltarLocal();
      if (Video.yt && Video.ytListo) { Video.yt.stopVideo(); Video.yt.getIframe().hidden = true; }
      Video.fuente = null;
      pendiente = nuevoPendiente();
      guardar();
      render();
    }
  } else {
    guardar();
  }
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

function conectarEventos() {
  conectarStats();
  $('partido-info').addEventListener('click', () => { if (partido()) dialogoPartido({ nuevo: false, cancelable: true }); });
  $('btn-partidos').addEventListener('click', dialogoPartidos);
  $('btn-plantel').addEventListener('click', dialogoPlantel);
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
  $('input-importar').addEventListener('change', (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (f) importarArchivo(f);
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
  $('chip-fuente').addEventListener('click', () => {
    ui.cambiandoVideo = true;
    const p = partido();
    if (p && p.video && p.video.tipo === 'youtube') $('input-youtube').value = p.video.url;
    render();
  });
  $('video-capa').addEventListener('click', () => Video.alternar());
  $('btn-sonido').addEventListener('click', alternarSilencio);

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
    const b = ev.target.closest('.ir[data-t]');
    if (b) Video.saltar(Number(b.dataset.t));
  });

  $('punto-rapido').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-punto]');
    if (b) puntoDirecto(b.dataset.punto);
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
