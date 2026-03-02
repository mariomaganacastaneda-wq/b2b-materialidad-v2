-- Fix: Reemplazar políticas de purchase_orders que usan profiles.organization_id (single-org)
-- con user_organization_access (multi-org) + bypass ADMIN via get_current_user_role()

-- ============================================================================
-- 1. Corregir políticas de purchase_orders
-- ============================================================================

-- DROP todas las políticas existentes (nombres reales en producción)
DROP POLICY IF EXISTS "Tenant isolation - Purchase Orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Admins can manage all purchase_orders" ON public.purchase_orders;
-- DROP nombres alternativos (migraciones anteriores)
DROP POLICY IF EXISTS "Usuarios pueden ver OC de sus organizaciones" ON public.purchase_orders;
DROP POLICY IF EXISTS "Usuarios pueden insertar OC para sus organizaciones" ON public.purchase_orders;
DROP POLICY IF EXISTS "Usuarios pueden actualizar OC de sus organizaciones" ON public.purchase_orders;
DROP POLICY IF EXISTS "Usuarios pueden eliminar OC de sus organizaciones" ON public.purchase_orders;

-- SELECT: usuarios ven OC de sus organizaciones + ADMIN ve todo
CREATE POLICY "Usuarios pueden ver OC de sus organizaciones"
ON public.purchase_orders FOR SELECT
USING (
    client_org_id IN (
        SELECT organization_id FROM user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
    )
    OR public.get_current_user_role() = 'ADMIN'
);

-- INSERT: usuarios con permiso pueden crear OC + ADMIN puede crear cualquiera
CREATE POLICY "Usuarios pueden insertar OC para sus organizaciones"
ON public.purchase_orders FOR INSERT
WITH CHECK (
    client_org_id IN (
        SELECT organization_id FROM user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
        AND can_manage_quotations = true
    )
    OR public.get_current_user_role() = 'ADMIN'
);

-- UPDATE: usuarios con permiso pueden actualizar + ADMIN
CREATE POLICY "Usuarios pueden actualizar OC de sus organizaciones"
ON public.purchase_orders FOR UPDATE
USING (
    client_org_id IN (
        SELECT organization_id FROM user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
        AND can_manage_quotations = true
    )
    OR public.get_current_user_role() = 'ADMIN'
);

-- DELETE: usuarios con permiso pueden eliminar + ADMIN
CREATE POLICY "Usuarios pueden eliminar OC de sus organizaciones"
ON public.purchase_orders FOR DELETE
USING (
    client_org_id IN (
        SELECT organization_id FROM user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
        AND can_manage_quotations = true
    )
    OR public.get_current_user_role() = 'ADMIN'
);

-- ============================================================================
-- 2. Corregir políticas de purchase_order_items
-- ============================================================================

DROP POLICY IF EXISTS "Usuarios pueden ver items de sus OC" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Admins pueden hacer todo en items OC" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Usuarios pueden gestionar items de sus OC" ON public.purchase_order_items;

-- SELECT: usuarios ven items de OC de sus organizaciones
CREATE POLICY "Usuarios pueden ver items de sus OC"
ON public.purchase_order_items FOR SELECT
USING (
    purchase_order_id IN (
        SELECT po.id FROM purchase_orders po
        JOIN user_organization_access uoa ON uoa.organization_id = po.client_org_id
        WHERE uoa.profile_id = (auth.jwt() ->> 'sub')
    )
    OR public.get_current_user_role() = 'ADMIN'
);

-- ALL para usuarios con acceso + ADMIN
CREATE POLICY "Usuarios pueden gestionar items de sus OC"
ON public.purchase_order_items FOR ALL
USING (
    purchase_order_id IN (
        SELECT po.id FROM purchase_orders po
        JOIN user_organization_access uoa ON uoa.organization_id = po.client_org_id
        WHERE uoa.profile_id = (auth.jwt() ->> 'sub')
        AND uoa.can_manage_quotations = true
    )
    OR public.get_current_user_role() = 'ADMIN'
);
