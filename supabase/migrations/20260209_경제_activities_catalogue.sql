-- Migración: Creación del Catálogo de Actividades Económicas SAT 2026
-- Descripción: Implementa una estructura taxonómica jerárquica para las actividades del SAT.

-- 1. Crear tipo enumerado para los niveles taxonómicos
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_level') THEN
        CREATE TYPE activity_level AS ENUM ('SECTOR', 'SUBSECTOR', 'RAMA', 'SUBRAMA');
    END IF;
END $$;

-- 2. Crear tabla de catálogo de actividades
CREATE TABLE IF NOT EXISTS public.cat_economic_activities (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    level activity_level NOT NULL,
    parent_id UUID REFERENCES public.cat_economic_activities(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Habilitar RLS
ALTER TABLE public.cat_economic_activities ENABLE ROW LEVEL SECURITY;

-- 4. Crear política de lectura pública
CREATE POLICY "Actividades económicas son legibles por todos" 
ON public.cat_economic_activities FOR SELECT 
USING (true);

-- 5. Comentario de la tabla
COMMENT ON TABLE public.cat_economic_activities IS 'Catálogo jerárquico de actividades económicas del SAT 2026, alineado con el SCIAN.';

-- 6. Población de datos iniciales basada en el análisis estructural
WITH 
-- SECTORES
ins_sector_1 AS (
    INSERT INTO public.cat_economic_activities (code, name, description, level, metadata)
    VALUES ('S1', 'Sector Primario', 'Agricultura, Ganadería, Silvicultura y Pesca. Tratamientos preferenciales (Tasa 0% IVA y exenciones ISR).', 'SECTOR', '{"vigilancia": "estricta", "beneficios": "exenciones ISR, tasa 0% IVA"}')
    RETURNING id
),
ins_sector_2 AS (
    INSERT INTO public.cat_economic_activities (code, name, description, level, metadata)
    VALUES ('S2', 'Sector Construcción', 'Infraestructura y Servicios. Clasificación estricta para cumplimiento REPSE.', 'SECTOR', '{"cumplimiento": "REPSE", "obligaciones": "SIROC"}')
    RETURNING id
),
ins_sector_3 AS (
    INSERT INTO public.cat_economic_activities (code, name, description, level, metadata)
    VALUES ('S3', 'Industrias Manufactureras', 'Identificación de capacidad técnica: productores vs comercializadoras.', 'SECTOR', '{"validacion": "COFEPRIS"}')
    RETURNING id
),
ins_sector_4 AS (
    INSERT INTO public.cat_economic_activities (code, name, description, level, metadata)
    VALUES ('S4', 'Comercio y Transportes', 'Determina obligación de facturación global y retenciones específicas.', 'SECTOR', '{"logistica": "e-commerce"}')
    RETURNING id
),
ins_sector_5 AS (
    INSERT INTO public.cat_economic_activities (code, name, description, level, metadata)
    VALUES ('S5', 'Servicios Profesionales, Financieros y Personales', 'Vigilancia CNBV y alta complejidad técnica.', 'SECTOR', '{"fiscalizacion": "dividendos, asalariados"}')
    RETURNING id
),

-- SUBSECTORES / RAMAS / SUBRAMAS (Ejemplos del análisis)
-- Sector Primario -> Agricultura
ins_sub_1_1 AS (
    INSERT INTO public.cat_economic_activities (code, name, description, level, parent_id, metadata)
    SELECT '1', 'Agricultura y Semillas Oleaginosas', 'Cultivo de granos y semillas para apoyo al campo.', 'SUBSECTOR', id, '{"programas": "SADER"}' FROM ins_sector_1
    RETURNING id
),
-- Subramas Agricultura
ins_subr_1_1_1 AS (
    INSERT INTO public.cat_economic_activities (code, name, description, level, parent_id, metadata)
    SELECT '1', 'Siembra, cultivo y cosecha de soya', 'Soya integral.', 'SUBRAMA', id, '{"conceptos": ["Soya integral"], "relevancia": "Programas de apoyo al campo"}' FROM ins_sub_1_1
),
ins_subr_1_1_2 AS (
    INSERT INTO public.cat_economic_activities (code, name, description, level, parent_id, metadata)
    SELECT '2', 'Siembra, cultivo y cosecha de cártamo', 'Oleaginosas anuales.', 'SUBRAMA', id, '{"conceptos": ["Oleaginosas anuales"], "relevancia": "Clasificación técnica"}' FROM ins_sub_1_1
),

-- Sector Construcción -> Edificación
ins_sub_2_1 AS (
    INSERT INTO public.cat_economic_activities (code, name, description, level, parent_id, metadata)
    SELECT 'C1', 'Edificación y Otros', 'Servicios de construcción y supervisión técnica.', 'SUBSECTOR', id, '{}' FROM ins_sector_2
    RETURNING id
),
ins_subr_2_1_1 AS (
    INSERT INTO public.cat_economic_activities (code, name, description, level, parent_id, metadata)
    SELECT '126', 'Administración de construcción de vivienda', 'Supervisión técnica y financiera (Sin ejecución).', 'SUBRAMA', id, '{"implicacion": "Project Management"}' FROM ins_sub_2_1
),
ins_subr_2_1_2 AS (
    INSERT INTO public.cat_economic_activities (code, name, description, level, parent_id, metadata)
    SELECT '2361', 'Edificación de vivienda', 'Construcción residencial.', 'SUBRAMA', id, '{"obligaciones": ["SIROC", "IMSS"]}' FROM ins_sub_2_1
),

-- Sector Manufactura -> Maquinaria
ins_sub_3_1 AS (
    INSERT INTO public.cat_economic_activities (code, name, description, level, parent_id, metadata)
    SELECT 'M1', 'Maquinaria y Equipo', 'Fabricación de equipo industrial y médico.', 'SUBSECTOR', id, '{}' FROM ins_sector_3
    RETURNING id
),
ins_subr_3_1_1 AS (
    INSERT INTO public.cat_economic_activities (code, name, description, level, parent_id, metadata)
    SELECT '406', 'Maquinaria agrícola', 'Tractores y arados.', 'SUBRAMA', id, '{"detalles": "Tasa 0% IVA en enajenación"}' FROM ins_sub_3_1
),
ins_subr_3_1_2 AS (
    INSERT INTO public.cat_economic_activities (code, name, description, level, parent_id, metadata)
    SELECT '474', 'Equipo médico y dental', 'Prótesis y mobiliario.', 'SUBRAMA', id, '{"certificacion": "COFEPRIS"}' FROM ins_sub_3_1
)

SELECT 'Catálogo cargado exitosamente' as status;
