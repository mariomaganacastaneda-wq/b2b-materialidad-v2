# 10 - Diagnóstico: Flujo Orden de Compra → Proforma

## Fecha del diagnóstico: 2026-02-27

## Resumen

Auditoría completa del flujo de procesamiento de Órdenes de Compra y su conversión a Proformas. Se analizaron 3 fuentes: workflow n8n, código frontend, y datos en Supabase.

---

## 1. Arquitectura del Flujo

### Pipeline completo:

```
PDF subido en pantalla OC
        │
        ▼
n8n webhook: POST /webhook/process-po-pdf
        │
        ▼
Extract from File (PDF → texto)
        │
        ▼
Information Extractor (GPT-4.1-mini)
  → Schema: supplier_rfc, supplier_name, buyer_rfc, buyer_name, line_items...
        │
        ▼
Code Node: "Preparar Payload Validación"
  → Mapea: supplier → issuer, buyer → client
        │
        ▼
HTTP Request: Edge Function validate-enrich-proforma
  → Busca organizaciones por RFC
  → Enriquece con datos SAT
  → Resuelve claves SAT para items
        │
        ▼
IF: ¿Validación OK?
  ├── SI → Formatear Respuesta Exitosa → Respond OK (200)
  └── NO → Formatear Respuesta Error → Respond Error (400)
        │
        ▼
PurchaseOrders.tsx recibe JSON
  → Inserta en purchase_orders + purchase_order_items
        │
        ▼
Usuario presiona "Convertir en Proforma"
  → navigate('/cotizaciones/nueva?po_full=...')
        │
        ▼
ProformaManager.tsx (DEBERÍA recibir datos)
  → Lee po_full del query string
  → Crea quotation en DB
```

### Workflow n8n: B2B_Procesar_Orden_Compra_OpenAI
- **ID**: YDv8SEZqn2ny0fCy
- **Estado**: ACTIVO
- **Modelo IA**: GPT-4.1-mini (OpenAI, temperatura 0.1)
- **Nodos**: 11 (Webhook, Extract PDF, Information Extractor, OpenAI Model, Code, HTTP, IF, 2x Format, 2x Respond)
- **Versiones**: 45 revisiones

---

## 2. Mapeo de Roles: Quién es Quién

### En el documento fuente (OC/Proforma):
| Concepto | En una OC | En una Proforma |
|----------|-----------|-----------------|
| **Supplier** | Quien recibe la OC y entregará el servicio | Quien emite la proforma |
| **Buyer** | Quien emite la OC y pagará | A quien va dirigida la proforma |

### En n8n (extracción IA):
| Campo n8n | Significado |
|-----------|-------------|
| `supplier_rfc` / `supplier_name` | Proveedor (quien entrega servicio) |
| `buyer_rfc` / `buyer_name` | Comprador (quien paga) |

### En el Code Node "Preparar Payload":
| Campo entrada | Campo salida | Significado |
|---------------|-------------|-------------|
| `supplier_rfc` | `issuer_rfc` | RFC del proveedor → "emisor" |
| `supplier_name` | `issuer_name` | Nombre del proveedor → "emisor" |
| `buyer_rfc` | `client_rfc` | RFC del comprador → "cliente" |
| `buyer_name` | `client_name` | Nombre del comprador → "cliente" |

### En PurchaseOrders.tsx (al guardar en DB):
| Campo DB | Fuente | Significado |
|----------|--------|-------------|
| `issuer_org_id` | Lookup por `quotation.client_rfc` | Quien EMITE la OC (cliente externo) |
| `client_org_id` | `selectedOrg.id` | Quien RECIBE la OC (nosotros) |
| `client_name` | `quotation.client_name` | Texto libre del emisor de OC |
| `client_rfc` | `quotation.client_rfc` | RFC del emisor de OC |

### En quotations (Proformas):
| Campo DB | Significado |
|----------|-------------|
| `organization_id` | Quien emite la proforma (nosotros) |
| `client_rfc` | A quien va dirigida la proforma |
| `client_name` | Nombre del destinatario |

---

## 3. Bugs Encontrados

### BUG 1 - CRÍTICO: Ruta de navegación incorrecta
- **Archivo**: `web/src/pages/PurchaseOrders.tsx`, línea ~273
- **Problema**: `navigate('/cotizaciones/nueva?po_full=...')` navega al componente equivocado
- **Causa**: La ruta `/cotizaciones/nueva` matchea con `/cotizaciones/:id` que renderiza `QuotationRequests`, NO `ProformaManager`
- **Impacto**: La conversión OC→Proforma está 100% rota. Los datos se pierden.
- **Corrección**: Cambiar a `navigate('/proformas/nueva?po_full=...')`

### BUG 2 - CRÍTICO: IA invierte roles emisor/cliente
- **Archivo**: Workflow n8n `YDv8SEZqn2ny0fCy`, nodo "Information Extractor"
- **Problema**: Al procesar "Preforma SEIDCO LT FASHION", GPT-4.1-mini extrae:
  - supplier = LT FASHION (INCORRECTO, debería ser SEIDCO)
  - buyer = SEIDCO (INCORRECTO, debería ser LT FASHION)
- **Causa**: El prompt del IA está optimizado para OCs, no proformas. La estructura visual del PDF confunde los roles.
- **Impacto**: Todos los datos downstream se invierten.

### BUG 3 - ALTO: Edge Function produce resultados inconsistentes
- **Servicio**: Edge Function `validate-enrich-proforma`
- **Problema**: Mismos datos de entrada → diferentes clientes resueltos
  - Ejecución 84209: Resuelve cliente = SEIDCO (SSI101213VD1)
  - Ejecución 84215: Resuelve cliente = DEMO CLIENTE DIEZ (CLIE000110XXX)
- **Causa probable**: Lógica de fuzzy matching o fallback inconsistente en la búsqueda por nombre

### BUG 4 - ALTO: RLS permisiva en purchase_orders
- **Tabla**: `purchase_orders`
- **Política**: `Permitir todo a usuarios autenticados PO` con condición `true`
- **Impacto**: Sin aislamiento multi-tenant. Cualquier usuario ve todas las OCs.

### BUG 5 - MEDIO: Navegación interna rota en ProformaManager
- **Archivo**: `web/src/components/commercial/ProformaManager.tsx`
- **Líneas afectadas**:
  - ~1495 (`handleDuplicate`): usa `/cotizaciones/nueva` → debería ser `/proformas/nueva`
  - ~1752 (post-guardado): usa `/cotizaciones/${id}` → debería ser `/proformas/${id}`

### BUG 6 - MEDIO: OC no actualiza status al convertir
- **Archivo**: `web/src/pages/PurchaseOrders.tsx`
- **Problema**: `handleConvertToProforma()` navega sin actualizar el `status` de la OC a `CONVERTED_TO_PROFORMA`
- **Impacto**: Se puede convertir la misma OC múltiples veces

---

## 4. Datos de Prueba en Supabase

### Organizaciones involucradas:
| Organización | RFC | ID (parcial) |
|-------------|-----|---------------|
| SEIDCO | SSI101213VD1 | 573a0822... |
| LT FASHION | LFA140313H67 | 5e083b98... |
| GRUPO CONSTRUCTOR SEIDCO-ALUBAC | GCS231006DE8 | e582667a... |

### OCs creadas durante pruebas (2026-02-27):
| OC | Issuer | Client Org | Client RFC en texto | Anomalía |
|----|--------|-----------|--------------------|-----------|
| c4cb05e9 | SEIDCO | DEMO EMISORA | SSI101213VD1 (SEIDCO) | Issuer y client_rfc son la misma org |
| 557ccd30 | DEMO CLIENTE | SEIDCO | CLIE000110XXX | client_org_id≠client_rfc data |

### Ejecuciones n8n recientes:
| ID | Hora | Status | Resultado |
|----|------|--------|-----------|
| 84209 | 17:59 | success | issuer=LT FASHION, client=SEIDCO |
| 84214 | 18:07 | success | (misma OC) |
| 84215 | 18:11 | success | issuer=LT FASHION, client=DEMO CLIENTE |

---

## 5. Recomendaciones de Corrección

### Prioridad 1 (Bloqueantes):
1. **Corregir ruta**: `PurchaseOrders.tsx:273` → `/proformas/nueva?po_full=...`
2. **Mejorar prompt IA**: Agregar detección de tipo de documento (OC vs Proforma) con mapeo de roles correspondiente

### Prioridad 2 (Importantes):
3. **Auditar Edge Function**: Revisar lógica de `validate-enrich-proforma` para búsqueda consistente
4. **Implementar RLS**: Filtrar `purchase_orders` por `issuer_org_id` o `client_org_id` según `organization_id` del usuario
5. **Corregir navegación ProformaManager**: Líneas ~1495 y ~1752

### Prioridad 3 (Mejoras):
6. **Actualizar status OC**: Añadir `UPDATE purchase_orders SET status='CONVERTED_TO_PROFORMA'` antes de navegar
7. **Añadir campos issuer_rfc/issuer_name**: Simetría en tabla `purchase_orders` (actualmente solo existen client_rfc/client_name)
8. **Revisar rol ADMIN_COPY_793**: Parece artefacto de clonación

---

## 6. Workflow n8n Detallado

### Prompt del System (Information Extractor):
El prompt identifica 2 actores en una OC:
- **COMPRADOR/CLIENTE (buyer)**: Empresa grande que emite la OC
- **PROVEEDOR/SUPPLIER (supplier)**: Empresa que recibe la OC y facturará

### Mapeo en Code Node "Preparar Payload Validación":
```javascript
issuer_rfc = extracted.supplier_rfc    // proveedor → emisor
issuer_name = extracted.supplier_name
client_rfc = extracted.buyer_rfc       // comprador → cliente
client_name = extracted.buyer_name
```

### Notas construidas:
```
"Origen: {tipo} #{número} | Fecha doc: {fecha}"
"Condiciones de pago: {payment_terms}"
"{notes del documento}"
```

---

## 7. Correcciones Aplicadas (2026-02-27)

### BUG 1 - CORREGIDO: Ruta de navegación
- **Archivo**: `web/src/pages/PurchaseOrders.tsx`, línea ~273
- **Cambio**: `navigate('/cotizaciones/nueva?po_full=...')` → `navigate('/proformas/nueva?po_full=...')`
- **Resultado**: La conversión OC→Proforma ahora llega correctamente al ProformaManager

### BUG 2 - CORREGIDO: Prompt IA en n8n
- **Workflow**: `B2B_Procesar_Orden_Compra_OpenAI` (YDv8SEZqn2ny0fCy)
- **Nodo**: Information Extractor (bc2d3a95...)
- **Cambio**: System prompt actualizado con detección de tipo de documento:
  - Paso 1: Identifica si es OC, Proforma/Cotización, Factura u Otro
  - Paso 2: Mapea roles según el tipo (supplier/buyer) con ejemplos concretos
  - Soporta: Órdenes de compra, proformas, cotizaciones y facturas
- **Resultado**: La IA ahora identifica correctamente quién es proveedor y quién es comprador en cualquier tipo de documento

### BUG 3 - CORREGIDO: Edge Function inconsistente
- **Función**: `validate-enrich-proforma` (v5 → v6)
- **Cambios**:
  - Nueva función `extractOrgKeywords()`: extrae palabras clave significativas eliminando sufijos legales (SA, DE, CV, etc.)
  - Nueva función `searchOrgByName()`: búsqueda robusta multi-estrategia
    1. Busca por keyword principal con scoring de overlap
    2. Fallback a nombre truncado
  - `resolveIssuer()` y `resolveClient()` actualizados para usar keyword matching
- **Resultado**: La búsqueda por nombre ahora es consistente: "SEIDCO Servicio de ingenieria..." y "SEIDCO SERVICIOS DE INGENIERIA..." ambos resuelven la misma organización

### BUG 4 - CORREGIDO: RLS en purchase_orders
- **Migración**: `fix_purchase_orders_rls`
- **Cambios**:
  - Eliminada política permisiva `true` de `purchase_orders` y `purchase_order_items`
  - Nueva política: Admins pueden gestionar todo (`get_current_user_role() = 'ADMIN'`)
  - Nueva política: Tenant isolation por `issuer_org_id` OR `client_org_id`
  - Items aislados vía join con `purchase_orders`
- **Resultado**: Aislamiento multi-tenant aplicado. Usuarios solo ven OCs de sus organizaciones.

### BUG 5 - CORREGIDO: Navegación interna en ProformaManager
- **Archivo**: `web/src/components/commercial/ProformaManager.tsx`
- **Cambios**:
  - Línea ~1495: `navigate('/cotizaciones/nueva')` → `navigate('/proformas/nueva')`
  - Línea ~1752: `navigate('/cotizaciones/${id}')` → `navigate('/proformas/${id}')`
- **Resultado**: Duplicar y guardar proformas mantiene al usuario en el flujo correcto

### BUG 6 - CORREGIDO: Status OC al convertir
- **Archivo**: `web/src/pages/PurchaseOrders.tsx`
- **Cambio**: `handleConvertToProforma()` ahora es `async` y actualiza `status = 'CONVERTED_TO_PROFORMA'` antes de navegar
- **Resultado**: Las OCs convertidas cambian de estado, previniendo conversiones duplicadas

### Resumen de archivos modificados:
| Archivo/Servicio | Tipo de cambio |
|-----------------|----------------|
| `web/src/pages/PurchaseOrders.tsx` | Ruta + status update |
| `web/src/components/commercial/ProformaManager.tsx` | 2 rutas internas |
| n8n workflow `YDv8SEZqn2ny0fCy` | System prompt (v45→v46) |
| Edge Function `validate-enrich-proforma` | Búsqueda robusta (v5→v6) |
| Supabase migration `fix_purchase_orders_rls` | Políticas RLS |
