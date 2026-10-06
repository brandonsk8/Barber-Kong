---
name: gitflow
description: Flujo GitFlow del equipo Barber Kong para empezar una tarea, commitear y preparar un Pull Request (ramas feature/fix/docs/hotfix desde develop, commits atómicos en español).
---

# GitFlow del equipo

Repos: `brandonsk8/Barber-Kong` (backend) y `Barber-Kong-Frontend`. `main` y `develop`
están protegidas: todo entra por Pull Request revisado por el otro integrante.

## Empezar una tarea

1. `git status` limpio (si no, preguntar qué hacer con los cambios; no descartarlos).
2. `git fetch origin && git switch develop && git pull --ff-only`
3. Crear rama según el tipo:
   - `feature/<descripcion-corta>` — funcionalidad nueva (desde develop)
   - `fix/<descripcion>` — corrección no urgente (desde develop)
   - `docs/<descripcion>` — solo documentación (desde develop)
   - `hotfix/<descripcion>` — corrección urgente de producción (**desde main**, se
     mergea a main y a develop)

## Commits

- Un cambio lógico por commit (atómico). Si el diff mezcla cosas, separarlo con
  `git add -p` / archivos específicos — nunca `git add -A` a ciegas.
- Mensaje en español, Conventional Commits: `feat: ...`, `fix: ...`, `docs: ...`,
  `refactor: ...`, `chore: ...`. Si aplica, referenciar la HU/UC (`feat(citas): reprogramar cita (HU-05)`).
- Antes de commitear código: skill `revisar-reglas` sobre el diff.

## Push y PR

- **No** hacer `git push` ni `gh pr create` sin autorización explícita del integrante
  (está configurado como `ask` en `.claude/settings.json`).
- PR siempre hacia `develop` (salvo hotfix → `main`). Descripción: qué cambia, HU/UC
  relacionadas, cómo se probó, migraciones nuevas si hay.
- Antes de abrir el PR: sincronizar con develop (`git pull --rebase origin develop` o
  merge) y revisar números de migración repetidos.

## Nunca sin confirmación

`git reset --hard`, `git push --force`, borrar ramas, `npm run db:reset`,
`docker compose down -v`.
