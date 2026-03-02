# Instrucciones del Proyecto

## Idioma
- Siempre responder en español.
- Todas las preguntas de confirmación, explicaciones y comunicación deben ser en español.

## Agentes Especializados

Agentes disponibles en `.claude/agents/` invocables con `@nombre`:

| Agente | Invocación | Cuándo usar |
|--------|-----------|-------------|
| **Frontend** | `@frontend` | Componentes React/TS, Tailwind, dashboards, estado, responsive, performance UI |
| **Database** | `@database` | Esquemas Supabase/PostgreSQL, migraciones, RLS policies, queries, índices |
| **Debugger** | `@debugger` | Bugs complejos, cross-system (frontend↔Supabase↔n8n), análisis de causa raíz |
| **Security** | `@security` | Auditoría de seguridad, RLS, auth, OWASP, vulnerabilidades en sistema financiero |
| **Test Engineer** | `@test-engineer` | Tests unitarios, TDD, E2E, cobertura, setup de testing |
| **Explorer** | `@explorer` | Mapeo de codebase, auditoría arquitectónica, feasibilidad, análisis de dependencias |
| **Verification** | `@verification` | SIEMPRE antes de declarar tarea completada. Exige evidencia real ejecutada |
| **Finish Branch** | `@finish-branch` | Completar rama de desarrollo: tests → opciones (merge/PR/keep/discard) → cleanup |
| **Code Review** | `@code-review` | Solicitar y procesar code reviews con rigor técnico |
| **Docs Sync** | `@docs-sync` | Sincronizar documentación del sistema en `docs/sistema/` |
| **Doc Writer** | `@documentation-writer` | README, changelog, ADR, documentación de API, JSDoc. Todo en español |
| **n8n Builder** | `@n8n-builder` | Workflows n8n: crear, modificar, validar, webhooks, integraciones, agentes AI |
| **Project Cleaner** | `@project-cleaner` | Organizar directorios, detectar archivos fuera de lugar. NUNCA borra, solo propone |
| **Proforma Deleter** | `@proforma-deleter` | Eliminar proformas verificando dependencias fiscales |

## Protocolo de Colaboración con Antigravity Kit

Este proyecto usa **dos sistemas de agentes** en paralelo:
- **Claude Code** (`.claude/`) - Este sistema
- **Antigravity Kit** (`.agent/`) - 20 agentes, 36 skills, 11 workflows

### Reglas de colaboración

1. **Al iniciar sesión**: Leer `WORKLOG.md` para saber qué hizo el otro sistema
2. **Al finalizar trabajo significativo**: Actualizar `WORKLOG.md` con resumen de cambios
3. **Skills compartidas**: Las skills del Antigravity Kit están en `.agent/skills/`. Si necesitas información detallada de una skill, léela directamente de ahí
4. **Documentación compartida**: `docs/sistema/` es mantenida por `@docs-sync` y ambos sistemas la leen
5. **No duplicar trabajo**: Antes de crear algo nuevo, verificar si ya existe en `.agent/`
