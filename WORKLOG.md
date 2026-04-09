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

- **Fecha**: 2026-04-09
- **Agente**: Claude Code (directo + n8n-builder + agentes especializados)
- **Resumen**: Generación de cotizaciones con IA + módulo OC + mejoras Materialidad + parser CFDI 4.0.
- **Cambios realizados**:

  **Módulo OC (Órdenes de Compra):**
  - Nueva pantalla `PurchaseOrderRequests.tsx` — gestión del ciclo de vida OC (solicitada→emitida→autorizada/rechazada)
  - Nueva pantalla `FileImport.tsx` — renombrada desde "Ordenes de Compra", acepta PDF/Excel/XML CFDI
  - 5to toggle "O.C." en ProformaManager → genera solicitud en pantalla OC
  - Migración `20260325_purchase_order_requests.sql` — tabla `purchase_order_requests` + columnas `req_purchase_order`, `purchase_order_status` en `quotations`
  - Migración `2026030401_purchase_orders_rls_dual_role.sql` — RLS dual rol

  **Parser CFDI 4.0 extendido:**
  - Validación de `TipoDeComprobante` — solo Ingreso (I) crea proforma, rechaza E/T/N/P con mensaje
  - Extracción de 14+ campos nuevos: `DomicilioFiscalReceptor`→`client_postal_code`, `FechaTimbrado`, `LugarExpedicion`, `RegimenFiscal` emisor, `TipoCambio`, `Exportacion`, `Descuento` (global y por línea), retenciones ISR, `NoIdentificacion` por concepto
  - Deduplicación por UUID fiscal — rechaza importar el mismo CFDI dos veces
  - Migración `20260325_cfdi_metadata_purchase_orders.sql` — 9 columnas nuevas en `purchase_orders` + índice único en `cfdi_uuid`

  **MaterialityBoard — Fix B+C aplicado a todos los indicadores:**
  - Indicador EVI: ahora gobernado por toggle `req_evidence` (inactivo si toggle OFF)
  - Indicador COT: gobernado por `req_quotation` con fallback 'solicitud'
  - Indicador CONT: gobernado por `is_contract_required` con fallback 'requerido'
  - Indicador O.C.: gobernado por `req_purchase_order` con fallback 'solicitada'
  - Eliminado indicador IMP (importación) — simplificado a 6 indicadores
  - Eliminados separadores visuales entre indicadores
  - Eliminados botones FileEdit y ArrowRight de cada fila

  **ProformaManager — UX mejorada:**
  - ConfigToggle rediseñado: toggle arriba, texto/descripción abajo
  - Nuevo orden de toggles: Cotización → O.C. → Contrato → Evidencia → Factura
  - Badge de estatus en dos líneas — evita desborde en textos largos como `PREFACTURA_PENDIENTE`
  - Fix: cuando `evidencePhotoCount > 0` se activa automáticamente `req_evidence=true` al cargar
  - Fix `is_contract_required` y `quotation_lifecycle` ahora se limpian correctamente al apagar sus toggles

- **Archivos creados**:
  - `web/src/pages/FileImport.tsx`
  - `web/src/pages/PurchaseOrderRequests.tsx`
  - `supabase/migrations/20260325_purchase_order_requests.sql`
  - `supabase/migrations/20260325_cfdi_metadata_purchase_orders.sql`
  - `supabase/migrations/2026030401_purchase_orders_rls_dual_role.sql`
  - `docs/guias/plan-ordenes-compra-importacion.md`

- **Archivos modificados**:
  - `web/src/App.tsx` (removido import no utilizado para Vercel build)
  - `web/src/components/commercial/MaterialityBoard.tsx` (removido obj. destructurado vacío)
  - `web/src/pages/PurchaseOrderRequests.tsx` (removida variable no utilizada)
  - `web/package.json`
  - `WORKLOG.md` (este archivo) — rutas `/importacion` y `/ordenes-compra`
  - `web/src/components/commercial/MaterialityBoard.tsx` — Fix B+C todos los indicadores
  - `web/src/components/commercial/ProformaManager.tsx` — 5to toggle OC + UX mejorada

- **Migraciones aplicadas en Supabase**: ✅ Todas aplicadas y verificadas
- **TypeScript**: ✅ Sin errores
- **Estado**: Listo para commit y deploy

  **Generación de Cotizaciones con IA:**
  - Botón "Generar con IA" en secciones Solicitud y Emisión de QuotationRequests
  - 2 workflows n8n independientes: solicitud (Hr3V5fGlWzB8DZOC) y emisión (nzPdvXH1r8QW836g)
  - Agente OpenAI gpt-4o genera texto profesional con branding corporativo
  - Solicitud: branding cliente, sin precios, firmante comercial
  - Emisión: branding emisora, con precios, escanea solicitud previa como contexto
  - Archivos guardados como HTML con botones Ver/Word/Eliminar
  - Conversión HTML→Word al vuelo sin servidor
  - Notificaciones no-bloqueantes (fix error insertBefore)
  - Identidad visual habilitada para clientes + upload de logo funcional
  - Persistencia de org seleccionada en BD (fix default org)
  - Documentación: `docs/sistema/16-GENERACION-COTIZACIONES-IA.md`

- **Pendientes / Próximas mejoras sugeridas**:
  - Mostrar `client_postal_code` y `cfdi_uuid` en el modal de detalle de FileImport
  - Filtro por tipo de comprobante en FileImport
  - Validar `RegimenFiscal` del emisor contra RFC de la organización seleccionada

---

### Historial Reciente (Previas a hoy)

- **Fecha**: 2026-03-04
- **Agente**: Antigravity Kit (frontend-specialist, orchestrator)
- **Resumen**: Overhaul radical de UI/UX a estética Neo-Dark Futurista, rebranding global de pantallas a "FISCERTA Materialidad Fiscal B2B" y homologación visual a través de la autenticación y vistas internas.
- **Cambios realizados**:
  - Creación y aplicación de la skill `futuristic-ui-ux` basada en directrices Neo-Dark interactivas (Componentes 21st.dev y React Bits).
  - Implementación de animación `TextGlitch` para los títulos principales ("Materialidad Fiscal") y alteración del tracking tipográfico.
  - Integración del isotipo corporativo personalizado (`escudo.png`) incrustado dentro de un contenedor glow dinámico (`animate-pulse`).
  - Extensión de la estética translúcida a todos los encabezados secundarios (Cotizaciones, Invoices, Compras, Pagos, SAT, Seguridad).
  - Replicación exacta del navbar macroscópico dentro de la pantalla de Login público (`SignedOut` modal).
- **Archivos creados/modificados**:
  - `web/src/App.tsx` (Filtros, Login, EnvDiagnostic, Header Master)
  - `web/src/index.css` (Base Dark Variables, Purgado de blancos pasados)
  - `web/public/escudo.png` (Isotipo Blindado)
  - Múltiples componentes listados en `task.md` y `walkthrough.md`.
  - Creación del archivo `.agent/skills/futuristic-ui-ux/SKILL.md`.
- **Estado**: Rediseño Visual Completado / Rebranding Exitoso.
- **Pendientes**:
  - Monitorear Vercel y verificar visualmente la legibilidad del modo totalmente oscuro en la carga de módulos internos.

---

## Estado Actual del Proyecto

### Historial Reciente (Previas a hoy)

- **Fecha**: 2026-03-03
- **Agente**: Claude Code (@oc-workflow-optimizer, @n8n-builder, @oc-tester, @documentation-writer, @docs-sync)
- **Resumen**: Optimización completa del workflow n8n `B2B_Procesar_Orden_Compra_OpenAI` - rediseño, pruebas con 10 archivos, 6 correcciones
- **Cambios realizados**:
  - **Workflow n8n (YDv8SEZqn2ny0fCy)**: Rediseñado de 17 nodos a 16 nodos limpios
  - **Nodo nuevo**: Verificación Aritmética (7 reglas)
  - **Nodo nuevo**: Rechazo de documentos no transaccionales (CSF, acuses)
  - **Pruebas**: 10 archivos probados (6 PDF + 4 Excel), 10/10 PASS
- **Archivos creados/modificados**:
  - `.claude/agents/oc-tester.md`, `.claude/agents/oc-workflow-optimizer.md`
  - `docs/sistema/11-PROCESO-OPTIMIZACION-WORKFLOW-OC.md`
- **Estado**: Completado

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
- `docs/sistema/` → 11 documentos del sistema (via `@docs-sync`), incluyendo APIs de Context7
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

### 2026-03-03 - Investigación Catálogo de Gastos
- **Agente**: Antigravity Kit (orchestrator, backend-specialist, project-planner)
- **Resumen**: Investigación estructurada y diseño técnico de un Catálogo de Gastos con Sustento Fiscal (Cruce Anexo 6 vs CFDI 4.0).
- **Cambios**: Uso del MCP NotebookLM, diseño de matriz de cuentas internas/SAT/Materialidad, borradores de Trigger SQL DDL, `catalogo_gastos_fiscal.md`, `implementation_plan.md`. Subida a Vercel.

### 2026-03-03 - Optimización Workflow OC n8n

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
