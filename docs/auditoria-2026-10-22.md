# Auditoría de diseño de VoleyStats (2026-10-22)

## Resumen

1. **El PDF no se lee cuando hay muchos ataques.** Con 327 ataques, el mapa «Ataque por zona» de la página 2 queda como una maraña: las flechas se salen de la cancha y tapan el título «rivales» (A1).
2. **En la lista de jugadas, la referencia se encima con el tiempo** cuando hay varios partidos («20 sept S1 R177:24»). Se lee mal justo donde uno elige qué clip ver (A2).
3. **El marcador de captura corta los nombres** («● Cat… 19 – 12 Universidad …») a 1440 y a 1280. En modo foco también se corta el título de «Ahora» («punto Católi») (A3, A4).
4. Detrás de esos vienen el foco del teclado (los diálogos no lo retienen, y Enter sobre un botón crea un rally) y los bordes de los campos, que tienen contraste 1,6:1 (A6–A8).
5. **La decisión más importante a revisar** es el reparto del espacio en la captura a 1280×720. La cancha queda de unos 320 px de ancho, unos 50 px por zona. Es donde se hacen los dos clics que definen zona y dirección, y por lo tanto todas las estadísticas (B1).

## Cómo se hizo

- **Sitio revisado:** el publicado (https://warchampox.github.io/VoleyStats/, commit 6465bbf), en Chrome headless controlado por CDP.
- **Viewports:** 1440×812 y 1280×720, con escala 1.
- **Datos de prueba:** generados para la prueba (Católica, 3 partidos, 403 rallies, plantel con nombres) y cargados en localStorage. El sitio los migró de v1 a v2 al abrir.
- **Video:** de YouTube, detenido en 0:00. Por eso los tiempos de la captura dicen 0:00,0.
- **Recorrido:** captura completa con teclas reales (Enter, W, clic, 1, ?, O, Tab), los diálogos, las 6 pestañas de estadísticas, el video lateral, filtros activos y el PDF (`Page.printToPDF`).
- **Criterios:** impeccable `audit` y `critique` (con `craft-floor` y modo *Operate*) y el modo crítica de taste (`references/REVIEW.md`).
- **Limitaciones de impeccable:** no corrí el detector (`impeccable detect`), porque necesita el programa que la skill descarga y que no instalé (ver `.claude/skills/LEEME.md`). Tampoco usé los subagentes que pide `critique`. En términos de la propia skill, esta es una corrida *degradada*: un solo contexto, sin detector. Los chequeos de contraste, foco y teclado los hice midiendo en la página y en el código.
- **Lo que no es del sitio:** los datos son sintéticos. Las armadas caen en tres puntos fijos, así que los grupos de círculos del PDF y las fichas casi iguales entre jugadores son efecto de los datos, no del sitio.

Las capturas están en [auditoria/](auditoria/). Los nombres que empiezan con `a` son recortes de cada hallazgo. Las pantallas completas tienen el ancho al inicio (`1440-…`, `1280-…`).

### Puntaje impeccable `audit`

| # | Dimensión | Puntaje | Hallazgo clave |
|---|---|---|---|
| 1 | Accesibilidad | 2 | Sin `:focus-visible` propio, diálogos sin trampa de foco, bordes de campos 1,6:1, rojo activo 4,26:1 |
| 2 | Rendimiento | 3 | Sin problemas visibles. `renderStats` recalcula todo en cada clic; no se notó con 400 rallies |
| 3 | Temas y tokens | 3 | Tokens en `:root`, pero 52 colores hex escritos fuera de él |
| 4 | Responsive | 2 | Pensado para notebook (bien), pero a 1280×720 hay cortes reales (A4, A5, A17) |
| 5 | Integridad | 3 | Lenguaje visual propio y coherente; los problemas son puntuales |
| | **Total** | **13/20** | Aceptable: lo que falta es pulido y accesibilidad, no rehacer |

**Veredicto de especificidad (impeccable):** pasa. El panel «Ahora» como placa de TV, el marcador en cursiva condensada, las flechas por zona y los colores fijos por tipo de armada no se pueden trasladar a otro producto. No se ve como un dashboard genérico.

### Crítica taste

- **El trabajo, como lo leo:** que Martín anote un partido desde el video sin perder el ritmo, y después vea en un minuto a quién y hacia dónde arma el rival.
- **Veredicto:** se puede usar después de una ronda de arreglos (A1–A5); ninguno exige rediseñar.
- **Lo inventado:** la eficacia «+75 %» de Z1 con n=8 se muestra con el mismo peso que «+1 %» con n=113. El número es real, pero la conclusión que sugiere va más allá de la evidencia (A19).
- **Lo que sobra:** la mitad derecha vacía de Equipo y Comparar a 1440. El contenido usa unos 780 px y deja el resto en blanco.
- **Lo que falta:** algo que marque las muestras chicas en Ataque. La n está, pero no cambia cómo se ve el dato.
- **El detalle que delata:** «Rallies en que **el** Católica recibe» y «R177:24». Son errores que un usuario ve en segundos.

---

## A. Problemas claros

### A1. El mapa de trayectorias del PDF no se lee con muchos ataques

- **Gravedad:** alta. **Esfuerzo:** 1–2 h.
- **Dónde:** Resumen PDF, página 2, «Ataque por zona». `htmlResumen()` llama a `partesAtaque(d, p, 'trayectorias')`.
- **Qué pasa:** con 327 ataques se dibuja una línea por ataque. Se forma una maraña, los impactos fuera de la cancha se salen del dibujo y tapan el título «rivales». En papel no se distingue ninguna tendencia.
- **Arreglo:** sobre 40 ataques (o con 15 o más por zona), usar las mismas flechas agregadas por zona y dirección de la pestaña Ataque, con grosor por %. Siguen siendo «trayectorias», como dice el SPEC, pero resumidas. Además, recortar el dibujo a su caja (`overflow: hidden` o un `clipPath`).
- **Capturas:** [a05-pdf-trayectorias.png](auditoria/a05-pdf-trayectorias.png), [pdf-pagina-2.jpg](auditoria/pdf-pagina-2.jpg).

### A2. La referencia de cada clip se encima con el tiempo

- **Gravedad:** alta. **Esfuerzo:** 15 min.
- **Dónde:** Estadísticas, lista de jugadas del video lateral. `.fila-clip` usa `grid-template-columns: 62px 56px …`; el texto sale de `filaClip()`.
- **Qué pasa:** con más de un partido, la referencia es «20 sept S1 R17» y no cabe en 62 px. Queda «R177:24» (rally 17, minuto 7:24). Pasa en todas las filas con rally de dos dígitos, a 1440 y a 1280.
- **Arreglo:** dar 92 px a la primera columna cuando hay varios partidos, o partirla en dos líneas (fecha arriba en gris, «S1 R17» abajo).
- **Captura:** [a03-clips-columnas-encimadas.png](auditoria/a03-clips-columnas-encimadas.png).

### A3. El marcador de captura corta los nombres de los equipos

- **Gravedad:** alta. **Esfuerzo:** 30–60 min.
- **Dónde:** Captura, `.marcador`, `#tanteo .equipo` (`overflow: hidden; text-overflow: ellipsis`).
- **Qué pasa:** «● Cat… 19 – 12 Universidad …». Los chips P1–P6 se quedan con la mitad del ancho y los nombres no caben, incluso uno corto como «Católica». Es el dato que confirma a quién se le está sumando el punto.
- **Arreglo:** pasar los chips de rotación a una segunda línea bajo el tanteo, o mostrar el alias o un nombre corto del equipo (ya existe `alias` en v2). El nombre completo puede quedar en el `title`.
- **Captura:** [a01-marcador-nombres-cortados.png](auditoria/a01-marcador-nombres-cortados.png).

### A4. En modo foco se corta el título de «Ahora»

- **Gravedad:** media. **Esfuerzo:** 20 min.
- **Dónde:** Captura con modo foco (O). `.ahora h2` usa `white-space: nowrap; overflow: hidden`.
- **Qué pasa:** «Rally 32 cerrado · punto Católi», cortado sin puntos suspensivos. Pasa a 1440 y a 1280.
- **Arreglo:** permitir dos líneas (`white-space: normal` con `line-clamp: 2`) o bajar el tamaño con `clamp()` según el ancho de la columna.
- **Captura:** [a02-foco-titulo-cortado.png](auditoria/a02-foco-titulo-cortado.png).

### A5. A 1280×720, la primera fila del rally queda tapada por la línea de tiempo

- **Gravedad:** media. **Esfuerzo:** 30 min.
- **Dónde:** Captura, `.historial` (grid-area `h`), paso Resultado.
- **Qué pasa:** con 4 acciones, la fila «Saque · Católica» queda cortada a la mitad bajo la barra de tiempo. Justo en el paso en que se revisa lo anotado.
- **Arreglo:** que el historial haga scroll hasta el final y con un degradado arriba, o compactar las filas a 20 px bajo 760 px de alto.
- **Captura:** [a04-1280-historial-cortado.png](auditoria/a04-1280-historial-cortado.png).

### A6. Los diálogos no retienen el foco ni lo devuelven al cerrar

- **Gravedad:** media. **Esfuerzo:** 30 min.
- **Dónde:** todos los diálogos (`abrirModal()` y `cerrarModal()`).
- **Qué pasa:** en «Partido nuevo», a los pocos Tab el foco sale del diálogo al fondo (medido: `BODY` y luego un `BUTTON` de atrás). Al cerrar, el foco no vuelve al botón que abrió el diálogo. `role="dialog"` y `aria-modal` existen, pero el diálogo no tiene nombre (`aria-labelledby`).
- **Arreglo:** en `abrirModal`, guardar el `document.activeElement` previo y hacer circular Tab y Shift+Tab dentro de `.dialogo`. En `cerrarModal`, devolver el foco al elemento guardado. Agregar `aria-labelledby` apuntando al `h2`.

### A7. En Captura, Enter sobre un botón enfocado crea un rally

- **Gravedad:** media. **Esfuerzo:** 20 min.
- **Dónde:** el `keydown` global y `teclaCaptura()`.
- **Qué pasa:** con el foco en «Foco» (por ejemplo, después de hacerle clic con el mouse), Enter creó el rally 33 en vez de activar el botón (medido: rallies 32 → 33, foco sin activar). Con el teclado no se pueden usar los botones de la cabecera en Captura. Además, si después de un clic queda un botón con foco, Enter hace lo que dice «Ahora» y no lo que se ve enfocado, que puede confundir.
- **Arreglo:** quitar el foco a los botones después de un clic con el mouse (`pointerup` → `blur()`). Así Enter sigue siendo «rally nuevo» para el flujo de Martín, y quien navega con Tab activa lo que tiene enfocado (`:focus-visible`).

### A8. Los bordes de campos y controles no cumplen contraste

- **Gravedad:** media. **Esfuerzo:** 15 min.
- **Dónde:** `.campo` y botones `.btn` en diálogos y en Equipos. `--borde-control: #3A404E` sobre `--fondo: #1C1F27` da **1,59:1**.
- **Qué pasa:** WCAG 1.4.11 pide 3:1 para el borde que define un campo. En «Partido nuevo», el campo «Equipo B» casi no se distingue del fondo del diálogo.
- **Arreglo:** un token `--borde-campo` cerca de `#5F6778` (alrededor de 3:1), solo para campos y botones secundarios. Los separadores pueden seguir tenues.
- **Captura:** [1440-dialogo-partido-nuevo.jpg](auditoria/1440-dialogo-partido-nuevo.jpg).

### A9. Las etiquetas de las canchas de estadísticas son chicas y quedan sobre las flechas

- **Gravedad:** media. **Esfuerzo:** 1 h.
- **Dónde:** Equipo (tendencia general, `vistaEquipo`), Ataque (`tarjetaZona`) y Jugadores (`canchaJugador`).
- **Qué pasa:** las etiquetas usan `font-size` 5,6 unidades SVG, unos 7–8 px en pantalla. «Diago 56 %» queda encima de la flecha amarilla. «Z4 29 %» y «Z2 21 %» cruzan la línea de la cancha. «Calle 35 %» queda gris sobre una flecha gris azulada.
- **Arreglo:** un halo del color de la cancha detrás del texto (`paint-order: stroke; stroke: var(--superficie-cancha); stroke-width: 3`), un mínimo de unos 10 px efectivos, y correr la etiqueta fuera del trazo.
- **Capturas:** [a08-tendencia-etiquetas.png](auditoria/a08-tendencia-etiquetas.png), [1440-stats-ataque.jpg](auditoria/1440-stats-ataque.jpg).

### A10. En Ataque, las trayectorias sueltas se salen de la tarjeta

- **Gravedad:** media. **Esfuerzo:** 30 min.
- **Dónde:** Ataque, tarjetas con n < 15 (Z1 y Z5 en la prueba). `tarjetaZona`.
- **Qué pasa:** los impactos fuera de la cancha se dibujan más allá del `viewBox`. Las líneas cruzan el borde superior o se cortan abajo, y en Z5 quedan cortadas las del fondo.
- **Arreglo:** ampliar el `viewBox` para incluir el «fuera» (unos 8 unidades por lado) y dibujar ese impacto con su símbolo en el borde.
- **Captura:** [a06-ataque-trayectorias-fuera.png](auditoria/a06-ataque-trayectorias-fuera.png).

### A11. En el conflicto de importación, la acción destructiva es la principal

- **Gravedad:** media. **Esfuerzo:** 10 min.
- **Dónde:** `elegirConflicto()`.
- **Qué pasa:** «Reemplazar» es el botón blanco (principal) y pisa el partido guardado. Las opciones seguras, «Omitir» y «Guardar como copia», se ven secundarias. Si se hace clic rápido en el botón destacado, se pierde el partido local.
- **Arreglo:** dejar «Guardar como copia» como principal (no pierde nada) y «Reemplazar» como secundaria. El foco inicial, en «Omitir».
- **Captura:** [1440-dialogo-importar-conflicto.jpg](auditoria/1440-dialogo-importar-conflicto.jpg).

### A12. «¿A quién le arman?» se ve mal en el PDF

- **Gravedad:** baja. **Esfuerzo:** 30 min.
- **Dónde:** Resumen PDF, página 2. `tablaAQuien()` dentro de `.resumen`.
- **Qué pasa:**
  - «n=326» sale más grande que el encabezado de la columna.
  - El resaltado del máximo no se nota en papel.
  - La nota usa el tamaño de pantalla.
  - En «Recepción», el bloque «= 8 %» y el pie «22 oct 2026» quedan cortados en el borde derecho.
- **Arreglo:**
  - Agregar reglas `.resumen .tabla .n` y `.resumen td.max` (negrita con fondo gris claro).
  - Pasar la nota a `.r-nota`.
  - Agregar `min-width: 0` y un margen a la derecha en la barra de recepción.
- **Captura:** [a09-pdf-a-quien-le-arman.png](auditoria/a09-pdf-a-quien-le-arman.png).

### A13. Los subtítulos de Comparar están en mayúsculas espaciadas

- **Gravedad:** baja. **Esfuerzo:** 5 min.
- **Dónde:** `.tabla-comparar tr.sub th` (`text-transform: uppercase; letter-spacing`).
- **Qué pasa:** es el único lugar del sitio con versalitas. La dirección visual pide «etiquetas en minúscula normal, sin mayúsculas espaciadas». Es un descuido de la entrega anterior, no una decisión.
- **Arreglo:** quitar `text-transform` y `letter-spacing`, y usar el estilo de `.bloque-titulo`.
- **Captura:** [a10-comparar-mayusculas.png](auditoria/a10-comparar-mayusculas.png).

### A14. Textos de la interfaz con errores

- **Gravedad:** baja. **Esfuerzo:** 15 min.
- **Qué pasa:**
  - Side-out y recepción: «Rallies en que **el** Católica recibe» (`vistaSideout`). Debiera ser «en que Católica recibe».
  - Conflicto de importación: «Guardado: **Scouteando** Católica, sets 3–1» (`resumenPartido`). Debiera ser «Guardado: Católica scouteado, sets 3–1, 178 rallies».
  - Plantel: el aviso «Es el plantel del equipo: se usa en todos sus partidos.» está bien, pero queda lejos de los campos, pegado a los botones.

### A15. En la ayuda, la fila «N 7» se pega con la siguiente

- **Gravedad:** baja. **Esfuerzo:** 10 min.
- **Dónde:** `alternarAyuda()` y la grilla `.ayuda`.
- **Qué pasa:** «Jugador a la última recepción, defensa o ataque (N N quita)» ocupa dos líneas y la segunda queda pegada a «Esc · Volver un paso de clic».
- **Arreglo:** acortar a «Jugador a la última acción (N N quita)» o dar `row-gap` a la grilla.
- **Captura:** [a07-ayuda-fila-N.png](auditoria/a07-ayuda-fila-N.png).

### A16. Detalles de accesibilidad

- **Gravedad:** baja. **Esfuerzo:** 20 min.
- **Qué pasa:**
  - Los avisos («#9 asignado al ataque», «Guardado») no tienen `aria-live` (0 en toda la página).
  - Los botones de video (−3 s, play, +3 s, sonido) tienen nombre solo en `title`.
  - No hay estilos `:focus-visible` propios: se usa el anillo por defecto de Chrome, que se ve, pero no sigue la dirección visual.
- **Arreglo:**
  - `aria-live="polite"` en el contenedor de avisos.
  - `aria-label` en los botones de video.
  - Una regla `:focus-visible { outline: 2px solid var(--texto); outline-offset: 2px }`.

### A17. A 1280, «+ Más filtros» queda solo en una segunda fila

- **Gravedad:** baja. **Esfuerzo:** 30 min.
- **Dónde:** `.stats-filtros` sin video lateral.
- **Qué pasa:** la segunda fila tiene un solo botón y se pierden unos 40 px de alto en una pantalla de 720.
- **Arreglo:** hacer que «Momento» o «Set» se compacten antes de que «Más filtros» baje de fila, o poner «Más filtros» como ícono al final de la primera fila.
- **Captura:** [a12-1280-filtros-dos-filas.png](auditoria/a12-1280-filtros-dos-filas.png).

### A18. Las fichas de jugadores tienen borde

- **Gravedad:** baja. **Esfuerzo:** 5 min.
- **Dónde:** `.ficha-jugador { border: 1px solid var(--borde) }`.
- **Qué pasa:** son las únicas tarjetas con borde. Las de Ataque y las de rotación se separan por fondo, como dice la dirección visual. También el líbero (0 ataques) aparece como tarjeta casi vacía con el mismo peso que los atacantes.
- **Arreglo:**
  - Usar `background: var(--fondo-secundario)` sin borde.
  - Mostrar a los jugadores sin ataques como una fila compacta («#1 Rojas · líbero · 42 recepciones, 52 % positiva») bajo las fichas.
- **Captura:** [1440-stats-jugadores.jpg](auditoria/1440-stats-jugadores.jpg).

### A19. Las muestras chicas pesan visualmente lo mismo que las grandes

- **Gravedad:** baja. **Esfuerzo:** 30 min.
- **Dónde:** Ataque, encabezado de cada tarjeta («efic. +75 %» con n=8). También el KPI de eficacia y la tabla del PDF.
- **Qué pasa:** el número de una zona con 8 ataques se ve igual de firme que el de una con 113. Comparar ya usa «pocos datos»; Ataque no.
- **Arreglo:** con n < 15, mostrar la eficacia en `--texto-3` con «(pocos datos)», igual que en Comparar.

---

## B. Decisiones a revisar

### B1. Reparto del ancho en la captura a 1280×720 (la más importante)

- **Decisión actual:** SPEC, Fases: «Diseño de la pantalla de captura en Claude Design: video, cancha, marcador y panel de teclas en una misma vista de notebook». El video ocupa unos 750 px y la columna derecha unos 480.
- **Qué la cuestiona:** a 1280, la cancha de captura mide unos 320 × 160 px. Cada zona tiene unos 50 px y la red queda a 160 px del fondo. Con esos dos clics se calculan la zona de ataque, la dirección (calle/diago/d. corta) y el destino. Un error de 10 px en el clic mueve el punto unos 0,5 m de cancha. En las capturas, la cancha es lo más chico de la pantalla.
- **Qué se gana al cambiar:** más precisión en el dato del que sale todo lo demás, y menos clics corregidos con Esc.
- **Qué se pierde:** video más chico (sigue siendo legible a 640 px de ancho) o un layout distinto según el ancho.
- **Recomendación: probar.** Anotar un set real a 1280 con la columna derecha a 560 px y comparar cuántas veces hay que corregir un clic.
- **Capturas:** [1280-captura-06-resultado.jpg](auditoria/1280-captura-06-resultado.jpg), [1440-captura-06-resultado.jpg](auditoria/1440-captura-06-resultado.jpg).

### B2. El rojo de transmisión con texto blanco no llega a AA

- **Decisión actual:** SPEC, Dirección visual: «El rojo de transmisión (#E1251B) aparece solo en la línea bajo el header, en lo activo o filtrado». La misma sección dice: «Contraste: textos con contraste AA».
- **Qué la cuestiona:** el texto claro sobre `#E1251B` da **4,26:1** (`#F3F4F6`) y 4,69:1 (blanco puro). Los botones activos usan 12–13 px («Captura», «P5», «Rally», «Estadísticas»), así que necesitan 4,5:1. Las dos reglas del SPEC chocan entre sí.
- **Qué se gana al cambiar:** cumplir AA sin perder el rojo.
- **Qué se pierde:** casi nada. `#C81E16` da 5,2:1 y se sigue viendo como rojo de TV, solo un poco más oscuro.
- **Recomendación: cambiar el tono** (o usar blanco puro y peso 600 en los activos).
- **Captura:** [a11-header-captura-activo.png](auditoria/a11-header-captura-activo.png).

### B3. Colores fijos de armada en el PDF claro

- **Decisión actual:** SPEC, Dirección visual: «Los colores de armada y de calificación mantienen su significado fijo». CSS: «Colores con significado fijo: solo para tipos de armada».
- **Qué la cuestiona:** en el PDF (fondo claro), el amarillo de «1er t.» (`#F0E442`) tiene 1,17:1 contra la cancha gris clara. Las flechas y los círculos amarillos casi desaparecen al imprimir.
- **Qué se gana al cambiar:** que el tipo más rápido de leer en pantalla también se lea en papel.
- **Qué se pierde:** si solo se cambia el tono en el PDF, se rompe un poco la idea de «mismo color, mismo significado».
- **Recomendación: probar** mantener el color y agregar, solo en el PDF, un contorno oscuro de 0,5 px a las marcas amarillas. Así se conserva el significado.
- **Captura:** [pdf-pagina-1.jpg](auditoria/pdf-pagina-1.jpg).

### B4. Indicadores grandes (KPI) en el PDF y en Recepción

- **Decisión actual:** SPEC, Resumen en PDF: «indicadores (side-out, recepción positiva, eficacia de ataque, punto en el 1er ataque)». Dirección visual: Barlow Condensed para «KPIs y eficacia».
- **Qué la cuestiona:** impeccable lista como patrón de interfaz generada «the hero-metric template: big number, small label, supporting stats».
- **Qué se gana al cambiar:** casi nada en este caso.
- **Qué se pierde:** el PDF se comparte por WhatsApp y esos 4 números son lo que el entrenador mira primero.
- **Recomendación: mantener.** Aquí el número grande es el contenido, no decoración.

### B5. La cancha de captura solo se usa con mouse

- **Decisión actual:** SPEC, Flujo de captura: el rally típico se marca con teclas y clics en la cancha. CLAUDE.md: «Toda acción de captura debe poder deshacerse (Ctrl+Z)», sin nada sobre teclado.
- **Qué la cuestiona:** impeccable `audit` pide que todo lo interactivo funcione con teclado. El `<svg id="cancha">` no tiene `tabindex` ni alternativa.
- **Qué se gana al cambiar:** accesibilidad completa.
- **Qué se pierde:** mucho trabajo (elegir punto con flechas) para un uso que no existe. El que anota necesita mouse para ubicar el punto.
- **Recomendación: mantener.**

### B6. Tema oscuro fijo

- **Decisión actual:** SPEC, Dirección visual: «fondo grafito azulado».
- **Qué la cuestiona:** impeccable pide elegir claro u oscuro según dónde se usa, no por categoría.
- **Qué se gana al cambiar:** comodidad si se anota en un gimnasio con luz.
- **Qué se pierde:** el video se ve mejor rodeado de oscuro, y se anota mirando el video.
- **Recomendación: mantener.** El PDF ya es claro.

---

## C. Sugerencias de las skills que no recomiendo

- **Íconos SVG de una familia en vez de caracteres Unicode** (▶, ⋯, ▾, ▲▼, ×). impeccable lo trata como señal de interfaz armada. Hoy se leen bien, son coherentes entre sí y cambiarlos no mejora ninguna tarea.
- **Sacar etiquetas sobre títulos** («Ahora · tecla», «Tendencia general», «Cancha · rally 32»). impeccable prohíbe el *kicker* o *eyebrow*. Aquí son etiquetas funcionales que dicen qué tecla aplica y qué se está mirando, no adornos sobre un titular.
- **Más color en la interfaz.** El modo *Operate* de impeccable dice que una pantalla gris con un solo acento es «el default de la categoría». En VoleyStats el color está reservado a significados (armadas, calificación, activo) y eso hace que las canchas se lean de un vistazo.
- **Botones táctiles de 44 px y diseño para celular.** Es una herramienta de notebook con teclado. Agrandar todo le quita espacio a la cancha (ver B1).
- **Animaciones y «momentos de deleite»** (`animate`, `delight`). En una herramienta que se usa mirando un video, cualquier movimiento fuera del video distrae.
- **Instalar el detector y los hooks de impeccable** para revisar cada cambio. Correrían un programa descargado en cada edición y al cierre de cada turno. Para un sitio de tres archivos, revisar a mano en cada entrega cuesta menos y es más claro (ver `.claude/skills/LEEME.md`).
- **Llenar la mitad derecha vacía de Equipo y Comparar a 1440** con más bloques. Es mejor limitar el ancho del contenido (unos 1100 px) que inventar contenido para llenarlo.

---

## Seguimiento (2026-10-22, `?v=26`)

Implementé A1–A19, el ancho máximo de Equipo y Comparar, y B1–B3, con las decisiones de Martín. B4, B5 y B6 se mantienen, y no se aplicó nada de la sección C. Después corrí de nuevo `audit` de impeccable sobre las pantallas tocadas, igual que antes: sin detector, en un solo contexto, con Chrome headless y los mismos datos de prueba.

### Puntaje de nuevo

| # | Dimensión | Antes | Ahora | Por qué |
|---|---|---|---|---|
| 1 | Accesibilidad | 2 | 3 | Foco propio visible, diálogos que retienen el foco, Enter/Espacio activan lo enfocado, bordes 3,5:1, rojo 5,2:1, `aria-live`, `aria-label` |
| 2 | Rendimiento | 3 | 3 | Sin cambios |
| 3 | Temas y tokens | 3 | 3 | Tokens nuevos (`--borde-campo`, `--col-der`); siguen los hex sueltos de antes |
| 4 | Responsive | 2 | 3 | Sin cortes a 1280, 1366 ni 1440, en los dos modos de captura |
| 5 | Integridad | 3 | 3 | Sin cambios de identidad |
| | **Total** | **13/20** | **15/20** | Bueno |

### Lo resuelto

| # | Qué se hizo | Verificado |
|---|---|---|
| A1 | Con más de 40 ataques, el PDF usa 6 tarjetas de flechas agregadas (3 por fila). Con menos, sigue la cancha de trayectorias, recortada bajo la línea de títulos | 326 ataques: 2 páginas, sin maraña. Con P1 + Final (11 ataques): trayectorias recortadas a su caja ([PDF filtrado](auditoria/seg-pdf-pagina-2-filtrado.jpg)) |
| A2 | Con varios partidos, la referencia del clip va en dos líneas («20 sept» / «S1 R17») y la fila crece a 36 px | [seg-clips-dos-lineas.png](auditoria/seg-clips-dos-lineas.png) |
| A3 | Marcador en dos filas: set y rotación arriba, tanteo a todo el ancho abajo | Nombres completos a 1280, 1366 y 1440 (medido: ningún nombre cortado) |
| A4 | El título de «Ahora» puede usar dos líneas; en foco baja a 32 px | «Rally 32 cerrado · punto Católica» completo a 1280 ([foco](auditoria/seg-1280-captura-foco.jpg)) |
| A5 | Historial con degradado arriba y filas de 21 px bajo 760 px de alto | La primera fila ya no aparece cortada en seco. Sigue habiendo scroll a 1280 en modo normal, a propósito |
| A6 | Tab y Shift+Tab circulan dentro del diálogo; al cerrar, el foco vuelve a quien lo tenía; `aria-labelledby` al título | 12 Tab seguidos en «Partido nuevo»: el foco nunca salió del diálogo |
| A7 | `pointerup` → `blur` en botones y casillas; Enter y Espacio sobre un control enfocado lo activan y no van a los atajos | Clic con mouse en «Foco» y luego Enter: crea el rally 32. Tab hasta «Foco» y Enter: entra al foco sin crear rally |
| A8 | `--borde-campo: #6B7385` en campos y `.btn`. El foco de un campo es blanco con un anillo de 1 px | 3,46:1 contra el fondo |
| A9 | Halo del color de la cancha detrás de las etiquetas del SVG; etiquetas de 6,2 unidades y más separadas de la flecha | [Ataque a 1280](auditoria/seg-1280-stats-ataque.jpg) |
| A10 | Los impactos fuera de la cancha se dibujan en el borde de la caja | Z1 y Z5 sin líneas fuera de la tarjeta |
| A11 | «Guardar como copia» es la principal, «Reemplazar» secundaria, y el foco inicial queda en «Omitir» | [Diálogo](auditoria/seg-1440-dialogo-importar-conflicto.jpg) |
| A12 | PDF: n chica junto al encabezado, máximo en negrita con fondo gris, notas a 8,5 px, margen derecho de 1,5 mm | «= 8 %» y el pie ya no se cortan |
| A13 | Subtítulos de Comparar en minúscula normal | Captura de Comparar |
| A14 | «Rallies en que Católica recibe»; «Guardado: Católica scouteado, sets 3–1, 178 rallies» | Texto en pantalla |
| A15 | «Jugador a la última acción (N N quita)» en una línea | Ayuda |
| A16 | Región `aria-live` para los avisos, `aria-label` en los botones de video, `:focus-visible` propio | 0 botones con nombre solo en `title` |
| A17 | Bajo 1400 px los filtros se compactan (espacios y relleno) | A 1280 caben en una fila ([Ataque a 1280](auditoria/seg-1280-stats-ataque.jpg)) |
| A18 | Fichas separadas por fondo, sin borde. Quienes no atacan van en filas compactas bajo las fichas | [Jugadores](auditoria/seg-1440-stats-jugadores.jpg): «#1 Rojas · líbero · 42 recepciones, 52 % positiva» |
| A19 | `conMuestra()`: con 1 a 14 casos, el valor va en `--texto-3` con «(pocos datos)». Aplica a las tarjetas y tablas de Ataque, al KPI de eficacia y al PDF; con 0 casos solo «—» | PDF filtrado: «+20 % (pocos datos)» |
| C | Equipo y Comparar con el contenido limitado a 1100 px | Captura de Comparar a 1440 |
| B1 | `--col-der` (normal: 500–600 px, unos 520 a 1280; ampliada: 600–720 px) y botón «Ampliar cancha», recordado en `prefs`. En ampliada, «Ahora» se compacta (226 px) para darle alto a la cancha. La cancha ya no tiene el tope fijo de 480 px | Tabla de abajo |
| B2 | `--tv: #C81E16` | 5,22:1 con `#F3F4F6`, 5,75:1 con blanco |
| B3 | Solo en el PDF: contorno oscuro de 0,5 px (`drop-shadow`) en marcas y muestras de primer tiempo (1,2:1), alta (2,1:1), rápida (2,05:1) y pipe (2,78:1). Emergencia (3,1:1) y segunda (4,7:1) quedan sin contorno | [PDF página 2](auditoria/seg-pdf-pagina-2.jpg) |

### Ancho de la cancha de captura (B1)

La cancha está limitada por el **alto** disponible, no por el ancho. Por eso el reparto normal casi no la cambia, y el aumento real viene del modo ampliado, que le da más alto. Medí el dibujo completo (viewBox 220×130) y, entre paréntesis, el rectángulo de la cancha, en el paso Resultado.

| Pantalla | Hoy (`?v=25`) | Normal nuevo | Ampliada | Video normal → ampliada |
|---|---|---|---|---|
| 1280×720 | 388 px (317) | 381 px (312) | **456 px (373)** | 712 → 632 px de ancho |
| 1366×768 | 469 px (384) | 463 px (379) | **537 px (439)** | 763 → 677 px |
| 1440×812 | 480 px (393) | **537 px (439)** | **612 px (500)** | 807 → 717 px |

- En los 6 casos el video se ve completo (16:9), la página no tiene scroll y no hay cortes en marcador, «Ahora» ni cancha.
- A 1280 y 1366, el reparto normal deja la cancha un 2 % más chica que hoy. El marcador ahora usa dos filas para no cortar nombres, y la cancha pierde ese alto.
- La ampliada le da a la cancha un **+18 %** a 1280 y un **+27 %** a 1440 respecto de hoy.

Capturas: [1280 normal](auditoria/seg-1280-captura-resultado.jpg), [1280 ampliada](auditoria/seg-1280-captura-resultado-ampliada.jpg).

### Lo que queda pendiente

- **Cancha en modo normal a 1280 y 1366:** no creció; quedó un 2 % más chica (ver tabla). Si Martín anota a 1280, lo útil es dejar «Ampliar cancha» activado. Una opción a revisar: compactar «Ahora» también en el modo normal.
- **Dos rojos juntos:** con «Ampliar cancha» activo quedan dos botones rojos lado a lado («Ampliar cancha» y «Rally»). Sigue la regla de «rojo en lo activo», pero pesa en la cabecera de la cancha. A revisar con Martín si molesta.
- **Contorno del PDF:** el de B3 se hace con `drop-shadow` y en papel se ve como un borde suave, no como una línea nítida. Si hace falta más definición, habría que dibujar un trazo oscuro bajo cada flecha (cambio en `dibujarJugada` y `tarjetaZona`).
- **Textos chicos:** la «n» bajo los encabezados de «¿A quién le arman?» y de Comparar pasó de 11 a 12 px. Queda solo la flecha ▸ de los plegables, a 10 px; es un ícono, no texto de lectura.
- **Panel «Ahora» con rally cerrado:** sigue con unos 100 px vacíos. No estaba en esta ronda.
- **`audit` sin detector:** se repitió sin el programa de impeccable (ver `.claude/skills/LEEME.md`).
