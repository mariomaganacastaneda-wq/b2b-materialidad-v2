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

- **Fecha**: 2026-03-03
- **Agente**: Claude Code (@oc-workflow-optimizer, @n8n-builder, @oc-tester, @documentation-writer, @docs-sync)
- **Resumen**: Optimización completa del workflow n8n `B2B_Procesar_Orden_Compra_OpenAI` - rediseño, pruebas con 10 archivos, 6 correcciones
- **Cambios realizados**:
  - **Workflow n8n (YDv8SEZqn2ny0fCy)**: Rediseñado de 17 nodos (4 muertos) a 16 nodos limpios (0 muertos)
  - **Nodo nuevo**: Verificación Aritmética (7 reglas: qty×price=subtotal, subtotal+IVA=total, etc.)
  - **Nodo nuevo**: Rechazo de documentos no transaccionales (CSF, acuses)
  - **Fix MIME type Excel**: `application/octet-stream` → mapeo correcto por extensión (.xlsx/.xls)
  - **Fix RFC flexible**: Lógica de 3 niveles (RFC > Nombre > Sin cliente). Nunca rechazar por falta de RFC
  - **Campos nuevos en respuesta**: `client_resolved` (bool), `client_message` (string para frontend UX)
  - **Fix toggles materialidad**: `requires_quotation`, `is_contract_required`, `has_advance_payment` = SIEMPRE false por default
  - **Fix roles SAP**: Instrucciones para OCs donde buyer=header/logo, supplier=vendor
  - **Prompt mejorado**: Notas textuales, reglas de roles, tipos de documentos, toggles
  - **Agentes nuevos**: `@oc-tester` (pruebas curl) y `@oc-workflow-optimizer` (coordinador)
  - **Documentación**: `docs/sistema/11-PROCESO-OPTIMIZACION-WORKFLOW-OC.md` (448+ líneas)
  - **Pruebas**: 10 archivos probados (6 PDF + 4 Excel), 10/10 PASS
- **Archivos creados/modificados**:
  - `.claude/agents/oc-tester.md` (nuevo)
  - `.claude/agents/oc-workflow-optimizer.md` (nuevo)
  - `CLAUDE.md` (2 agentes nuevos en tabla)
  - `docs/sistema/11-PROCESO-OPTIMIZACION-WORKFLOW-OC.md` (nuevo, actualizado)
  - `docs/sistema/00-INDICE.md` (actualizado)
  - Workflow n8n actualizado vía MCP (6 actualizaciones parciales)
- **Estado**: Completado
- **Pendientes**:
  - Registrar empresa AGA en la plataforma (manual, usuario)
  - Considerar mejorar detección de billing_type TIMBRADO para CFDIs

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

### 2026-03-02 - Reorganización del proyecto
- **Agente**: Claude Code (@project-cleaner)
- **Resumen**: Reorganización completa del proyecto (5 fases), .gitignore corregido, 35+ archivos movidos
- **Cambios**: Raíz de ~60 a ~17 items, rutas actualizadas en 13 scripts

### 2026-03-01 - Integración de agentes
- **Agente**: Claude Code
- **Resumen**: Integración de agentes Antigravity Kit y Superpowers en Claude Code
- **Cambios**: 12 agentes en `.claude/agents/`, WORKLOG.md, protocolo de colaboración

### 2026-03-01 - Sesión anterior
- **Agente**: Claude Code
- **Resumen**: Diagnóstico y corrección flujo OC → Proforma (6 bugs), refactorizado MaterialityBoard
- **Cambios**: Múltiples fixes en frontend y Supabase
