# Skills de diseño del proyecto

Copiadas a mano el 2026-10-22 para que viajen con el repo.

| Skill | Origen | Commit | Qué se copió |
| --- | --- | --- | --- |
| impeccable | https://github.com/pbakaus/impeccable (Apache 2.0) | 8644175 | `SKILL.md`, `reference/`, `LICENSE`, `NOTICE.md` |
| taste | https://github.com/hmbown/taste | c9ec83b | todo menos `scripts/` (instaladores) |

## Lo que se dejó fuera de impeccable, a propósito

- `scripts/impeccable`: un lanzador que la primera vez **descarga un programa** (binario) desde los
  releases de GitHub a `~/.impeccable/bin/` y lo ejecuta. Lo usan `impeccable context`, `detect`,
  `critique-storage`, `pin` y otros comandos.
- `.claude/settings.json` del instalador: **hooks** que corren ese programa solos al abrir la sesión,
  después de cada edición de archivos y al terminar cada turno.
- `scripts/live-browser*.js` (550 KB minificados que se inyectan en la página para el modo `live`)
  y los subagentes de `.claude/agents/`.

Sin esos archivos, la skill sigue su propio camino «Launcher unavailable»: lee PRODUCT.md y DESIGN.md
si existen y trabaja solo con las instrucciones de `reference/`. Los comandos que dependen del
programa (`detect`, `live`, `generate`, `hooks`, `pin`, guardar críticas) no funcionan.

Para la instalación completa: `npx impeccable install` (ver el README del repo original).
