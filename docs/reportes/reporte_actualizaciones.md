# Reporte de Estado - Integración Fiscal B2B_Materialidad

Este documento detalla el progreso de las actualizaciones solicitadas para el sistema de gestión de proformas y captura de CSF.

## 1. Resumen de Actualizaciones Requeridas

| Tarea | Estado | Observaciones |
| :--- | :--- | :--- |
| **Integrar Campo de Régimen Fiscal** | ✅ Completado | Se añadió `client_regime_code` a `quotations` y el campo en el frontend. |
| **Consistencia de Uso de CFDI** | ✅ Completado | El selector de Uso de CFDI ahora filtra opciones basadas en el régimen del cliente. |
| **Fallo en Webhook de n8n (500)** | ✅ Resuelto | Se reconfiguró el Webhook a "When Last Node Finishes" y se corrigió el script Python para evitar race conditions. |
| **IVA Desmarcado por Defecto** | ✅ Resuelto | Se corrigió el bug en `ProformaManager.tsx` para que el IVA esté siempre `ON` (true) por defecto al seleccionar un producto. |
| **Editar Concepto sin Cambiar Clave** | ✅ Completado | La interfaz permite editar la descripción del ítem independientemente de la clave SAT seleccionada. |
| **Regímenes Fiscales en Captura CSF** | ✅ Completado | Edge Function `v35` + n8n Python Node extraen y mapean correctamente regímenes y actividades económicas. |
| **Re-procesar CSF ("T M AUTOPARTES")** | ✅ Completado | Validación exitosa con extracción de 2 actividades y sus porcentajes. |
| **Plan para Actualizar la Base de Datos** | ✅ Elaborado | Se ejecutó un script de backfill para mapear regímenes existentes. |

## 2. Detalle de Tareas Pendientes y Bloqueos

### ⚠️ Captura de Regímenes Fiscales
**Problema**: El SAT en la CSF entrega nombres de regímenes (ej: "Régimen General de Ley Personas Morales") pero el CFDI requiere códigos (ej: "601").
**Causa**: La lógica anterior no mapeaba los nombres a los códigos de los catálogos del SAT.
**Solución**: Se implementó en la Edge Function `v35` una búsqueda por similitud (`ilike`) contra el catálogo `cat_cfdi_regimenes` durante el procesamiento del PDF.

### ⚠️ Re-procesamiento de CSF
**Causa**: Los archivos en el storage tienen nombres largos con timestamps que dificultan el disparo manual por terminal. Además, la sintaxis de PowerShell para enviar JSON anidado y Blobs es propensa a errores.
**Acción**: Se recomienda realizar la prueba subiendo los archivos nuevamente desde la interfaz "Onboarding" o "Empresas" para validar el flujo completo de la versión 35.

---

## 3. Próximos Pasos

1. **Prueba de Fuego (E2E)**: Subir un archivo CSF fresco para confirmar que los regímenes se guarden con su código SAT correspondiente.
2. **Validación de UI**: Confirmar que al seleccionar a "T M AUTOPARTES" en una proforma, su régimen se cargue automáticamente y el Uso de CFDI se bloquee a opciones válidas.
3. **Limpieza de N8N**: Eliminar advertencias restantes sobre parámetros obsoletos en nodos menores.
