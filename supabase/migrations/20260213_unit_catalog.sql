-- Migración: Creación de Tabla para Catálogo de Unidades CFDI
-- Fecha: 2026-02-13

CREATE TABLE IF NOT EXISTS public.cat_cfdi_unidades (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    symbol TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.cat_cfdi_unidades IS 'Catálogo oficial del SAT para Claves de Unidad (c_ClaveUnidad)';

-- Habilitar RLS
ALTER TABLE public.cat_cfdi_unidades ENABLE ROW LEVEL SECURITY;

-- Política de Lectura Pública
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy WHERE polname = 'Allow public read on cfdi_unidades'
    ) THEN
        CREATE POLICY "Allow public read on cfdi_unidades" ON public.cat_cfdi_unidades FOR SELECT USING (true);
    END IF;
END $$;

-- Trigger para updated_at
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_unidades'
    ) THEN
        CREATE TRIGGER set_updated_at_unidades 
        BEFORE UPDATE ON public.cat_cfdi_unidades 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END $$;
