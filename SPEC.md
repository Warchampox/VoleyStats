# Sitio de scouting de voleibol — Especificación

Oct 13, 2026 · @Martín Batarce

## Propósito y alcance

El sitio es una herramienta de scouting a nivel de equipo: muestra cómo juega un equipo (dónde arma, hacia dónde ataca, cómo recibe) a partir de video, sin Excel.

- **Quién anota:** una sola persona, en un notebook, con calma y el video en la misma pantalla.
- **Qué equipo:** se elige por partido. Lo habitual será solo el rival; existe la opción de scoutear ambos equipos.
- **Cómo se comparte:** cada persona hace su propia revisión y la comparte como archivo (un partido o el paquete de un equipo). Sin cuentas ni sincronización.
- **Foco:** estadísticas de equipo. Las individuales por jugador son un extra, no el objetivo.
- **Tono:** herramienta seria para compartir información. Sin componentes de juego.
- **Proyecto separado de GOAT**, con identidad visual propia.

**Fuera de alcance por ahora:** versión para teléfono, sincronización entre dispositivos, cuentas de usuario.

## Dirección visual

**«Transmisión»:** se siente como el grafismo de una transmisión de vóley (marcador de TV, bloques sólidos, números condensados en cursiva), no como un dashboard genérico. La energía va en pocos lugares: marcador, panel «Ahora», marca y elementos activos; todo lo demás, sobrio.

- **Tipografía:** Barlow Semi Condensed para toda la interfaz; Barlow Condensed (cursiva 700–800) solo para números y títulos de impacto: marcador, título de «Ahora», marca, tiempo del video, KPIs y eficacia. Números tabulares. Etiquetas en minúscula normal, sin mayúsculas espaciadas.
- **Color:** fondo grafito azulado. El rojo de transmisión (#C81E16, 5,2:1 con el texto claro de los activos) aparece solo en la línea bajo el header, en lo activo o filtrado (selectores, filtros, rotación) y en el subrayado de la pestaña activa. Los errores usan un rosado distinto. Los colores de armada y de calificación mantienen su significado fijo.
- **Formas:** radios de 2 px; un solo nivel de contenedor, separado por fondo y no por bordes. El panel «Ahora» es una placa clara sólida con teclas negras, como la gráfica de TV.
- **Contraste:** textos con contraste AA, incluido el panel «Ahora». Bordes de campos y botones secundarios con al menos 3:1 contra el fondo. Foco de teclado visible en todo control.
- **Captura, reparto de columnas:** el video a la izquierda y la columna derecha (marcador, «Ahora», cancha) con unos 520 px a 1280 de ancho, proporcional en otros anchos (entre 500 y 600 px). El botón «Ampliar cancha», en la cabecera de la cancha, alterna a un reparto con la columna derecha en unos 600 px a 1280 (hasta 720 px), «Ahora» más compacto y el video más chico; se recuerda entre sesiones. La cancha usa todo el espacio que le deja el alto disponible.
- **Resumen PDF:** tema claro con la misma tipografía. Las marcas de armada en colores que quedan bajo 3:1 contra la cancha clara (primer tiempo, alta, rápida, pipe) llevan un contorno oscuro de 0,5 px, solo en el PDF.

## Arquitectura

Se usa el mismo enfoque que funcionó en GOAT: un sitio estático sin servidor, donde lo que está en el repo es lo que corre.

- **Stack:** HTML/CSS/JS plano, sin framework ni build.
- **Librerías por CDN:** las que hagan falta (por ejemplo, gráficos). Nunca npm ni bundler.
- **Persistencia:** localStorage en el navegador del notebook. Si los partidos detallados crecen mucho, se evalúa IndexedDB.
- **Compartir:** exportar un partido, el paquete de un equipo (el equipo, su plantel y todos sus partidos) o un respaldo completo. Importar acepta varios archivos a la vez y los tres formatos, también los partidos sueltos de versiones anteriores. Opcional: exportar a CSV para quien quiera abrirlo en Excel.
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
2. **Armada:** una tecla con el tipo de armada, luego un click donde cae la armada. Eso define la zona de ataque. Antes, un click opcional marca dónde queda el pase (recepción o defensa).
3. **Golpe:** tecla modificadora solo si no fue remate, luego un click donde pega o cae el balón.
4. **Resultado:** una tecla. La app dibuja el símbolo correspondiente.

Si el rally sigue tras un "defendido", la siguiente secuencia se asume como contraataque; en contraataque, la defensa se puede calificar (opcional) con la misma escala. Tras un ataque propio "rejugado", la armada siguiente es **cobertura** (recovery), sin tecla.

**Zona de ataque:** delantera según la banda donde cae la armada (Z4 / Z3 / Z2), sin importar la distancia a la red. Es de zaguero (Z5 / Z6 / Z1 según la banda) solo si la armada es pipe o se marca con la tecla de zaguero antes del click.

**Cierre sin ataque:** al cerrar un rally sin otro ataque del equipo scouteado se puede indicar el motivo: ace (gana el que saca), error de saque (gana el que recibe) o punto de bloqueo del equipo scouteado.

Si se aprieta una tecla de captura que no corresponde al paso actual, la app lo avisa en el panel.

### Calificación (recepción y defensa)

Escala de 5 niveles: **#** perfecta · **+** buena · **!** regular · **-** mala · **=** error. El saque no se califica: se registran el ace y el error de saque al cerrar el rally.

### Tipos de armada

Cada tipo tiene un color en la cancha:

| Tipo | Uso habitual |
| --- | --- |
| Primer tiempo | Centrales |
| Pelota alta | Extremos |
| Rápida | Extremos |
| Pipe | Zaguero (siempre ataque de zaguero) |
| Emergencia | La arma otro jugador tras un mal pase o defensa |
| Segunda del armador | El armador ataca de segunda (finta o remate): un click donde toca y otro donde cae |

Emergencia y segunda no cuentan en la distribución del armador: van aparte.

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

**Jugadores identificados:** el plantel del equipo es la referencia. En todo el sitio (tablas, filtros, clips, fichas y PDF) un jugador se muestra como «#7 Pérez», o «#7» si no tiene nombre. Entre partidos del mismo equipo, un número es un mismo jugador.

**Asignar jugador rápido:** N y el número (1 o 2 dígitos; Enter o 0,6 s de espera confirman) asigna el jugador a la última recepción, defensa o ataque del rally en pantalla. N y N otra vez lo quita. Aviso breve: «#9 Pérez asignado al ataque». Se deshace con Ctrl+Z. En el paso Resultado aparece una sugerencia «¿#9?» (el jugador más frecuente en la misma rotación y zona de ataque en rallies anteriores del equipo); N y Enter la aceptan. Nunca se asigna solo. El menú «Jugador» con el mouse sigue igual.

### Comodidad

- Teclas para el video: pausa, retroceder y avanzar unos segundos.
- Deshacer con Ctrl+Z.
- Opcional: pausar el video al empezar a marcar.

### Modo rápido

Prioridad baja: casi no se anota en vivo. Registra solo quién gana el punto y, si alcanza, la zona de armada. Un partido anotado así se puede completar después en modo video, sobre las mismas jugadas.

Las teclas exactas se definen probando el prototipo, no en papel.

## Modelo de datos

Lo normal es scoutear a un equipo viendo varios de sus partidos contra terceros, así que los datos se organizan **por equipo**. Un partido contiene sets, cada set contiene rallies y cada rally contiene acciones. Cada acción guarda su segundo de video y coordenadas normalizadas de la cancha (0 a 1), para poder recalcular estadísticas y mapas después.

- **Equipo:** nombre, alias (otros nombres con que aparece, por ejemplo «U. Católica» para «Católica») y plantel (número, nombre y posición opcionales). Es la referencia del plantel en todos sus partidos. Se puede renombrar, agregar alias y juntar con otro equipo guardado con otro nombre (se mueven sus partidos y se unen los planteles por número).
- **Partido:** los ids de sus dos equipos (lado A y lado B) y cuál se scoutea, fecha, competencia opcional, fuente de video (link de YouTube o nombre del archivo local) y una copia del plantel de cada equipo. La interfaz siempre muestra los nombres de los equipos. El estado («Completo», «En curso», «Sin empezar») se calcula.
- **Set:** número, rotación inicial de cada equipo, marcador final.
- **Rally:** equipo que saca, marcador antes del rally, ganador, segundo de video de inicio y, si se cerró con motivo, `motivo` (ace, error de saque, bloqueo). La rotación del armador se deriva (rotación inicial del set, side-outs y correcciones).
- **Acción:** tipo (saque, recepción, defensa, armada, ataque, pasa libre, recibe libre; datos viejos pueden traer recovery), equipo, jugador opcional (recepción, defensa, ataque), calificación (recepción y defensa), posición del pase opcional (`punto` en recepción y defensa), tipo de armada, `zaguero` si se marcó con la tecla, coordenadas, tipo de golpe, resultado, segundo de video.

La fase de cada armada (recepción, contra, cobertura, libre) no se guarda: se deduce de las acciones anteriores.

**Versiones del formato:** la versión 2 agregó los equipos como entidad. Al abrir datos de la versión 1, la app guarda primero una copia exacta, crea los equipos desde los nombres de los partidos (agrupando los nombres iguales sin importar mayúsculas ni tildes) y pasa a cada equipo los planteles que tenía recordados. Los archivos viejos se importan igual y se asocian a un equipo existente por nombre o alias.

**Archivos:** `voleystats-partido` (un partido y sus dos equipos), `voleystats-paquete` (un equipo, su plantel y todos sus partidos) y `voleystats-respaldo` (todo lo guardado). Si al importar un partido ya existe, se elige Reemplazar, Guardar como copia u Omitir, con opción de aplicar a todos.

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
| Distribución del armador | Dónde arma según rotación (P1 a P6) y calidad del pase (recepción y defensa), sin emergencia ni segunda; aparte, emergencias y segunda del armador por rotación |
| Mapa de ataque por zona | Hacia dónde ataca cada zona: diago, diago corta, calle, toques; mapa de calor de impactos |
| Side-out por rotación | En qué rotaciones el equipo sufre o rinde al recibir |
| Eficiencia de recepción | Distribución de calificaciones de recepción del equipo |
| Jugadores | Ficha por jugador con 5 o más acciones asignadas, ordenadas por ataques: mini cancha con flechas por zona y dirección (grosor = %), zonas, tipos de armada, golpe, resultado (punto y error + bloqueado) y recepción |
| ¿A quién le arman? (en Equipo) | Reparto de los ataques entre jugadores (% del total con jugador asignado): todo, con pase malo (! -) y final de set; resaltado el más buscado de cada columna |
| Comparar | Por set, momento o partido (2 a 4 grupos), lado a lado: distribución del armador por zona, dirección de ataque, side-out y a quién le arman. Diferencias de 15 puntos o más destacadas; grupos con menos de 8 jugadas tenues («pocos datos») |
| Saque y bloqueo | Aces y errores de saque de cada equipo, y puntos de bloqueo del equipo scouteado, por set y por rotación |

**Pocos datos:** cuando un valor se calcula sobre menos de 15 casos (por ejemplo, la eficacia de una zona con 8 ataques), se muestra en gris tenue con «(pocos datos)», en pantalla y en el PDF. En Comparar, los grupos con menos de 8 jugadas se ven tenues.

**Momento del set (calculado, no se guarda):** según el mayor de los dos marcadores antes del rally. Inicio 0–9, Medio 10–19, Final 20 o más; en el 5.º set 0–4, 5–9 y 10 o más.

**Filtros combinables:** set, rotación, momento (Todo · Inicio · Medio · Final), calidad de pase (recepción o defensa), tipo de armada, zona, tipo de golpe, resultado, fase (recepción, contra, cobertura, libre), jugador.

**Lista de clips:** cada filtro produce una lista de jugadas; un click salta al segundo exacto del video.

**Resumen en PDF:** desde Estadísticas, un resumen de 2 páginas A4 para compartir (por ejemplo, por WhatsApp), con el mismo alcance y filtros de la pantalla: encabezado con partidos y resultados, indicadores (side-out, recepción positiva, eficacia de ataque, punto en el 1er ataque), distribución del armador, cancha con las armadas, ataque por zona con trayectorias (con más de 40 ataques, flechas agregadas por zona y dirección, como en la pestaña Ataque), side-out, recepción, «¿A quién le arman?» y, si hay jugadores con ficha, una tabla compacta por jugador (zonas, dirección dominante, golpe). Se genera con el diálogo de impresión del navegador («Guardar como PDF»).

Las vistas se irán ajustando con el uso.

## Fases

Primero se valida el flujo de captura con un video real, porque si anotar es incómodo nadie va a usar el sitio. El resto se construye encima.

1. **Diseño de la pantalla de captura** en Claude Design: video, cancha, marcador y panel de teclas en una misma vista de notebook.
2. **Prototipo de captura:** video de YouTube y archivo local, clicks en la cancha, teclas, deshacer, guardado en localStorage. Se prueba anotando un set real y se ajustan las teclas.
3. **Marcador y rotación automática**, plantel por número y nombres.
4. **Exportar e importar** el partido como JSON.
5. **Estadísticas y filtros**, con lista de clips enlazada al video.
6. **Modo rápido** y extras (estadísticas por jugador, CSV), según uso.

## Preguntas abiertas

- [ ] Nombre del sitio (la identidad visual quedó definida: dirección «Transmisión»).
- [ ] Asignación exacta de teclas (se define con el prototipo).
- [ ] Umbral de ángulo entre diago, diago corta y calle.
- [x] ¿El saque se califica siempre o solo cuando interesa? → No se califica. Se registran ace y error de saque al cerrar el rally (G → 3 / 4).
- [ ] ¿Se registra la armada del equipo scouteado también en contraataque, o solo en side-out?
