# 04 - Inventario de Componentes React

## Resumen

- **Total componentes**: 17
- **Total páginas**: 11
- **Total archivos TSX**: 28
- **Líneas de código**: ~14,200

---

## Componentes por Área

### Accounting (1 componente)

#### `BankAccountsManager.tsx`
- **Ruta**: `components/accounting/BankAccountsManager.tsx`
- **Propósito**: Gestión de cuentas bancarias y cajas de efectivo
- **Tablas**: `org_bank_accounts`, `cat_mexican_banks`
- **Estado local**: accounts, editingId, formData, bankCatalog, searchTerm
- **Funcionalidades**:
  - CRUD de cuentas bancarias
  - Selector de banco con búsqueda (dropdown inteligente)
  - Distinción CUENTA BANCARIA vs CAJA DE EFECTIVO
  - Toggle activo/inactivo
  - Muestra saldo y moneda (MXN/USD)

---

### Catalogs (7 componentes)

#### `BlacklistTab.tsx`
- **Ruta**: `components/catalogs/BlacklistTab.tsx`
- **Propósito**: Auditoría contra lista negra SAT (EFOS/EDOS - Art. 69-B CFF)
- **Tablas**: `sat_blacklist`
- **Funcionalidades**:
  - Búsqueda en tiempo real por RFC o nombre
  - Acordeón expandible con detalles
  - Alertas de riesgo fiscal (badges rojos)
  - Info: oficio global, entidad federativa, fecha publicación DOF

#### `EconomicActivitiesTab.tsx`
- **Ruta**: `components/catalogs/EconomicActivitiesTab.tsx`
- **Propósito**: Catálogo SCIAN con mapeo a productos SAT
- **Tablas**: `cat_economic_activities`, `organization_activities`, `rel_activity_cps_congruence`, `cat_cfdi_productos_servicios`
- **Funcionalidades**:
  - Árbol jerárquico expandible (SECTOR → SUBSECTOR → RAMA → SUBRAMA)
  - Búsqueda en taxonomía SCIAN
  - Lazy loading de productos al expandir
  - Score de coincidencia (PRINCIPAL si ≥ 1.0)
  - Recomendaciones de productos SAT por actividad
  - Cuenta de organizaciones por actividad

#### `ProductsServicesTab.tsx`
- **Ruta**: `components/catalogs/ProductsServicesTab.tsx`
- **Propósito**: Catálogo SAT de Productos/Servicios CFDI 4.0
- **Tablas**: `cat_cfdi_productos_servicios`, `rel_activity_cps_congruence`
- **RPC**: `search_productos_sat` (búsqueda semántica FTS)
- **Funcionalidades**:
  - Árbol jerárquico (DIVISION → GROUP → CLASS → PRODUCT)
  - Búsqueda por código (numérica) o nombre (semántica)
  - Indicadores IVA Trasladado / IEPS Trasladado
  - Palabras clave similares
  - Actividades económicas relacionadas con score
  - Mapeo bidireccional Actividad ↔ Producto

#### `RegimesTab.tsx`
- **Ruta**: `components/catalogs/RegimesTab.tsx`
- **Propósito**: Catálogo de Regímenes Fiscales CFDI 4.0
- **Tablas**: `cat_cfdi_regimenes`
- **Funcionalidades**:
  - Filtro por nombre/código
  - Aplicabilidad PF/PM
  - Estatus de validación (Vigente SAT 2026)

#### `UsesTab.tsx`
- **Ruta**: `components/catalogs/UsesTab.tsx`
- **Propósito**: Catálogo de Usos de CFDI
- **Tablas**: `cat_cfdi_usos`
- **Funcionalidades**:
  - Búsqueda/filtro por código o descripción
  - Mapeo PF/PM
  - Alerta: uso incorrecto invalida deducibilidad

#### `SystemVersionsTab.tsx`
- **Ruta**: `components/catalogs/SystemVersionsTab.tsx`
- **Propósito**: Historial de versiones con changelog y rollback
- **Tablas**: `sys_versions`
- **Funcionalidades**:
  - Timeline visual con versión actual resaltada
  - Changelog con tipos: feat (verde), fix (rojo), ui (cyan), perf (amarillo)
  - Script de rollback disponible
  - Ordenamiento cronológico descendente

#### `BulkCSFManager.tsx`
- **Ruta**: `components/catalogs/BulkCSFManager.tsx`
- **Propósito**: Carga masiva de Constancias de Situación Fiscal
- **Edge Function**: `process-csf`
- **Storage**: Bucket `csf`
- **Funcionalidades**:
  - Selector de múltiples PDFs
  - Validación de tipo (solo PDF)
  - Procesamiento con barra de progreso
  - Extracción automática vía Edge Function
  - Creación automática de organizaciones si son nuevas
  - Resumen con éxitos/errores

---

### Commercial (2 componentes)

#### `MaterialityBoard.tsx`
- **Ruta**: `components/commercial/MaterialityBoard.tsx`
- **Propósito**: Dashboard forense de Materialidad Fiscal
- **Tablas**: `quotations`, `organizations`, `contracts`, `invoices`, `evidence`, `quotation_payments`
- **Funcionalidades**:
  - Tabla con indicadores visuales (badges de estado)
  - Folio: `{RFC_PREFIX}-{YYMMDD}-{NUMERO}`
  - 7 gatillos de materialidad (OC, COT, CONT, FACT, PAGO, EVI)
  - Links directos a cada módulo por gatillo
  - Stats: materializaciones completas, contratos pendientes, total cotizado
  - Búsqueda por cliente/descripción/folio
  - Filtro por estatus

#### `ProformaManager.tsx`
- **Ruta**: `components/commercial/ProformaManager.tsx`
- **Propósito**: Creación/edición de Proformas con selector inteligente
- **Tablas**: `quotations`, `rel_activity_cps_congruence`, `cat_cfdi_productos_servicios`, `cat_activity_search_tokens`
- **Subcomponente**: `ProductSelector`
  - Smart Tags (palabras clave extraídas)
  - Tags guardados en localStorage (`user_tags_{activityCode}`)
  - Búsqueda inversa por tokens
  - Búsqueda semántica RPC `search_productos_sat`
  - Multi-fuente: Actividad base → Inversa → Global SAT
- **Funcionalidades**:
  - CRUD de proformas
  - Autocompletado inteligente de productos
  - Cálculo automático IVA/IEPS
  - Validación conformidad CFDI 4.0

---

### Settings (7 componentes)

#### `SettingsPage.tsx`
- **Ruta**: `components/settings/SettingsPage.tsx`
- **Propósito**: Hub de configuración con 4 tabs
- **Tablas**: `organizations`, `profiles`, `user_organization_access`, `organization_activities`, `organization_regimes`, `organization_obligations`, `organization_csf_history`, `rel_activity_product`
- **Tabs**: Empresas (3 sub-tabs: clientes/emisoras/lote), Usuarios, Roles, Mi Perfil
- **Filtros**: searchTerm, activityFilter, typeFilter (moral/física), csfFilter

#### `CompanyList.tsx`
- **Ruta**: `components/settings/CompanyList.tsx`
- **Propósito**: Lista de empresas con búsqueda y filtros
- **Props**: orgs, selectedOrgId, onSelectOrg, filters
- **Funcionalidades**:
  - Búsqueda por nombre/RFC
  - Chips de filtro: Morales, Físicas, Con CSF
  - Avatar dinámico con color primario

#### `CompanyDetails.tsx`
- **Ruta**: `components/settings/CompanyDetails.tsx`
- **Propósito**: Formulario detallado de empresa
- **Campos**: datos básicos, contacto, fiscal (regímenes, actividades, obligaciones), CSF, productos relacionados

#### `UserDirectory.tsx`
- **Ruta**: `components/settings/UserDirectory.tsx`
- **Propósito**: Gestión de usuarios y roles
- **Funcionalidades**: invitar, asignar roles, ver estado, reenviar invitación, cambiar rol

#### `UserList.tsx`
- **Ruta**: `components/settings/UserList.tsx`
- **Propósito**: Componente lista de usuarios (helper)
- **Props**: users, selectedUserId, onSelectUser, searchTerm

#### `UserDetails.tsx`
- **Ruta**: `components/settings/UserDetails.tsx`
- **Propósito**: Formulario de edición de usuario
- **Campos**: Full Name, Email, Role, Status, Avatar URL, Notificaciones

#### `RoleManager.tsx`
- **Ruta**: `components/settings/RoleManager.tsx`
- **Propósito**: Configuración de permisos por rol
- **Tabla**: `role_permissions`
- **Funcionalidades**: Matriz role_id × screen_id → can_view/create/edit/delete

---

## Páginas

| Página | Archivo | Tamaño | Descripción |
|--------|---------|--------|-------------|
| Dashboard | `pages/Dashboard.tsx` | ~5 KB | Stats básicas |
| Invoices | `pages/Invoices.tsx` | **~58 KB** | CFDI completo |
| PurchaseOrders | `pages/PurchaseOrders.tsx` | ~41.8 KB | Gestión OC + OCR |
| Quotations | `pages/Quotations.tsx` | ~28.1 KB | Lista proformas |
| Contracts | `pages/Contracts.tsx` | ~25.9 KB | Contratos NOM-151 |
| QuotationRequests | `pages/QuotationRequests.tsx` | ~23.3 KB | Solicitudes |
| Evidence | `pages/Evidence.tsx` | ~14.3 KB | Galería evidencia |
| SecurityCenter | `pages/SecurityCenter.tsx` | ~8.9 KB | Auditoría |
| SATCatalogs | `pages/SATCatalogs.tsx` | ~5.8 KB | Hub 7 tabs |
| BankAccounts | `pages/BankAccounts.tsx` | ~2 KB | Wrapper |
| Proformas | `pages/Proformas.tsx` | ~3 KB | Lista |

---

## Utilidades

### `lib/supabase.ts`
- Cliente Supabase con interceptor JWT de Clerk
- `setClerkTokenProvider()` - Registra getter de token
- `updateSupabaseAuth()` - Actualiza token en sesión
- Custom fetch interceptor para inyección dinámica de Authorization

### `types/index.ts`
12 interfaces TypeScript:
- `Organization`, `Profile`, `Quotation`, `Invoice`
- `CFDIProductService`, `CFDIRegime`, `CFDIUse`
- `SATBlacklist`, `EconomicActivity`, `SystemVersion`
- `OrgBankAccount`, `QuotationPayment`
