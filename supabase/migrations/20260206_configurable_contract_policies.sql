-- MIGRACION: Políticas de Contratación Configurables (V2)
-- Objetivo: Permitir al admin ajustar montos de umbral y vincular datos de cotización al contrato.

-- 1. Crear tabla de configuraciones globales
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    key TEXT UNIQUE NOT NULL,
    value NUMERIC NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insertar valores por defecto para la organización (o globales)
INSERT INTO system_settings (key, value, description)
VALUES 
('contract_threshold_amount', 250000, 'Monto mínimo para requerir contrato obligatorio'),
('nom151_threshold_amount', 500000, 'Monto mínimo para requerir sello NOM-151 (Fecha Cierta)')
ON CONFLICT (key) DO NOTHING;

-- 2. Extender quotations con datos para contrato
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS object_of_contract TEXT,
ADD COLUMN IF NOT EXISTS special_clauses TEXT;

-- 3. Función de evaluación de políticas dinámica
CREATE OR REPLACE FUNCTION public.evaluate_contract_policies()
RETURNS TRIGGER AS $$
DECLARE
    v_contract_limit NUMERIC;
    v_nom151_limit NUMERIC;
BEGIN
    -- Obtener límites de la tabla de settings
    SELECT value INTO v_contract_limit FROM system_settings WHERE key = 'contract_threshold_amount';
    SELECT value INTO v_nom151_limit FROM system_settings WHERE key = 'nom151_threshold_amount';

    -- Si no existen las llaves, usar defaults hardcoded de seguridad
    v_contract_limit := COALESCE(v_contract_limit, 250000);
    v_nom151_limit := COALESCE(v_nom151_limit, 500000);

    -- Política de Contrato Obligatorio
    IF NEW.amount_total > v_contract_limit OR NEW.is_bidding_process = TRUE THEN
        NEW.is_contract_required := TRUE;
    END IF;

    -- Política de Fecha Cierta NOM-151
    IF NEW.amount_total > v_nom151_limit THEN
        NEW.requires_nom151 := TRUE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Re-crear trigger
DROP TRIGGER IF EXISTS tr_evaluate_contract_policies ON quotations;
CREATE TRIGGER tr_evaluate_contract_policies
BEFORE INSERT OR UPDATE ON quotations
FOR EACH ROW
EXECUTE FUNCTION public.evaluate_contract_policies();

-- 5. Comentarios
COMMENT ON COLUMN quotations.object_of_contract IS 'Objeto del contrato extraído de la cotización para garantizar congruencia legal.';
COMMENT ON COLUMN quotations.special_clauses IS 'Cláusulas particulares pactadas en la cotización que deben heredarse al contrato.';
