# Plan: Módulo Ordenes de Compra + Importación de Archivos

**Fecha:** 2026-03-25
**Estado:** Pendiente de autorización
**Prioridad:** Alta

---

## Contexto

La pantalla actual "Ordenes de Compra" (`/ordenes-compra`) maneja importación de archivos PDF/Excel para crear proformas vía OCR/IA. Se requiere:

1. Renombrarla a "Importación de Archivos" y agregar soporte para XML de facturas CFDI
2. Crear una nueva pantalla "Ordenes de Compra" para gestionar OC como ciclo de vida (similar a Contratos/Cotizaciones)
3. Agregar toggle de OC en la pantalla de Proforma
4. Activar el indicador O.C. en la pantalla de Materialidad

---

## Estado Actual del Sistema

| Elemento | Valor actual |
|---------|--------------|
| Ruta `/ordenes-compra` | Importación PDF/Excel → crea proformas |
| Toggles en Proforma | 4: Cotización, Contrato, Evidencia, Factura |
| Indicador O.C. en Materialidad | Existe visualmente pero sin datos |
| Tabla `purchase_orders` | OC importadas (origen externo, procesadas por n8n) |

---

## FASE 1 — Renombrar + Soporte XML (Importación de Archivos)

**Objetivo:** La pantalla actual pasa a llamarse "Importación de Archivos" y agrega soporte para XML CFDI.

### Cambios

1. Renombrar componente `PurchaseOrders.tsx` → `FileImport.tsx`
2. Cambiar ruta `/ordenes-compra` → `/importacion`
3. Actualizar título, ícono y entrada en navegación lateral
4. Ampliar input de archivo para aceptar `.xml` además de PDF/Excel
5. Detectar tipo de documento: XML → `FACTURA_XML`
6. Parsear XML CFDI para extraer: RFC Emisor/Receptor, Subtotal, IVA, Total, Conceptos, Fecha
7. Crear proforma automáticamente desde XML (igual que desde OC/Proforma)
8. Webhook n8n: agregar rama para `document_type = FACTURA_XML` (o parsear en frontend, ya que XML CFDI es estructurado)

### Archivos afectados

- `web/src/pages/PurchaseOrders.tsx` → renombrar + modificar
- `web/src/App.tsx` → cambiar ruta
- Componente de navegación lateral

---

## FASE 2 — Base de Datos

### Nueva tabla `purchase_order_requests`

Modelo similar a `contracts`. Representa una solicitud de OC vinculada a una proforma.

```sql
CREATE TABLE purchase_order_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        REFERENCES organizations(id),
  quotation_id      UUID        REFERENCES quotations(id),
  status            VARCHAR(50) DEFAULT 'solicitada',
    -- valores: 'solicitada' | 'autorizada' | 'rechazada'
  file_url          TEXT,           -- PDF de la OC subido
  po_number         TEXT,           -- Número de OC asignado
  comments          TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

### Nuevas columnas en `quotations`

```sql
ALTER TABLE quotations
  ADD COLUMN req_purchase_order    BOOLEAN     DEFAULT false,
  ADD COLUMN purchase_order_status VARCHAR(50);
  -- valores: 'solicitada' | 'autorizada' | 'rechazada'
```

### RLS

Seguir el patrón de `contracts`: acceso solo para usuarios de la misma `organization_id`.

### Archivo de migración

`supabase/migrations/YYYYMMDD_purchase_order_requests.sql`

---

## FASE 3 — Nueva Pantalla "Ordenes de Compra"

**Ruta:** `/ordenes-compra`
**Componente:** `web/src/pages/PurchaseOrderRequests.tsx`
**Referencia de diseño:** `Contracts.tsx` y `Quotations.tsx`

### Funcionalidades

- Lista de solicitudes de OC agrupadas o filtradas por proforma
- Filtros por tab: TODAS | SOLICITADA | AUTORIZADA | RECHAZADA
- Card por solicitud mostrando: número de proforma, cliente, monto, fecha, estado
- Vista detalle de una solicitud:
  - Datos de la proforma vinculada (solo lectura)
  - Upload de PDF de la OC
  - Campo para número de OC
  - Campo para comentarios
  - Botón **"Marcar Autorizada"** → estado `autorizada`, guarda `file_url` y `po_number`
  - Botón **"Rechazar"** → estado `rechazada`, requiere comentario obligatorio
- Descarga del PDF subido
- Indicador visual de estado con colores

### Flujo de estados

```
Toggle activado en Proforma
        ↓
   [solicitada]  ← estado inicial
        ↓
  Subir PDF en pantalla OC
        ↓
  ┌─────────────┬──────────────┐
  ↓             ↓
[autorizada]  [rechazada]
```

---

## FASE 4 — Toggle de OC en Proforma

**Archivo:** `web/src/components/commercial/ProformaManager.tsx`

### Nuevo 5to toggle en la sección de configuración

```
┌────────────┬────────────┬────────────┬────────────┬────────────┐
│ Cotización │  Contrato  │ Evidencia  │  Factura   │    O.C.    │
└────────────┴────────────┴────────────┴────────────┴────────────┘
```

### Comportamiento

| Acción | Resultado |
|--------|-----------|
| Activar (OFF → ON) | INSERT en `purchase_order_requests` con `status = 'solicitada'` |
| Desactivar (ON → OFF) | DELETE del registro con confirmación del usuario |
| Estado `autorizada` | Toggle disabled, no se puede desactivar |

### Lógica `handlePurchaseOrderToggle`

```typescript
const handlePurchaseOrderToggle = async (val: boolean) => {
  if (val) {
    const { data } = await supabase
      .from('purchase_order_requests')
      .insert({
        organization_id: selectedOrg.id,
        quotation_id: id,
        status: 'solicitada'
      })
      .select()
      .single();

    setFormData({
      ...formData,
      req_purchase_order: true,
      purchase_order_status: 'solicitada'
    });

    await supabase
      .from('quotations')
      .update({
        req_purchase_order: true,
        purchase_order_status: 'solicitada'
      })
      .eq('id', id);

  } else {
    // Mostrar confirmación antes de eliminar
    const confirm = window.confirm('¿Eliminar la solicitud de OC?');
    if (!confirm) return;

    await supabase
      .from('purchase_order_requests')
      .delete()
      .eq('quotation_id', id);

    setFormData({
      ...formData,
      req_purchase_order: false,
      purchase_order_status: null
    });
  }
};
```

### Etiquetas de estado en toggle

| Estado | Color | Texto |
|--------|-------|-------|
| `solicitada` | amber | solicitada |
| `autorizada` | emerald | autorizada |
| `rechazada` | red | rechazada |

---

## FASE 5 — Indicador O.C. en Materialidad

**Archivo:** `web/src/components/commercial/MaterialityBoard.tsx`

El indicador `O.C.` ya existe visualmente. Se conecta a los nuevos datos.

### Función de color

```typescript
const getPurchaseOrderColor = (status: string): string | null => {
  if (status === 'solicitada') return 'amber-500/20';
  if (status === 'autorizada') return 'emerald-500/20';
  if (status === 'rechazada')  return 'red-500/20';
  return null;
};
```

### Integración en `getMaterialityStatus`

```typescript
const hasPO = q.req_purchase_order === true && !!q.purchase_order_status;
const purchaseOrderStatus = q.purchase_order_status || null;
```

### Query — incluir datos de OC en el fetch de materialidad

Agregar `purchase_order_requests(id, status)` al select de quotations.

---

## FASE 6 — Navegación Lateral

Actualizar el componente de sidebar para reflejar los nuevos nombres y rutas:

| Entrada | Ruta | Ícono sugerido |
|---------|------|----------------|
| Importación de Archivos | `/importacion` | `upload_file` (Material Symbols) |
| Ordenes de Compra | `/ordenes-compra` | `shopping_bag` o `receipt_long` |

---

## Resumen de Archivos

| Archivo | Acción | Fase |
|---------|--------|------|
| `supabase/migrations/XXXXXX_purchase_order_requests.sql` | CREAR | 2 |
| `web/src/pages/PurchaseOrders.tsx` | RENOMBRAR → `FileImport.tsx` + modificar | 1 |
| `web/src/pages/PurchaseOrderRequests.tsx` | CREAR | 3 |
| `web/src/App.tsx` | MODIFICAR rutas | 1, 3 |
| Sidebar / Nav component | MODIFICAR entradas | 6 |
| `web/src/components/commercial/ProformaManager.tsx` | MODIFICAR 5to toggle | 4 |
| `web/src/components/commercial/MaterialityBoard.tsx` | MODIFICAR indicador O.C. | 5 |

---

## Orden de Ejecución

```
Fase 2 → BD y migración (base de todo)
Fase 1 → Renombrar FileImport + XML
Fase 3 → Nueva pantalla PurchaseOrderRequests
Fase 6 → Rutas + Navegación
Fase 4 → Toggle en ProformaManager
Fase 5 → Indicador en MaterialityBoard
```

---

## Preguntas Pendientes de Resolución

1. **Parseo XML**: ¿Frontend (JS puro) o webhook n8n?
2. **Creación manual de OC**: ¿La nueva pantalla permite crear OC sin que venga de toggle de proforma?
3. **Autorización de OC**: ¿Solo usuarios internos pueden autorizar/rechazar, o también el cliente externo?

---

## Referencias

- Diseño de referencia: [Contracts.tsx](../../web/src/pages/Contracts.tsx)
- Toggles actuales: [ProformaManager.tsx](../../web/src/components/commercial/ProformaManager.tsx)
- Indicadores materialidad: [MaterialityBoard.tsx](../../web/src/components/commercial/MaterialityBoard.tsx)
- Migración base: [supabase/migrations/20260220_purchase_orders_module.sql](../../supabase/migrations/20260220_purchase_orders_module.sql)
