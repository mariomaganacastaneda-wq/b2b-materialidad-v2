---
name: finish-branch
description: Proceso formal para completar trabajo en una rama de desarrollo. Verifica tests, presenta opciones (merge/PR/keep/discard) y limpia worktrees. Basado en Superpowers finishing-a-development-branch.
model: sonnet
---

# Finishing a Development Branch

Proceso estructurado para completar trabajo de desarrollo de forma ordenada y segura.

## Principio Core

> "Nunca mergees sin tests pasando. Nunca descartes sin confirmación."

## Proceso en 5 Pasos

### Paso 1: Verificar Tests

```
Ejecutar la suite de tests del proyecto.
├── Tests pasan → Continuar a Paso 2
└── Tests fallan → DETENER. Arreglar tests primero.
```

**REGLA ABSOLUTA**: NUNCA proceder si los tests fallan.

### Paso 2: Determinar Rama Base

Identificar de qué rama (main/master) se originó la feature branch.

```bash
# Encontrar rama base
git log --oneline --graph --all | head -20
# O verificar directamente
git merge-base main HEAD
```

### Paso 3: Presentar Opciones

Presentar exactamente estas 4 opciones al usuario:

```
¿Cómo quieres finalizar esta rama?

1. Merge local     → Integrar a rama base inmediatamente
2. Push + crear PR → Enviar para revisión
3. Mantener        → Preservar la rama para después
4. Descartar       → Eliminar permanentemente el trabajo
```

**IMPORTANTE**: Presentar las 4 opciones sin elaborar. Dejar que el usuario elija.

### Paso 4: Ejecutar la Opción Elegida

#### Opción 1: Merge Local
```bash
git checkout main
git merge --no-ff feature-branch
# Verificar que tests siguen pasando después del merge
npm test
```
- SIEMPRE verificar tests después del merge
- Usar `--no-ff` para preservar historial

#### Opción 2: Push + PR
```bash
git push -u origin feature-branch
gh pr create --title "Descripción" --body "Resumen de cambios"
```
- Incluir descripción clara en el PR
- Listar cambios principales

#### Opción 3: Mantener
- No hacer nada
- Informar al usuario que la rama está preservada
- NO limpiar worktree

#### Opción 4: Descartar
```
⚠️ CONFIRMACIÓN REQUERIDA:
"¿Estás seguro de que quieres descartar TODO el trabajo en esta rama?
Esto es PERMANENTE y no se puede deshacer.
Escribe 'CONFIRMO DESCARTAR' para proceder."
```
- REQUIRIR confirmación explícita
- NUNCA descartar sin confirmación del usuario

### Paso 5: Limpiar Worktree (si aplica)

| Opción elegida | ¿Limpiar worktree? |
|---------------|-------------------|
| 1. Merge local | SI - ya está integrado |
| 2. Push + PR | SI - está en remote |
| 3. Mantener | NO - usuario quiere preservar |
| 4. Descartar | SI - ya no se necesita |

```bash
# Si hay worktree que limpiar
git worktree remove /path/to/worktree
git branch -d feature-branch  # Solo si fue mergeada
```

## Reglas de Seguridad

1. **NUNCA** proceder si tests fallan
2. **SIEMPRE** verificar tests después de merge
3. **REQUERIR** confirmación antes de descartar
4. **SOLO** limpiar worktrees después de opciones 1, 2 y 4
5. **NUNCA** hacer force-push a main/master
6. **SIEMPRE** usar `--no-ff` para preservar historial de merge

## Integración con Otros Agentes

- Usar después de `@debugger` cuando terminas de arreglar un bug
- Usar después de `@frontend` o `@database` cuando completas una feature
- Combinar con `@verification` para asegurar que todo está verificado antes del merge
- Combinar con `@code-review` antes de crear PR

## Cuándo Usarme

- Al finalizar toda implementación de feature
- Después de completar un fix de bug
- Cuando quieres cerrar una rama de desarrollo ordenadamente
- Antes de pasar a otra tarea
