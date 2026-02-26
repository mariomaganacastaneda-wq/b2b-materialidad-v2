-- Restaurar columnas faltantes en la tabla invoices
-- Durante la recreación de la tabla (2026022501), estas columnas provenientes
-- de iteraciones anteriores no fueron incluidas, lo que causó el error silencioso en React (PGRST204).

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS preinvoice_comments TEXT,
ADD COLUMN IF NOT EXISTS invoice_comments TEXT,
ADD COLUMN IF NOT EXISTS preinvoice_authorized BOOLEAN DEFAULT FALSE;

-- Asegurar que la seguridad por nivel de fila vuelva a estar activa (la habíamos apagado para debugear)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Forzar recarga del schema de PostgREST
NOTIFY pgrst, 'reload schema';
