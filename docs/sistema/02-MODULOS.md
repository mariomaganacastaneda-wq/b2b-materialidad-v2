# 02 - Módulos del Sistema

## Visión General

El sistema consta de **11 módulos** organizados por funcionalidad de negocio.

| # | Módulo | Ruta | Estado | Archivo Principal |
|---|--------|------|--------|------------------|
| 1 | Dashboard | `/` | Operativo | `pages/Dashboard.tsx` |
| 2 | Materialidad | `/materialidad` | Operativo | `components/commercial/MaterialityBoard.tsx` |
| 3 | Solicitudes de Cotización | `/cotizaciones` | Operativo | `pages/QuotationRequests.tsx` |
| 4 | Proformas | `/proformas` | Operativo | `pages/Proformas.tsx` + `ProformaManager.tsx` |
| 5 | Órdenes de Compra | `/ordenes-compra` | Operativo | `pages/PurchaseOrders.tsx` |
| 6 | Facturación CFDI | `/facturas` | Operativo | `pages/Invoices.tsx` |
| 7 | Cuentas Bancarias | `/bancos` | Operativo | `pages/BankAccounts.tsx` |
| 8 | Evidencia | `/evidencia` | Operativo | `pages/Evidence.tsx` |
| 9 | Contratos | `/contratos` | Operativo | `pages/Contracts.tsx` |
| 10 | Catálogos SAT | `/catalogos-sat` | Operativo | `pages/SATCatalogs.tsx` |
| 11 | Configuración | `/settings` | Operativo | `components/settings/SettingsPage.tsx` |
| 12 | Centro de Seguridad | `/security` | Operativo | `pages/SecurityCenter.tsx` |

---

## Detalle por Módulo

### 1. Dashboard (`/`)
- **Archivo**: `pages/Dashboard.tsx`
- **Función**: Landing page con estadísticas básicas del sistema
- **Métricas mostradas**: Monto total cotizaciones, total facturas, estado conexión DB
- **Roles**: Todos los roles tienen acceso

### 2. Materialidad (`/materialidad`)
- **Archivo**: `components/commercial/MaterialityBoard.tsx`
- **Función**: Dashboard forense - Tablero Kanban de cumplimiento documentario
- **7 Gatillos de materialidad**:
  1. **O.C.** - Orden de Compra vinculada
  2. **COT** - Cotización/Solicitud vinculada
  3. **CONT** - Contrato firmado
  4. **FACT** - Factura emitida
  5. **PAGO** - Porcentaje de pago (0%, 50%, 100%)
  6. **EVI** - Evidencia fotográfica/documental
- **Folio**: `{RFC_PREFIX}-{YYMMDD}-{NUMERO}`
- **Stats**: Materializaciones completas, contratos pendientes, total cotizado
- **Roles**: ADMIN, CONTABLE, FACTURACION

### 3. Solicitudes de Cotización (`/cotizaciones`)
- **Archivo**: `pages/QuotationRequests.tsx` (~23.3 KB)
- **Función**: Panel para crear y gestionar solicitudes de cotización
- **Roles**: ADMIN, VENDEDOR, REPRESENTANTE

### 4. Proformas (`/proformas`)
- **Archivos**: `pages/Proformas.tsx` + `components/commercial/ProformaManager.tsx`
- **Función**: Crear/editar proformas con selector inteligente de productos SAT
- **ProductSelector**: Componente con Smart Tags, búsqueda semántica RPC, multi-fuente
- **Estados**: PENDIENTE → ACEPTADA / RECHAZADA / EXPIRADA
- **Roles**: ADMIN, VENDEDOR, FACTURACION

### 5. Órdenes de Compra (`/ordenes-compra`)
- **Archivo**: `pages/PurchaseOrders.tsx` (~41.8 KB)
- **Función**: Gestión de OC recibidas de clientes
- **Flujo**: PDF → n8n webhook (OCR/IA) → Datos → Validación → Proforma
- **Integración**: n8n webhook `process-po-pdf` para extracción automática
- **Roles**: ADMIN, VENDEDOR, FACTURACION, CXC

### 6. Facturación CFDI (`/facturas`)
- **Archivo**: `pages/Invoices.tsx` (~58 KB - el más grande)
- **Función**: Gestión completa de facturas CFDI 4.0
- **Estados**: SOLICITUD → PREFACTURA_PENDIENTE → EN_REVISION_VENDEDOR → VALIDADA → TIMBRADA / CANCELADA / RECHAZADA
- **Archivos**: Upload de prefactura PDF, XML CFDI, factura timbrada PDF
- **Roles**: ADMIN, FACTURACION, CXC, CONTABLE, CLIENTE

### 7. Cuentas Bancarias (`/bancos`)
- **Archivos**: `pages/BankAccounts.tsx` + `components/accounting/BankAccountsManager.tsx`
- **Función**: Gestión de cuentas bancarias y cajas de efectivo
- **Tipos**: CUENTA BANCARIA, CAJA DE EFECTIVO
- **Catálogo**: Bancos mexicanos (`cat_mexican_banks`)
- **Roles**: ADMIN, FACTURACION, CXC, REPRESENTANTE

### 8. Evidencia (`/evidencia`)
- **Archivo**: `pages/Evidence.tsx` (~14.3 KB)
- **Función**: Galería de evidencia fotográfica/documental para materialidad
- **Storage**: Bucket `evidence` en Supabase
- **Asociación**: Vinculada a proforma/factura
- **Roles**: ADMIN, VENDEDOR, FACTURACION

### 9. Contratos (`/contratos`)
- **Archivo**: `pages/Contracts.tsx` (~25.9 KB)
- **Función**: Gestión de contratos asociados a proformas
- **NOM-151**: Soporte para fecha cierta (trazabilidad inmutable)
- **Estados**: en_revision → firmado → completado
- **Storage**: Bucket `contracts` en Supabase
- **Roles**: ADMIN, VENDEDOR, FACTURACION

### 10. Catálogos SAT (`/catalogos-sat`)
- **Archivo**: `pages/SATCatalogs.tsx`
- **7 Tabs**:
  1. **Productos/Servicios** - Catálogo CFDI jerárquico (DIVISION → PRODUCT)
  2. **Regímenes Fiscales** - Aplicabilidad PF/PM
  3. **Usos de CFDI** - Propósito fiscal del comprobante
  4. **Actividades Económicas** - Taxonomía SCIAN
  5. **Lista Negra** - EFOS/EDOS (Art. 69-B CFF)
  6. **Versiones del Sistema** - Changelog y rollback
  7. **Carga Masiva CSF** - Upload bulk de Constancias
- **Roles**: ADMIN, FACTURACION, CONTABLE

### 11. Configuración (`/settings`)
- **Archivo**: `components/settings/SettingsPage.tsx`
- **4 Tabs**:
  1. **Empresas** - CRUD organizaciones (clientes, emisoras, bulk CSF)
  2. **Usuarios** - UserDirectory (invitar, asignar roles)
  3. **Roles** - RoleManager (matriz de permisos por pantalla)
  4. **Mi Perfil** - Teléfono WhatsApp, Telegram
- **Roles**: ADMIN, VENDEDOR, CXC, CONTABLE

### 12. Centro de Seguridad (`/security`)
- **Archivo**: `pages/SecurityCenter.tsx` (~8.9 KB)
- **Función**: Auditoría de accesos, logs, validación RLS
- **Roles**: Solo ADMIN
