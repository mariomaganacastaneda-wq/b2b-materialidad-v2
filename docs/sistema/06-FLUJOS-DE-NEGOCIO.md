# 06 - Flujos de Negocio

## 1. Flujo de Materialidad (Proceso Principal)

La materialidad es el concepto central del sistema: **demostrar que una operación comercial realmente ocurrió** para blindaje fiscal ante el SAT.

### Los 7 Gatillos de Materialidad

```
┌─────────────────────────────────────────────────────────────┐
│                    TABLERO DE MATERIALIDAD                    │
│                                                               │
│  Proforma   O.C.   COT   CONT   FACT   PAGO   EVI          │
│  ─────────  ────   ────  ────   ────   ────   ────          │
│  PRF-001     ✅     ✅    ✅     ✅    100%    ✅  ← COMPLETA │
│  PRF-002     ✅     ✅    ⏳     ✅     50%    ❌  ← PARCIAL  │
│  PRF-003     ✅     ✅    ❌     ❌      0%    ❌  ← INICIO   │
└─────────────────────────────────────────────────────────────┘
```

| Gatillo | Significado | Cómo se cumple |
|---------|-------------|----------------|
| **O.C.** | Orden de Compra | Existe una OC vinculada a la proforma |
| **COT** | Cotización/Solicitud | Existe solicitud de cotización registrada |
| **CONT** | Contrato | Contrato firmado y vinculado |
| **FACT** | Factura | Factura CFDI emitida y timbrada |
| **PAGO** | Pago | Porcentaje de pago verificado (0%, 50%, 100%) |
| **EVI** | Evidencia | Fotos/documentos de entrega cargados |

### Flujo completo:

```
Solicitud de Cotización
       │
       ▼
   Proforma ──────────── Contrato (si aplica)
       │                      │
       ▼                      ▼
  Orden de Compra ──── Factura CFDI
       │                      │
       ▼                      ▼
   Evidencia ────────── Pago Verificado
       │
       ▼
  ✅ MATERIALIDAD COMPLETA
  (Expediente listo para auditoría SAT)
```

---

## 2. Flujo de Facturación CFDI

### Estados de una factura:

```
SOLICITUD
    │ (Se genera solicitud de factura)
    ▼
PREFACTURA_PENDIENTE
    │ (Se sube PDF de prefactura)
    ▼
EN_REVISION_VENDEDOR
    │ (Vendedor revisa y aprueba/rechaza)
    ├──→ RECHAZADA (si hay errores → vuelve a SOLICITUD)
    ▼
VALIDADA
    │ (Datos correctos, lista para timbrado)
    ▼
TIMBRADA ← Estado final exitoso
    │
    └──→ CANCELADA (si se cancela ante SAT)
```

### Archivos por factura:
1. **Prefactura PDF** - Borrador de la factura
2. **XML CFDI** - Comprobante fiscal digital (estructura SAT)
3. **Factura PDF timbrada** - Documento final con sello SAT

### Tabla de responsabilidades:
| Acción | Responsable |
|--------|------------|
| Solicitar factura | VENDEDOR, ADMIN |
| Subir prefactura | FACTURACION |
| Revisar prefactura | VENDEDOR |
| Aprobar/rechazar | VENDEDOR, ADMIN |
| Timbrar | FACTURACION |
| Cancelar | ADMIN |

---

## 3. Flujo de Órdenes de Compra

### Procesamiento automático con IA:

```
Cliente envía PDF de OC
        │
        ▼
  Usuario sube PDF al sistema
        │
        ▼
  n8n webhook (process-po-pdf)
        │ → OCR + IA extrae datos:
        │   - po_number, emission_date
        │   - client_rfc, client_name
        │   - items (producto SAT, qty, precio)
        │   - validation_messages
        ▼
  Datos se insertan en DB
  (purchase_orders + purchase_order_items)
        │
        ▼
  Usuario revisa y valida datos extraídos
        │
        ├──→ Corregir datos manualmente (si hay errores OCR)
        │
        ▼
  Convertir a Proforma
        │ → Se crea quotation automáticamente
        │   con datos de la OC
        ▼
  Proforma lista para continuar flujo
```

### Datos extraídos por IA:
- Número de OC
- Fecha de emisión
- Moneda (MXN/USD)
- RFC y nombre del cliente
- Dirección del cliente
- Organización emisora (buscada por RFC)
- Partidas: clave SAT, cantidad, precio unitario, IVA, IEPS
- Mensajes de validación (conformidad)

---

## 4. Flujo de Cotizaciones/Proformas

```
Solicitud de Cotización (QuotationRequests)
        │
        ▼
  Vendedor recibe solicitud
        │
        ▼
  Crear Proforma (ProformaManager)
        │ → Seleccionar productos SAT (inteligente)
        │ → Calcular montos (subtotal, IVA, IEPS, total)
        │ → Definir si requiere contrato
        ▼
  Proforma creada (status: PENDIENTE)
        │
        ├──→ ACEPTADA (cliente acepta)
        │       │
        │       ▼
        │    Continuar con materialidad
        │    (contrato, factura, evidencia...)
        │
        ├──→ RECHAZADA (cliente rechaza)
        │
        └──→ EXPIRADA (pasó el tiempo)
```

### Selector Inteligente de Productos:
1. **Smart Tags**: Palabras clave extraídas de productos de la actividad económica
2. **Tags guardados**: Persistencia en localStorage por usuario/actividad
3. **Búsqueda inversa**: Detecta actividades por palabras clave
4. **Búsqueda semántica**: RPC `search_productos_sat` (Full Text Search)
5. **Multi-fuente**: Actividad base → Búsqueda inversa → Global SAT

---

## 5. Flujo de Evidencia

```
Proforma ACEPTADA
        │
        ▼
  Cargar evidencia fotográfica
        │ → Fotos de obra/entrega
        │ → Fotos de reuniones
        │ → Documentos de soporte
        │ → Actas de entrega
        ▼
  Asociar a proforma y/o factura
        │
        ▼
  Validar completitud
        │ → ¿Hay suficiente evidencia?
        │ → ¿Las fechas coinciden?
        │ → ¿Los metadatos son correctos?
        ▼
  ✅ Gatillo EVI cumplido en Materialidad
```

### Metadatos de evidencia:
- Fecha de captura
- Descripción del evento
- Tipo de evidencia
- Vinculación a proforma/factura

---

## 6. Flujo de Contratos

```
Proforma con is_contract_required = true
        │
        ▼
  Crear contrato en el sistema
        │
        ▼
  Subir PDF del contrato (status: en_revision)
        │
        ▼
  Revisión y firma
        │ → Firma digital o manual
        │ → NOM-151 (fecha cierta)
        ▼
  Contrato firmado (status: firmado)
        │
        ▼
  Completado (status: completado)
        │
        ▼
  ✅ Gatillo CONT cumplido en Materialidad
```

### NOM-151:
- Establece **fecha cierta** del contrato
- Trazabilidad inmutable con timestamps
- Requerido para blindaje fiscal completo

---

## 7. Flujo de Pagos

```
Factura TIMBRADA
        │
        ▼
  Cliente realiza pago
        │
        ▼
  Registrar pago en el sistema
        │ → Seleccionar cuenta bancaria destino
        │ → Monto, fecha, método, referencia
        │ → Subir comprobante de pago
        ▼
  Pago registrado (status: PENDIENTE)
        │
        ▼
  Verificación por CXC/ADMIN
        │
        ├──→ VERIFICADO ✅ → Gatillo PAGO avanza
        │
        └──→ RECHAZADO ❌ → Se notifica al vendedor
```

### Porcentajes de pago en Materialidad:
- **0%** - Sin pagos verificados
- **50%** - Pago parcial
- **100%** - Pago completo (gatillo cumplido)

---

## 8. Flujo de Carga Masiva CSF

```
Usuario selecciona múltiples PDFs de CSF
        │
        ▼
  Por cada PDF:
        │ → Validar que sea PDF
        │ → Subir a Storage (bucket csf)
        │ → Invocar Edge Function process-csf
        │     → Extrae: RFC, nombre, régimen, actividades
        │ → Si organización no existe → Crearla
        │ → Guardar en organization_csf_history
        ▼
  Resumen: X éxitos / Y errores
        │
        ▼
  Organizaciones creadas/actualizadas automáticamente
```
