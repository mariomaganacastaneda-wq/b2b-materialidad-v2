-- ============================================================
-- Módulo: Estimaciones de Obra y Propuesta Económica
-- Fecha: 2026-04-15
-- Descripción: Tablas para presupuestos de obra civil y
--              estimaciones de avance por partida.
-- ============================================================

-- 1. Propuesta económica / Presupuesto de obra
CREATE TABLE IF NOT EXISTS public.work_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    budget_number VARCHAR(50),
    description TEXT,
    total_amount NUMERIC(15,2) DEFAULT 0,
    amount_subtotal NUMERIC(15,2) DEFAULT 0,
    amount_iva NUMERIC(15,2) DEFAULT 0,
    anticipo_amount NUMERIC(15,2) DEFAULT 0,
    anticipo_amortizado NUMERIC(15,2) DEFAULT 0,
    source_file_url TEXT,
    status VARCHAR(50) DEFAULT 'borrador'
        CHECK (status IN ('borrador','aprobado','en_ejecucion','completado','cancelado')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Partidas del presupuesto (conceptos de obra)
CREATE TABLE IF NOT EXISTS public.work_budget_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_budget_id UUID NOT NULL REFERENCES public.work_budgets(id) ON DELETE CASCADE,
    item_number SMALLINT NOT NULL,
    description TEXT NOT NULL,
    unit VARCHAR(20) NOT NULL,
    quantity NUMERIC(15,4) NOT NULL,
    unit_price NUMERIC(15,4) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    material_cost NUMERIC(15,2) DEFAULT 0,
    labor_cost NUMERIC(15,2) DEFAULT 0,
    equipment_cost NUMERIC(15,2) DEFAULT 0,
    utility_cost NUMERIC(15,2) DEFAULT 0,
    indirect_cost NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Estimaciones de avance
CREATE TABLE IF NOT EXISTS public.work_estimations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_budget_id UUID NOT NULL REFERENCES public.work_budgets(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL,
    estimation_number SMALLINT NOT NULL,
    period_from DATE,
    period_to DATE,
    amount_subtotal NUMERIC(15,2) DEFAULT 0,
    amount_iva NUMERIC(15,2) DEFAULT 0,
    amount_total NUMERIC(15,2) DEFAULT 0,
    accumulated_previous NUMERIC(15,2) DEFAULT 0,
    accumulated_total NUMERIC(15,2) DEFAULT 0,
    remaining NUMERIC(15,2) DEFAULT 0,
    anticipo_amortizado_est NUMERIC(15,2) DEFAULT 0,
    progress_percentage SMALLINT DEFAULT 0,
    evidence_url TEXT,
    status VARCHAR(50) DEFAULT 'borrador'
        CHECK (status IN ('borrador','enviada','validada','pagada','rechazada')),
    validated_by TEXT,
    validated_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(work_budget_id, estimation_number)
);

-- 4. Detalle por partida de cada estimación
CREATE TABLE IF NOT EXISTS public.work_estimation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_estimation_id UUID NOT NULL REFERENCES public.work_estimations(id) ON DELETE CASCADE,
    work_budget_item_id UUID NOT NULL REFERENCES public.work_budget_items(id) ON DELETE CASCADE,
    volume_previous NUMERIC(15,4) DEFAULT 0,
    volume_this_estimation NUMERIC(15,4) DEFAULT 0,
    volume_accumulated NUMERIC(15,4) DEFAULT 0,
    volume_remaining NUMERIC(15,4) DEFAULT 0,
    amount_this_estimation NUMERIC(15,2) DEFAULT 0,
    amount_accumulated NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Columnas en quotations para toggle de materialidad
ALTER TABLE public.quotations
    ADD COLUMN IF NOT EXISTS req_estimaciones BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS estimacion_status VARCHAR(50);

-- 6. Trigger updated_at
CREATE OR REPLACE TRIGGER set_updated_at_work_budgets
    BEFORE UPDATE ON public.work_budgets
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER set_updated_at_work_estimations
    BEFORE UPDATE ON public.work_estimations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. Índices
CREATE INDEX IF NOT EXISTS idx_work_budgets_quotation ON public.work_budgets(quotation_id);
CREATE INDEX IF NOT EXISTS idx_work_budgets_org ON public.work_budgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_work_estimations_budget ON public.work_estimations(work_budget_id);
CREATE INDEX IF NOT EXISTS idx_work_estimation_items_estimation ON public.work_estimation_items(work_estimation_id);

-- 8. RLS
ALTER TABLE public.work_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_estimations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_estimation_items ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura
CREATE POLICY "work_budgets_read" ON public.work_budgets FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM public.user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
    )
);

CREATE POLICY "work_budget_items_read" ON public.work_budget_items FOR SELECT USING (
    work_budget_id IN (SELECT id FROM public.work_budgets)
);

CREATE POLICY "work_estimations_read" ON public.work_estimations FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM public.user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
    )
);

CREATE POLICY "work_estimation_items_read" ON public.work_estimation_items FOR SELECT USING (
    work_estimation_id IN (SELECT id FROM public.work_estimations)
);

-- Políticas de escritura (usuarios con acceso a la org)
CREATE POLICY "work_budgets_write" ON public.work_budgets FOR ALL USING (
    organization_id IN (
        SELECT organization_id FROM public.user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
    )
);

CREATE POLICY "work_budget_items_write" ON public.work_budget_items FOR ALL USING (
    work_budget_id IN (SELECT id FROM public.work_budgets)
);

CREATE POLICY "work_estimations_write" ON public.work_estimations FOR ALL USING (
    organization_id IN (
        SELECT organization_id FROM public.user_organization_access
        WHERE profile_id = (auth.jwt() ->> 'sub')
    )
);

CREATE POLICY "work_estimation_items_write" ON public.work_estimation_items FOR ALL USING (
    work_estimation_id IN (SELECT id FROM public.work_estimations)
);
