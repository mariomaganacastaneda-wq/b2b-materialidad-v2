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
- **Líneas Frontend**: ~14,200 líneas TypeScript/TSX
- **Migraciones SQL**: 47 archivos (~4,700 líneas)
- **Componentes React**: 28 (17 componentes + 11 páginas)
- **Tablas Supabase**: 26+
- **Edge Functions**: 6
- **Roles de usuario**: 8

---

*Documentación generada: Febrero 2026*
*Versión del sistema documentada: Basada en commit 71bfa6b*
