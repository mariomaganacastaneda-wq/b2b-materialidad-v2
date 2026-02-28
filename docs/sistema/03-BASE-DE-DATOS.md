# 03 - Base de Datos (Supabase PostgreSQL)

## Resumen

- **Plataforma**: Supabase (PostgreSQL)
- **Migraciones**: 47 archivos SQL
- **Tablas**: 26+ tablas
- **Edge Functions**: 6
- **Storage Buckets**: 5+
- **RLS**: Habilitado en todas las tablas transaccionales

---

## Tablas del Sistema

### Tablas Principales (Transaccionales)

#### `organizations`
Empresas cliente y emisoras del sistema.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID (PK) | Identificador único |
| `name` | TEXT | Nombre de la organización |
| `rfc` | TEXT | RFC fiscal |
| `brand_name` | TEXT | Nombre comercial |
| `logo_url` | TEXT | URL del logotipo |
| `primary_color` | TEXT | Color primario (#hex) |
| `theme_config` | JSONB | Configuración completa del tema visual |

#### `profiles`
Usuarios del sistema, vinculados a auth.users de Supabase.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | TEXT (PK) | ID de Clerk (user_xxx) |
| `organization_id` | UUID (FK → organizations) | Organización principal |
| `email` | TEXT | Correo electrónico |
| `full_name` | TEXT | Nombre completo |
| `role` | TEXT | Rol: ADMIN, VENDEDOR, FACTURACION, REPRESENTANTE, GESTOR_NOM151, CXC, CONTABLE, CLIENTE |
| `phone_whatsapp` | TEXT | Teléfono WhatsApp |
| `telegram_chat_id` | TEXT | ID de chat Telegram |
| `notification_prefered_channels` | TEXT[] | Canales preferidos de notificación |

#### `user_organization_access`
Matriz de acceso usuario-organización (multi-tenant).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID (PK) | ID único |
| `profile_id` | TEXT (FK → profiles) | ID del usuario |
| `organization_id` | UUID (FK → organizations) | ID de la organización |

#### `role_permissions`
Permisos por rol y pantalla (RBAC).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `role_id` | TEXT | Nombre del rol |
| `screen_id` | TEXT | ID de la pantalla |
| `can_view` | BOOLEAN | Puede ver |
| `can_create` | BOOLEAN | Puede crear |
| `can_edit` | BOOLEAN | Puede editar |
| `can_delete` | BOOLEAN | Puede eliminar |

#### `quotations`
Proformas/cotizaciones del sistema.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID (PK) | ID único |
| `consecutive_id` | INTEGER | Número consecutivo |
| `amount_total` | NUMERIC | Monto total |
| `amount_iva` | NUMERIC | Monto IVA |
| `amount_ieps` | NUMERIC | Monto IEPS |
| `status` | TEXT | PENDIENTE, ACEPTADA, RECHAZADA, EXPIRADA |
| `vendor_id` | TEXT | ID del vendedor |
| `description` | TEXT | Descripción del servicio |
| `is_contract_required` | BOOLEAN | ¿Requiere contrato? |
| `request_direct_invoice` | BOOLEAN | ¿Solicita factura directa? |
| `created_at` | TIMESTAMPTZ | Fecha de creación |

#### `invoices`
Facturas CFDI del sistema.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID (PK) | ID único |
| `quotation_id` | UUID (FK → quotations) | Proforma asociada |
| `internal_number` | TEXT | Número interno |
| `amount_total` | NUMERIC | Monto total |
| `status` | TEXT | SOLICITUD, PREFACTURA_PENDIENTE, EN_REVISION_VENDEDOR, VALIDADA, RECHAZADA, TIMBRADA, CANCELADA |
| `preinvoice_url` | TEXT | URL del PDF de prefactura |
| `xml_url` | TEXT | URL del XML CFDI |
| `pdf_url` | TEXT | URL del PDF timbrado |
| `created_at` | TIMESTAMPTZ | Fecha de creación |

#### `contracts`
Contratos vinculados a proformas.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID (PK) | ID único |
| `quotation_id` | UUID (FK → quotations) | Proforma asociada |
| `status` | TEXT | en_revision, firmado, completado |
| `file_url` | TEXT | URL del PDF firmado |

#### `evidence`
Evidencia fotográfica/documental para materialidad.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID (PK) | ID único |
| `quotation_id` | UUID (FK) | Proforma asociada |
| `invoice_id` | UUID (FK) | Factura asociada |
| `file_url` | TEXT | URL del archivo |
| `description` | TEXT | Descripción |
| `type` | TEXT | Tipo de evidencia |

#### `purchase_orders`
Órdenes de compra recibidas.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID (PK) | ID único |
| `po_number` | TEXT | Número de orden |
| `emission_date` | DATE | Fecha de emisión |
| `currency` | TEXT | Moneda (MXN/USD) |
| `client_rfc` | TEXT | RFC del cliente |
| `client_name` | TEXT | Nombre del cliente |
| `client_address` | TEXT | Dirección del cliente |
| `issuer_org_id` | UUID (FK → organizations) | Organización emisora |
| `validation_messages` | JSONB | Mensajes de validación |

#### `purchase_order_items`
Partidas/líneas de órdenes de compra.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID (PK) | ID único |
| `purchase_order_id` | UUID (FK → purchase_orders) | OC padre |
| `sat_product_key` | TEXT | Clave producto SAT |
| `quantity` | NUMERIC | Cantidad |
| `unit_price` | NUMERIC | Precio unitario |
| `has_iva` | BOOLEAN | ¿Incluye IVA? |
| `has_ieps` | BOOLEAN | ¿Incluye IEPS? |

#### `quotation_payments`
Pagos registrados contra proformas.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID (PK) | ID único |
| `quotation_id` | UUID (FK → quotations) | Proforma pagada |
| `bank_account_id` | UUID (FK → org_bank_accounts) | Cuenta bancaria |
| `amount` | NUMERIC | Monto del pago |
| `payment_date` | DATE | Fecha de pago |
| `payment_method` | TEXT | Método de pago |
| `reference` | TEXT | Referencia bancaria |
| `evidence_url` | TEXT | Comprobante de pago |
| `status` | TEXT | PENDIENTE, VERIFICADO, RECHAZADO |
| `notes` | TEXT | Notas |

#### `org_bank_accounts`
Cuentas bancarias y cajas de efectivo.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID (PK) | ID único |
| `organization_id` | UUID (FK → organizations) | Organización |
| `bank_name` | TEXT | Nombre del banco |
| `account_number` | TEXT | Número de cuenta |
| `holder_name` | TEXT | Titular |
| `currency` | TEXT | MXN o USD |
| `is_active` | BOOLEAN | Estado |
| `account_type` | TEXT | CUENTA BANCARIA o CAJA DE EFECTIVO |

---

### Tablas de Catálogos SAT

#### `cat_cfdi_productos_servicios`
Catálogo jerárquico de productos y servicios CFDI 4.0.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `code` | TEXT (PK) | Clave SAT |
| `name` | TEXT | Descripción |
| `level` | TEXT | DIVISION, GROUP, CLASS, PRODUCT |
| `parent_code` | TEXT | Clave padre (jerárquico) |
| `includes_iva_transfered` | BOOLEAN | ¿Incluye IVA trasladado? |
| `includes_ieps_transfered` | BOOLEAN | ¿Incluye IEPS trasladado? |
| `similar_words` | TEXT | Palabras clave similares |
| `similarity_threshold` | NUMERIC | Umbral de similitud |

#### `cat_cfdi_regimenes`
Regímenes fiscales CFDI 4.0.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `code` | TEXT (PK) | Código (601, 605, etc.) |
| `name` | TEXT | Descripción |
| `applies_to_physical` | BOOLEAN | Aplica a Persona Física |
| `applies_to_moral` | BOOLEAN | Aplica a Persona Moral |

#### `cat_cfdi_usos`
Usos de CFDI (propósito fiscal del comprobante).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `code` | TEXT (PK) | Código (G01, G03, P01, etc.) |
| `name` | TEXT | Descripción |
| `applies_to_physical` | BOOLEAN | Aplica a PF |
| `applies_to_moral` | BOOLEAN | Aplica a PM |

#### `cat_economic_activities`
Clasificación SCIAN de actividades económicas.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID (PK) | ID único |
| `code` | TEXT | Código SCIAN |
| `name` | TEXT | Nombre de la actividad |
| `level` | TEXT | SECTOR, SUBSECTOR, RAMA, SUBRAMA |
| `parent_id` | UUID (FK self) | Actividad padre |
| `metadata` | JSONB | Metadatos adicionales |
| `description` | TEXT | Descripción |

#### `cat_mexican_banks`
Catálogo de bancos mexicanos.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `name` | TEXT (PK) | Nombre del banco |

#### `sat_blacklist`
Lista negra SAT - EFOS/EDOS (Art. 69-B CFF).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `rfc` | TEXT (PK) | RFC del contribuyente |
| `razon_social` | TEXT | Razón social |
| `estatus` | TEXT | Situación fiscal |
| `fecha_publicacion` | DATE | Fecha de publicación en DOF |
| `dof_url` | TEXT | URL del Diario Oficial |
| `last_sync_at` | TIMESTAMPTZ | Última sincronización |

---

### Tablas de Relación

#### `organization_activities`
Actividades económicas asociadas a organizaciones.

#### `organization_regimes`
Regímenes fiscales de organizaciones.

#### `organization_obligations`
Obligaciones tributarias de organizaciones.

#### `organization_csf_history`
Historial de Constancias de Situación Fiscal.

#### `rel_activity_cps_congruence`
Mapeo bidireccional Actividad Económica ↔ Producto/Servicio SAT con score de congruencia.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `activity_code` | TEXT (FK) | Código de actividad SCIAN |
| `cps_family_code` | TEXT (FK) | Código familia producto SAT |
| `score` | NUMERIC | Score de congruencia (≥1.0 = PRINCIPAL) |

#### `rel_activity_product`
Relación directa actividad-producto.

#### `cat_activity_search_tokens`
Tokens de búsqueda inversa por actividad.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `activity_code` | TEXT (FK) | Código de actividad |
| `token` | TEXT | Palabra clave para búsqueda inversa |

#### `sys_versions`
Historial de versiones del sistema.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `tag` | TEXT (PK) | Tag de versión |
| `name` | TEXT | Nombre de la versión |
| `description` | TEXT | Descripción |
| `changelog` | JSONB | Lista de cambios [{type, desc}] |
| `rollback_script` | TEXT | Script SQL de rollback |
| `created_at` | TIMESTAMPTZ | Fecha de creación |

---

## Diagrama de Relaciones

```
organizations ──────────┬──── profiles
     │                  │         │
     │                  │         ▼
     │                  │  user_organization_access
     │                  │
     ├── org_bank_accounts
     │         │
     │         ▼
     ├── quotations ──────┬── invoices
     │      │             ├── contracts
     │      │             ├── evidence
     │      │             └── quotation_payments
     │      │
     │      └── purchase_orders ── purchase_order_items
     │
     ├── organization_activities ── cat_economic_activities
     ├── organization_regimes ──── cat_cfdi_regimenes
     └── organization_obligations

cat_economic_activities ── rel_activity_cps_congruence ── cat_cfdi_productos_servicios
                           cat_activity_search_tokens
```

---

## Edge Functions

| Función | Descripción | JWT |
|---------|-------------|-----|
| `process-purchase-order` | Procesar OC (OCR/IA vía n8n) | Sí |
| `process-csf` | Procesar Constancia de Situación Fiscal | Sí |
| `manage-user-access` | Control de acceso usuario-organización | Sí |
| `send-proforma` | Envío de proformas por email/WhatsApp | Sí |
| `notify-invoice` | Notificaciones de estado de factura | Sí |
| `fix-rls` | Correcciones de políticas RLS | Sí |

---

## Storage Buckets

| Bucket | Contenido |
|--------|-----------|
| `invoices` | PDFs de prefactura, XML CFDI, facturas timbradas |
| `contracts` | PDFs de contratos firmados |
| `evidence` | Fotos y documentos de evidencia |
| `purchase_orders` | PDFs de órdenes de compra |
| `csf` | Constancias de Situación Fiscal (PDFs) |
| `quotations` | Archivos de proformas |

---

## Migraciones (47 archivos)

### Orden cronológico:
1. `20260204_initial_schema.sql` - Schema inicial
2. `20260205_full_schema.sql` - Schema principal completo
3. `20260205_notifications.sql` - Sistema de notificaciones
4. `20260205_onboarding_payments.sql` - Pagos de onboarding
5. `20260205_photography_metadata.sql` - Metadata de fotografías
6. `20260206_security_validation.sql` - Validaciones de seguridad
7. `20260206_prefactura_workflow.sql` - Flujo de prefactura
8. `20260206_fast_track_invoicing.sql` - Facturación rápida
9. `20260206_contract_policies.sql` - Políticas de contratos
10. `20260206_configurable_contract_policies.sql` - Políticas configurables
11. `20260209_*_activities_catalogue.sql` - Catálogo de actividades
12. `20260209_update_activities_catalog.sql` - Actualización catálogo
13. `batch_1.sql` - Migración batch
14. `20260209_cfdi_catalogs_schema.sql` - Schema catálogos CFDI
15. `20260211_enhance_blacklist.sql` - Lista negra mejorada
16. `20260211_product_hierarchy.sql` - Jerarquía de productos
17. `20260211_system_versions.sql` - Versiones del sistema
18. `20260211_activity_product_mapping.sql` - Mapeo actividad-producto
19. `20260212_recommendation_schema.sql` - Schema de recomendaciones
20. `20260212_csf_history_and_granularity.sql` - Historial CSF
21. `20260213_unit_catalog.sql` - Catálogo de unidades
22. `20260218_payments_and_banks.sql` - Pagos y bancos
23. `20260220_fix_profiles_rls_and_null_org.sql` - Fix RLS profiles
24. `20260220_add_dynamic_roles_and_tester.sql` - Roles dinámicos
25. `20260220_purchase_orders_module.sql` - Módulo OC
26. `20260220_purchase_orders_bucket.sql` - Bucket OC
27. `20260220_add_bank_account_to_quotations.sql` - Banco en cotizaciones
28-47. `2026022*` - Fixes de RLS, triggers, foreign keys, invoices, proformas

### RPCs (Funciones de Servidor)
- `search_productos_sat` - Búsqueda semántica Full Text Search de productos SAT
