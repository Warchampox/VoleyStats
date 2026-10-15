# Sitio de scouting de voleibol — Especificación

Oct 13, 2026 · @Martín Batarce

## Propósito y alcance

El sitio es una herramienta de scouting a nivel de equipo: muestra cómo juega un equipo (dónde arma, hacia dónde ataca, cómo recibe) a partir de video, sin Excel.

- **Quién anota:** una sola persona, en un notebook, con calma y el video en la misma pantalla.
- **Qué equipo:** se elige por partido. Lo habitual será solo el rival; existe la opción de scoutear ambos equipos.
- **Cómo se comparte:** cada persona hace su propia revisión y la comparte como archivo. Sin cuentas ni sincronización.
- **Foco:** estadísticas de equipo. Las individuales por jugador son un extra, no el objetivo.
- **Tono:** herramienta seria para compartir información. Sin componentes de juego.
- **Proyecto separado de GOAT**, con identidad visual propia.

**Fuera de alcance por ahora:** versión para teléfono, sincronización entre dispositivos, cuentas de usuario.

## Arquitectura

Se usa el mismo enfoque que funcionó en GOAT: un sitio estático sin servidor, donde lo que está en el repo es lo que corre.

- **Stack:** HTML/CSS/JS plano, sin framework ni build.
- **Librerías por CDN:** las que hagan falta (por ejemplo, gráficos). Nunca npm ni bundler.
- **Persistencia:** localStorage en el navegador del notebook. Si los partidos detallados crecen mucho, se evalúa IndexedDB.
- **Compartir:** exportar e importar un archivo JSON por partido. Opcional: exportar a CSV para quien quiera abrirlo en Excel.
- **Deploy:** GitHub Pages directo desde el repo. Es necesario servir por http(s), porque el reproductor de YouTube no funciona abriendo el HTML como archivo local.
- **Sincronización:** no hace falta. Se reevalúa solo si el uso real lo pide.
- **Repo:** con CLAUDE.md (reglas fijas) y STATUS.md (avance por sesión), igual que GOAT.

## Fuentes de video

El sitio necesita leer y controlar el segundo del video, porque cada acción queda ligada a su momento exacto. Eso permite después filtrar jugadas y saltar directo a cada una.

| Fuente | Cómo se carga | Control desde el sitio |
| --- | --- | --- |
| YouTube | Pegar el link | Leer el segundo actual, saltar, pausar, velocidad 0,25× a 2×. Sin avance cuadro a cuadro. |
| Video de Drive | Descargarlo y abrirlo como archivo local. No se sube a ningún lado. | Control total, incluido avance cuadro a cuadro. |

El reproductor incrustado de Drive no expone una API para leer ni controlar el tiempo, así que no sirve para anotar. Como tenemos acceso para descargar los videos, la vía local resuelve ese caso.

Al importar un partido compartido, el video no viaja en el archivo: quien lo recibe vuelve a pegar el link de YouTube o abre su copia local del video.

## Flujo de captura

Se anota con un híbrido: teclas para elegir el tipo de acción o calificar, y clicks sobre una cancha dibujada para marcar posiciones. Un rally típico en modo video toma unas 5 o 6 acciones.

### Rally típico (modo video, con pausa)

1. **Recepción:** una tecla con la calificación. El primer contacto tras el saque es recepción automáticamente.
2. **Armada:** una tecla con el tipo de armada, luego un click donde cae la armada. Eso define la zona de ataque.
3. **Golpe:** tecla modificadora solo si no fue remate, luego un click donde pega o cae el balón.
4. **Resultado:** una tecla. La app dibuja el símbolo correspondiente.

Si el rally sigue tras un "defendido", la siguiente secuencia se asume como contraataque. Recovery se marca con tecla.

### Calificación (recepción, pase y saque)

Escala de 5 niveles: **#** perfecta · **+** buena · **!** regular · **-** mala · **=** error.

### Tipos de armada

Cada tipo tiene un color en la cancha. Son cuatro:

| Tipo | Uso habitual |
| --- | --- |
| Primer tiempo | Centrales |
| Pelota alta | Extremos |
| Rápida | Extremos |
| Pipe | Zaguero |

### Dirección y tipo de golpe

- **Dirección:** se calcula sola del ángulo entre el punto de armada y el punto de impacto: diago, diago corta o calle. Se guardan las coordenadas reales para mapas de calor.
- **Tipo de golpe:** remate por defecto. Tecla modificadora para toque corto o toque largo.
- **Zonas de destino** (5/1/6…): sobre todo relevantes para los centrales; se derivan del punto de impacto.

### Resultados del ataque

| Resultado | Qué se dibuja |
| --- | --- |
| Punto | Línea con marca de punto |
| Error (afuera o red) | Línea con marca de error |
| Bloqueado | Línea cortada con X en la red |
| Tocado por el bloque y sigue (pinchado) | Símbolo de toque en la red |
| Rejugado / cubierto | Símbolo de vuelta al propio campo |
| Defendido | Línea normal, el rally sigue |
| Usa el bloque (pega en el bloque y sale) | Línea hasta la red, rombo de toque en la red, punteada hasta el impacto y marca de punto |

### Marcador y rotación

- Marcador punto a punto: quién saca y quién gana cada rally.
- Se fija la rotación inicial de cada set; la app rota sola en cada side-out ganado. Se puede corregir a mano si se descuadra.
- Cada jugada queda asociada a la rotación del armador (P1 a P6).

### Plantel

Números de camiseta cargados a mano mientras se ve el video. Nombres opcionales para equipos conocidos, reutilizables entre partidos.

### Comodidad

- Teclas para el video: pausa, retroceder y avanzar unos segundos.
- Deshacer con Ctrl+Z.
- Opcional: pausar el video al empezar a marcar.

### Modo rápido

Prioridad baja: casi no se anota en vivo. Registra solo quién gana el punto y, si alcanza, la zona de armada. Un partido anotado así se puede completar después en modo video, sobre las mismas jugadas.

Las teclas exactas se definen probando el prototipo, no en papel.

## Modelo de datos

Un partido contiene sets, cada set contiene rallies y cada rally contiene acciones. Cada acción guarda su segundo de video y coordenadas normalizadas de la cancha (0 a 1), para poder recalcular estadísticas y mapas después.

- **Partido:** equipos, fecha, fuente de video (link de YouTube o nombre del archivo local), equipo o equipos scouteados, plantel por equipo.
- **Set:** número, rotación inicial de cada equipo, marcador final.
- **Rally:** equipo que saca, marcador antes del rally, rotación del armador (P1 a P6), ganador, segundo de video de inicio.
- **Acción:** tipo (saque, recepción, contra, recovery, armada, ataque), equipo, jugador opcional, calificación, tipo de armada, coordenadas, tipo de golpe, resultado, segundo de video.

Ejemplo de un rally:

```json
{
  "saca": "propio",
  "marcador": [12, 10],
  "rotacionArmador": 4,
  "t": 1523.4,
  "acciones": [
    { "tipo": "recepcion", "equipo": "rival", "calif": "+", "t": 1525.1 },
    { "tipo": "armada", "equipo": "rival", "armada": "alta", "punto": [0.12, 0.08], "t": 1526.0 },
    { "tipo": "ataque", "equipo": "rival", "golpe": "remate", "punto": [0.78, 0.71], "resultado": "punto", "t": 1526.6 }
  ],
  "gana": "rival"
}
```

Zona de ataque, dirección (diago, diago corta, calle) y zona de destino no se guardan: se calculan desde las coordenadas. Si cambia el criterio de clasificación, los datos viejos se reclasifican solos.

Los nombres de campos son orientativos; Claude Code los fija al implementar.

## Estadísticas y salidas

La salida central es la distribución del armador según la rotación y la calidad del pase. Todo se puede filtrar, y cada jugada filtrada se puede abrir en el video.

| Vista | Qué responde |
| --- | --- |
| Distribución del armador | Dónde arma según rotación (P1 a P6) y calidad de recepción |
| Mapa de ataque por zona | Hacia dónde ataca cada zona: diago, diago corta, calle, toques; mapa de calor de impactos |
| Side-out por rotación | En qué rotaciones el equipo sufre o rinde al recibir |
| Eficiencia de recepción | Distribución de calificaciones de recepción del equipo |

**Filtros combinables:** set, rotación, calidad de pase, tipo de armada, zona, tipo de golpe, resultado, recepción vs. contra vs. recovery.

**Lista de clips:** cada filtro produce una lista de jugadas; un click salta al segundo exacto del video.

Estadísticas por jugador quedan como extra si salen fáciles del mismo modelo. Las vistas se irán ajustando con el uso.

## Fases

Primero se valida el flujo de captura con un video real, porque si anotar es incómodo nadie va a usar el sitio. El resto se construye encima.

1. **Diseño de la pantalla de captura** en Claude Design: video, cancha, marcador y panel de teclas en una misma vista de notebook.
2. **Prototipo de captura:** video de YouTube y archivo local, clicks en la cancha, teclas, deshacer, guardado en localStorage. Se prueba anotando un set real y se ajustan las teclas.
3. **Marcador y rotación automática**, plantel por número y nombres.
4. **Exportar e importar** el partido como JSON.
5. **Estadísticas y filtros**, con lista de clips enlazada al video.
6. **Modo rápido** y extras (estadísticas por jugador, CSV), según uso.

## Preguntas abiertas

- [ ] Nombre del sitio e identidad visual.
- [ ] Asignación exacta de teclas (se define con el prototipo).
- [ ] Umbral de ángulo entre diago, diago corta y calle.
- [ ] ¿El saque se califica siempre o solo cuando interesa?
- [ ] ¿Se registra la armada del equipo scouteado también en contraataque, o solo en side-out?
