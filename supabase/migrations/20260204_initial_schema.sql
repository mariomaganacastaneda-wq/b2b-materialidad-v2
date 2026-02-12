-- SCHEMA DE BASE DE DATOS: B2B_Materialidad
-- Objetivo: Gestión de Materialidad y Fecha Cierta

-- 1. Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Organizaciones (Multi-tenant)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    rfc TEXT UNIQUE NOT NULL,
    legal_representative TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Perfiles de Usuario
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    full_name TEXT,
    role TEXT CHECK (role IN ('ADMIN', 'VENDEDOR', 'CONTABLE', 'CLIENTE')) DEFAULT 'VENDEDOR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Vendedores/Proveedores de la Organización (para monitoreo de materialidad)
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    rfc TEXT NOT NULL,
    razon_social TEXT NOT NULL,
    sat_status TEXT CHECK (sat_status IN ('LIMPIO', 'PRESUNTO', 'DEFINITIVO', 'DESVIRTUADO')) DEFAULT 'LIMPIO',
    last_validation_date TIMESTAMP WITH TIME ZONE,
    risk_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Cotizaciones
CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    vendor_id UUID REFERENCES vendors(id),
    consecutive_id SERIAL,
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT DEFAULT 'MXN',
    status TEXT CHECK (status IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA')) DEFAULT 'PENDIENTE',
    description TEXT,
    file_url TEXT, -- PDF/Imagen de la solicitud
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Contratos y Fecha Cierta (NOM-151)
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID REFERENCES quotations(id),
    file_url TEXT NOT NULL,
    nom151_metadata JSONB, -- Hash, Timestamp, PSC Info
    is_signed_representative BOOLEAN DEFAULT FALSE,
    is_signed_client BOOLEAN DEFAULT FALSE,
    fecha_cierta_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Facturas (CFDI 4.0)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID REFERENCES quotations(id),
    uuid UUID UNIQUE NOT NULL, -- Folio Fiscal del SAT
    xml_url TEXT,
    pdf_url TEXT,
    amount_total DECIMAL(15,2),
    rfc_emisor TEXT,
    rfc_receptor TEXT,
    status_sat TEXT, -- Vigente, Cancelado
    type TEXT CHECK (type IN ('PRODUCTO', 'SERVICIO')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Evidencia de Materialidad (Breadcrumbs)
CREATE TABLE evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices,
    contract_id UUID REFERENCES contracts,
    type TEXT NOT NULL, -- 'FOTO', 'GPS', 'LOG', 'BITACORA'
    file_url TEXT,
    metadata JSONB, -- {gps: {lat, lng}, device: '...', etc}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Listas Negras SAT (Art. 69-B) - Cache Global
CREATE TABLE sat_blacklist (
    rfc TEXT PRIMARY KEY,
    razon_social TEXT,
    estatus TEXT,
    fecha_publicacion DATE,
    dof_url TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Pagos y Comprobantes
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices,
    amount_paid DECIMAL(15,2),
    payment_method TEXT, -- SPEI, Transferencia, etc.
    proof_url TEXT, -- PDF/Imagen del comprobante
    payment_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Auditoría (Inmutabilidad)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT,
    record_id UUID,
    action TEXT, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    user_id UUID REFERENCES auth.users,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- POLÍTICAS DE RLS (Ejemplos)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- (Más políticas se definirán según el flujo de usuarios)
