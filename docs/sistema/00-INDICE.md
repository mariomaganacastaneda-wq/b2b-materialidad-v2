# B2B Materialidad - Documentación del Sistema

## Índice General

| # | Documento | Descripción |
|---|-----------|-------------|
| 01 | [Arquitectura](01-ARQUITECTURA.md) | Stack, estructura de carpetas, auth, deploy |
| 02 | [Módulos](02-MODULOS.md) | Los 11 módulos del sistema y su estado |
| 03 | [Base de Datos](03-BASE-DE-DATOS.md) | Schema Supabase: tablas, relaciones, RLS, edge functions |
| 04 | [Componentes](04-COMPONENTES.md) | Inventario de 28 componentes React |
| 05 | [Roles y Permisos](05-ROLES-Y-PERMISOS.md) | Sistema RBAC con 8 roles |
| 06 | [Flujos de Negocio](06-FLUJOS-DE-NEGOCIO.md) | Materialidad, facturación, OC, cotizaciones |
| 07 | [Integraciones](07-INTEGRACIONES.md) | Clerk, Supabase, n8n, Vercel, SAT |
| 08 | [Catálogos SAT](08-CATALOGS-SAT.md) | CFDI 4.0, SCIAN, Lista Negra 69-B |
| 09 | [Theme y Branding](09-THEME-Y-BRANDING.md) | Sistema de diseño dinámico 60-30-10 |
| 10 | [Diagnóstico OC→Proforma](10-DIAGNOSTICO-OC-PROFORMA.md) | Auditoría del flujo OC→Proforma: bugs críticos, mapeo de roles, datos de prueba y recomendaciones |
| 11 | [Optimización Workflow OC](11-PROCESO-OPTIMIZACION-WORKFLOW-OC.md) | Proceso completo de optimización del workflow n8n: 10 problemas diagnosticados (P1-P10), soluciones aplicadas, correcciones de fase de pruebas (MIME types, RFC flexible, toggles de materialidad, roles SAP), resultados de 10 archivos de prueba y lecciones aprendidas |
| 12 | [Context7 Libraries](12-CONTEXT7-MASTER-LIBRARIES.md) | Librerías de referencia indexadas en Context7 para uso en el proyecto |
| 13 | [Análisis MCP](13-MCP-ANALISIS.md) | Análisis de MCPs disponibles y su configuración |
| 14 | [Análisis CFDI 4.0](14-ANALISIS-CFDI-4-0.md) | Especificación técnica del parser CFDI 4.0 |
| 15 | [Módulo Órdenes de Compra](15-MODULO-ORDENES-COMPRA.md) | Ciclo de vida OC, parser CFDI 4.0, indicadores MaterialityBoard |
| 16 | [Generación Cotizaciones IA](16-GENERACION-COTIZACIONES-IA.md) | Workflows n8n + OpenAI para generación automática de cotizaciones |
| 17 | [Estimaciones de Obra](17-ESTIMACIONES-OBRA.md) | Módulo de obra civil: presupuesto Excel, estimaciones periódicas, amortización anticipo, proformas |
| 18 | [Contratos Multi-Proforma](18-CONTRATOS-MULTI-PROFORMA.md) | Relación N:N contratos-proformas, semáforo heredado, sincronización de status |

---

## Resumen Ejecutivo

**B2B Materialidad** es un sistema de **Blindaje Fiscal B2B** que implementa:

- **Materialidad**: Demostración de que los servicios realmente ocurrieron
- **Fecha Cierta**: Trazabilidad inmutable con timestamps (NOM-151)
- **Cumplimiento Fiscal**: Validación contra listas negras SAT (Art. 69-B CFF)
- **Expedientes de Defensa**: Documentación forense lista para auditoría
- **CFDI 4.0 Compliance**: Generación y validación de comprobantes

### Stack Tecnológico
- **Frontend**: React 19 + TypeScript 5.9 + Vite 7.2
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Autenticación**: Clerk (JWT → Supabase)
- **Automatización**: n8n (webhooks, OCR, procesamiento)
- **Deploy**: Vercel
- **State Management**: Zustand

### Métricas del Código
- **Líneas Frontend**: ~16,000 líneas TypeScript/TSX (estimado)
- **Migraciones SQL**: 51+ archivos
- **Componentes React**: 30+ (incluye WorkEstimations, QuotationRequests mejorado)
- **Tablas Supabase**: 30+ (incluye work_budgets, work_estimations, contract_quotations)
- **Edge Functions**: 6
- **Roles de usuario**: 8
- **Workflows n8n**: 3 (OC, Cotización Solicitud, Cotización Emisión)

### Módulos Activos (2026-04-15)

| Módulo | Estado | Ruta |
|---|---|---|
| Materialidad (ProformaManager) | Producción | `/materialidad` |
| Cotizaciones | Producción | `/cotizaciones` |
| Estimaciones de Obra | Producción | `/estimaciones-obra` |
| Órdenes de Compra | Producción | `/ordenes-compra` |
| Importación CFDI | Producción | `/importacion` |
| Contratos | Producción | (modal integrado) |
| Evidencias | Producción | (integrado en ProformaManager) |
| Pagos | Producción | (integrado en ProformaManager) |

---

*Documentación generada: Febrero 2026*
*Ultima actualizacion: Abril 2026 — docs 17 y 18 creados (Estimaciones de Obra + Contratos Multi-Proforma)*
*Versión del sistema documentada: Basada en commit 7ae18fe y sesión 2026-04-15*
