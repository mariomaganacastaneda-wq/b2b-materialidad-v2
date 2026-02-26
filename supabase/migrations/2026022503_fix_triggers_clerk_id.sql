-- Hotfix: Convertir dependencias de perfiles a TEXT para compatibilidad total con Clerk.
-- El uso de UUID en triggers y llaves foráneas choca con los JWT string "user_...".

-- 1. Modificar tipos de columna en tablas existentes
ALTER TABLE notifications ALTER COLUMN recipient_id TYPE TEXT;
ALTER TABLE quotations ALTER COLUMN created_by TYPE TEXT;

-- 2. Corregir función notify_vendor_on_invoice
CREATE OR REPLACE FUNCTION notify_vendor_on_invoice()
RETURNS TRIGGER AS $$
DECLARE
    v_vendor_id TEXT;
    v_quotation_no TEXT;
BEGIN
    -- Obtener el vendedor de la cotización vinculada
    SELECT id, profiles.id, (SELECT consecutive_id FROM quotations WHERE id = NEW.quotation_id) 
    INTO v_vendor_id, v_vendor_id, v_quotation_no
    FROM profiles 
    WHERE id = (SELECT profile_id FROM quotations WHERE id = NEW.quotation_id LIMIT 1); 

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

-- 3. Corregir función notify_preinvoice_validation
CREATE OR REPLACE FUNCTION notify_preinvoice_validation()
RETURNS TRIGGER AS $$
DECLARE
    v_vendor_id TEXT;
    v_msg TEXT;
BEGIN
    -- Obtener el vendedor desde la cotización origen
    SELECT created_by INTO v_vendor_id 
    FROM quotations 
    WHERE id = NEW.quotation_id;

    IF NEW.status = 'EN_REVISION_VENDEDOR' THEN
        v_msg := 'Se ha generado una prefactura para la cotización #' || 
                 (SELECT consecutive_id FROM quotations WHERE id = NEW.quotation_id) || 
                 '. Favor de validar para proceder al timbrado.';
        
        INSERT INTO notifications (organization_id, recipient_id, type, title, message, metadata)
        VALUES (
            NEW.organization_id,
            v_vendor_id,
            'PREFACTURA_POR_VALIDAR',
            'Validación de Prefactura Requerida',
            v_msg,
            jsonb_build_object('invoice_id', NEW.id, 'quotation_id', NEW.quotation_id)
        );
    END IF;

    -- Notificar a facturación si el vendedor rechaza (correciones)
    IF NEW.status = 'RECHAZADA' THEN
         INSERT INTO notifications (organization_id, recipient_id, type, title, message, metadata)
         SELECT NEW.organization_id, id, 'CORRECCION_SOLICITADA', 'Corrección de Prefactura', 
                'El vendedor ha solicitado correcciones en la prefactura: ' || NEW.correction_notes,
                jsonb_build_object('invoice_id', NEW.id)
         FROM profiles 
         WHERE role = 'FACTURACION' AND organization_id = NEW.organization_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
