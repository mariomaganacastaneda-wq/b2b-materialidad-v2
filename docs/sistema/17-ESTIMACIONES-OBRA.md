# Módulo: Estimaciones de Obra

**Versión:** 1.0 | **Fecha:** 2026-04-15 | **Autor:** Claude Code

---

## Resumen

Módulo para gestión de obras civiles o de construcción con flujo completo:
presupuesto → estimaciones periódicas → generación de proformas.
Soporta importación de presupuesto desde Excel, captura manual de volúmenes ejecutados,
amortización de anticipo y trabajos adicionales.

**Ruta:** `/estimaciones-obra`
**Componente:** `web/src/pages/WorkEstimations.tsx`

---

## Flujo General

```
Excel de presupuesto
        |
        v
  work_budgets            <-- Presupuesto maestro de la obra
  work_budget_items       <-- Partidas y conceptos con precios unitarios
        |
        v
  work_estimations        <-- Estimación periódica (mensual o por avance)
  work_estimation_items   <-- Volumen ejecutado por concepto en esa estimación
        |
        v
  quotations              <-- Proforma generada desde la estimación
        |
        v
  [documento HTML / PDF enviado al cliente]
```

---

## Tablas de Base de Datos

### `work_budgets`

Presupuesto maestro de una obra. Un cliente puede tener múltiples presupuestos.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | Identificador |
| `organization_id` | UUID FK | Organización emisora |
| `client_org_id` | UUID FK | Cliente (organización) |
| `nombre_obra` | TEXT | Nombre descriptivo de la obra |
| `descripcion` | TEXT | Descripción libre |
| `monto_total` | DECIMAL | Suma total del presupuesto |
| `monto_anticipo` | DECIMAL | Monto del anticipo pactado |
| `porcentaje_anticipo` | DECIMAL | Porcentaje del anticipo (0-100) |
| `fecha_inicio` | DATE | Fecha de inicio estimada |
| `fecha_fin` | DATE | Fecha de fin estimada |
| `status` | TEXT | `activo` / `completado` / `cancelado` |
| `created_at` | TIMESTAMPTZ | Fecha de creación |

### `work_budget_items`

Partidas y conceptos del presupuesto importados desde Excel.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | Identificador |
| `budget_id` | UUID FK | Presupuesto padre |
| `numero_partida` | TEXT | Número de partida (ej. "1.1", "2.3.a") |
| `descripcion` | TEXT | Descripción del concepto |
| `unidad` | TEXT | Unidad de medida (m2, m3, pieza, etc.) |
| `cantidad` | DECIMAL | Cantidad total presupuestada |
| `precio_unitario` | DECIMAL | Precio unitario |
| `monto_total` | DECIMAL | `cantidad * precio_unitario` |
| `orden` | INTEGER | Orden de presentación |

### `work_estimations`

Estimación periódica de avance de obra. Cada estimación genera una proforma.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | Identificador |
| `budget_id` | UUID FK | Presupuesto al que pertenece |
| `numero_estimacion` | INTEGER | Número correlativo (1, 2, 3...) |
| `periodo` | TEXT | Descripción del periodo (ej. "Enero 2026") |
| `fecha_estimacion` | DATE | Fecha de la estimación |
| `monto_estimacion` | DECIMAL | Suma de conceptos ejecutados |
| `monto_extras` | DECIMAL | Trabajos adicionales en este periodo |
| `amort_anticipo` | DECIMAL | Amortización proporcional del anticipo |
| `monto_neto` | DECIMAL | `monto_estimacion + monto_extras - amort_anticipo` |
| `proforma_id` | UUID FK | Proforma generada desde esta estimación |
| `proforma_folio` | TEXT | Folio de la proforma (desnormalizado para display) |
| `status` | TEXT | `borrador` / `emitida` / `pagada` |
| `html_url` | TEXT | URL del documento HTML generado en Storage |
| `created_at` | TIMESTAMPTZ | Fecha de creación |

### `work_estimation_items`

Volumen ejecutado por concepto en una estimación.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | Identificador |
| `estimation_id` | UUID FK | Estimación padre |
| `budget_item_id` | UUID FK | Concepto del presupuesto |
| `cantidad_ejecutada` | DECIMAL | Volumen ejecutado en este periodo |
| `precio_unitario` | DECIMAL | Precio unitario (heredado del presupuesto) |
| `monto` | DECIMAL | `cantidad_ejecutada * precio_unitario` |

---

## Parser Excel de Presupuesto

### Formato esperado del archivo

El Excel debe tener columnas reconocibles por nombre (insensible a mayúsculas):

| Columna en Excel | Campo mapeado |
|---|---|
| `Partida` / `No.` / `Num` | `numero_partida` |
| `Descripcion` / `Concepto` / `Descripción` | `descripcion` |
| `Unidad` / `U.M.` | `unidad` |
| `Cantidad` / `Cant.` | `cantidad` |
| `P.U.` / `Precio Unitario` / `PU` | `precio_unitario` |
| `Importe` / `Total` / `Monto` | `monto_total` (calculado si no existe) |

### Tecnología utilizada

```typescript
import * as XLSX from 'xlsx';

const workbook = XLSX.read(buffer, { type: 'array' });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
```

Dependencia: `xlsx` (ya incluida en `web/package.json`).

---

## Fórmula de Amortización de Anticipo

Estándar de la industria de construcción (obra civil):

```
amort_anticipo_i = (monto_estimacion_i / monto_total_obra) * monto_anticipo_total
```

Donde:
- `monto_estimacion_i` = suma de conceptos ejecutados en la estimación i
- `monto_total_obra` = monto total del presupuesto (`work_budgets.monto_total`)
- `monto_anticipo_total` = anticipo pactado (`work_budgets.monto_anticipo`)

El anticipo se amortiza proporcionalmente al avance. Al llegar al 100% de avance,
la suma de todas las amortizaciones debe igualar el anticipo total.

### Monto neto de la estimación

```
monto_neto = monto_estimacion + monto_extras - amort_anticipo
```

---

## Generación de Documentos HTML

### Propuesta Económica

Documento de presentación que incluye:
- Cabecera con logo + datos completos del emisor (RFC, dirección, teléfono)
- Datos del cliente y nombre de la obra
- Tabla del presupuesto completo (partidas y conceptos)
- Monto del anticipo
- Condiciones generales del contrato

### Estimación (Documento por periodo)

Documento de cobro por periodo que incluye:
- Encabezado: emisor, cliente, número de estimación, periodo
- Tabla de conceptos ejecutados (descripción, unidad, cantidad, PU, importe)
- Trabajos adicionales (extras) si aplica
- Resumen: subtotal, amortización anticipo, monto neto, IVA, total
- Cuadro de avance acumulado
- Referencia al folio de proforma vinculada

### Impresión con Colores

```css
print-color-adjust: exact;
-webkit-print-color-adjust: exact;
```

Garantiza que los colores corporativos y fondos coloreados se conserven al imprimir.

---

## Integración con ProformaManager

### 6to Toggle: Estimaciones

El `ProformaManager` ahora tiene 6 toggles de configuración:

| # | Label | Toggle field |
|---|---|---|
| 1 | Cotización | `req_quotation` |
| 2 | O.C. | `req_purchase_order` |
| 3 | Contrato | `is_contract_required` |
| 4 | Evidencia | `req_evidence` |
| 5 | Factura | `request_direct_invoice` |
| 6 | Estimaciones | `req_estimacion` |

### Generar Proforma desde Estimación

Desde la pantalla de Estimaciones, el botón "Generar proforma" crea una proforma en `quotations`
con los datos de la estimación y guarda el `proforma_id` y `proforma_folio` en `work_estimations`.

También se puede generar una proforma de anticipo directamente desde el presupuesto.

---

## Integración con MaterialityBoard

El indicador **EST** en el `MaterialityBoard` refleja el estado del módulo de estimaciones.

Estado actual (2026-04-15): estructura del indicador implementada en el tablero,
pendiente conectar con datos reales de `work_estimations`.

Lógica prevista:
```
activo = req_estimacion === true
status = ultima_estimacion.status || 'borrador'
```

---

## Barras de Progreso Duales

La pantalla muestra dos barras de progreso por obra:

| Barra | Color | Calcula |
|---|---|---|
| Pagos | Verde (`bg-green-500`) | `suma(pagos_recibidos) / monto_total * 100` |
| Obra | Cyan (`bg-cyan-500`) | `suma(estimaciones_emitidas) / monto_total * 100` |

Permiten visualizar si el avance de pago está alineado con el avance de obra.
