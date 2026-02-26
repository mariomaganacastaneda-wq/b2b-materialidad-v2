-- 2026022508_auto_increment_proforma_number.sql

CREATE OR REPLACE FUNCTION ensure_unique_proforma_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Si el folio solicitado ya existe para esta organizacion, encontramos el maximo real y le sumamos 1
    IF EXISTS (
        SELECT 1 FROM quotations
        WHERE organization_id = NEW.organization_id
        AND proforma_number = NEW.proforma_number
    ) THEN
        -- Casteo fuerte para evitar "COALESCE types text and integer cannot be matched"
        -- Convertimos explícitamente a BIGINT antes de sumar
        SELECT CAST(COALESCE(MAX(CAST(NULLIF(proforma_number::text, '') AS BIGINT)), 0) + 1 AS BIGINT)
        INTO NEW.proforma_number
        FROM quotations
        WHERE organization_id = NEW.organization_id
        AND proforma_number::text ~ '^[0-9]+$'; -- Seguridad extra: solo evualar nums puros
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_ensure_unique_proforma_number ON quotations;
CREATE TRIGGER tr_ensure_unique_proforma_number
BEFORE INSERT ON quotations
FOR EACH ROW
EXECUTE FUNCTION ensure_unique_proforma_number();
