# Módulo: Órdenes de Compra y Materialidad

**Versión:** 1.0 | **Fecha:** 2026-03-25 | **Autor:** Claude Code

---

## Arquitectura del Módulo

### Pantallas

| Ruta | Componente | Descripción |
|---|---|---|
| `/importacion` | `FileImport.tsx` | Importa PDF/Excel/XML CFDI → crea registros en `purchase_orders` |
| `/ordenes-compra` | `PurchaseOrderRequests.tsx` | Gestión del ciclo de vida de OC solicitadas desde proformas |

### Ciclo de Vida OC (solicitada desde ProformaManager)

```
Toggle O.C. ON → status: "solicitada"
   ↓ (usuario sube PDF en pantalla OC)
status: "emitida"
   ↓ (cliente autoriza)         ↓ (cliente rechaza)
status: "autorizada"         status: "rechazada"
```

### Tablas Involucradas

| Tabla | Propósito |
|---|---|
| `purchase_orders` | Registros importados desde FileImport (PDF/Excel/XML) |
| `purchase_order_items` | Líneas/conceptos de cada importación |
| `purchase_order_requests` | OC solicitadas desde el toggle en ProformaManager |
| `quotations` | Columnas `req_purchase_order` y `purchase_order_status` |

---

## Parser CFDI 4.0

### Campos Extraídos del XML

**Nodo `cfdi:Comprobante`**
- `TipoDeComprobante` — validación obligatoria (solo "I" pasa)
- `Fecha` → `cfdi_fecha_emision`
- `LugarExpedicion` → `cfdi_lugar_expedicion`
- `SubTotal`, `Total`, `Descuento` → montos
- `Moneda`, `TipoCambio` → divisa
- `MetodoPago`, `FormaPago` → condiciones de pago
- `CondicionesDePago` → `notes`
- `Exportacion` → advertencia si es exportación

**Nodo `cfdi:Emisor`**
- `Rfc` → `issuer_rfc` (validación contra organización seleccionada)
- `Nombre` → `issuer_name`
- `RegimenFiscal` → `cfdi_emisor_regimen`

**Nodo `cfdi:Receptor`**
- `Rfc` → `client_rfc`
- `Nombre` → `client_name`
- `RegimenFiscalReceptor` → `client_regime_code`
- `DomicilioFiscalReceptor` → `client_postal_code` ← nuevo en CFDI 4.0
- `UsoCFDI` → `usage_cfdi_code`

**Nodo `tfd:TimbreFiscalDigital`**
- `UUID` → `cfdi_uuid` (deduplicación — índice único en BD)
- `FechaTimbrado` → `cfdi_fecha_timbrado`
- `NoCertificadoSAT` → auditoría

**Por cada `cfdi:Concepto`**
- `ClaveProdServ` → `code`
- `NoIdentificacion` → `item_code` (fallback a ClaveProdServ)
- `Descripcion`, `Cantidad`, `ClaveUnidad`, `ValorUnitario`
- `Descuento` → descuento por línea
- `ObjetoImp` → objeto de impuesto
- Traslados: `002`=IVA → `has_iva`, `003`=IEPS → `has_ieps`
- Retenciones: `001`=ISR → `has_isr`

**Nodo `cfdi:Impuestos` (global)**
- `TotalImpuestosRetenidos` → `amount_retenciones`

### Validaciones del Parser

1. **Tipo de comprobante**: Solo `I` (Ingreso) puede crear proforma. E/T/N/P → error con nombre del tipo
2. **Deduplicación UUID**: Si `cfdi_uuid` ya existe en `purchase_orders` → alerta, no inserta
3. **RFC**: El RFC del emisor o receptor debe coincidir con la organización seleccionada
4. **Contraparte desconocida**: Si el otro RFC no existe en la BD → alerta para crearlo

---

## MaterialityBoard — Lógica de Indicadores (Fix B+C)

Todos los indicadores siguen el mismo patrón:

```
activo = toggle_field === true
status = toggle_field ? (status_field || 'estado_inicial') : null
```

| Indicador | Toggle | Status field | Fallback inicial |
|---|---|---|---|
| O.C. | `req_purchase_order` | `purchase_order_status` | `'solicitada'` |
| COT | `req_quotation` | `quotation_lifecycle` | `'solicitud'` |
| CONT | `is_contract_required` | `contract_status` / `lifecycle_status` | `'requerido'` |
| EVI | `req_evidence` | `evidence_status` | `'solicitada'` |
| FACT | `request_direct_invoice` | `invoice_status` | `'SOLICITUD'` |

---

## ProformaManager — Toggles de Configuración

Orden actual (izquierda a derecha):

| # | Label | Toggle field | Status field |
|---|---|---|---|
| 1 | Cotización | `req_quotation` | `related_quotation_status` |
| 2 | O.C. | `req_purchase_order` | `purchase_order_status` |
| 3 | Contrato | `is_contract_required` | `contract_status` |
| 4 | Evidencia | `req_evidence` | `evidence_status` |
| 5 | Factura | `request_direct_invoice` | `invoice_status` |

**Estados visuales del ConfigToggle:**
- `disabled=false, checked=false` → gris "OFF"
- `disabled=false, checked=true` → cyan "ON"
- `disabled=true, checked=true` → esmeralda "OK" (bloqueado porque ya está completado)

---

## Columnas CFDI en `purchase_orders`

```sql
cfdi_uuid             TEXT        -- UUID único, índice UNIQUE WHERE NOT NULL
cfdi_tipo_comprobante CHAR(1)     -- I/E/T/N/P
cfdi_fecha_emision    TIMESTAMPTZ -- fecha del XML
cfdi_fecha_timbrado   TIMESTAMPTZ -- fecha certificación SAT
cfdi_lugar_expedicion VARCHAR(10) -- CP del emisor
cfdi_emisor_regimen   VARCHAR(10) -- régimen fiscal del emisor
amount_descuento      DECIMAL     -- descuento global del comprobante
amount_retenciones    DECIMAL     -- total retenciones ISR
client_postal_code    VARCHAR(10) -- CP fiscal del receptor
```
