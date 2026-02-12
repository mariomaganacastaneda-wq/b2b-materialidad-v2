-- SCHEMA: Materialidad Fotográfica e Inmutabilidad
-- Objetivo: Capturar metadatos técnicos y auditar cambios de ubicación

-- 1. Tabla de metadatos de evidencia
CREATE TABLE IF NOT EXISTS evidence_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evidence_id UUID REFERENCES evidence(id) ON DELETE CASCADE,
    
    -- Metadatos extraídos (si existen)
    original_exif JSONB, 
    
    -- Datos capturados por el sistema al subir (Browser/Mobile GPS)
    detected_latitude DECIMAL(10, 8),
    detected_longitude DECIMAL(11, 8),
    
    -- Ajuste manual (Sustitución controlada)
    corrected_latitude DECIMAL(10, 8),
    corrected_longitude DECIMAL(11, 8),
    
    -- Auditoría
    upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID REFERENCES profiles(id),
    audit_comment TEXT, -- Motivo de la sustitución de ubicación
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar RLS
ALTER TABLE evidence_metadata ENABLE ROW LEVEL SECURITY;

-- 3. Función para validar materialidad (Check de consistencia)
-- Si la ubicación detectada difiere mucho de la corregida, marcar para revisión
CREATE OR REPLACE FUNCTION check_location_consistency()
RETURNS TRIGGER AS $$
BEGIN
    IF ABS(NEW.detected_latitude - NEW.corrected_latitude) > 0.1 OR 
       ABS(NEW.detected_longitude - NEW.corrected_longitude) > 0.1 THEN
        -- Aquí se podría disparar una alerta de 'Materialidad en Riesgo'
        RAISE NOTICE 'Advertencia: Gran discrepancia en la ubicación de la evidencia.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_check_location_consistency
BEFORE INSERT OR UPDATE ON evidence_metadata
FOR EACH ROW
WHEN (NEW.corrected_latitude IS NOT NULL AND NEW.detected_latitude IS NOT NULL)
EXECUTE FUNCTION check_location_consistency();
