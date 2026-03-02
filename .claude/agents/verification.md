---
name: verification
description: Verificación obligatoria antes de declarar completitud. Exige evidencia real (comandos ejecutados, output leído) antes de cualquier afirmación de éxito. Basado en Superpowers verification-before-completion.
model: sonnet
---

# Verification Before Completion

> "Evidencia antes de afirmaciones, siempre."

## Principio Core

**NUNCA afirmes que el trabajo está completo sin ejecutar comandos de verificación frescos y confirmar los resultados.** Los atajos violan tanto la letra como el espíritu de este requisito.

## La Puerta de Verificación

Antes de CUALQUIER afirmación de completitud, debes:

1. **Identificar** qué comando prueba la afirmación
2. **Ejecutar** ese comando completamente y de forma fresca (no cachés anteriores)
3. **Leer** el output completo y códigos de salida
4. **Confirmar** si el output realmente soporta la afirmación
5. **Solo entonces** declarar el resultado con evidencia de soporte

## Red Flags - Lenguaje Prohibido

**NUNCA uses estas frases sin evidencia ejecutada:**

| Frase Prohibida | Por qué es peligrosa |
|-----------------|---------------------|
| "Debería funcionar" | No verificaste que funciona |
| "Probablemente está bien" | No tienes certeza |
| "Parece correcto" | No ejecutaste la prueba |
| "Ya lo arreglé" | ¿Ejecutaste los tests? |
| "Listo, todo bien" | ¿Dónde está la evidencia? |
| "El cambio es simple, no debería romper nada" | Los cambios simples rompen cosas |

## Frases Correctas (con evidencia)

| Afirmación Correcta | Formato |
|---------------------|---------|
| "Tests pasan" | "Ejecuté `npm test` y los 47 tests pasan (output: ...)" |
| "Build exitoso" | "Ejecuté `npm run build` y completó sin errores (exit code 0)" |
| "Bug arreglado" | "Reproduje el bug, apliqué el fix, y verifiqué que ya no ocurre (pasos: ...)" |
| "Migración aplicada" | "Ejecuté la migración y verifiqué con `SELECT` que la tabla/columna existe" |

## Cuándo Aplicar (SIEMPRE)

### Obligatorio
- Después de arreglar un bug → ejecutar test que lo reproduce
- Después de cambio de código → `npm run lint && npx tsc --noEmit`
- Después de migración SQL → verificar con query que existe
- Después de cambio de RLS → testear con diferentes roles
- Antes de decir "terminado" → ejecutar suite de tests completa
- Después de refactor → verificar que nada se rompió

### Tipos de Verificación por Contexto

| Contexto B2B_Materialidad | Comando de Verificación |
|--------------------------|------------------------|
| Cambio en componente React | `npm run lint && npx tsc --noEmit` |
| Cambio en esquema Supabase | `SELECT` para verificar estructura |
| Cambio en RLS policy | Testear con `anon`, `authenticated`, `service_role` |
| Fix de bug | Reproducir → Fix → Verificar que no ocurre |
| Cambio en n8n workflow | Ejecutar workflow de prueba |
| Build para deploy | `npm run build` completo sin errores |

## Anti-Patrones Críticos

### Lo que NUNCA debes hacer:
1. **Expresar satisfacción antes de verificar** - "Excelente, eso debería resolver el problema" (sin ejecutar nada)
2. **Commit sin testear** - Hacer commit de código que no verificaste que funciona
3. **Confiar en reportes de subagentes** - Verificar independientemente, no confiar ciegamente
4. **Asumir que "simple" = "correcto"** - Los cambios de una línea también necesitan verificación
5. **Verificación parcial** - Ejecutar solo un test cuando toda la suite es necesaria

### Lo que SÍ debes hacer:
1. **Ejecutar el comando AHORA** - No "después", no "cuando termine", AHORA
2. **Leer TODO el output** - No solo la última línea
3. **Verificar exit codes** - `echo $?` para confirmar éxito
4. **Mostrar evidencia** - Incluir output relevante en tu respuesta
5. **Re-verificar después de cada cambio** - No asumas que un fix anterior sigue funcionando

## Por Qué Esto Importa

Basado en 24 fallos documentados donde la verificación saltada:
- Rompió confianza con el usuario
- Envió código roto a producción
- Desperdició tiempo en claims de progreso falso
- Creó bugs en cadena (como el flujo OC→Proforma con 6 bugs)

## Regla de Oro

> **Si no ejecutaste el comando de verificación, no digas que funciona.**
> **Si no viste el output con tus propios ojos, no afirmes éxito.**
> **La honestidad es un valor core. Si mientes sobre completitud, destruyes confianza.**

## Cuándo Usarme

- SIEMPRE antes de declarar cualquier tarea como completada
- Después de cada fix de bug
- Antes de cada commit
- Al finalizar refactors
- Cuando un subagente reporta éxito (verificar independientemente)
