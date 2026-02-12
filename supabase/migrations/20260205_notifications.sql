-- SCHEMA: Notificaciones y Preferencias B2B_Materialidad
-- Objetivo: Avisar a vendedores sobre carga de facturas externas vía Email o Telegram

-- 1. Extender perfiles con preferencias de notificación
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS notification_prefered_channels TEXT[] DEFAULT ARRAY['EMAIL'],
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- 2. Tabla de Notificaciones vinculada
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES profiles(id),
    type TEXT NOT NULL, -- 'FACTURA_CARGADA', 'CONTRATO_FIRMADO', etc.
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB, -- { invoice_id: '...', quotation_id: '...' }
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Trigger para informar al vendedor cuando se vincula una factura a su cotización
CREATE OR REPLACE FUNCTION notify_vendor_on_invoice()
RETURNS TRIGGER AS $$
DECLARE
    v_vendor_id UUID;
    v_quotation_no TEXT;
BEGIN
    -- Obtener el vendedor de la cotización vinculada
    SELECT id, profiles.id, (SELECT consecutive_id FROM quotations WHERE id = NEW.quotation_id) 
    INTO v_vendor_id, v_vendor_id, v_quotation_no
    FROM profiles 
    WHERE id = (SELECT profile_id FROM quotations WHERE id = NEW.quotation_id LIMIT 1); -- Asumiendo que agregamos profile_id a quotations para saber quién la creó

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

-- NOTA: El trigger requiere que la tabla quotations tenga un campo para rastrear al vendedor (owner)
-- Si no existe, lo agregamos:
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

DROP TRIGGER IF EXISTS tr_notify_vendor_invoice ON invoices;
CREATE TRIGGER tr_notify_vendor_invoice
AFTER INSERT ON invoices
FOR EACH ROW
WHEN (NEW.quotation_id IS NOT NULL)
EXECUTE FUNCTION notify_vendor_on_invoice();
