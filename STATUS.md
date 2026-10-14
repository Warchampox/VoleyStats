# Estado del proyecto

## 2026-10-14 — Prototipo de captura (pasos 1 a 5 del brief)

Hecho, según el brief «Pantalla de captura» (dirección A · Cabina):

- Layout de 1440×900 sin scroll: header, video, controles, línea de tiempo,
  rally actual, rallies anteriores, marcador y rotación, panel de estado, cancha y leyenda.
- Video: YouTube (IFrame API, `controls:0`, `disablekb:1`, capa encima para que el
  iframe no tome el foco) y archivo local (`<video>` sin `controls`), detrás del
  objeto `Video` en app.js. Velocidad 0,25×–2×, ±3 s, cuadro a cuadro (solo local).
- Captura como máquina de estados derivada de los datos (`estado()` en app.js);
  teclas modales en el objeto `TECLAS`.
- Cancha SVG con clics, trayectorias, símbolos de resultado y lo calculado
  (zona de ataque, dirección, zona de destino). Vista Rally / Set.
- Guardado en localStorage (`voleystats`, con `version` y función `migrar()`),
  preferencias en `voleystats:prefs`. Deshacer con Ctrl/Cmd+Z (en memoria, hasta 300 pasos).
- Diálogo propio de partido: crear y editar nombres y fecha (clic en el nombre del partido).

Decisiones tomadas en esta sesión (con Martín):

- Coordenadas 0–1 sobre toda el área de 22×13 m. x = 0 es el fondo detrás del equipo
  scouteado y la red queda en x = 0,5. y = 0 es la banda izquierda del equipo scouteado
  mirando a la red. El equipo scouteado siempre se dibuja a la izquierda.
- Dirección por ángulo respecto a la banda: calle < 20°, diago 20°–50°, diago corta > 50°
  (`UMBRALES_DIRECCION`).
- Teclas provisorias: G = cerrar rally sin ataque (luego 1 Propio / 2 Rival),
  T = recovery, «,» / «.» = cuadro a cuadro (1/30 s).

Decisiones de implementación a confirmar con Martín:

- Pinchado y rejugado dejan el rally abierto, igual que defendido: puede venir otra
  armada o se cierra con G. Punto, error y bloqueado cierran el rally.
- Recepción «=» cierra el rally con punto del que sacó.
- «Contra» no es una acción guardada: se deduce, porque es toda armada que no
  viene después de una recepción o de un recovery. «Recovery» sí es una acción.
- La rotación no se guarda por rally: rotación inicial del set más correcciones
  (`set.correcciones`, desde el rally N).
- Fin de set automático a 25 (15 en el 5.º) con diferencia de 2. Enter abre el set siguiente.
- Se scoutea un solo equipo por partido (Rival o Propio). «Ambos» queda pendiente.

No probado todavía: archivo de video local (falta probarlo con un archivo real).

### Ajustes tras la primera prueba de Martín (mismo día)

- Subtítulos de YouTube desactivados (`cc_load_policy: 0` y se descarga el módulo
  de subtítulos al reproducir).
- El panel de estado crece si hace falta: el texto ya no se monta sobre las teclas.
- La columna de tiempo del rally actual cabe en videos de más de una hora.
- Balón libre, pedido por Martín (en el paso de armada, típicamente tras una defensa):
  F = el equipo scouteado pasa balón libre (acción `pasaLibre`; el rally sigue),
  B = el equipo scouteado recibe balón libre (acción `recibeLibre`; la armada que
  sigue se clasifica como fase «libre»).

- Caché: Pages sirve los archivos con `max-age=600`. index.html carga
  `estilos.css?v=N` y `app.js?v=N`. **Subir N en cada publicación** que cambie esos archivos.

### Rotación automática (fase 3, parte 1)

- Orden del armador P1 → P6 → P5 → P4 → P3 → P2 → P1, un giro por cada side-out
  ganado por el equipo scouteado (`rotar()`, `rotacionEn()`).
- Al abrir cada set: «¿Quién saca?» (1/2) y luego «¿Dónde parte el armador?» (1–6).
- Corrección con los botones P1–P6: fija la rotación desde el rally vigente y sigue
  rotando sola desde ahí. Solo se guarda si difiere de lo automático.
- Solo se lleva la rotación del equipo scouteado (decisión de Martín).
- Plantel: ver sección siguiente.

### Menú de partidos (pedido por Martín)

- Botón «Partidos» en el header: lista de partidos guardados en el navegador
  (fecha, equipo scouteado, sets, rallies), con Abrir, Partido nuevo y Eliminar
  (con confirmación propia; borra el historial de deshacer para no revivirlo).

### Exportar e importar JSON (fase 4)

- «Exportar JSON» en el header (partido abierto) y «Exportar» por fila en el menú Partidos.
  Archivo `voleystats-<rival>-vs-<propio>-<fecha>.json` con
  `{ formato: "voleystats-partido", version, exportado, partido }`.
  Incluye el link de YouTube o el nombre del archivo local; el video nunca viaja.
- «Importar JSON…» en el menú Partidos. Acepta el archivo exportado o un partido suelto,
  valida la estructura y pasa por `migrarPartido()`. Rechaza archivos de una versión más nueva.
  Si el id ya existe: Reemplazar / Guardar como copia / Cancelar.
- Pendiente opcional (fase 6): exportar CSV.

### Plantel (fase 3, parte 2)

- `partido.plantel = { propio: [], rival: [] }` con `{ num, nombre?, pos? }`. Posiciones
  opcionales: armador, central, punta, opuesto, líbero. Los partidos viejos parten con
  plantel vacío (`migrarPartido`).
- Editor en el botón «Plantel» (pestaña por equipo; Enter agrega otra fila; valida
  números 0–99 sin repetir). Al guardar se recuerda por nombre de equipo en
  `voleystats:equipos` y se carga solo al crear un partido con ese nombre.
- Botón «Jugador ▾» en el encabezado de la cancha (menú desplegable; antes era una fila
  fija que achicaba la cancha): un clic en un número asigna `accion.jugador` a la última
  recepción o ataque del rally en pantalla; otro clic en el mismo lo quita (deshacible).
  Solo recepción y ataque llevan jugador (decisión de Martín).

### Estadísticas (fase 5)

- Selector «Captura | Estadísticas» en el header. En Estadísticas el video sigue a la
  izquierda con la lista de clips; a la derecha: alcance, filtros y 4 vistas.
- Alcance: el partido abierto o varios partidos con el mismo equipo scouteado (por nombre),
  elegidos en «Elegir partidos…». Un clip de otro partido abre ese partido y carga su video.
- Vistas: Armador (zona de ataque por rotación y por calidad de pase, tipo de armada,
  puntos de armada en la cancha), Ataque (por zona: calle/diago/d. corta sobre remates,
  toques, punto, error+bloqueo, eficacia; trayectorias o mapa de calor de impactos),
  Side-out (por rotación y por pase, con punto en el 1er ataque) y Recepción
  (distribución, KPIs, por jugador y por rotación).
- Filtros combinables (OR dentro de cada filtro, AND entre filtros): set, rotación, pase,
  fase, armada, zona, golpe, resultado, jugador. Clic en celdas/filas fija filtros.
  Panel plegable: muestra solo los activos.
- Los clips parten 2 s antes de la recepción (side-out) o de la armada.
- Estado de estadísticas en memoria (`stats`), no se guarda.

### Espacio de la cancha (pedido por Martín)

- Leyenda oculta por defecto, con botón «Leyenda» (preferencia en `voleystats:prefs`).
- Teclas del paso de armada y de rotación inicial en 4 columnas: el panel de estado queda en ~222 px.
- A 1440×812 (la ventana de Martín) la cancha queda en su tamaño completo (512×302).

### Auditoría antes del primer partido real (2026-10-14)

- Probado en Chromium sin interfaz: un partido completo de 3 sets (129 rallies) con
  teclado y clics, archivo local, YouTube simulado, deshacer, recarga, exportar/importar
  y las 4 vistas de estadísticas. Marcador, saque y rotación coinciden con un cálculo
  independiente en todos los rallies. Sin errores de consola.
- Corregido: Ctrl+Z no funcionaba después de recargar la pestaña (el historial era solo
  en memoria). Ahora se guarda en sessionStorage al salir (`pagehide`, últimos 60 pasos).
- Corregido: bajo 1420 px de ancho los botones 1,5× y 2× quedaban tapados por «Pausar al
  marcar». Se ocultan las teclas impresas en los botones de esa fila.
- `?v=13`.

### Punto sin jugada (pedido por Martín)

- Botones «+1 <equipo>» en el marcador y tecla G con el rally cerrado (luego 1 Propio /
  2 Rival). Con un rally abierto, G sigue cerrándolo sin ataque como antes.
- Se guarda como un rally con solo el saque y su ganador (`puntoDirecto()`), así marcador,
  saque y rotación siguen derivándose; se deshace con Ctrl+Z. En la lista aparece «sin jugada».
- Si es el primer punto del set, primero pide quién saca y la rotación inicial
  (`pendiente.puntoPara`).
- Marcador: nombres largos de equipo en una línea con «…».
- `?v=14`.

### Auditoría y controles de video (2026-10-14)

- Ctrl+Z tras recargar y controles de video bajo 1440 px: ya estaban hechos (commit
  33a97d4, sección «Auditoría antes del primer partido real»). Sin cambios.
- Saltos de 10 s: J / L y Shift+← / Shift+→ (`SALTO_LARGO_SEGUNDOS = 10`, teclas
  `atrasLargo` / `adelanteLargo` en `TECLAS`). ← / → solos siguen en 3 s.
- Silencio: tecla M y botón abajo a la derecha del video («🔊 Sonido» / «🔇 Sin sonido»),
  visible solo con video cargado. `Video.silenciar(bool)` con `yt.mute()/unMute()` o
  `el.muted`; se aplica en `onReady` de YouTube y en `cargarArchivo`. Se recuerda en
  `voleystats:prefs` → `silencio`.
- J, L y M no chocan con ninguna tecla de captura (verificado contra `TECLAS`).
- Panel de estado: las teclas de video ahora son 5; el paso «rally cerrado» va en
  4 columnas para no crecer (algunas etiquetas se cortan con «…»).
- `?v=15` (14 ya estaba publicado con el punto sin jugada).
- Conocido, sin cambiar: con un video de YouTube recién cargado que nunca se ha
  reproducido (estado «sin iniciar»), YouTube solo acepta el primer salto. Después de
  reproducir una vez, todos los saltos funcionan.

**Siguiente paso:** anotar un set real y ajustar teclas y vistas con el uso; luego fase 6
(modo rápido, CSV, estadísticas por jugador según uso).
