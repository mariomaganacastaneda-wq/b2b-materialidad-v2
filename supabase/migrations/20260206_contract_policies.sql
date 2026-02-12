-- MIGRACION: Políticas de Contratación y Fecha Cierta (NOM-151)
-- Objetivo: Automatizar el requerimiento de contratos y sellos de tiempo.

-- 1. Extender la tabla quotations con flags de política
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS is_bidding_process BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS requires_nom151 BOOLEAN DEFAULT FALSE;

-- 2. Función para evaluar políticas automáticamente basado en monto
CREATE OR REPLACE FUNCTION public.evaluate_contract_policies()
RETURNS TRIGGER AS $$
BEGIN
    -- Política de Contrato Obligatorio (> $250,000)
    IF NEW.amount_total > 250000 OR NEW.is_licitation = TRUE THEN
        NEW.is_contract_required := TRUE;
    END IF;

    -- Política de Fecha Cierta NOM-151 (> $500,000)
    IF NEW.amount_total > 500000 THEN
        NEW.requires_nom151 := TRUE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger preventivo en la tabla de cotizaciones
DROP TRIGGER IF EXISTS tr_evaluate_contract_policies ON quotations;
CREATE TRIGGER tr_evaluate_contract_policies
BEFORE INSERT OR UPDATE ON quotations
FOR EACH ROW
EXECUTE FUNCTION public.evaluate_contract_policies();

-- 4. Comentarios de documentación técnica
COMMENT ON COLUMN quotations.is_contract_required IS 'Determinado automáticamente por monto (>250k) o licitación.';
COMMENT ON COLUMN quotations.requires_nom151 IS 'Obligatorio para montos >500k según política de materialidad.';
COMMENT ON COLUMN quotations.is_bidding_process IS 'Indica si la proforma viene de un proceso de licitación.';
