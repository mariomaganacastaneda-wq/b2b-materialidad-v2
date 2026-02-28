# Changelog v2026.02.28 - B2B Materialidad

**Fecha**: 27-28 de febrero de 2026
**Alcance**: Flujo OC completo, sidebar expandible, pantalla Pagos, agente de borrado, 31 archivos modificados, 4 migraciones DB

---

## Resumen Ejecutivo

Esta versión consolida el flujo completo de Órdenes de Compra (OC) → Proforma con soporte para archivos Excel, campos de facturación/contratos/anticipos, sidebar jerárquico de Materialidad, nueva pantalla de Pagos, y un agente seguro para eliminación de proformas.

---

## 1. Flujo OC → Proforma: Campos de Facturación y Documentos

### Problema
Las Órdenes de Compra procesadas por n8n no extraían ni propagaban campos clave del flujo fiscal: tipo de comprobante (prefactura/timbrado), si requiere cotización, si requiere contrato, monto de anticipo, y notas del documento.

### Solución

#### 1a. Migración DB: `add_billing_fields_to_purchase_orders`
```sql
ALTER TABLE public.purchase_orders
  ADD COLUMN billing_type text DEFAULT 'PREFACTURA',
  ADD COLUMN requires_quotation boolean DEFAULT false,
  ADD COLUMN has_advance_payment boolean DEFAULT false,
  ADD COLUMN advance_payment_amount numeric DEFAULT 0;
```

#### 1b. n8n Workflow `YDv8SEZqn2ny0fCy` (B2B_Procesar_Orden_Compra_OpenAI)
- **Information Extractor**: Agregados 7 campos al schema (billing_type, requires_quotation, is_contract_required, has_advance_payment, advance_payment_amount, cfdi_use, fiscal_regime)
- **Preparar Payload Validación**: Mapeo de campos nuevos con normalización (PREFACTURA/TIMBRADO)
- **Formatear Respuesta Exitosa**: Re-inyección de campos de facturación post Edge Function (la Edge Function los filtraba)

#### 1c. Frontend: `PurchaseOrders.tsx`
- 4 toggles visuales en modal de detalle: Tipo Comprobante, Req. Cotización, Req. Contrato, Anticipo
- Colores: emerald (activo), amber (anticipo), slate (inactivo)
- Sección de Notas con icono StickyNote y formato pre-wrap
- Insert a DB incluye todos los campos nuevos

**Archivos**: `web/src/pages/PurchaseOrders.tsx`

---

## 2. Extracción de Archivos Excel en n8n

### Problema
El nodo "Excel a Texto" del workflow n8n producía filas vacías al procesar archivos .xlsx de OCs con formato libre (celdas combinadas, sin encabezados estándar). El nodo `Extract from File` de n8n genera columnas `__EMPTY`, `__EMPTY_1`, etc. y el filtro `!h.startsWith('_')` eliminaba TODAS las columnas.

### Solución
Reescritura del nodo "Excel a Texto" con detección inteligente de headers:
- **Headers reales** (no `__EMPTY`): formato markdown table estándar
- **Headers auto-generados** (`__EMPTY_*`): ordena por índice de columna, extrae valores no vacíos separados por `|`

**Archivo n8n**: Nodo `excel-to-text-001` en workflow `YDv8SEZqn2ny0fCy`

---

## 3. Fix: Insert de OC fallaba silenciosamente

### Problema
El insert a `purchase_orders` incluía `client_cp: quotation.client_cp` pero la columna `client_cp` NO existe en la tabla. Cuando el valor era `undefined`, JSON.stringify lo omitía (funcionaba). Cuando tenía valor real, Supabase retornaba error 400 (el insert fallaba sin crear registro).

### Solución
Eliminado `client_cp` del insert en `PurchaseOrders.tsx`.

---

## 4. Sidebar Expandible de Materialidad

### Problema
El sidebar era una lista plana sin jerarquía. Materialidad es el concepto madre que agrupa: Cotización → Contrato → OC → Facturación → Evidencia → Pagos.

### Solución
- **`materialityChildren`**: Array con 6 sub-items (Cotizaciones, Contratos, Órdenes Compra, Facturación, Evidencia, Pagos)
- **`materialityOpen` state**: Toggle expandir/colapsar con animación ChevronDown
- **Auto-expand**: Se expande automáticamente cuando la URL es de un child (ej. `/facturas`)
- **Renderizado dual**: Click en label → navega, click en chevron → toggle
- **Sub-items**: Padding izquierdo 44px, font 13px, borde izquierdo cyan activo

**Estructura del sidebar:**
```
Dashboard
▼ Materialidad (expandible)
  · Cotizaciones     → /cotizaciones
  · Contratos        → /contratos
  · Órdenes Compra   → /ordenes-compra
  · Facturación      → /facturas
  · Evidencia        → /evidencia
  · Pagos            → /pagos
Bancos
Reportes
Catálogos SAT
Configuración
Seguridad
```

**Archivo**: `web/src/App.tsx`

---

## 5. Nueva Pantalla: Pagos (`/pagos`)

### Descripción
Pantalla standalone para visualizar todos los pagos registrados de proformas de la organización.

### Características
- Query: `quotation_payments` con joins a `quotations` y `org_bank_accounts`
- Tabs de filtro: TODOS, VERIFICADO, PENDIENTE, RECHAZADO
- Tabla: Folio proforma, Cliente, Monto, Fecha, Forma de pago, Banco/Cuenta, Referencia, Estado, Comprobante
- Botón ver comprobante con URL firmada de Storage
- Mismos estilos visuales que Invoices.tsx y Evidence.tsx

**Archivo nuevo**: `web/src/pages/Pagos.tsx`
**Ruta**: `/pagos` registrada en `App.tsx`

---

## 6. Propagación OC → Proforma → MaterialityBoard (Fix Indicadores)

### Problema
Cuando una OC con `requires_quotation=true`, `billing_type=PREFACTURA`, `is_contract_required=true` se convertía en proforma, solo el indicador CONT (Contrato) se encendía en el MaterialityBoard. Los indicadores COT (Cotización), FACT (Factura) y EVI (Evidencia) permanecían apagados.

### Causa raíz
En `ProformaManager.tsx` líneas 1136-1138, el mapeo de campos OC → proforma era incompleto:

| Campo OC | Campo Proforma | Estado anterior |
|----------|---------------|-----------------|
| `requires_quotation` | `req_quotation` | NO SE MAPEABA |
| `billing_type` | `request_direct_invoice` | NO SE MAPEABA (buscaba campo inexistente) |
| `is_contract_required` | `is_contract_required` | OK |
| (ninguno) | `req_evidence` | NUNCA SE ASIGNABA |

### Solución
Agregados 3 mapeos en `ProformaManager.tsx:1138-1140`:
```typescript
request_direct_invoice: !!poData.billing_type || poData.request_direct_invoice || prev.request_direct_invoice,
req_quotation: poData.requires_quotation ?? prev.req_quotation,
req_evidence: poData.requires_quotation || poData.is_contract_required || !!poData.billing_type ? true : prev.req_evidence,
```

Ahora los 4 indicadores del MaterialityBoard se encienden correctamente cuando la OC los solicita.

**Archivo**: `web/src/components/commercial/ProformaManager.tsx`

---

## 7. Agente Proforma Deleter

### Descripción
Agente de Claude Code para eliminación segura de proformas con validación de dependencias fiscales.

### Reglas de negocio
- **BLOQUEA** si hay: factura timbrada (UUID), evidencia fotográfica, contrato con archivo, cotización formal
- **PERMITE** si solo hay solicitudes o prefacturas (se eliminan en cascada)
- **Pagos se conservan**: quedan con `quotation_id = NULL`, reasignables a otra proforma

### Flujo
1. Identificar proforma → 2. Escanear 5 dependencias → 3. Diagnóstico visual → 4. Ejecutar con confirmación → 5. Reportar resultado

**Archivo nuevo**: `.claude/agents/proforma-deleter.md`

---

## 8. Migración: FK Pagos CASCADE → SET NULL

### Problema
`quotation_payments.quotation_id` tenía `ON DELETE CASCADE`, lo que borraría los pagos al eliminar una proforma. El negocio requiere conservar los pagos.

### Solución
Migración `change_payments_fk_to_set_null`:
```sql
ALTER TABLE public.quotation_payments
  DROP CONSTRAINT quotation_payments_quotation_id_fkey;
ALTER TABLE public.quotation_payments
  ADD CONSTRAINT quotation_payments_quotation_id_fkey
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL;
```

---

## 9. Migraciones de Base de Datos (sesión completa)

| Migración | Descripción |
|-----------|-------------|
| `fix_purchase_orders_rls` | Corregir políticas RLS de purchase_orders |
| `allow_payments_without_proforma` | Permitir pagos sin proforma vinculada (RLS) |
| `add_billing_fields_to_purchase_orders` | billing_type, requires_quotation, has_advance_payment, advance_payment_amount |
| `change_payments_fk_to_set_null` | FK de pagos cambiada de CASCADE a SET NULL |

---

## 10. Archivos Modificados (31 archivos, +1084 -760 líneas)

### Nuevos
| Archivo | Descripción |
|---------|-------------|
| `web/src/pages/Pagos.tsx` | Pantalla de pagos |
| `.claude/agents/proforma-deleter.md` | Agente de borrado seguro |
| `.gitignore` | Exclusiones del proyecto |
| `CLAUDE.md` | Instrucciones del proyecto para Claude |
| `.mcp.json` | Configuración MCP (Supabase, n8n) |
| `docs/sistema/*.md` | Documentación del sistema (10 docs) |

### Modificados principales
| Archivo | Cambios |
|---------|---------|
| `web/src/App.tsx` | Sidebar expandible, rutas Pagos, structure materialityChildren |
| `web/src/pages/PurchaseOrders.tsx` | Toggles facturación, notas, fix client_cp, iconos |
| `web/src/components/commercial/ProformaManager.tsx` | Fix mapeo OC→Proforma (req_quotation, billing_type, req_evidence) |
| `web/src/components/commercial/MaterialityBoard.tsx` | Refactorización layout, colores, indicadores |
| `web/src/pages/Invoices.tsx` | Mejoras UI facturación |
| `web/src/pages/Contracts.tsx` | Mejoras UI contratos |
| `web/src/pages/Evidence.tsx` | Mejoras UI evidencia |
| `web/src/pages/QuotationRequests.tsx` | Mejoras UI cotizaciones |
| `web/src/index.css` | Variables CSS, estilos globales |
| `web/src/main.tsx` | Configuración inicial |
| `vercel.json` | Configuración de deploy |

### n8n Workflow `YDv8SEZqn2ny0fCy`
| Nodo | Cambio |
|------|--------|
| Excel a Texto | Reescrito para headers auto-generados (__EMPTY_*) |
| Information Extractor | +7 campos en schema (billing, quotation, contract, advance) |
| Preparar Payload Validación | Mapeo de campos nuevos |
| Formatear Respuesta Exitosa | Re-inyección de campos post Edge Function |

---

## Problemas Resueltos

| # | Problema | Causa | Solución |
|---|----------|-------|----------|
| 1 | Excel OC produce filas vacías | Filter `!startsWith('_')` eliminaba columnas `__EMPTY_*` | Detección inteligente de headers |
| 2 | Toggles facturación no aparecían en OC | Campos no existían en DB ni frontend | Migración + UI + n8n |
| 3 | Toggle PREFACTURA se veía inactivo | Color cyan no percibido como "activo" | Cambiado a emerald |
| 4 | Insert OC fallaba silenciosamente | `client_cp` no existe en tabla | Eliminado del insert |
| 5 | Solo CONT se prendía en MaterialityBoard | Mapeo OC→Proforma incompleto | +3 mapeos en ProformaManager |
| 6 | Pagos se borrarían al eliminar proforma | FK con CASCADE | Migración a SET NULL |
| 7 | n8n campos perdidos post Edge Function | Edge Function filtra campos desconocidos | Re-inyección desde payload previo |

---

## Estado de Compilación

- `npx tsc --noEmit` → Limpio (0 errores)
- Build de producción: pendiente verificación en Vercel post-push
