-- MIGRACION: Prefacturación y Flujo de Validación (Billing-Sales Link)
-- Objetivo: Soportar el ciclo de vida de una factura desde prefactura hasta timbrado.

-- 1. Crear tipo enumerado para los estados de la factura
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
        CREATE TYPE invoice_status AS ENUM (
            'PREFACTURA_PENDIENTE', -- Creada por Facturación
            'EN_REVISION_VENDEDOR', -- Notificada al vendedor
            'VALIDADA',            -- Aceptada por vendedor
            'RECHAZADA',           -- Con solicitud de corrección
            'TIMBRADA',            -- Factura oficial (CFDI)
            'CANCELADA'
        );
    END IF;
END $$;

-- 2. Agregar columna de estado a la tabla de facturas
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS status invoice_status DEFAULT 'PREFACTURA_PENDIENTE',
ADD COLUMN IF NOT EXISTS correction_notes TEXT,
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES profiles(id);

-- 3. Trigger para notificar al vendedor cuando se crea una PREFACTURA
CREATE OR REPLACE FUNCTION notify_preinvoice_validation()
RETURNS TRIGGER AS $$
DECLARE
    v_vendor_id UUID;
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

DROP TRIGGER IF EXISTS tr_notify_preinvoice_status ON invoices;
CREATE TRIGGER tr_notify_preinvoice_status
AFTER UPDATE OF status ON invoices
FOR EACH ROW
EXECUTE FUNCTION notify_preinvoice_validation();

COMMENT ON COLUMN invoices.status IS 'Estado del flujo de validación entre Ventas y Facturación.';
COMMENT ON COLUMN invoices.correction_notes IS 'Notas de corrección enviadas por el vendedor para el área de facturación.';
