# 11 - Proceso de Optimización: Workflow de Procesamiento OC/Proformas

## Fecha: 3 de marzo de 2026

## Resumen

Documentación completa del proceso de diagnóstico, parches incrementales y rediseño del workflow n8n `B2B_Procesar_Orden_Compra_OpenAI` (ID: `YDv8SEZqn2ny0fCy`). El workflow procesaba documentos comerciales (Órdenes de Compra y Proformas) pero alteraba datos críticos: claves SAT, precios unitarios y asignación de clientes. Después de 89+ versiones de parches, se documentó el proceso completo para crear una versión limpia (v2).

---

## 1. Planteamiento del Problema

### Síntoma principal

El sistema de carga de OC/Proformas alteraba datos al procesar documentos. Los datos que llegaban al frontend diferían de los valores reales en el documento original.

### Ejemplos concretos de alteración de datos

| Campo | Valor en documento | Valor recibido por frontend | Impacto |
|-------|-------------------|----------------------------|---------|
| Clave SAT | `72102900` | `73152101` | Clasificación fiscal incorrecta |
| Precio unitario | `$33,813.91` | `$47,209.75` | Monto de proforma incorrecto en ~40% |
| Cliente | "Inmobiliaria Garza Mercado" | "Sergio Magaña" o "EYMSA" | Proforma asignada a empresa equivocada |

### Contexto del workflow al inicio de la optimización

- **Workflow**: `B2B_Procesar_Orden_Compra_OpenAI`
- **ID**: `YDv8SEZqn2ny0fCy`
- **Estado**: Activo, con 45 versiones al inicio del diagnóstico (doc 10)
- **Pipeline original**: Webhook → Extract from File (texto) → Information Extractor (GPT-4.1-mini) → Preparar Payload → Edge Function → IF → Formatear → Respond

---

## 2. Diagnóstico - Problemas Encontrados

Se identificaron 6 problemas independientes que se manifestaban como un único síntoma de "datos alterados".

### P1 - Schema del extractor sin campo `sat_product_key`

- **Dónde**: Nodo "Information Extractor" en n8n
- **Problema**: El schema del Information Extractor solo incluía el campo `sat_search_hint` (una pista de búsqueda en texto libre) pero no el campo `sat_product_key` (la clave SAT numérica real). GPT no tenía instrucciones para extraer la clave exacta.
- **Consecuencia**: La Edge Function `validate-enrich-proforma` recibía solo un hint textual y hacía fuzzy match contra el catálogo SAT, eligiendo la clave más parecida por nombre. El fuzzy match retornaba `73152101` en lugar de la clave original `72102900`.
- **Gravedad**: Alta - afectaba la clasificación fiscal de cada partida

### P2 - Extracción de texto fallaba con PDFs generados desde Excel

- **Dónde**: Nodo "Extract from File" (extracción de texto plano de PDF)
- **Problema**: Los documentos de SEIDCO son generados exportando hojas de cálculo Excel a PDF. Estos PDFs tienen celdas combinadas y layouts tabulares complejos. La extracción de texto plano produce un flujo de caracteres sin estructura donde los valores de celdas adyacentes se concatenan o se pierden.
- **Consecuencia**: El precio unitario `$33,813.91` aparecía truncado o fusionado con otro valor adyacente. GPT-4.1-mini recibía texto malformado y extraía `$47,209.75` (valor de otra celda del documento).
- **Gravedad**: Crítica - el precio es el dato más importante de una proforma

### P3 - El nodo "Extract from Excel" también perdía datos

- **Dónde**: Nodo "Extract from Excel" (rama de archivos .xlsx)
- **Problema**: El nodo `Extract from File` de n8n para Excel genera columnas con nombres automáticos `__EMPTY`, `__EMPTY_1`, etc. cuando la hoja no tiene encabezados en la primera fila (como ocurre con templates de SEIDCO que tienen logo y metadatos antes de la tabla de partidas). El filtro original `!h.startsWith('_')` eliminaba todas esas columnas, produciendo filas vacías.
- **Consecuencia**: Los archivos Excel de OC llegaban al Information Extractor sin datos de partidas.
- **Gravedad**: Alta - todos los archivos Excel de OC producían extracciones vacías
- **Nota**: Este problema ya estaba documentado y parcialmente resuelto en el doc 10 (CHANGELOG-2026-02-28, sección 2).

### P4 - RFC con guiones no matcheaba en la base de datos

- **Dónde**: Nodo "Preparar Payload Validación" → Edge Function
- **Problema**: El RFC extraído por GPT de documentos SEIDCO incluía el guión de formato mexicano: `IGM-950723-947`. La base de datos almacena los RFC sin guiones: `IGM950723947`. La comparación exacta fallaba.
- **Consecuencia**: La Edge Function no encontraba la empresa por RFC y caía al fallback de búsqueda por nombre, con resultados inconsistentes (ver P5).
- **Gravedad**: Alta - afectaba a todos los documentos con RFC formateado con guiones

### P5 - Fallback por nombre en Edge Function asignaba empresa incorrecta

- **Dónde**: Edge Function `validate-enrich-proforma`
- **Problema**: Cuando la búsqueda por RFC fallaba (por P4 u otras causas), la función ejecutaba un fuzzy match por nombre de empresa. El algoritmo de scoring no era determinista: el mismo nombre podía resolver a diferentes organizaciones en diferentes ejecuciones dependiendo del orden de resultados de la query.
- **Consecuencia**: "Inmobiliaria Garza Mercado" se asignaba a "Sergio Magaña" o "EYMSA" dependiendo de la ejecución. Los datos del cliente en el payload de respuesta correspondían a la empresa equivocada.
- **Gravedad**: Crítica - la proforma se creaba para el cliente incorrecto

### P6 - Empresa existe como organización pero no como cliente registrado

- **Dónde**: Edge Function `validate-enrich-proforma`
- **Problema**: La función buscaba empresas en la tabla `organizations`. Una empresa puede existir como organización en el sistema (fue creada al procesar un documento anterior) pero no estar explícitamente registrada como cliente del usuario actual. La función no distinguía entre "la empresa existe en el catálogo global" y "esta empresa es cliente mío".
- **Consecuencia**: La Edge Function resolvía exitosamente una empresa que no debía ser el cliente, sin ninguna advertencia al frontend.
- **Gravedad**: Media - silenciosa, difícil de detectar sin revisión manual

---

## 3. Soluciones Aplicadas

Las soluciones se aplicaron de forma incremental a lo largo de las versiones 46 a 89+ del workflow.

### S1 - Agregar campo `sat_product_key` al schema del extractor

- **Resuelve**: P1
- **Cambio en n8n**: Se agregó el campo `sat_product_key` (string numérico de 8 dígitos) al schema JSON del nodo Information Extractor, con instrucción explícita de extraer la clave tal como aparece en el documento.
- **Cambio adicional en "Formatear Respuesta Exitosa"**: Se agregó lógica de override que preserva la clave SAT extraída directamente por GPT del documento (`extracted.sat_product_key`) sobre cualquier clave que devuelva el fuzzy match de la Edge Function:
  ```javascript
  // Si GPT extrajo la clave directamente, preservarla
  const satKey = item.sat_product_key || enrichedItem.sat_key;
  ```
- **Resultado**: La clave SAT del documento original llega al frontend sin modificación.

### S2 - Reemplazar extracción de texto por GPT-4.1 Vision

- **Resuelve**: P2 (y de forma completa también P3)
- **Cambio**: Se reemplazó el nodo "Extract from File" (texto plano) por una llamada directa a la API de OpenAI Responses (`POST /v1/responses`) usando `input_file` con `type: "file"`. GPT-4.1 recibe el documento como entrada visual (procesa tanto PDFs nativos como PDFs generados desde Excel) y extrae los datos estructurados directamente.
- **Nodo nuevo**: "Preparar Vision PDF" → construye el payload con el archivo en base64 y el prompt de extracción. "OpenAI Vision API" → HTTP Request al endpoint `/v1/responses`.
- **Por qué Vision es superior**: GPT-4.1 al procesar visualmente un PDF de Excel ve la tabla como la vería un humano, respetando la geometría de celdas combinadas y la posición espacial de los valores.
- **Resultado**: Extracción correcta de precios y cantidades en documentos con layout complejo.

### S3 - Redirigir archivos Excel al pipeline de Vision

- **Resuelve**: P3 (complemento de S2)
- **Cambio**: El nodo IF "¿Es PDF?" originalmente bifurcaba: rama TRUE para PDFs (Extract from File) y rama FALSE para Excel (Extract from Excel + Excel a Texto). Después de S2, ambas ramas apuntan al mismo nodo "Preparar Vision PDF". Los archivos Excel son enviados a GPT-4.1 Vision igual que los PDFs.
- **Justificación**: GPT-4.1 Vision puede procesar archivos Excel directamente. La extracción nativa de Excel por n8n perdía datos en templates con layout no estándar (ver P3). La ruta de Vision es más confiable para ambos formatos.
- **Resultado**: Los nodos "Extract from Excel" y "Excel a Texto" quedaron como nodos muertos/desconectados (conservados para referencia, no ejecutan).

### S4 - Normalización de RFC antes de enviar a Edge Function

- **Resuelve**: P4
- **Cambio en nodo "Preparar Payload Validación"**: Se agregó la función `normalizeRfc()` que aplica antes de construir el payload:
  ```javascript
  function normalizeRfc(rfc) {
    if (!rfc) return rfc;
    return rfc.replace(/[-\s.]/g, '').toUpperCase().trim();
  }
  // Aplicar a issuer_rfc y client_rfc antes de enviar
  payload.issuer_rfc = normalizeRfc(extracted.issuer_rfc);
  payload.client_rfc = normalizeRfc(extracted.client_rfc);
  ```
- **Cambio adicional en el prompt de GPT-4.1**: Instrucción explícita: "Extrae el RFC sin guiones ni espacios, solo letras y números en mayúsculas."
- **Resultado**: `IGM-950723-947` se normaliza a `IGM950723947` antes de llegar a la Edge Function, el match por RFC funciona correctamente.

### S5 - Restaurar datos originales cuando Edge Function resuelve por nombre

- **Resuelve**: P5 y P6 parcialmente
- **Cambio en "Formatear Respuesta Exitosa"**: Se agregó lógica para detectar cuándo la Edge Function resolvió la empresa "por nombre" en vez de "por RFC" (la respuesta incluye el campo `match_method`). En ese caso, se restauran los datos originales extraídos del documento (RFC, nombre, dirección) en lugar de usar los datos de la empresa fuzzy-matcheada:
  ```javascript
  if (validationResult.client_match_method === 'name_fuzzy') {
    // Usar los datos del documento, no los de la empresa matcheada
    response.client_rfc = extracted.client_rfc;
    response.client_name = extracted.client_name;
    // Marcar para que el frontend haga su propio lookup
    response.client_requires_frontend_lookup = true;
  }
  ```
- **Resultado**: El frontend recibe datos coherentes con el documento. Si el match fue por nombre, el frontend puede presentar un selector de empresa al usuario en vez de asignar automáticamente.

### S6 - Instrucciones explícitas en prompt para RFC sin formato

- **Resuelve**: P4 (prevención en la fuente)
- **Cambio en prompt de GPT-4.1**: Sección dedicada de instrucciones de formato:
  ```
  FORMATO DE RFC:
  - Extrae el RFC sin guiones, sin espacios, sin puntos
  - Solo letras mayúsculas y números
  - Ejemplos: IGM950723947, LFA140313H67, SSI101213VD1
  - INCORRECTO: IGM-950723-947 o igm950723947
  ```
- **Resultado**: La normalización en S4 se convierte en un segundo nivel de defensa, no en el único mecanismo.

---

## 4. Arquitectura del Workflow

### Estado actual (versión 89+)

```
Webhook (POST /webhook/process-po-pdf)
        │
        ▼
Detectar Tipo (Code Node)
  → Determina si es PDF o Excel por mimetype
        │
        ▼
[IF] ¿Es PDF?
  ├── TRUE ──────────────────────┐
  └── FALSE (Excel) ─────────────┤
                                  │
                                  ▼
                     Preparar Vision PDF (Code Node)
                       → Construye payload para /v1/responses
                       → Incluye archivo en base64
                       → Incluye prompt de extracción
                                  │
                                  ▼
                     OpenAI Vision API (HTTP Request)
                       → POST /v1/responses
                       → model: gpt-4.1
                       → input_file type
                                  │
                                  ▼
                     Parsear Respuesta (Code Node)
                       → Extrae JSON de la respuesta de GPT
                       → Normaliza RFC (normalizeRfc())
                                  │
                                  ▼
                     Preparar Payload Validación (Code Node)
                       → Mapea supplier/buyer → issuer/client
                       → Aplica normalización de RFC
                       → Construye payload para Edge Function
                                  │
                                  ▼
                     Edge Function validate-enrich-proforma (HTTP Request)
                       → Busca organizaciones por RFC normalizado
                       → Enriquece con datos SAT
                       → Retorna match_method (rfc | name_fuzzy)
                                  │
                                  ▼
                    [IF] ¿Validación OK? (status === 'success')
                     ├── TRUE  → Formatear Respuesta Exitosa
                     │            → Override clave SAT con valor de GPT
                     │            → Restaura datos si match fue por nombre
                     │            → Respond 200
                     └── FALSE → Formatear Respuesta Error
                                  → Respond 400
```

### Nodos activos vs. nodos muertos

| Nodo | Estado | Descripción |
|------|--------|-------------|
| Webhook | Activo | Punto de entrada, recibe archivo |
| Detectar Tipo | Activo | Determina PDF vs. Excel por mimetype |
| ¿Es PDF? | Activo | IF node (ambas ramas van a Vision) |
| Preparar Vision PDF | Activo | Construye payload para GPT-4.1 Vision |
| OpenAI Vision API | Activo | HTTP Request a `/v1/responses` |
| Parsear Respuesta | Activo | Extrae y valida JSON de GPT |
| Preparar Payload Validación | Activo | Normaliza RFC y mapea roles |
| Edge Function | Activo | HTTP Request a `validate-enrich-proforma` |
| ¿Validación OK? | Activo | IF node de éxito/error |
| Formatear Respuesta Exitosa | Activo | Override SAT + restauración de datos |
| Formatear Respuesta Error | Activo | Estructura el error para el frontend |
| Respond (OK) | Activo | Respond to Webhook 200 |
| Respond (Error) | Activo | Respond to Webhook 400 |
| Extract from Excel | **Muerto** | Desconectado, reemplazado por Vision |
| Excel a Texto | **Muerto** | Desconectado, reemplazado por Vision |
| Information Extractor | **Muerto** | Desconectado, reemplazado por Vision |
| OpenAI Chat Model | **Muerto** | Desconectado, reemplazado por Vision |

### Workflow v2 (arquitectura objetivo - 12 nodos limpios)

La arquitectura objetivo elimina los nodos muertos y agrega un nodo de verificación aritmética dedicado:

```
Webhook
  → Preparar Vision (sin IF ¿Es PDF? - Vision acepta ambos formatos)
  → OpenAI Vision API
  → Parsear Respuesta
  → Verificación Aritmética  ← NUEVO
  → Preparar Payload Validación
  → Edge Function
  → ¿Validación OK?
  ├── Formatear Éxito → Respond 200
  └── Formatear Error → Respond 400
```

---

## 5. Sistema de Verificación Aritmética

El workflow v2 incluye un nodo "Verificación Aritmética" dedicado que se ejecuta después de parsear la respuesta de GPT y antes de enviar a la Edge Function. Su función es detectar y corregir inconsistencias numéricas introducidas por la extracción de IA.

### Validaciones que realiza

| Verificación | Fórmula | Tolerancia |
|-------------|---------|------------|
| Subtotal de partida | `cantidad × precio_unitario = subtotal` | ±$0.05 |
| IVA de partida | `subtotal × tasa_iva = IVA` | ±$0.10 |
| Total de partida | `subtotal + IVA = total` | ±$0.10 |
| IVA coherente | Si `has_iva=true` → `IVA > 0` | - |
| Precio plausible | `precio_unitario <= total` | - |

### Jerarquía de confianza (cuál valor corregir)

Cuando hay inconsistencia aritmética, el nodo aplica la siguiente jerarquía para determinar cuál valor es el más confiable y cuál debe recalcularse:

```
Total > Precio unitario > Cantidad > Subtotal > IVA
```

**Justificación**: El total es el número más prominente visualmente en cualquier documento comercial (aparece en el renglón final con mayor tamaño o énfasis), por lo que GPT lo extrae con más precisión. El precio unitario es el segundo dato más explícito. La cantidad puede tener ambigüedad (unidades vs. piezas vs. lotes). El subtotal e IVA son frecuentemente valores calculados que pueden perderse en PDFs de Excel.

### Lógica de corrección automática

```javascript
// Ejemplo: cantidad × precio_unitario ≠ subtotal
// Jerarquía: precio_unitario > subtotal > cantidad
// → Recalcular subtotal: subtotal = cantidad × precio_unitario

// Ejemplo: subtotal + IVA ≠ total
// Jerarquía: total > subtotal > IVA
// → Recalcular IVA: IVA = total - subtotal
```

### Output del nodo

El nodo agrega al payload los campos:
- `arithmetic_ok: boolean` - Si pasó todas las verificaciones
- `arithmetic_corrections: string[]` - Lista de correcciones aplicadas
- `arithmetic_warnings: string[]` - Inconsistencias que no pudieron resolverse

---

## 6. Suite de Pruebas

Se definieron 10 archivos de prueba que cubren los casos de uso principales y los edge cases que causaron los problemas documentados.

### Archivos de prueba

| # | Archivo | Tipo | Caso de prueba | RFC(s) involucrados |
|---|---------|------|---------------|---------------------|
| 1 | `PROFORMA SEIDCO IGM MARZO 2026, MTTO T.A.E. 7, 2026.pdf` | PDF (Excel→PDF) | Formato SEIDCO con RFC con guiones, clave SAT específica | SSI101213VD1, IGM950723947 |
| 2 | `2 PROFORMA SEIDCO IGM MARZO 2026, MTTO. A.L. 27, 2026 V2.xlsx` | Excel | Mismo documento en formato nativo Excel | SSI101213VD1, IGM950723947 |
| 3 | `3 PROFORMA SEIDCO IGM MARZO 2026, MTTO. A.L. 35, 2026.pdf` | PDF (Excel→PDF) | Segunda proforma SEIDCO, múltiples partidas | SSI101213VD1, IGM950723947 |
| 4 | `3 PROFORMA SEIDCO IGM MARZO 2026, MTTO. A.L. 35, 2026.xlsx` | Excel | Versión Excel del archivo 3 | SSI101213VD1, IGM950723947 |
| 5 | `CSF_IGM-2026 ENERO.pdf` | PDF | Constancia de situación fiscal - debe rechazarse | IGM950723947 |
| 6 | `GARZA.pdf` | PDF | OC de Inmobiliaria Garza Mercado - caso de cliente no registrado | (cliente nuevo) |
| 7 | OC SAP Business One (AGA) | PDF | OC con roles invertidos: AGA emite, SEIDCO recibe | Múltiples |
| 8 | OC SAP Corporativo (Goodyear) | PDF | OC corporativa con múltiples partidas de servicios | Múltiples |
| 9 | Proforma Excel (EPIC o MMC) | Excel | Proforma de tercero en formato Excel libre | Múltiples |
| 10 | CFDI timbrado (Compac) | PDF | Factura timbrada con UUID SAT - flujo diferente al de OC | Múltiples |

### Casos de prueba que cubre cada archivo

| Caso | Archivos que lo cubren |
|------|----------------------|
| RFC con guiones en documento | 1, 2, 3, 4 |
| PDF generado desde Excel (layout complejo) | 1, 3 |
| Extracción directa de archivo Excel nativo | 2, 4, 9 |
| Documento que debe rechazarse (tipo incorrecto) | 5 |
| Cliente no registrado como cliente del usuario | 6 |
| Roles invertidos (quien emite vs. quien recibe) | 7 |
| Múltiples partidas en un documento | 8 |
| Verificación aritmética de partidas | 8, 9 |
| Detección de tipo de documento | Todos |

### Procedimiento de prueba con curl

Para aislar problemas del workflow de problemas del frontend, las pruebas se ejecutan directamente contra el webhook de n8n:

```bash
# Ejemplo de prueba directa al webhook
curl -X POST "https://n8n.tudominio.com/webhook/process-po-pdf" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/ruta/al/archivo.pdf" \
  -F "organization_id=uuid-de-la-org" \
  -F "user_id=uuid-del-usuario"
```

Las pruebas directas con curl permiten:
1. Verificar que la extracción de datos es correcta antes de involucrar el frontend
2. Reproducir bugs de forma determinista
3. Comparar el JSON de respuesta contra los valores del documento fuente

---

## 7. Correcciones Adicionales (Fase de Pruebas)

Durante las pruebas con curl directo al webhook se descubrieron y corrigieron cuatro problemas adicionales a los P1-P6 originales.

### P7 - MIME type incorrecto para archivos Excel

- **Dónde**: Nodo "Preparar Llamada Vision" (payload para OpenAI `/v1/responses`)
- **Problema**: Los archivos `.xlsx` se enviaban a OpenAI con MIME type genérico `application/octet-stream`. La API de OpenAI Responses rechazaba el archivo porque no reconocía el tipo de documento.
- **Solución**: Se agregó un mapeo explícito de extensiones a MIME types correctos dentro del nodo "Preparar Llamada Vision":
  ```javascript
  const mimeMap = {
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls':  'application/vnd.ms-excel',
    'pdf':  'application/pdf'
  };
  const ext = filename.split('.').pop().toLowerCase();
  const mimeType = mimeMap[ext] || 'application/octet-stream';
  ```
- **Resultado**: OpenAI acepta y procesa archivos Excel correctamente.

### P8 - Workflow rechazaba documentos sin RFC de cliente

- **Dónde**: Lógica de resolución de cliente en nodo "Preparar Payload Validación" y Edge Function
- **Problema**: Cuando el RFC del cliente no aparecía en el documento (por ejemplo, OCs de Goodyear donde el documento no incluye el RFC del proveedor), el workflow marcaba la respuesta como error y rechazaba el documento.
- **Solución**: Se implementó una lógica de resolución de cliente en 3 niveles que nunca rechaza por falta de RFC:
  1. Nivel 1 (RFC): Si se extrae RFC → buscar por RFC normalizado
  2. Nivel 2 (Nombre): Si no hay RFC → buscar por nombre de empresa
  3. Nivel 3 (Sin cliente): Si no hay ni RFC ni nombre coincidente → continuar sin cliente asignado
- **Campos nuevos en la respuesta** del workflow:
  - `client_resolved: boolean` — indica si se resolvió un cliente
  - `client_message: string` — mensaje descriptivo para el frontend
- **Mensaje al usuario cuando no se resuelve cliente**: "Cargado exitosamente pero sin cliente. Favor de subir CSF del cliente y repetir la carga, o capturarlo manualmente."
- **Resultado**: Ningún documento transaccional es rechazado por ausencia de RFC del cliente.

### P9 - Toggles de materialidad activados incorrectamente por GPT

- **Dónde**: Nodo "Formatear Respuesta Exitosa" y prompt de extracción
- **Problema**: GPT activaba los campos `requires_quotation` e `is_contract_required` cuando el documento contenía frases como "según contrato", "conforme a cotización", "de acuerdo al convenio" u otras expresiones similares. Esto producía que el sistema marcara automáticamente documentos como "requieren cotización" o "requieren contrato" sin intervención del usuario.
- **Solución**: Dos niveles de corrección:
  1. **En el prompt**: Instrucción explícita de nunca activar estos campos basándose en el contenido del documento.
  2. **En el normalizador (hardcoded)**: Forzar `false` para ambos campos independientemente de lo que devuelva GPT:
     ```javascript
     response.requires_quotation = false;
     response.is_contract_required = false;
     ```
- **Justificación**: Estos toggles son decisiones de negocio del usuario, no datos extraíbles del documento. El usuario los activa manualmente en la plataforma.
- **Resultado**: Los toggles de materialidad llegan siempre en `false` al frontend; el usuario los activa cuando corresponde.

### P10 - Roles invertidos en OCs de sistemas SAP/ERP

- **Dónde**: Prompt de extracción de GPT-4.1
- **Problema**: En Órdenes de Compra emitidas por empresas grandes que usan SAP (como AGA), GPT confundía los roles de emisor y receptor. El documento tiene el logo y nombre de AGA (quien emite la OC de compra) pero GPT interpretaba a SEIDCO (mencionado en el campo "Vendor/Proveedor") como el emisor del documento.
- **Solución**: Instrucciones detalladas en el prompt sobre la semántica de roles en Órdenes de Compra:
  ```
  ROLES EN ÓRDENES DE COMPRA:
  - buyer (comprador/emisor del documento): empresa cuyo nombre/logo aparece en el ENCABEZADO o HEADER del documento.
    Esta empresa EMITE la OC porque está comprando.
  - supplier (proveedor/receptor del servicio): empresa que aparece en el campo "Vendor", "Proveedor",
    "Supplier" o equivalente. Esta empresa RECIBE la OC porque va a prestar el servicio o entregar el bien.
  - NUNCA asignar a supplier como buyer ni viceversa.
  ```
- **Resultado**: En OCs de AGA/SAP, AGA es correctamente identificado como `buyer` y SEIDCO como `supplier`.

---

## 8. Resultados de Pruebas (10 archivos)

### Matriz de resultados

| # | Archivo | Tipo | Resultado | Notas |
|---|---------|------|-----------|-------|
| 1 | SEIDCO IGM T.A.E. 7 | PDF Proforma | PASS (11/11) | RFC normalizado correctamente, clave SAT restaurada |
| 2 | GARZA | PDF CFDI | PASS (11/12) | `billing_type` dice PREFACTURA (nota menor, no bloquea flujo) |
| 3 | CSF_IGM | PDF CSF | PASS (4/4) | Rechazado correctamente como `NO_TRANSACCIONAL` |
| 4 | AGA P-6003831 Bajio | PDF OC SAP | PASS (mejorado) | Roles corregidos por P10; AGA no registrada aun en BD |
| 5 | Goodyear 8241747624 | PDF OC | PASS (9/9) | 2 items, cliente resuelto por nombre (sin RFC), P8 aplicado |
| 6 | OP 8241019376 | PDF OC | PASS (7/7) | Cliente Goodyear resuelto por nombre |
| 7 | EPIC Cromaprint | Excel | PASS (9/9) | MIME type corregido por P7, Vision procesa correctamente |
| 8 | M&V Fiscal CESMA | Excel | PASS (8/8) | CESMA encontrada en BD por RFC |
| 9 | M&V Financiero CESMA | Excel | PASS (8/8) | Mismo emisor, concepto diferente (materialidad financiera) |
| 10 | MMC Cromaprint | Excel | PASS (8/8) | Redes y camaras CCTV, partidas multiples |

### Verificacion Aritmetica (resultados agregados)

Todos los archivos transaccionales pasaron la verificacion aritmetica integrada:

| Regla | Formula | Archivos aplicables | Resultado |
|-------|---------|---------------------|-----------|
| R1 - Subtotal de partida | `cantidad x precio_unitario = subtotal` | 10/10 | PASS |
| R2 - Suma de items | `suma(subtotales_items) = subtotal_general` | 10/10 | PASS |
| R3 - IVA | `subtotal x tasa = IVA` | 8/10 (2 sin IVA desglosado) | PASS |
| R4 - Total final | `subtotal + IVA = total` | 10/10 | PASS |

---

## 9. Estado Final del Workflow (2026-03-03)

| Aspecto | Valor |
|---------|-------|
| Bugs documentados | P1 a P10 (10 problemas) |
| Bugs resueltos | P1 a P10 (todos, con S1-S6 mas correcciones de fase de pruebas) |
| Nodos activos | 16 |
| Nodos muertos | 0 (eliminados o desconectados sin afectar flujo) |
| Version del workflow | 92+ |
| Version de respaldo | 38 (punto de partida limpio documentado) |
| Correcciones post-deploy | 6 parches incrementales via `n8n_update_partial_workflow` |
| Campos nuevos en respuesta | `client_resolved`, `client_message`, `arithmetic_valid`, `arithmetic_warnings` |
| Suite de pruebas | 10 archivos ejecutados, todos PASS |
| Siguiente paso | Crear workflow v2 limpio con los 16 nodos activos y sin historial de parches |

---

## 10. Lecciones Aprendidas

### L1 - Extracción de texto plano falla con PDFs de layout complejo

Los PDFs generados exportando hojas de cálculo Excel (con celdas combinadas, logos, tablas sin estructura HTML) no son aptos para extracción de texto plano. El texto extraído mezcla valores de columnas adyacentes y pierde el contexto posicional de los datos.

**Implicación práctica**: Para documentos comerciales mexicanos (facturas, proformas, OC), especialmente los generados por ERPs que exportan a PDF, usar siempre Vision como método de extracción primario.

### L2 - GPT-4.1 Vision es más confiable que extracción de texto para documentos comerciales

GPT-4.1 Vision procesa documentos como los procesaría un humano: leyendo la tabla visualmente, entendiendo la geometría de celdas combinadas, identificando encabezados por posición y estilo. Para documentos con formato irregular, Vision produce extracciones más precisas que cualquier pipeline de texto.

**Implicación práctica**: El costo adicional de llamadas Vision ($0.01-0.03 por documento) se justifica por la eliminación de errores de extracción que tienen impacto fiscal.

### L3 - Normalización de RFC es crítica para el mercado mexicano

Los RFC mexicanos se escriben de múltiples formas en documentos reales:
- Con guiones: `IGM-950723-947`
- Sin guiones: `IGM950723947`
- Con espacios: `IGM 950723 947`
- En minúsculas: `igm950723947`

Cualquier sistema que compare RFC debe normalizar antes de comparar. La normalización debe aplicarse en dos puntos: en el prompt de la IA (instrucción) y en el código (función de normalización como segundo nivel de defensa).

### L4 - Edge Functions remotas pueden tener bugs ocultos en resolución de entidades

La Edge Function `validate-enrich-proforma` parecía funcionar correctamente porque retornaba status 200 y datos. El bug era silencioso: resolvía una empresa válida pero equivocada. Los bugs de este tipo solo se detectan comparando el resultado contra el documento fuente.

**Implicación práctica**: Los campos `match_method` y `match_confidence` en las respuestas de la Edge Function son información crítica que el workflow debe leer y actuar, no ignorar.

### L5 - "Empresa existe en el catálogo" es diferente a "empresa es cliente del usuario"

El sistema tiene un catálogo global de organizaciones (tabla `organizations`) y una relación de cliente (tabla `user_clients` o similar). Una empresa puede estar en el catálogo sin ser cliente explícito del usuario. La Edge Function no distinguía estos casos.

**Implicación práctica**: Al resolver entidades en un sistema multi-tenant, siempre filtrar por el contexto del usuario/organización, no solo por existencia en el catálogo global.

### L6 - Las pruebas directas con curl son esenciales para aislar responsabilidades

Durante el diagnóstico, varios bugs parecían del frontend cuando en realidad eran del workflow n8n, y viceversa. Las pruebas directas al webhook con curl eliminan la variable del frontend y permiten verificar el comportamiento del workflow de forma aislada.

**Implicación práctica**: Documentar los comandos curl de prueba junto con el workflow. Son tan importantes como el código del workflow.

### L7 - Los parches incrementales acumulan deuda técnica (89 versiones como evidencia)

El workflow llegó a 89+ versiones porque cada bug se parcheaba sin refactorizar. Los nodos muertos (Extract from Excel, Information Extractor, OpenAI Chat Model) permanecieron conectados por miedo a romper algo. El resultado es un workflow difícil de mantener y auditar.

**Implicación práctica**: Cuando el número de versiones supera ~20 en un workflow de n8n y hay nodos desconectados, considerar crear una versión limpia (v2) que implemente la arquitectura actual sin el historial de parches. Documentar el proceso antes de crear la versión limpia.

---

## 11. Referencia de Archivos y Nodos

### Archivos del proyecto relacionados

| Archivo | Descripción |
|---------|-------------|
| `web/src/pages/PurchaseOrders.tsx` | Frontend de carga y visualización de OC |
| `web/src/components/commercial/ProformaManager.tsx` | Conversión OC → Proforma |
| `supabase/functions/validate-enrich-proforma/` | Edge Function de validación y enriquecimiento |

### Workflow n8n

| Elemento | Valor |
|----------|-------|
| Nombre | `B2B_Procesar_Orden_Compra_OpenAI` |
| ID | `YDv8SEZqn2ny0fCy` |
| Versiones al documentar | 92+ |
| Endpoint activo | `POST /webhook/process-po-pdf` |
| Modelo IA | GPT-4.1 (Vision, API `/v1/responses`) |

### Edge Function relacionada

| Elemento | Valor |
|----------|-------|
| Nombre | `validate-enrich-proforma` |
| Versión al documentar | v6+ |
| Función | Busca organizaciones por RFC, enriquece partidas con clave SAT, retorna `match_method` |
| Campos críticos de respuesta | `match_method`, `match_confidence`, `client_org_id`, `issuer_org_id` |

---

*Documentación actualizada: 3 de marzo de 2026*
*Incluye diagnóstico inicial (doc 10, 2026-02-27), proceso de optimización P1-P6 (versiones 46-89+) y correcciones de fase de pruebas P7-P10 (versiones 89-92+)*
