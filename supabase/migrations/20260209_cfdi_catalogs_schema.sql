-- Migración: Creación de Tablas para Catálogos CFDI 4.0
-- Fecha: 2026-02-09

-- 1. Tabla de Regímenes Fiscales
CREATE TABLE IF NOT EXISTS public.cat_cfdi_regimenes (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    applies_to_physical BOOLEAN DEFAULT FALSE,
    applies_to_moral BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.cat_cfdi_regimenes IS 'Catálogo oficial del SAT para regímenes fiscales (c_RegimenFiscal)';

-- 2. Tabla de Usos de CFDI
CREATE TABLE IF NOT EXISTS public.cat_cfdi_usos (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    applies_to_physical BOOLEAN DEFAULT FALSE,
    applies_to_moral BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.cat_cfdi_usos IS 'Catálogo oficial del SAT para usos de CFDI (c_UsoCFDI)';

-- 3. Tabla de Claves de Productos y Servicios
CREATE TABLE IF NOT EXISTS public.cat_cfdi_productos_servicios (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    includes_iva_transfered BOOLEAN DEFAULT FALSE,
    includes_ieps_transfered BOOLEAN DEFAULT FALSE,
    similarity_threshold FLOAT DEFAULT 0, -- Para futuro motor de búsqueda
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.cat_cfdi_productos_servicios IS 'Catálogo oficial del SAT para Claves de Productos y Servicios (c_ClaveProdServ)';

-- Habilitar RLS (Seguridad)
ALTER TABLE public.cat_cfdi_regimenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cat_cfdi_usos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cat_cfdi_productos_servicios ENABLE ROW LEVEL SECURITY;

-- Políticas de Lectura Pública (Solo lectura para usuarios autenticados)
CREATE POLICY "Allow public read on cfdi_regimenes" ON public.cat_cfdi_regimenes FOR SELECT USING (true);
CREATE POLICY "Allow public read on cfdi_usos" ON public.cat_cfdi_usos FOR SELECT USING (true);
CREATE POLICY "Allow public read on cfdi_productos_servicios" ON public.cat_cfdi_productos_servicios FOR SELECT USING (true);

-- Triggers para actualización automática de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_regimenes BEFORE UPDATE ON public.cat_cfdi_regimenes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_usos BEFORE UPDATE ON public.cat_cfdi_usos FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_productos BEFORE UPDATE ON public.cat_cfdi_productos_servicios FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
