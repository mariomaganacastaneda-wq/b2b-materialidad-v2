-- ============================================================================
-- Migración: Tabla purchase_order_requests + columnas en quotations
-- Fecha: 2026-03-25
-- Descripción: Nueva tabla para gestionar solicitudes de OC vinculadas a
--              proformas (cotizaciones). Modela el ciclo de vida de una OC
--              solicitada desde la pantalla de Proforma.
-- Referencia: docs/guias/plan-ordenes-compra-importacion.md (FASE 2)
-- ============================================================================

-- ============================================================================
-- 1. Nueva tabla: purchase_order_requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.purchase_order_requests (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    quotation_id    UUID        NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    status          VARCHAR(50) NOT NULL DEFAULT 'solicitada'
                                CONSTRAINT chk_por_status
                                CHECK (status IN ('solicitada', 'emitida', 'autorizada', 'rechazada')),
    file_url        TEXT,
    po_number       TEXT,
    comments        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.purchase_order_requests IS
    'Solicitudes de Orden de Compra vinculadas a cotizaciones/proformas. '
    'Creadas cuando el toggle O.C. se activa en la pantalla de Proforma.';

COMMENT ON COLUMN public.purchase_order_requests.status IS
    'Estado del ciclo de vida: solicitada → emitida → autorizada | rechazada';
COMMENT ON COLUMN public.purchase_order_requests.file_url IS
    'URL del PDF de la OC subido en el bucket de storage';
COMMENT ON COLUMN public.purchase_order_requests.po_number IS
    'Número de OC asignado por el cliente al momento de autorizar';
COMMENT ON COLUMN public.purchase_order_requests.comments IS
    'Comentarios obligatorios al rechazar, opcionales en otros estados';

-- ============================================================================
-- 2. Nuevas columnas en quotations
-- ============================================================================

ALTER TABLE public.quotations
    ADD COLUMN IF NOT EXISTS req_purchase_order    BOOLEAN     DEFAULT false,
    ADD COLUMN IF NOT EXISTS purchase_order_status VARCHAR(50);

COMMENT ON COLUMN public.quotations.req_purchase_order IS
    'true cuando se activa el toggle de OC en la pantalla de Proforma';
COMMENT ON COLUMN public.quotations.purchase_order_status IS
    'Refleja el estado de la solicitud OC activa: solicitada | emitida | autorizada | rechazada';

-- ============================================================================
-- 3. Índices para performance
-- ============================================================================

-- Queries frecuentes: listar OC de una organización
CREATE INDEX IF NOT EXISTS idx_por_organization_id
    ON public.purchase_order_requests (organization_id);

-- Queries frecuentes: buscar la OC asociada a una proforma
CREATE INDEX IF NOT EXISTS idx_por_quotation_id
    ON public.purchase_order_requests (quotation_id);

-- Queries frecuentes: filtrar por tab de estado (TODAS / SOLICITADA / AUTORIZADA / RECHAZADA)
CREATE INDEX IF NOT EXISTS idx_por_status
    ON public.purchase_order_requests (status);

-- ============================================================================
-- 4. Trigger de updated_at
-- ============================================================================
-- Usa public.handle_updated_at() definida en 20260209_cfdi_catalogs_schema.sql

CREATE TRIGGER set_updated_at_purchase_order_requests
    BEFORE UPDATE ON public.purchase_order_requests
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 5. Habilitar RLS
-- ============================================================================

ALTER TABLE public.purchase_order_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. Políticas RLS
-- Patrón: user_organization_access + get_current_user_role() = 'ADMIN'
-- Referencia: 2026030202_fix_purchase_orders_rls.sql
--             2026030401_purchase_orders_rls_dual_role.sql
-- ============================================================================

-- SELECT: usuarios de la misma organización pueden ver las solicitudes de OC
CREATE POLICY "Usuarios pueden ver solicitudes OC de su organización"
ON public.purchase_order_requests FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM public.user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
    )
    OR public.get_current_user_role() = 'ADMIN'
);

-- INSERT: usuarios con permiso de gestión de cotizaciones pueden crear solicitudes
CREATE POLICY "Usuarios pueden crear solicitudes OC de su organización"
ON public.purchase_order_requests FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM public.user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
        AND can_manage_quotations = true
    )
    OR public.get_current_user_role() = 'ADMIN'
);

-- UPDATE: usuarios con permiso de gestión de cotizaciones pueden actualizar
CREATE POLICY "Usuarios pueden actualizar solicitudes OC de su organización"
ON public.purchase_order_requests FOR UPDATE
USING (
    organization_id IN (
        SELECT organization_id FROM public.user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
        AND can_manage_quotations = true
    )
    OR public.get_current_user_role() = 'ADMIN'
);

-- DELETE: usuarios con permiso de gestión de cotizaciones pueden eliminar
-- (solo aplica cuando el toggle se desactiva y el estado es 'solicitada')
CREATE POLICY "Usuarios pueden eliminar solicitudes OC de su organización"
ON public.purchase_order_requests FOR DELETE
USING (
    organization_id IN (
        SELECT organization_id FROM public.user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
        AND can_manage_quotations = true
    )
    OR public.get_current_user_role() = 'ADMIN'
);
