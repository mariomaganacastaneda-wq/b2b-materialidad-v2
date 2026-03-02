# Registro de Trabajo - B2B Materialidad

Este archivo es el **canal de comunicación** entre Claude Code y Antigravity Kit.
Ambos sistemas DEBEN leer este archivo al inicio de cada sesión y actualizarlo al finalizar trabajo significativo.

## Protocolo

1. **Al iniciar sesión**: Leer este archivo para entender el estado actual
2. **Al finalizar trabajo**: Actualizar la sección "Última sesión" y mover la anterior a "Historial"
3. **Formato**: Siempre en español

---

## Estado Actual del Proyecto

### Última sesión

- **Fecha**: 2026-03-02
- **Agente**: Claude Code (@project-cleaner)
- **Resumen**: Reorganización completa del proyecto (5 fases)
- **Cambios realizados**:
  - Corregido `.gitignore` corrupto (UTF-16 LE → UTF-8) - las reglas de ignorar NO funcionaban
  - Movidos 35+ archivos sueltos de la raíz a estructura organizada:
    - 6 CSFs → `archivos/clientes/`
    - 5 proformas/facturas → `archivos/proformas/` y `archivos/facturas/`
    - 2 catálogos XLS → `archivos/catalogos/`
    - 4 scripts JS → `scripts/debug/`
    - 2 SQL → `scripts/migrations/`
    - 13 reportes/docs → `docs/reportes/`
    - 1 guía → `docs/guias/`
    - 1 TSX temporal → `scripts/debug/`
  - Reorganizadas 7 carpetas:
    - `Ejemplos/` → `archivos/ejemplos/`
    - `Ejemplos2/` → `archivos/ejemplos2/`
    - `Exel/` → `archivos/catalogos-sat/`
    - `VistaPrevia/` → `archivos/proformas/vista-previa/`
    - `Ordenes de compra OP/` → `archivos/ordenes-compra/`
    - `similar_words/` → `scripts/analysis/similar-words/`
    - `Logos/` → `archivos/logos/`
  - Eliminados 2 XMLs vacíos (0 bytes)
  - Actualizadas rutas en 13 scripts que referenciaban archivos movidos
  - Raíz del proyecto: de ~60 items a ~17 items
- **Archivos modificados**:
  - `.gitignore` (recodificado UTF-8, actualizado patrones)
  - `scripts/debug/extract_payment_forms.js` (ruta catCFDI)
  - `scripts/debug/inspect_proforma.js` (ruta Ejemplos)
  - `scripts/migrations/extract_units.cjs` (ruta catCFDI)
  - `web/extract_cfdi.js`, `web/dump_catalogs.cjs`, `web/inspect_catalogs.cjs`, `web/inspect_catalogs_v2.cjs`, `web/import_catalogs.cjs` (ruta catCFDI)
  - `web/import_samples.js`, `web/inspect_proforma.js`, `web/analyze_excel.js`, `web/analyze_excel.cjs` (ruta Ejemplos)
  - `web/scripts/enrich_sat_catalog.cjs` (ruta catálogo SAT)
- **Estado**: Completado
- **Pendientes**:
  - Ejecutar `@docs-sync` para sincronizar documentación del sistema
  - Configurar tests con `@test-engineer`
  - Considerar eliminar `opencode-windows-x64.zip` (63MB) de git tracking

---

## Mapa de Agentes Activos

### Claude Code (`.claude/agents/`)
| Agente | Basado en | Especialidad |
|--------|-----------|-------------|
| `@frontend` | Antigravity: frontend-specialist | React/TS/Tailwind |
| `@database` | Antigravity: database-architect | Supabase/PostgreSQL |
| `@debugger` | Antigravity: debugger | Análisis de causa raíz |
| `@security` | Antigravity: security-auditor | OWASP, RLS, Auth |
| `@test-engineer` | Antigravity: test-engineer | TDD, Vitest, Playwright |
| `@explorer` | Antigravity: explorer-agent | Mapeo arquitectónico |
| `@verification` | Superpowers | Verificación antes de completitud |
| `@finish-branch` | Superpowers | Cierre de ramas |
| `@code-review` | Superpowers | Code review bidireccional |
| `@documentation-writer` | Antigravity: documentation-writer | README, changelog, ADR |
| `@docs-sync` | Original B2B | Sincronizar docs/sistema/ |
| `@proforma-deleter` | Original B2B | Eliminar proformas |

### Antigravity Kit (`.agent/agents/`)
| Agente | Skills | Especialidad |
|--------|--------|-------------|
| `orchestrator` | parallel-agents, behavioral-modes | Coordinación multi-agente |
| `project-planner` | brainstorming, plan-writing, architecture | Planificación |
| `frontend-specialist` | react-best-practices, tailwind-patterns, frontend-design | UI/UX web |
| `backend-specialist` | api-patterns, nodejs-best-practices | APIs, lógica de negocio |
| `database-architect` | database-design | Schema, SQL |
| `security-auditor` | vulnerability-scanner, red-team-tactics | Seguridad |
| `test-engineer` | testing-patterns, tdd-workflow, webapp-testing | Testing |
| `debugger` | systematic-debugging | Root cause analysis |
| `performance-optimizer` | performance-profiling | Web Vitals |
| `documentation-writer` | documentation-templates | Docs técnicos |
| `product-manager` | plan-writing, brainstorming | Requisitos |
| `code-archaeologist` | clean-code, code-review-checklist | Legacy/Refactor |
| `explorer-agent` | architecture | Análisis de codebase |
| + 7 más | ... | Mobile, Game, DevOps, SEO, QA, PenTest, Product Owner |

---

## Documentación Compartida

Ambos sistemas leen y mantienen:
- `docs/sistema/` → 10 documentos del sistema (via `@docs-sync`)
- `WORKLOG.md` → Este archivo (registro de trabajo)
- `CLAUDE.md` → Instrucciones para Claude Code
- `.agent/ARCHITECTURE.md` → Arquitectura del Antigravity Kit

---

## Convenciones de Colaboración

1. **Antes de empezar**: Leer WORKLOG.md para saber qué hizo el otro sistema
2. **Cambios en DB**: Documentar en WORKLOG.md (tablas, columnas, RLS)
3. **Cambios en componentes**: Documentar en WORKLOG.md (qué componente, qué cambió)
4. **Cambios en flujos**: Documentar en WORKLOG.md (qué flujo, qué paso cambió)
5. **Al terminar**: Actualizar "Última sesión" y mover la anterior a Historial

---

## Historial

(Las sesiones anteriores se registran aquí, más recientes primero)

### 2026-03-01 - Integración de agentes
- **Agente**: Claude Code
- **Resumen**: Integración de agentes Antigravity Kit y Superpowers en Claude Code
- **Cambios**: 12 agentes en `.claude/agents/`, WORKLOG.md, protocolo de colaboración

### 2026-03-01 - Sesión anterior
- **Agente**: Claude Code
- **Resumen**: Diagnóstico y corrección flujo OC → Proforma (6 bugs), refactorizado MaterialityBoard
- **Cambios**: Múltiples fixes en frontend y Supabase
