-- SCHEMA DE BASE DE DATOS: B2B_Materialidad (v2.0)
-- Objetivo: Garantía de Materialidad y Fecha Cierta (NOM-151)
-- Fecha: 2026-02-05

-- 1. Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Organizaciones (Tenant Root)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    rfc TEXT UNIQUE NOT NULL, -- RFC de la empresa cliente
    legal_representative TEXT,
    tax_domicile TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Perfiles de Usuario (vía Auth de Supabase)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    phone_whatsapp TEXT, -- Para notificaciones automáticas (Prompt V1)
    role TEXT CHECK (role IN ('ADMIN', 'VENDEDOR', 'FACTURACION', 'REPRESENTANTE', 'GESTOR_NOM151', 'CXC', 'CONTABLE', 'CLIENTE')) DEFAULT 'VENDEDOR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Proveedores / Vendors (Due Diligence)
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    rfc TEXT NOT NULL,
    razon_social TEXT NOT NULL,
    tax_regime TEXT, -- Régimen Fiscal
    compliance_opinion_url TEXT, -- URL a la Opinión de Cumplimiento (32-D)
    sat_status TEXT CHECK (sat_status IN ('LIMPIO', 'PRESUNTO', 'DEFINITIVO', 'DESVIRTUADO')) DEFAULT 'LIMPIO',
    last_validation_date TIMESTAMP WITH TIME ZONE,
    risk_score INTEGER DEFAULT 0, -- Cálculo interno de riesgo
    latitude DECIMAL(10, 8), -- Validación geográfica
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, rfc)
);

-- 5. Cotizaciones / Solicitudes
CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id),
    consecutive_id SERIAL,
    amount_subtotal DECIMAL(15,2) NOT NULL,
    amount_iva DECIMAL(15,2) NOT NULL,
    amount_total DECIMAL(15,2) NOT NULL,
    currency TEXT DEFAULT 'MXN',
    status TEXT CHECK (status IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'EXPIRADA')) DEFAULT 'PENDIENTE',
    is_licitation BOOLEAN DEFAULT FALSE,
    is_contract_required BOOLEAN DEFAULT FALSE, -- Evaluado por sistema o forzado por vendedor
    type TEXT CHECK (type IN ('PRODUCTO', 'SERVICIO')),
    description TEXT,
    request_file_url TEXT, -- PDF de la cotización
    proforma_excel_url TEXT, -- Excel de la proforma (Prompt V1)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5.1 Detalles de Cotización / Proforma
CREATE TABLE quotation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    sat_product_key TEXT, -- Según catálogo SAT
    quantity DECIMAL(15,4) NOT NULL,
    unit_id TEXT, -- ID Unidad SAT
    description TEXT NOT NULL,
    unit_price DECIMAL(15,4) NOT NULL,
    discount DECIMAL(15,2) DEFAULT 0,
    subtotal DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Contratos y Fecha Cierta (NOM-151)
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    quotation_id UUID REFERENCES quotations(id),
    file_url TEXT NOT NULL,
    sha256_hash TEXT NOT NULL, -- Inmutabilidad del documento
    nom151_tsr_token TEXT, -- Token binario de la NOM-151 (ASN.1)
    nom151_metadata JSONB, -- {timestamp, psc, serial_number, version}
    is_signed_representative BOOLEAN DEFAULT FALSE,
    is_signed_vendor BOOLEAN DEFAULT FALSE,
    fecha_cierta_date TIMESTAMP WITH TIME ZONE, -- Fecha oficial del sello de tiempo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Facturas (CFDI 4.0)
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
    rfc_emisor TEXT NOT NULL,
    rfc_receptor TEXT NOT NULL,
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

-- 8. Evidencia Breadcrumbs (Materialidad)
CREATE TABLE evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id),
    contract_id UUID REFERENCES contracts(id),
    type TEXT NOT NULL, -- 'FOTO', 'GPS', 'LOG', 'BITACORA', 'ENTREGABLE'
    file_url TEXT,
    sha256_hash TEXT, -- Garantía de integridad WORM
    file_size BIGINT,
    mime_type TEXT,
    metadata JSONB, -- {gps: {lat, lng}, device_id: '...', agent_id: '...'}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Listas Negras SAT (Cache Global)
CREATE TABLE sat_blacklist (
    rfc TEXT PRIMARY KEY,
    razon_social TEXT,
    estatus TEXT, -- PRESUNTO, DEFINITIVO, DESVIRTUADO
    fecha_publicacion DATE,
    dof_url TEXT,
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Pagos / Trazabilidad Financiera
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id),
    amount_paid DECIMAL(15,2),
    payment_method TEXT, -- SPEI, Transferencia
    spei_vua_url TEXT, -- Comprobante de pago electrónico
    payment_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Auditoría Centralizada (Inmutabilidad del Sistema)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES auth.users,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Habilitar RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 13. Políticas RLS Básicas (Tenant Isolation)
-- Nota: En producción esto se refinará para roles específicos.

CREATE POLICY "Org members can view their own organization" 
ON organizations FOR SELECT USING (id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their own profile" 
ON profiles FOR SELECT USING (id = auth.uid());

-- Política general de aislamiento por organization_id
-- Para simplificar el plan inicial, aplicamos esto globalmente:
CREATE POLICY "Tenant isolation - Vendors" ON vendors 
FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation - Quotations" ON quotations 
FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation - Contracts" ON contracts 
FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation - Invoices" ON invoices 
FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation - Evidence" ON evidence 
FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation - Payments" ON payments 
FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation - Audit" ON audit_logs 
FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
