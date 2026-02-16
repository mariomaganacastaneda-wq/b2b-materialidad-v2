# Plan de Corrección de Acentos y Codificación

## Objetivo
Eliminar definitivamente los caracteres extraños (mojibake) y asegurar que todos los acentos se visualicen correctamente en la aplicación B2B_Materialidad.

## Tareas
1. **Auditoría de Codificación**: Identificar archivos con secuencias de bytes inválidas o caracteres "Ã".
2. **Corrección Masiva**: Aplicar reemplazos de cadenas específicas en `App.tsx` y otros archivos detectados.
3. **Normalización a UTF-8**: Asegurar que todos los archivos editados se guarden con codificación UTF-8 sin BOM.
4. **Verificación Visual**: Comprobar que el `DiagnosticBar` y otras etiquetas no tengan artefactos visuales.

## Archivos Impactados
- `web/src/App.tsx` (Principal foco de errores en `DiagnosticBar` y placeholders)
- `web/src/components/settings/SettingsPage.tsx`
- `web/src/components/settings/CompanyDetails.tsx`

## Métodos
- Uso de scripts de Python para manipulación directa de bytes o limpieza de strings.
- Búsqueda con ripgrep (`grep_search`) de patrones comunes de error (Ã³, Ã¡, etc).
