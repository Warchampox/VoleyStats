# Reglas fijas del proyecto

Lee SPEC.md al inicio de cada sesión. Actualiza STATUS.md al final.

## Arquitectura (no cambiar sin pedido explícito)
- HTML/CSS/JS plano. Tres archivos: index.html, estilos.css, app.js.
  Sin framework, sin build, sin npm. Lo que está en el repo es lo que corre.
- Librerías solo por CDN.
- Persistencia: localStorage. Proponer IndexedDB solo si hay un problema
  real de tamaño, nunca por adelantado.
- Sin backend, sin cuentas, sin sincronización. Compartir = exportar/
  importar JSON por partido.
- Deploy: GitHub Pages desde main. Sin Actions.

## Video
- YouTube: IFrame Player API (leer tiempo, seekTo, pausa, velocidad).
- Archivo local: <video> con URL de objeto desde un input de archivo.
  El video nunca se sube ni se copia.
- Nunca usar el reproductor incrustado de Google Drive.
- Ambas fuentes detrás de una misma interfaz interna (tiempo actual,
  saltar, pausar, velocidad) para que el resto del código no sepa
  cuál se usa.

## Datos
- Partido > sets > rallies > acciones. Cada acción guarda su segundo
  de video y coordenadas normalizadas 0–1 de la cancha.
- Zona de ataque, dirección (diago / diago corta / calle) y zona de
  destino NO se guardan: se calculan desde las coordenadas.
- La rotación se deriva del marcador y la rotación inicial del set;
  se guarda solo la corrección manual si existe.
- Cambios al formato de datos requieren migración de datos existentes
  en localStorage y compatibilidad al importar archivos viejos.

## Convenciones
- Interfaz en español de Chile. Nunca "che" ni argentinismos.
- Diálogos de confirmación propios, nunca confirm() nativo.
- Toda acción de captura debe poder deshacerse (Ctrl+Z).
- No inventar features fuera de SPEC.md; si algo parece faltar,
  preguntar.

## Diseño y revisión
- Las skills impeccable y taste se usan para revisar. Sus hallazgos que
  choquen con SPEC.md o CLAUDE.md no se aplican ni se descartan solos: se
  reportan como decisiones a revisar con Martín.
- En todo cambio visual (CSS, layout, componentes, PDF), leer y aplicar
  las referencias de impeccable (tipografía, color, espaciado, jerarquía,
  anti-patrones) y revisar el resultado con capturas antes del commit.
  La dirección visual «Transmisión» de SPEC.md define la identidad
  (fuentes, paleta, rojo solo en lo activo); impeccable afina la
  ejecución dentro de ella. Si impeccable sugiere cambiar la identidad
  misma, se reporta como decisión a revisar, no se aplica.
