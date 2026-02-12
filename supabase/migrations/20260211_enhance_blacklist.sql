-- MODIFICACIÓN DE SCHEMA: Mejora de Lista Negra SAT para Automatización
-- Fecha: 2026-02-11

ALTER TABLE sat_blacklist 
ADD COLUMN IF NOT EXISTS entidad_federativa TEXT,
ADD COLUMN IF NOT EXISTS tipo_listado TEXT, -- '69' o '69-B'
ADD COLUMN IF NOT EXISTS numero_oficio TEXT;

COMMENT ON COLUMN sat_blacklist.tipo_listado IS 'Categoría del listado: 69 para incumplidos, 69-B para operaciones inexistentes';
