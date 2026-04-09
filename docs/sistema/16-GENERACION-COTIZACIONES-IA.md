# Generación de Cotizaciones con IA

**Versión:** 1.0 | **Fecha:** 2026-04-09 | **Autor:** Claude Code

---

## Resumen

Sistema de generación automática de documentos de cotización usando OpenAI (gpt-4o) 
a través de workflows de n8n. Genera 2 tipos de documentos:

| Documento | Quién lo emite | Branding | Precios | Workflow n8n |
|---|---|---|---|---|
| **Solicitud** | Cliente → Emisora | Del cliente | NO | `B2B_Generar_Cotizacion_IA` |
| **Emisión** | Emisora → Cliente | De la emisora | SÍ | `B2B_Generar_Emision_Cotizacion_IA` |

---

## Arquitectura

```
┌─────────────────────┐     POST /webhook      ┌──────────────────┐
│  QuotationRequests   │ ──────────────────────▷│  n8n Workflow     │
│  (React frontend)    │                        │                  │
│                      │     JSON response      │  1. Webhook      │
│  • Formulario modal  │ ◁──────────────────────│  2. Preparar     │
│  • Escaneo solicitud │                        │     Prompt       │
│  • Guardar HTML      │                        │  3. OpenAI Chat  │
│  • Botones Ver/Word  │                        │  4. Generar HTML │
└─────────────────────┘                        │  5. Preparar     │
                                                │     Upload       │
                                                │  6. Preparar     │
                                                │     Respuesta    │
                                                └──────────────────┘
```

---

## Workflows n8n

### Solicitud: `B2B_Generar_Cotizacion_IA`

- **ID:** `Hr3V5fGlWzB8DZOC`
- **Webhook:** `POST https://n8n-n8n.5gad6x.easypanel.host/webhook/generar-cotizacion`
- **6 nodos** lineales
- **Rol del agente IA:** Formal, profesional, neutro. NO incluye precios.
- **Campos JSON que genera:** encabezado, saludo, cuerpo_solicitud, conceptos_refinados[], condiciones_texto, clausulas_legales, despedida, pie_pagina

### Emisión: `B2B_Generar_Emision_Cotizacion_IA`

- **ID:** `nzPdvXH1r8QW836g`
- **Webhook:** `POST https://n8n-n8n.5gad6x.easypanel.host/webhook/generar-emision-cotizacion`
- **6 nodos** lineales
- **Rol del agente IA:** Comercial, persuasivo, profesional. SÍ incluye precios y totales.
- **Campos JSON que genera:** encabezado, saludo_comercial, referencia_solicitud, cuerpo_cotizacion, conceptos_con_precios[], resumen_totales{}, propuesta_valor, condiciones_texto, clausulas_legales, despedida, pie_pagina
- **Recibe contexto de solicitud previa** para generar respuesta coherente

---

## Payload enviado al webhook

```json
{
  "tipo": "solicitud | emision",
  "quotation_id": "uuid",
  "proforma": {
    "folio": "SSI-070426-03",
    "items": [
      {
        "code": "72102900",
        "description": "Servicio de limpieza",
        "quantity": 1,
        "unit": "E48",
        "unitPrice": 13500,
        "has_iva": true
      }
    ],
    "subtotal": 13500,
    "iva": 2160,
    "total": 15660,
    "currency": "MXN",
    "client_name": "LATAMGYM",
    "client_rfc": "LAT110824BJ4"
  },
  "campos_usuario": {
    "fecha_emision": "2026-04-09",
    "vigencia": "30",
    "incluye_iva": true,
    "lugar_entrega": "Oficinas del cliente",
    "forma_pago": "transferencia",
    "condiciones_credito": "30",
    "observaciones": "Texto libre",
    "firmante_comercial": "Mario Magaña",
    "firmante_ventas": "Ricardo López",
    "firmante_cliente": ""
  },
  "branding_principal": {
    "nombre": "LATAMGYM",
    "rfc": "LAT110824BJ4",
    "logo_url": "https://...",
    "primary_color": "#e5322d",
    "secondary_color": "#45af95",
    "accent_color": "#0c1221",
    "slogan": "Somos la Mejor solución B2B"
  },
  "branding_contraparte": {
    "nombre": "SEIDCO SERVICIOS",
    "rfc": "SSI101213VD1"
  },
  "contexto_solicitud": "Texto extraído de la solicitud previa (solo para emisión)"
}
```

---

## Respuesta del webhook

```json
{
  "success": true,
  "pdf_url": null,
  "html_content": "<!DOCTYPE html>...",
  "ai_content": { "encabezado": "...", "saludo": "...", ... },
  "ai_summary": "SOLICITUD DE COTIZACIÓN generada para SEIDCO - Folio b56ea6c5",
  "folio": "b56ea6c5",
  "tipo": "solicitud",
  "pdf_generated": false
}
```

---

## Frontend — QuotationRequests.tsx

### Flujo de generación

1. Usuario abre modal de cotización → ve botón **"Generar con IA"** en cada sección
2. Clic → se abre modal popup con formulario (fecha, vigencia, IVA, lugar, pago, crédito, firmantes)
3. Si es **emisión** y existe solicitud previa:
   - Descarga el HTML de Supabase Storage
   - Extrae texto con DOMParser
   - Extrae nombre del firmante (busca en `<div class="firma">` → `<strong>`)
   - Precarga datos en el formulario
   - Envía texto como `contexto_solicitud` al webhook
4. Clic "Generar PDF con IA" → POST al webhook de n8n
5. Recibe `html_content` → guarda como `.html` en Supabase Storage
6. Actualiza `solicitud_url` o `revision_emisor_url` + lifecycle

### Botones cuando hay archivo HTML generado

| Botón | Acción |
|---|---|
| 👁 **Ver** (Eye) | Descarga HTML de Supabase, lo abre como Blob en nueva pestaña |
| 📝 **Word** (FileEdit) | Descarga HTML, lo envuelve con XML de Word, descarga como `.doc` |
| 🗑 **Eliminar** (Trash2) | Borra archivo de Storage y limpia campo en BD |

El botón Word solo aparece cuando el archivo es `.html` (generado por IA).
Los PDFs subidos manualmente solo muestran Ver y Eliminar.

### Función `handleOpenAsWord`

Convierte HTML a Word al vuelo sin servidor:

```typescript
const handleOpenAsWord = async (filePath: string) => {
    // 1. Descargar HTML de Supabase
    const { data } = await supabase.storage.from('quotations').download(filePath);
    const htmlText = await data.text();
    
    // 2. Envolver con XML de Microsoft Office
    const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" 
                            xmlns:w="urn:schemas-microsoft-com:office:word">
        <head><meta charset="utf-8">
        <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
        ${estilos}
        </head><body>${contenido}</body></html>`;
    
    // 3. Descargar como .doc
    const blob = new Blob([wordHtml], { type: 'application/msword' });
    // ... trigger download
};
```

---

## Identidad Visual — CompanyDetails.tsx

### Cambio aplicado

La sección "Identidad Visual y Generador 60-30-10" ahora está habilitada para **clientes** 
además de emisoras:

```diff
- {org.is_issuer && (
+ {(org.is_issuer || org.is_client) && (
```

### Upload de logo implementado

```typescript
const handleLogoUpload = async (e) => {
    // Sube a bucket 'logos' en Supabase Storage
    // Guarda URL pública en org.logo_url via onUpdateDetail
};
```

---

## Escaneo inteligente de solicitud previa (para emisión)

| Tipo de archivo | Método de extracción |
|---|---|
| `.html` / `.doc` (generado por IA) | Descarga de Supabase → DOMParser → textContent |
| `.pdf` / `.jpg` (subido manualmente) | Descarga → base64 → envía a n8n para OpenAI Vision |
| Sin solicitud | Usa solo datos de la proforma |

### Extracción del firmante (3 métodos en cascada)

1. **DOM:** Busca `<div class="firma">` que contenga "Comercial" → lee `<strong>`
2. **Fallback DOM:** Busca cualquier `<strong>` cuyo hermano siguiente diga "Comercial"
3. **Regex:** Busca patrón `"nombre Área Comercial"` en texto plano

---

## Formato de números en n8n

`toLocaleString('es-MX')` no funciona en el runtime de n8n (Node.js server).
Se usa función manual:

```javascript
const fmtNum = (n) => {
    const num = parseFloat(n) || 0;
    const parts = num.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
};
// 41500 → "41,500.00"
```

---

## Credenciales y variables de entorno

| Recurso | Ubicación |
|---|---|
| OpenAI API | Credencial n8n `g8dQ4umCJzSW8juR` ("OpenAi account") |
| Supabase URL | Variable n8n `SUPABASE_URL_B2B` |
| Supabase Anon Key | Variable n8n `SUPABASE_ANON_PUBLIC_KEY_B2B` |
| Supabase Service Key | Variable n8n `SUPABASE_SERVICE_ROLE_KEY_B2B` |
| Bucket Storage | `quotations` (público) |

---

## Coexistencia con upload manual

Ambos métodos coexisten en el mismo modal:
- **Subir PDF manualmente** → arrastra/selecciona archivo → se sube directo
- **Generar con IA** → formulario → webhook n8n → HTML generado

Si se genera con IA sobre una cotización que ya tiene archivo manual, el archivo anterior se reemplaza.
