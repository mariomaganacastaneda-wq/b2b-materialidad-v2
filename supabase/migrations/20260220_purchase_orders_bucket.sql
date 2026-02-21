-- Crear el bucket de Storage para las Órdenes de Compra
INSERT INTO storage.buckets (id, name, public)
VALUES ('purchase_orders', 'purchase_orders', false)
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS en el bucket de purchase_orders si no está habilitado
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad para el Bucket purchase_orders
-- 1. Los usuarios logueados pueden subir archivos a purchase_orders
CREATE POLICY "Usuarios pueden subir OCs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'purchase_orders');

-- 2. Los usuarios logueados pueden leer/descargar archivos de purchase_orders
CREATE POLICY "Usuarios pueden leer OCs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'purchase_orders');

-- 3. Los usuarios logueados pueden borrar archivos (usado si fallan extracciones o cancelan)
CREATE POLICY "Usuarios pueden borrar OCs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'purchase_orders');
