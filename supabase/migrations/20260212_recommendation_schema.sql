-- Migración para soportar Jerarquía SAT 2026 y Motor de Recomendación
-- Fecha: 2026-02-12

-- 1. Mejorar tabla de actividades económicas
ALTER TABLE public.cat_economic_activities 
ADD COLUMN IF NOT EXISTS sector_code TEXT,
ADD COLUMN IF NOT EXISTS subsector_code TEXT,
ADD COLUMN IF NOT EXISTS parent_code TEXT;

-- 2. Tabla de Tokens de Búsqueda (extraídos de los "Productos" del Excel 2019)
CREATE TABLE IF NOT EXISTS public.cat_activity_search_tokens (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    activity_code TEXT NOT NULL REFERENCES public.cat_economic_activities(code) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    source TEXT DEFAULT 'SAT_2019',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_activity_tokens_keyword ON public.cat_activity_search_tokens USING gin (keyword gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_activity_tokens_code ON public.cat_activity_search_tokens(activity_code);

-- 3. Tabla de Congruencia Fiscal (Relación Actividad <-> ClaveProdServ)
CREATE TABLE IF NOT EXISTS public.rel_activity_cps_congruence (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    activity_code TEXT NOT NULL REFERENCES public.cat_economic_activities(code),
    cps_family_code TEXT NOT NULL, -- Primeros 4 dígitos (Familia UNSPSC)
    score FLOAT DEFAULT 1.0, -- Nivel de confianza (0.0 a 1.0)
    reason TEXT, -- Justificación (ej. Matriz SAT 2019)
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(activity_code, cps_family_code)
);

COMMENT ON TABLE public.rel_activity_cps_congruence IS 'Motor de Recomendación: Vincula actividades del CSF con familias de productos permitidos.';
