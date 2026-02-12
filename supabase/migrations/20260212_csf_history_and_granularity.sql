-- migración: 20260212_csf_history_and_granularity.sql
-- Objetivo: Soportar historial de CSF, validación de fechas y mapeo granular de actividades SAT.

-- 1. Asegurar columnas en table organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS tax_status TEXT,
ADD COLUMN IF NOT EXISTS tax_domicile TEXT,
ADD COLUMN IF NOT EXISTS csf_emission_date DATE,
ADD COLUMN IF NOT EXISTS last_csf_update TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Añadir código de actividad a la tabla de relación de organizaciones
ALTER TABLE public.organization_activities
ADD COLUMN IF NOT EXISTS activity_code TEXT;

-- 3. Crear tabla de historial de CSF
CREATE TABLE IF NOT EXISTS public.organization_csf_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    emission_date DATE NOT NULL,
    extracted_data JSONB NOT NULL, -- Snapshot total de lo extraído por n8n por si se requiere auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Comentarios para documentación
COMMENT ON COLUMN public.organizations.csf_emission_date IS 'Fecha real de emisión leída del PDF para validar obsolescencia';
COMMENT ON COLUMN public.organization_activities.activity_code IS 'Código de 6 dígitos del catálogo SAT 2026';
COMMENT ON TABLE public.organization_csf_history IS 'Almacén de versiones previas de la situación fiscal de las empresas';

-- 5. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_org_csf_history_org_id ON public.organization_csf_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_activities_code ON public.organization_activities(activity_code);
