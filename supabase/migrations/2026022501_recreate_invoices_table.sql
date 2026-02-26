-- Recreación limpia de la tabla invoices para corregir el error 22P02 (Token Bearer / JSON parsing)

-- 1. Respaldar datos existentes (si los hay)
CREATE TABLE IF NOT EXISTS invoices_backup AS SELECT * FROM invoices;

-- 2. Eliminar la tabla actual (esto elimina triggers y dependencias locales que causaban el error)
DROP TABLE invoices CASCADE;

-- 3. Recrear la tabla con el esquema exacto original
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id),
    quotation_id UUID REFERENCES quotations(id),
    contract_id UUID REFERENCES contracts(id),
    internal_number TEXT UNIQUE, -- Número interno para ligar documentos (Prompt V1)
    uuid UUID UNIQUE, -- Folio Fiscal (null si es prefactura)
    is_preinvoice BOOLEAN DEFAULT FALSE,
    preinvoice_url TEXT,
    is_validated_by_vendor BOOLEAN DEFAULT FALSE,
    rfc_emisor TEXT,
    rfc_receptor TEXT,
    client_cp TEXT,
    client_regime TEXT,
    cfdi_use TEXT,
    payment_method_id TEXT,
    payment_form_id TEXT,
    xml_url TEXT,
    pdf_url TEXT,
    amount_total DECIMAL(15,2),
    status_sat TEXT DEFAULT 'Vigente', -- Vigente, Cancelado
    substitution_of_uuid UUID REFERENCES invoices(uuid), -- Relación 04
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Restaurar enum status y columnas adicionales
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS status invoice_status DEFAULT 'PREFACTURA_PENDIENTE',
ADD COLUMN IF NOT EXISTS correction_notes TEXT,
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS validated_by TEXT REFERENCES profiles(id);

-- 4. Reaplicar Políticas de Seguridad (RLS) necesarias
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - Invoices" ON invoices 
FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()::text));

CREATE POLICY "Admins can manage all invoices" ON invoices
FOR ALL TO authenticated USING ( public.get_current_user_role() = 'ADMIN' ) WITH CHECK ( public.get_current_user_role() = 'ADMIN' );

-- 5. Reaplicar Trigger de Notificaciones Base
DROP TRIGGER IF EXISTS tr_notify_vendor_invoice ON invoices;
CREATE TRIGGER tr_notify_vendor_invoice
AFTER INSERT ON invoices
FOR EACH ROW
WHEN (NEW.quotation_id IS NOT NULL)
EXECUTE FUNCTION notify_vendor_on_invoice();

-- 6. Trigger Prefactura
DROP TRIGGER IF EXISTS tr_notify_preinvoice_status ON invoices;
CREATE TRIGGER tr_notify_preinvoice_status
AFTER UPDATE OF status ON invoices
FOR EACH ROW
EXECUTE FUNCTION notify_preinvoice_validation();

-- 7. Restaurar los datos de respaldo si aplican
INSERT INTO invoices (id, organization_id, vendor_id, quotation_id, contract_id, internal_number, uuid, is_preinvoice, preinvoice_url, is_validated_by_vendor, rfc_emisor, rfc_receptor, client_cp, client_regime, cfdi_use, payment_method_id, payment_form_id, xml_url, pdf_url, amount_total, status_sat, substitution_of_uuid, created_at, status, correction_notes, validated_at, validated_by)
SELECT id, organization_id, vendor_id, quotation_id, contract_id, internal_number, uuid, is_preinvoice, preinvoice_url, is_validated_by_vendor, rfc_emisor, rfc_receptor, client_cp, client_regime, cfdi_use, payment_method_id, payment_form_id, xml_url, pdf_url, amount_total, status_sat, substitution_of_uuid, created_at, status, correction_notes, validated_at, validated_by FROM invoices_backup
ON CONFLICT (id) DO NOTHING;
