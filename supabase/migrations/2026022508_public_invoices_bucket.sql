-- Solución para permitir la carga de archivos cuando falla la sincronización JWT de Clerk
-- Como App.tsx reporta "Auth session missing!", las peticiones van como 'anon' (anónimas).
-- Para que el almacenamiento no bloquee la carga silenciosamente, abrimos el bucket invoices al público.

-- 1. Asegurar que el bucket existe y es explícitamente público
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Eliminar todas las políticas del storage.objects
DROP POLICY IF EXISTS "Allow any user to upload invoices" ON storage.objects;
DROP POLICY IF EXISTS "Allow any user to update invoices" ON storage.objects;
DROP POLICY IF EXISTS "Allow any user to see invoices" ON storage.objects;
DROP POLICY IF EXISTS "Allow any user to delete invoices" ON storage.objects;

-- 3. Crear políticas completamente públicas para desarrollo
CREATE POLICY "Public Upload Invoices"
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Public Update Invoices"
ON storage.objects FOR UPDATE 
USING (bucket_id = 'invoices');

CREATE POLICY "Public Select Invoices"
ON storage.objects FOR SELECT 
USING (bucket_id = 'invoices');

CREATE POLICY "Public Delete Invoices"
ON storage.objects FOR DELETE 
USING (bucket_id = 'invoices');

-- Recargar el caché
NOTIFY pgrst, 'reload schema';
