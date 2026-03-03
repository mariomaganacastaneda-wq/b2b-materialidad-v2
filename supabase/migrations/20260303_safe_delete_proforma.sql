-- MIGRACION: Eliminacion segura de proformas
-- Objetivo: Cambiar FK de pagos a SET NULL + Crear RPC delete_proforma_safe
-- Fecha: 2026-03-03

-- ============================================================
-- 1. Cambiar FK de quotation_payments: CASCADE -> SET NULL
-- ============================================================

-- Permitir NULL en quotation_id (antes era NOT NULL)
ALTER TABLE public.quotation_payments ALTER COLUMN quotation_id DROP NOT NULL;

-- Reemplazar constraint: de CASCADE a SET NULL
ALTER TABLE public.quotation_payments
  DROP CONSTRAINT quotation_payments_quotation_id_fkey;

ALTER TABLE public.quotation_payments
  ADD CONSTRAINT quotation_payments_quotation_id_fkey
    FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE SET NULL;

-- ============================================================
-- 2. Funcion RPC: delete_proforma_safe
-- ============================================================
-- Modo dry_run=true: diagnostico (no elimina nada)
-- Modo dry_run=false: ejecuta eliminacion en transaccion

CREATE OR REPLACE FUNCTION public.delete_proforma_safe(
  p_quotation_id UUID,
  p_dry_run BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proforma RECORD;
  v_blockers JSONB := '[]'::JSONB;
  v_blocker JSONB;
  v_count INTEGER;
  v_invoice_ids UUID[];
  v_invoice_statuses TEXT[];
  v_storage_files TEXT[] := '{}';
  v_deleted_invoices INTEGER := 0;
  v_deleted_contracts INTEGER := 0;
  v_deleted_items INTEGER := 0;
  v_orphaned_payments INTEGER := 0;
  v_orphaned_amount NUMERIC(15,2) := 0;
  v_proforma_number TEXT;
BEGIN
  -- =========================================
  -- PASO 1: Verificar existencia de la proforma
  -- =========================================
  SELECT id, proforma_number, amount_total, currency, status,
         related_quotation_status, proforma_excel_url, request_file_url,
         organization_id
  INTO v_proforma
  FROM public.quotations
  WHERE id = p_quotation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Proforma no encontrada con ID: ' || p_quotation_id::TEXT
    );
  END IF;

  v_proforma_number := COALESCE(v_proforma.proforma_number::TEXT, v_proforma.id::TEXT);

  -- =========================================
  -- PASO 2: Escanear dependencias bloqueantes
  -- =========================================

  -- 2a. Facturas timbradas (uuid IS NOT NULL o status TIMBRADA/VALIDADA)
  SELECT count(*), array_agg(status)
  INTO v_count, v_invoice_statuses
  FROM public.invoices
  WHERE quotation_id = p_quotation_id
    AND (uuid IS NOT NULL OR status::TEXT IN ('TIMBRADA', 'VALIDADA'));

  IF v_count > 0 THEN
    v_blocker := jsonb_build_object(
      'type', 'factura_timbrada',
      'count', v_count,
      'message', 'Tiene ' || v_count || ' factura(s) timbrada(s)/validada(s). No se puede eliminar mientras existan facturas con folio fiscal.'
    );
    v_blockers := v_blockers || v_blocker;
  END IF;

  -- 2b. Evidencia fotografica cargada (via invoices)
  SELECT count(*)
  INTO v_count
  FROM public.evidence e
  JOIN public.invoices i ON e.invoice_id = i.id
  WHERE i.quotation_id = p_quotation_id
    AND e.file_url IS NOT NULL;

  IF v_count > 0 THEN
    v_blocker := jsonb_build_object(
      'type', 'evidencia_cargada',
      'count', v_count,
      'message', 'Tiene ' || v_count || ' evidencia(s) fotografica(s) cargada(s). Elimine la evidencia antes de borrar la proforma.'
    );
    v_blockers := v_blockers || v_blocker;
  END IF;

  -- 2c. Evidencia via contratos
  SELECT count(*)
  INTO v_count
  FROM public.evidence e
  JOIN public.contracts c ON e.contract_id = c.id
  WHERE c.quotation_id = p_quotation_id
    AND e.file_url IS NOT NULL;

  IF v_count > 0 THEN
    v_blocker := jsonb_build_object(
      'type', 'evidencia_contrato',
      'count', v_count,
      'message', 'Tiene ' || v_count || ' evidencia(s) vinculada(s) a contratos. Elimine la evidencia antes de borrar la proforma.'
    );
    v_blockers := v_blockers || v_blocker;
  END IF;

  -- 2d. Contratos con archivo cargado
  SELECT count(*)
  INTO v_count
  FROM public.contracts
  WHERE quotation_id = p_quotation_id
    AND file_url IS NOT NULL;

  IF v_count > 0 THEN
    v_blocker := jsonb_build_object(
      'type', 'contrato_cargado',
      'count', v_count,
      'message', 'Tiene ' || v_count || ' contrato(s) con archivo cargado. Elimine los contratos antes de borrar la proforma.'
    );
    v_blockers := v_blockers || v_blocker;
  END IF;

  -- 2e. Cotizacion formal vinculada
  IF v_proforma.related_quotation_status IS NOT NULL
     AND v_proforma.related_quotation_status NOT IN ('solicitada', '') THEN
    v_blocker := jsonb_build_object(
      'type', 'cotizacion_formal',
      'count', 1,
      'message', 'Tiene cotizacion formal vinculada (status: ' || v_proforma.related_quotation_status || '). Desvincule la cotizacion antes de borrar.'
    );
    v_blockers := v_blockers || v_blocker;
  END IF;

  -- =========================================
  -- PASO 3: Si hay bloqueantes, retornar diagnostico
  -- =========================================
  IF jsonb_array_length(v_blockers) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No se puede eliminar la proforma ' || v_proforma_number,
      'blockers', v_blockers,
      'proforma', jsonb_build_object(
        'id', v_proforma.id,
        'proforma_number', v_proforma_number,
        'amount_total', v_proforma.amount_total,
        'currency', COALESCE(v_proforma.currency, 'MXN'),
        'status', v_proforma.status
      )
    );
  END IF;

  -- =========================================
  -- PASO 4: Recopilar datos antes de eliminar
  -- =========================================

  -- Contar items que se eliminaran (CASCADE)
  SELECT count(*) INTO v_deleted_items
  FROM public.quotation_items
  WHERE quotation_id = p_quotation_id;

  -- Contar facturas eliminables (no timbradas)
  SELECT count(*) INTO v_deleted_invoices
  FROM public.invoices
  WHERE quotation_id = p_quotation_id AND uuid IS NULL;

  -- Contar contratos eliminables (sin archivo)
  SELECT count(*) INTO v_deleted_contracts
  FROM public.contracts
  WHERE quotation_id = p_quotation_id AND file_url IS NULL;

  -- Contar pagos que quedaran huerfanos
  SELECT count(*), COALESCE(sum(amount), 0)
  INTO v_orphaned_payments, v_orphaned_amount
  FROM public.quotation_payments
  WHERE quotation_id = p_quotation_id;

  -- Recopilar URLs de storage para limpieza
  IF v_proforma.proforma_excel_url IS NOT NULL THEN
    v_storage_files := v_storage_files || v_proforma.proforma_excel_url;
  END IF;
  IF v_proforma.request_file_url IS NOT NULL THEN
    v_storage_files := v_storage_files || v_proforma.request_file_url;
  END IF;

  -- =========================================
  -- PASO 5: Si es dry_run, retornar diagnostico sin ejecutar
  -- =========================================
  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'success', true,
      'dry_run', true,
      'message', 'La proforma ' || v_proforma_number || ' puede ser eliminada',
      'proforma', jsonb_build_object(
        'id', v_proforma.id,
        'proforma_number', v_proforma_number,
        'amount_total', v_proforma.amount_total,
        'currency', COALESCE(v_proforma.currency, 'MXN'),
        'status', v_proforma.status
      ),
      'will_delete', jsonb_build_object(
        'items', v_deleted_items,
        'invoices', v_deleted_invoices,
        'contracts', v_deleted_contracts
      ),
      'orphaned_payments', jsonb_build_object(
        'count', v_orphaned_payments,
        'total_amount', v_orphaned_amount,
        'message', CASE
          WHEN v_orphaned_payments > 0 THEN
            'Existen ' || v_orphaned_payments || ' pago(s) ($' || v_orphaned_amount::TEXT || ') asignados a esta proforma que quedaran sin proforma asignada. Puede reasignarlos desde la seccion de Pagos.'
          ELSE 'No hay pagos asociados.'
        END
      ),
      'storage_files', to_jsonb(v_storage_files)
    );
  END IF;

  -- =========================================
  -- PASO 6: Ejecutar eliminacion
  -- =========================================

  -- 6a. Eliminar facturas no timbradas
  DELETE FROM public.invoices
  WHERE quotation_id = p_quotation_id AND uuid IS NULL;

  -- 6b. Eliminar contratos sin archivo
  DELETE FROM public.contracts
  WHERE quotation_id = p_quotation_id AND file_url IS NULL;

  -- 6c. Eliminar la proforma (CASCADE elimina items, SET NULL en pagos)
  DELETE FROM public.quotations
  WHERE id = p_quotation_id;

  -- =========================================
  -- PASO 7: Retornar resultado
  -- =========================================
  RETURN jsonb_build_object(
    'success', true,
    'dry_run', false,
    'message', 'Proforma ' || v_proforma_number || ' eliminada exitosamente',
    'deleted', jsonb_build_object(
      'items', v_deleted_items,
      'invoices', v_deleted_invoices,
      'contracts', v_deleted_contracts
    ),
    'orphaned_payments', jsonb_build_object(
      'count', v_orphaned_payments,
      'total_amount', v_orphaned_amount,
      'message', CASE
        WHEN v_orphaned_payments > 0 THEN
          'Existen ' || v_orphaned_payments || ' pago(s) ($' || v_orphaned_amount::TEXT || ') que estaban asignados a esta proforma y quedaron huerfanos. Puede reasignarlos desde la seccion de Pagos.'
        ELSE 'No habia pagos asociados.'
      END
    ),
    'storage_files', to_jsonb(v_storage_files)
  );
END;
$$;

-- Permisos: solo usuarios autenticados pueden llamar esta funcion
GRANT EXECUTE ON FUNCTION public.delete_proforma_safe(UUID, BOOLEAN) TO authenticated;

-- Comentario para documentacion
COMMENT ON FUNCTION public.delete_proforma_safe IS 'Eliminacion segura de proformas. Verifica dependencias (facturas timbradas, evidencia, contratos, cotizaciones) antes de eliminar. Modo dry_run para diagnostico.';
