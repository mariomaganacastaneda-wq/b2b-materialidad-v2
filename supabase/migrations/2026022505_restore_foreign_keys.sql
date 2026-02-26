-- Restaurar las llaves foráneas que fueron eliminadas por el DROP TABLE invoices CASCADE
-- Estas llaves son vitales para que Supabase PostgREST entienda las relaciones.

-- 1. Tabla evidence
ALTER TABLE evidence 
DROP CONSTRAINT IF EXISTS evidence_invoice_id_fkey;

ALTER TABLE evidence
ADD CONSTRAINT evidence_invoice_id_fkey 
FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

-- 2. Tabla payments
ALTER TABLE payments 
DROP CONSTRAINT IF EXISTS payments_invoice_id_fkey;

ALTER TABLE payments
ADD CONSTRAINT payments_invoice_id_fkey 
FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

-- Forzar la recarga del schema cache de PostgREST
NOTIFY pgrst, 'reload schema';
