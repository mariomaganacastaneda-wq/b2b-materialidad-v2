-- 1. Crear tipo enumerado para los niveles de productos/servicios
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_service_level') THEN
        CREATE TYPE product_service_level AS ENUM ('DIVISION', 'GROUP', 'CLASS', 'PRODUCT');
    END IF;
END $$;

-- 2. Añadir columnas de jerarquía a la tabla de productos y servicios
ALTER TABLE public.cat_cfdi_productos_servicios 
ADD COLUMN IF NOT EXISTS parent_code TEXT REFERENCES public.cat_cfdi_productos_servicios(code) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS level product_service_level;

-- 3. Comentarios para documentación
COMMENT ON COLUMN public.cat_cfdi_productos_servicios.parent_code IS 'Referencia al código del nodo padre en la taxonomía SAT (e.g., Clase -> Grupo -> División)';
COMMENT ON COLUMN public.cat_cfdi_productos_servicios.level IS 'Nivel taxonómico del registro (DIVISION, GROUP, CLASS, PRODUCT)';
