-- Fix: Permitir ver/gestionar OC donde la org es emisor O cliente
-- Necesario porque ahora las proformas emitidas por nosotros tienen
-- issuer_org_id = nuestra org, client_org_id = el tercero

-- ============================================================================
-- 1. purchase_orders policies
-- ============================================================================

DROP POLICY IF EXISTS "Usuarios pueden ver OC de sus organizaciones" ON public.purchase_orders;
DROP POLICY IF EXISTS "Usuarios pueden insertar OC para sus organizaciones" ON public.purchase_orders;
DROP POLICY IF EXISTS "Usuarios pueden actualizar OC de sus organizaciones" ON public.purchase_orders;
DROP POLICY IF EXISTS "Usuarios pueden eliminar OC de sus organizaciones" ON public.purchase_orders;

-- SELECT: ver OC donde somos emisor O cliente
CREATE POLICY "Usuarios pueden ver OC de sus organizaciones"
ON public.purchase_orders FOR SELECT
USING (
    client_org_id IN (
        SELECT organization_id FROM user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
    )
    OR issuer_org_id IN (
        SELECT organization_id FROM user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
    )
    OR public.get_current_user_role() = 'ADMIN'
);

-- INSERT: crear OC si somos emisor O cliente
CREATE POLICY "Usuarios pueden insertar OC para sus organizaciones"
ON public.purchase_orders FOR INSERT
WITH CHECK (
    client_org_id IN (
        SELECT organization_id FROM user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
        AND can_manage_quotations = true
    )
    OR issuer_org_id IN (
        SELECT organization_id FROM user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
        AND can_manage_quotations = true
    )
    OR public.get_current_user_role() = 'ADMIN'
);

-- UPDATE
CREATE POLICY "Usuarios pueden actualizar OC de sus organizaciones"
ON public.purchase_orders FOR UPDATE
USING (
    client_org_id IN (
        SELECT organization_id FROM user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
        AND can_manage_quotations = true
    )
    OR issuer_org_id IN (
        SELECT organization_id FROM user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
        AND can_manage_quotations = true
    )
    OR public.get_current_user_role() = 'ADMIN'
);

-- DELETE
CREATE POLICY "Usuarios pueden eliminar OC de sus organizaciones"
ON public.purchase_orders FOR DELETE
USING (
    client_org_id IN (
        SELECT organization_id FROM user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
        AND can_manage_quotations = true
    )
    OR issuer_org_id IN (
        SELECT organization_id FROM user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
        AND can_manage_quotations = true
    )
    OR public.get_current_user_role() = 'ADMIN'
);

-- ============================================================================
-- 2. purchase_order_items policies
-- ============================================================================

DROP POLICY IF EXISTS "Usuarios pueden ver items de sus OC" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Usuarios pueden gestionar items de sus OC" ON public.purchase_order_items;

CREATE POLICY "Usuarios pueden ver items de sus OC"
ON public.purchase_order_items FOR SELECT
USING (
    purchase_order_id IN (
        SELECT po.id FROM purchase_orders po
        JOIN user_organization_access uoa
            ON (uoa.organization_id = po.client_org_id OR uoa.organization_id = po.issuer_org_id)
        WHERE uoa.profile_id = (auth.jwt() ->> 'sub')
    )
    OR public.get_current_user_role() = 'ADMIN'
);

CREATE POLICY "Usuarios pueden gestionar items de sus OC"
ON public.purchase_order_items FOR ALL
USING (
    purchase_order_id IN (
        SELECT po.id FROM purchase_orders po
        JOIN user_organization_access uoa
            ON (uoa.organization_id = po.client_org_id OR uoa.organization_id = po.issuer_org_id)
        WHERE uoa.profile_id = (auth.jwt() ->> 'sub')
        AND uoa.can_manage_quotations = true
    )
    OR public.get_current_user_role() = 'ADMIN'
);
