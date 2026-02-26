-- Desactivar temporalmente la Seguridad a Nivel de Fila (RLS) en la tabla 'invoices'
-- Esto permitirá aislar si el problema de que no se guarden las facturas es estrictamente por los permisos o por un typo en el código.

ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;

-- Notificar a PostgREST para que refresque el caché
NOTIFY pgrst, 'reload schema';
