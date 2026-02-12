-- MIGRACION: Soporte para Facturación Directa (Fast-Track)
-- Objetivo: Permitir que proformas con historial consistente se timbren sin prefactura.

-- 1. Agregar flag de Facturación Directa a Quotations
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS request_direct_invoice BOOLEAN DEFAULT FALSE;

-- 2. Comentario informativo
COMMENT ON COLUMN quotations.request_direct_invoice IS 'Si es TRUE, la proforma bypassa el estado de prefactura y viaja directo a timbrado (Fast-Track).';

-- 3. Actualización de lógica de notificaciones (Opcional: Ajustar prioridad)
-- Facturación verá estas proformas con una prioridad distinta en su bandeja de entrada.
