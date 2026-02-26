-- Hotfix 2: Corregir el nombre de la columna en el trigger (profile_id -> created_by)
-- La tabla quotations usa 'created_by' para ligar al perfil, NO 'profile_id'.

CREATE OR REPLACE FUNCTION notify_vendor_on_invoice()
RETURNS TRIGGER AS $$
DECLARE
    v_vendor_id TEXT;
    v_quotation_no TEXT;
BEGIN
    -- Obtener el vendedor de la cotización vinculada
    SELECT created_by, (SELECT consecutive_id::text FROM quotations WHERE id = NEW.quotation_id) 
    INTO v_vendor_id, v_quotation_no
    FROM quotations 
    WHERE id = NEW.quotation_id LIMIT 1;

    IF v_vendor_id IS NOT NULL THEN
        INSERT INTO notifications (organization_id, recipient_id, type, title, message, metadata)
        VALUES (
            NEW.organization_id,
            v_vendor_id,
            'FACTURA_CARGADA',
            'Nueva Factura Vinculada',
            'La factura con folio ' || COALESCE(NEW.internal_number, 'S/N') || ' ha sido cargada para la cotización #' || COALESCE(v_quotation_no, 'S/N'),
            jsonb_build_object('invoice_id', NEW.id, 'quotation_id', NEW.quotation_id)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
