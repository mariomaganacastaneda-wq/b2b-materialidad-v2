# Plan de Implementación: Estabilización de Datos Fiscales y E2E

Este plan describe los pasos finales para asegurar la integridad de los datos fiscales extraídos de la CSF y su correcta visualización en el generador de proformas.

## Fase 1: Sincronización de Base de Datos (Completada/Pendiente)
1. **[X] Migración de Esquema**: Adición de `regime_code` en `organization_regimes` y `client_regime_code` en `quotations`.
2. **[X] Mapeo de Catálogos**: Carga de compatibilidad entre Regímenes y Usos de CFDI.
3. **[X] Backfill de Datos**: Ejecución de SQL para normalizar registros históricos basados en nombres de regímenes conocidos.

## Fase 2: Robustez de la Edge Function (V35)
1. **[X] Normalización de Nombres**: Remover palabras ruidosas (ej: "Fiscal", "Régimen") antes de buscar en catálogos.
2. **[X] Búsqueda Fuzzy**: Implementar `ilike` para capturar variaciones menores en la extracción de n8n.
3. **[ ] Manejo de Errores**: Asegurar que si un régimen no se mapea, se registre el nombre original para auditoría manual.

## Fase 3: Optimización de Componentes Frontend
1. **[X] ProformaManager**: Carga automática del régimen del cliente al seleccionarlo.
2. **[X] Filtro de Uso CFDI**: Bloqueo de selecciones inválidas según el régimen.
3. **[X] IVA Manual**: Permitir edición del concepto sin resetear la clave SAT y mantener IVA activo.
4. **[ ] Feedback Visual**: Mostrar un aviso cuando el uso seleccionado no es compatible con el régimen cargado (Validación reactiva).

## Fase 4: Pruebas de Aceptación (E2E)
1. **Subida de CSF**: Cargar el PDF de "T M AUTOPARTES".
2. **Inspección de DB**: Verificar en la tabla `organization_regimes` que la columna `regime_code` NO sea nula.
3. **Creación de Proforma**:
   - Seleccionar a T M AUTOPARTES.
   - Verificar que el Régimen aparezca como "601 - General de Ley...".
   - Verificar que el Uso "Gastos en General" sea seleccionable.
   - Agregar un ítem y verificar que el IVA esté marcado por defecto.
