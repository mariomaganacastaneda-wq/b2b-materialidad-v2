# Contratos Multi-Proforma

**Versión:** 1.0 | **Fecha:** 2026-04-15 | **Autor:** Claude Code

---

## Resumen

Sistema que permite vincular múltiples proformas a un mismo contrato mediante una
tabla de relación N:N. Las proformas vinculadas heredan la materialidad (documentos)
del contrato padre y el semáforo se sincroniza automáticamente.

---

## Modelo de Datos

### Tabla `contract_quotations`

Relación muchos a muchos entre contratos y proformas.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | Identificador |
| `contract_id` | UUID FK | Referencia a `contracts.id` |
| `quotation_id` | UUID FK | Referencia a `quotations.id` |
| `linked_at` | TIMESTAMPTZ | Fecha y hora del vínculo |
| `linked_by` | TEXT | Usuario que realizó el vínculo |

Restricción de unicidad: `(contract_id, quotation_id)` — una proforma no puede
vincularse dos veces al mismo contrato.

---

## Flujo de Vinculación

```
Modal de Contrato
      |
      | [Sección "Proformas Vinculadas"]
      |
      v
Buscar proformas (por folio o cliente)
      |
      v
Seleccionar proforma → clic "Vincular"
      |
      v
INSERT en contract_quotations
      |
      +-- Sincronización automática:
      |   UPDATE quotations SET contract_status = contracts.status
      |                       SET related_contract_id = contract_id
      |
      v
Badge "VINCULADO · LEGALIZADO" aparece en tabla de proformas
```

### Desvincular

El modal también permite desvincular:

```
DELETE FROM contract_quotations
WHERE contract_id = ? AND quotation_id = ?

UPDATE quotations
SET contract_status = NULL,
    related_contract_id = NULL
WHERE id = ?
```

---

## Semáforo Heredado

Cuando una proforma está vinculada a un contrato, el semáforo de materialidad
refleja los documentos del contrato padre en lugar de requerir documentos propios.

### Indicador CONT en MaterialityBoard

| Escenario | Color semáforo | Tooltip |
|---|---|---|
| Sin contrato requerido | Gris (inactivo) | toggle OFF |
| Contrato requerido, sin vincular | Rojo | "Requerido" |
| Vinculado, contrato en revisión | Amarillo | status del contrato |
| Vinculado, contrato legalizado | Verde | "Legalizado" |

### Sincronización de `contract_status`

La función `linkQuotation` actualiza `quotations.contract_status` con el
`status` actual del contrato en el mismo momento del vínculo:

```typescript
const linkQuotation = async (contractId: string, quotationId: string) => {
    // 1. Obtener status actual del contrato
    const { data: contract } = await supabase
        .from('contracts')
        .select('status')
        .eq('id', contractId)
        .single();

    // 2. Crear vínculo
    await supabase
        .from('contract_quotations')
        .insert({ contract_id: contractId, quotation_id: quotationId });

    // 3. Sincronizar status en la proforma
    await supabase
        .from('quotations')
        .update({
            contract_status: contract.status,
            related_contract_id: contractId
        })
        .eq('id', quotationId);
};
```

---

## UI — Sección en Modal de Contrato

La sección "Proformas Vinculadas" aparece dentro del modal de detalle de contratos:

### Lista de proformas vinculadas

Muestra todas las proformas ya vinculadas al contrato con:
- Folio de la proforma
- Cliente
- Monto
- Status de la proforma
- Botón "Desvincular"

### Buscador para vincular

- Campo de búsqueda por folio o nombre de cliente
- Lista de resultados (proformas existentes no vinculadas aún al contrato)
- Botón "Vincular" por cada resultado

---

## Badge en Tabla de Proformas

Las proformas vinculadas a un contrato legalizado muestran un badge compuesto
en la columna de estado:

```
VINCULADO · LEGALIZADO
```

- **VINCULADO**: indica que existe registro en `contract_quotations`
- **LEGALIZADO**: refleja el `contract_status` de la proforma

El badge usa estilo `bg-emerald-900/50 text-emerald-300 border border-emerald-700`.

---

## Relación con Otros Módulos

| Módulo | Relación |
|---|---|
| `ProformaManager` | El toggle "Contrato" activa el requerimiento; el vínculo satisface el indicador |
| `MaterialityBoard` | Indicador CONT lee `is_contract_required` + `contract_status` |
| `WorkEstimations` | Las proformas generadas desde estimaciones también pueden vincularse a un contrato |
| `QuotationRequests` | Las cotizaciones vinculadas a un contrato heredan su materialidad |

---

## Casos de Uso

### Obra con múltiples estimaciones bajo un solo contrato

```
Contrato "Obra Edificio Torre A"
    ├── Proforma anticipo 30%        (estimación 0)
    ├── Proforma estimación 1        (enero 2026)
    ├── Proforma estimación 2        (febrero 2026)
    └── Proforma estimación 3        (marzo 2026)
```

Todas las proformas heredan el contrato legalizado → semáforo verde en todas.

### Servicio recurrente con un solo contrato marco

```
Contrato marco "Servicios de limpieza 2026"
    ├── Proforma enero 2026
    ├── Proforma febrero 2026
    └── Proforma marzo 2026
```

Al legalizar el contrato marco, todas las proformas mensuales se actualizan.
