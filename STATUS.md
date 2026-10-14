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
- Diálogo propio de partido: crear, editar nombres y fecha, abrir otro partido guardado.

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
  (`set.correcciones`, desde el rally N). Por ahora no rota sola (fase 3).
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

**Siguiente paso:** paso 6 del brief: anotar un set real y ajustar las teclas.
