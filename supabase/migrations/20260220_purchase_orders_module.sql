-- ============================================================================
-- Migración: Módulo de Órdenes de Compra (OC)
-- Fecha: 2026-02-20
-- ============================================================================

-- 1. Tabla Principal de Órdenes de Compra (Cabecera)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number VARCHAR(100) NOT NULL, -- Número de folio u OC (Ej: Goodyear P.O. # 8241019376)
    emission_date DATE,
    issuer_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL, -- El que emite la orden (Ej. Goodyear)
    client_org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE, -- Tu cliente (B2B) al que le expiden la OC
    currency VARCHAR(10) DEFAULT 'MXN',
    subtotal NUMERIC(15,2) DEFAULT 0,
    tax_total NUMERIC(15,2) DEFAULT 0,
    grand_total NUMERIC(15,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'PENDING_REVIEW', -- Estado del procesamiento OCR: PENDING_REVIEW, APPROVED, REJECTED, CONVERTED_TO_PROFORMA
    source_file_url TEXT, -- Ruta en Storage del PDF original
    raw_ocr_data JSONB, -- Toda la metadata arrojada por el LLM en N8N (para revisión humana o auditoría)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Partidas Individuales
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    item_code VARCHAR(100), -- Código SKU o identificador propio del proveedor (si lo hay)
    description TEXT NOT NULL,
    quantity NUMERIC(15,4) NOT NULL DEFAULT 1,
    unit_measure VARCHAR(50), -- EA, PZA, KGM, Servicio, etc
    unit_price NUMERIC(15,4) NOT NULL DEFAULT 0,
    discount NUMERIC(15,4) DEFAULT 0,
    tax_amount NUMERIC(15,4) DEFAULT 0,
    total_amount NUMERIC(15,4) NOT NULL DEFAULT 0, -- Cantidad * Unit Price
    -- Opcional: Relación a un producto interno de tu catálogo después de mapear
    linked_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Índices por desempeño
CREATE INDEX idx_po_number ON public.purchase_orders(po_number);
CREATE INDEX idx_po_client_org ON public.purchase_orders(client_org_id);
CREATE INDEX idx_po_issuer_org ON public.purchase_orders(issuer_org_id);
CREATE INDEX idx_po_items_po_id ON public.purchase_order_items(purchase_order_id);

-- 4. Triggers de updated_at
CREATE TRIGGER handle_updated_at_purchase_orders
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.moddatetime (updated_at);

-- 5. Bucket de Almacenamiento
INSERT INTO storage.buckets (id, name, public) VALUES ('purchase_orders', 'purchase_orders', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Políticas RLS (Row Level Security) - Habilitar
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- 6.1 Políticas para Órdenes de Compra
CREATE POLICY "Usuarios pueden ver OC de sus organizaciones" 
ON public.purchase_orders FOR SELECT 
USING (
    client_org_id IN (
        SELECT organization_id FROM user_organization_access WHERE profile_id = auth.uid()
    )
);

CREATE POLICY "Usuarios pueden insertar OC para sus organizaciones" 
ON public.purchase_orders FOR INSERT 
WITH CHECK (
    client_org_id IN (
        SELECT organization_id FROM user_organization_access WHERE profile_id = auth.uid() AND can_manage_quotations = true
    )
);

CREATE POLICY "Usuarios pueden actualizar OC de sus organizaciones" 
ON public.purchase_orders FOR UPDATE 
USING (
    client_org_id IN (
        SELECT organization_id FROM user_organization_access WHERE profile_id = auth.uid() AND can_manage_quotations = true
    )
);

CREATE POLICY "Usuarios pueden eliminar OC de sus organizaciones" 
ON public.purchase_orders FOR DELETE 
USING (
    client_org_id IN (
        SELECT organization_id FROM user_organization_access WHERE profile_id = auth.uid() AND can_manage_quotations = true
    )
);

-- 6.2 Políticas para los items
CREATE POLICY "Usuarios pueden ver items de sus OC" 
ON public.purchase_order_items FOR SELECT 
USING (
    purchase_order_id IN (
        SELECT po.id FROM purchase_orders po
        JOIN user_organization_access uoa ON uoa.organization_id = po.client_org_id
        WHERE uoa.profile_id = auth.uid()
    )
);

CREATE POLICY "Admins pueden hacer todo en items OC" 
ON public.purchase_order_items FOR ALL 
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- 7. Políticas del Bucket Storage
CREATE POLICY "Cualquier usuario puede ver OCs"
ON storage.objects FOR SELECT
USING ( bucket_id = 'purchase_orders' );

CREATE POLICY "Usuarios autenticados pueden subir OCs"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'purchase_orders' AND auth.role() = 'authenticated' );

CREATE POLICY "Admins pueden borrar OCs"
ON storage.objects FOR DELETE
USING ( bucket_id = 'purchase_orders' AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN' );
