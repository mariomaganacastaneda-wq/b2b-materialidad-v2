-- 2026022510_daily_proforma_number.sql

CREATE OR REPLACE FUNCTION ensure_unique_proforma_number()
RETURNS TRIGGER AS $$
DECLARE
    max_num BIGINT;
BEGIN
    -- Obtenemos el maximo proforma_number (secuencial diario) para la organizacion de est proforma,
    -- filtrando unicamente para el dia de hoy (DATE() de created_at o del server)
    -- Asumimos que created_at de NEW esta configurado por default a NOW(), pero si viene vacio usamos CURRENT_DATE
    SELECT COALESCE(MAX(CAST(NULLIF(proforma_number::text, '') AS BIGINT)), 0)
    INTO max_num
    FROM quotations
    WHERE organization_id = NEW.organization_id
    AND DATE(COALESCE(created_at, CURRENT_TIMESTAMP)) = DATE(COALESCE(NEW.created_at, CURRENT_TIMESTAMP))
    AND proforma_number::text ~ '^[0-9]+$'; -- Seguridad extra: solo evualar nums puros
    
    -- El nuevo folio sera el maximo actual de este dia + 1
    NEW.proforma_number := (max_num + 1)::text;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Al reemplazar la funcion, el trigger ya existente se actualiza automaticamente en su ejecucion,
-- pero para mayor limpieza podemos recrearlo
DROP TRIGGER IF EXISTS tr_ensure_unique_proforma_number ON quotations;
CREATE TRIGGER tr_ensure_unique_proforma_number
BEFORE INSERT ON quotations
FOR EACH ROW
EXECUTE FUNCTION ensure_unique_proforma_number();
