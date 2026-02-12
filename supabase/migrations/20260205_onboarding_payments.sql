-- SCHEMA: Onboarding y Pagos B2B_Materialidad
-- Objetivo: Almacenar CSF, Cuentas Bancarias y Comprobantes de Pago

-- 1. Cuentas Bancarias del Prestador de Servicios
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    clabe TEXT UNIQUE NOT NULL,
    account_number TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Documentos Maestros (Onboarding/Configuración Inicial/Licitaciones)
CREATE TABLE IF NOT EXISTS master_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- 'CONSTITUTIVA', 'ESCRITURA', 'PODER', 'CSF', 'SAT_32D', 'IMSS_32D', 'INFONAVIT_32D', 'REPSE', 'DOMICILIO', 'ID_REPRESENTANTE', 'BANCARIO'
    file_url TEXT NOT NULL,
    sha256_hash TEXT NOT NULL,
    metadata JSONB,
    validity_date DATE,
    is_public_for_clients BOOLEAN DEFAULT FALSE, -- Para envío automático en procesos de licitación/alta
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Gestión de Pagos (Cierre de Materialidad)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id),
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT DEFAULT 'MXN',
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reference_id TEXT, -- Folio SPEI / Autorización
    proof_url TEXT, -- Link al PDF/XML del CEP (Comprobante Electrónico de Pago)
    sha256_hash TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Habilitar RLS para las nuevas tablas
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
