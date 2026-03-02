-- Crear el bucket de Storage para comprobantes de pago
-- Este bucket es referenciado en ProformaManager.tsx y Pagos.tsx pero nunca fue creado
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-evidence', 'payment-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Seguridad para el Bucket payment-evidence
-- Seguimos el mismo patrón de contracts y quotations

-- Limpiar políticas existentes (idempotente)
DROP POLICY IF EXISTS "Usuarios autenticados pueden subir comprobantes de pago" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver comprobantes de pago" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden borrar comprobantes de pago" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar comprobantes de pago" ON storage.objects;

-- 1. Insertar (subir comprobantes)
CREATE POLICY "Usuarios autenticados pueden subir comprobantes de pago"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-evidence');

-- 2. Leer (ver/descargar comprobantes)
CREATE POLICY "Usuarios autenticados pueden ver comprobantes de pago"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'payment-evidence');

-- 3. Borrar (eliminar comprobantes)
CREATE POLICY "Usuarios autenticados pueden borrar comprobantes de pago"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'payment-evidence');

-- 4. Actualizar (reemplazar comprobantes)
CREATE POLICY "Usuarios autenticados pueden actualizar comprobantes de pago"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'payment-evidence');
