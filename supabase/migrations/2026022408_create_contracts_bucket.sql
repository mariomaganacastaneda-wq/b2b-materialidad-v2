-- Crear el bucket de Storage para los Contratos
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS en objetos de storage
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad para el Bucket contracts
-- 1. Insertar
CREATE POLICY "Usuarios pueden subir contratos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contracts');

-- 2. Leer
CREATE POLICY "Usuarios pueden leer contratos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'contracts');

-- 3. Borrar
CREATE POLICY "Usuarios pueden borrar contratos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'contracts');

-- 4. Actualizar
CREATE POLICY "Usuarios pueden actualizar contratos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'contracts');
