-- MIGRACIÓN: Gestión de Cobros y Cuentas Bancarias
-- Objetivo: Permitir el registro de entradas (pagos) vinculados a proformas y gestionar las cuentas receptoras.

-- 1. Catálogo de Cuentas Bancarias de la Organización
CREATE TABLE IF NOT EXISTS public.org_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    account_type TEXT NOT NULL DEFAULT 'BANCO', -- BANCO, EFECTIVO
    bank_name TEXT NOT NULL, -- Ej: BBVA, Banorte, Santander, o "Efectivo"
    account_number TEXT NOT NULL, -- Cuenta, CLABE, o Nombre de la Caja
    holder_name TEXT NOT NULL, -- Nombre del beneficiario o responsable
    currency TEXT NOT NULL DEFAULT 'MXN', -- MXN, USD
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Registro de Pagos / Abonos a Proformas
CREATE TABLE IF NOT EXISTS public.quotation_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    bank_account_id UUID REFERENCES public.org_bank_accounts(id) ON DELETE SET NULL,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method_code TEXT NOT NULL, -- Código SAT: 01, 03, etc.
    reference TEXT, -- Folio de rastreo, número de cheque, etc.
    evidence_url TEXT, -- Link al comprobante en Storage
    status TEXT NOT NULL DEFAULT 'VERIFICADO', -- PENDIENTE, VERIFICADO, RECHAZADO
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Catálogo de Formas de Pago (SAT)
CREATE TABLE IF NOT EXISTS public.cat_payment_forms (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

INSERT INTO public.cat_payment_forms (code, name) VALUES
('01', 'Efectivo'),
('02', 'Cheque nominativo'),
('03', 'Transferencia electrónica de fondos'),
('04', 'Tarjeta de crédito'),
('05', 'Monedero electrónico'),
('06', 'Dinero electrónico'),
('08', 'Vales de despensa'),
('12', 'Dación en pago'),
('13', 'Pago por subrogación'),
('14', 'Pago por consignación'),
('15', 'Condonación'),
('17', 'Compensación'),
('23', 'Novación'),
('24', 'Confusión'),
('25', 'Remisión de deuda'),
('26', 'Prescripción o caducidad'),
('27', 'A satisfacción del acreedor'),
('28', 'Tarjeta de débito'),
('29', 'Tarjeta de servicios'),
('30', 'Aplicación de anticipos'),
('31', 'Intermediario pagos'),
('99', 'Por definir')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- 4. Catálogo de Bancos Principales (México)
CREATE TABLE IF NOT EXISTS public.cat_mexican_banks (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_major BOOLEAN DEFAULT false
);

INSERT INTO public.cat_mexican_banks (code, name, is_major) VALUES
('002', 'BANAMEX', true),
('012', 'BBVA MEXICO', true),
('014', 'SANTANDER', true),
('021', 'HSBC', true),
('044', 'SCOTIABANK', true),
('072', 'BANORTE', true),
('127', 'AZTECA', true),
('136', 'INBURSA', true),
('062', 'AFIRME', false),
('112', 'BANCO DEL BAJIO', false),
('137', 'BANREGIO', false),
('000', 'EFECTIVO', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_major = EXCLUDED.is_major;

-- 5. Seguridad (RLS)
ALTER TABLE public.org_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_payments ENABLE ROW LEVEL SECURITY;

-- Política para Cuentas Bancarias: Basada en la organización del perfil
DROP POLICY IF EXISTS "Users can manage their organization bank accounts" ON public.org_bank_accounts;
CREATE POLICY "Users can manage their organization bank accounts" ON public.org_bank_accounts
FOR ALL USING (
    organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = (auth.jwt() ->> 'sub')
    )
);

-- Política para Pagos: Basada en la propiedad de la proforma
DROP POLICY IF EXISTS "Users can manage payments for their quotations" ON public.quotation_payments;
CREATE POLICY "Users can manage payments for their quotations" ON public.quotation_payments
FOR ALL USING (
    quotation_id IN (
        SELECT id FROM public.quotations WHERE organization_id IN (
            SELECT organization_id FROM public.profiles WHERE id = (auth.jwt() ->> 'sub')
        )
    )
);

-- 4. Triggers de Consistencia (Multi-tenant)

-- Validar que la cuenta bancaria pertenezca a la misma organización que el usuario que la crea
CREATE OR REPLACE FUNCTION public.validate_bank_account_org()
RETURNS TRIGGER AS $$
DECLARE
    user_org_id UUID;
BEGIN
    SELECT organization_id INTO user_org_id FROM public.profiles WHERE id = (auth.jwt() ->> 'sub');
    IF NEW.organization_id <> user_org_id THEN
        RAISE EXCEPTION 'Conflicto de Identidad: No puedes gestionar cuentas de otra empresa.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_validate_bank_account_org ON public.org_bank_accounts;
CREATE TRIGGER tr_validate_bank_account_org
BEFORE INSERT OR UPDATE ON public.org_bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.validate_bank_account_org();

-- Comentarios para documentación
COMMENT ON TABLE public.org_bank_accounts IS 'Cuentas bancarias autorizadas del emisor para recibir pagos.';
COMMENT ON TABLE public.quotation_payments IS 'Historial de abonos y liquidaciones vinculadas a una proforma/cotización.';
