-- MIGRACION: Agregar modo force (admin) a delete_proforma_safe
-- Permite al ADMIN eliminar proformas sin ninguna restriccion
-- Fecha: 2026-03-03

-- Eliminar la version anterior (2 parametros)
DROP FUNCTION IF EXISTS public.delete_proforma_safe(UUID, BOOLEAN);

-- Crear version con 3 parametros: p_force para admin sin restricciones
CREATE OR REPLACE FUNCTION public.delete_proforma_safe(
  p_quotation_id UUID,
  p_dry_run BOOLEAN DEFAULT true,
  p_force BOOLEAN DEFAULT false
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
  v_invoice_statuses TEXT[];
  v_storage_files TEXT[] := '{}';
  v_deleted_invoices INTEGER := 0;
  v_deleted_contracts INTEGER := 0;
  v_deleted_evidence INTEGER := 0;
  v_deleted_items INTEGER := 0;
  v_orphaned_payments INTEGER := 0;
  v_orphaned_amount NUMERIC(15,2) := 0;
  v_proforma_number TEXT;
  v_caller_role TEXT;
  v_file_url TEXT;
BEGIN
  -- =========================================
  -- PASO 0: Si force=true, verificar que sea ADMIN
  -- =========================================
  IF p_force THEN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = (auth.jwt()->>'sub');
    IF v_caller_role IS DISTINCT FROM 'ADMIN' THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Solo el administrador puede eliminar proformas con force=true. Rol actual: ' || COALESCE(v_caller_role, 'desconocido')
      );
    END IF;
  END IF;

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
  -- PASO 2: Escanear dependencias (solo si NO es force)
  -- =========================================
  IF NOT p_force THEN
    -- 2a. Facturas timbradas
    SELECT count(*), array_agg(status)
    INTO v_count, v_invoice_statuses
    FROM public.invoices
    WHERE quotation_id = p_quotation_id
      AND (uuid IS NOT NULL OR status::TEXT IN ('TIMBRADA', 'VALIDADA'));

    IF v_count > 0 THEN
      v_blockers := v_blockers || jsonb_build_object(
        'type', 'factura_timbrada', 'count', v_count,
        'message', 'Tiene ' || v_count || ' factura(s) timbrada(s)/validada(s).'
      );
    END IF;

    -- 2b. Evidencia via invoices
    SELECT count(*) INTO v_count
    FROM public.evidence e JOIN public.invoices i ON e.invoice_id = i.id
    WHERE i.quotation_id = p_quotation_id AND e.file_url IS NOT NULL;

    IF v_count > 0 THEN
      v_blockers := v_blockers || jsonb_build_object(
        'type', 'evidencia_cargada', 'count', v_count,
        'message', 'Tiene ' || v_count || ' evidencia(s) fotografica(s) cargada(s).'
      );
    END IF;

    -- 2c. Evidencia via contratos
    SELECT count(*) INTO v_count
    FROM public.evidence e JOIN public.contracts c ON e.contract_id = c.id
    WHERE c.quotation_id = p_quotation_id AND e.file_url IS NOT NULL;

    IF v_count > 0 THEN
      v_blockers := v_blockers || jsonb_build_object(
        'type', 'evidencia_contrato', 'count', v_count,
        'message', 'Tiene ' || v_count || ' evidencia(s) vinculada(s) a contratos.'
      );
    END IF;

    -- 2d. Contratos con archivo
    SELECT count(*) INTO v_count
    FROM public.contracts WHERE quotation_id = p_quotation_id AND file_url IS NOT NULL;

    IF v_count > 0 THEN
      v_blockers := v_blockers || jsonb_build_object(
        'type', 'contrato_cargado', 'count', v_count,
        'message', 'Tiene ' || v_count || ' contrato(s) con archivo cargado.'
      );
    END IF;

    -- 2e. Cotizacion formal
    IF v_proforma.related_quotation_status IS NOT NULL
       AND v_proforma.related_quotation_status NOT IN ('solicitada', '') THEN
      v_blockers := v_blockers || jsonb_build_object(
        'type', 'cotizacion_formal', 'count', 1,
        'message', 'Tiene cotizacion formal vinculada (status: ' || v_proforma.related_quotation_status || ').'
      );
    END IF;

    -- Si hay bloqueantes, retornar
    IF jsonb_array_length(v_blockers) > 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'No se puede eliminar la proforma ' || v_proforma_number,
        'blockers', v_blockers,
        'proforma', jsonb_build_object(
          'id', v_proforma.id, 'proforma_number', v_proforma_number,
          'amount_total', v_proforma.amount_total,
          'currency', COALESCE(v_proforma.currency, 'MXN'), 'status', v_proforma.status
        )
      );
    END IF;
  END IF;

  -- =========================================
  -- PASO 3: Recopilar datos antes de eliminar
  -- =========================================

  -- Items
  SELECT count(*) INTO v_deleted_items FROM public.quotation_items WHERE quotation_id = p_quotation_id;

  -- Facturas (todas si force, solo no timbradas si normal)
  IF p_force THEN
    SELECT count(*) INTO v_deleted_invoices FROM public.invoices WHERE quotation_id = p_quotation_id;
  ELSE
    SELECT count(*) INTO v_deleted_invoices FROM public.invoices WHERE quotation_id = p_quotation_id AND uuid IS NULL;
  END IF;

  -- Contratos (todos si force, solo sin archivo si normal)
  IF p_force THEN
    SELECT count(*) INTO v_deleted_contracts FROM public.contracts WHERE quotation_id = p_quotation_id;
  ELSE
    SELECT count(*) INTO v_deleted_contracts FROM public.contracts WHERE quotation_id = p_quotation_id AND file_url IS NULL;
  END IF;

  -- Evidencia (solo en force)
  IF p_force THEN
    SELECT count(*) INTO v_deleted_evidence
    FROM public.evidence e
    WHERE e.invoice_id IN (SELECT id FROM public.invoices WHERE quotation_id = p_quotation_id)
       OR e.contract_id IN (SELECT id FROM public.contracts WHERE quotation_id = p_quotation_id);
  END IF;

  -- Pagos huerfanos
  SELECT count(*), COALESCE(sum(amount), 0)
  INTO v_orphaned_payments, v_orphaned_amount
  FROM public.quotation_payments WHERE quotation_id = p_quotation_id;

  -- Storage files de la proforma
  IF v_proforma.proforma_excel_url IS NOT NULL THEN
    v_storage_files := v_storage_files || v_proforma.proforma_excel_url;
  END IF;
  IF v_proforma.request_file_url IS NOT NULL THEN
    v_storage_files := v_storage_files || v_proforma.request_file_url;
  END IF;

  -- Storage files de hijos (solo en force)
  IF p_force THEN
    -- URLs de facturas
    FOR v_file_url IN
      SELECT unnest(ARRAY[preinvoice_url, xml_url, pdf_url])
      FROM public.invoices WHERE quotation_id = p_quotation_id
    LOOP
      IF v_file_url IS NOT NULL THEN
        v_storage_files := v_storage_files || v_file_url;
      END IF;
    END LOOP;

    -- URLs de contratos
    FOR v_file_url IN
      SELECT file_url FROM public.contracts WHERE quotation_id = p_quotation_id AND file_url IS NOT NULL
    LOOP
      v_storage_files := v_storage_files || v_file_url;
    END LOOP;

    -- URLs de evidencia
    FOR v_file_url IN
      SELECT e.file_url FROM public.evidence e
      WHERE (e.invoice_id IN (SELECT id FROM public.invoices WHERE quotation_id = p_quotation_id)
         OR e.contract_id IN (SELECT id FROM public.contracts WHERE quotation_id = p_quotation_id))
        AND e.file_url IS NOT NULL
    LOOP
      v_storage_files := v_storage_files || v_file_url;
    END LOOP;
  END IF;

  -- =========================================
  -- PASO 4: Si es dry_run, retornar sin ejecutar
  -- =========================================
  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'success', true, 'dry_run', true,
      'message', 'La proforma ' || v_proforma_number || ' puede ser eliminada',
      'proforma', jsonb_build_object(
        'id', v_proforma.id, 'proforma_number', v_proforma_number,
        'amount_total', v_proforma.amount_total,
        'currency', COALESCE(v_proforma.currency, 'MXN'), 'status', v_proforma.status
      ),
      'will_delete', jsonb_build_object(
        'items', v_deleted_items, 'invoices', v_deleted_invoices,
        'contracts', v_deleted_contracts, 'evidence', v_deleted_evidence
      ),
      'orphaned_payments', jsonb_build_object(
        'count', v_orphaned_payments, 'total_amount', v_orphaned_amount,
        'message', CASE WHEN v_orphaned_payments > 0 THEN
          'Existen ' || v_orphaned_payments || ' pago(s) ($' || v_orphaned_amount::TEXT || ') que quedaran sin proforma.'
          ELSE 'No hay pagos asociados.' END
      ),
      'storage_files', to_jsonb(v_storage_files)
    );
  END IF;

  -- =========================================
  -- PASO 5: Ejecutar eliminacion
  -- =========================================

  IF p_force THEN
    -- ADMIN FORCE: eliminar TODO sin restriccion

    -- 5a. Evidencia vinculada a invoices
    DELETE FROM public.evidence
    WHERE invoice_id IN (SELECT id FROM public.invoices WHERE quotation_id = p_quotation_id);

    -- 5b. Evidencia vinculada a contracts
    DELETE FROM public.evidence
    WHERE contract_id IN (SELECT id FROM public.contracts WHERE quotation_id = p_quotation_id);

    -- 5c. TODAS las facturas (incluyendo timbradas)
    DELETE FROM public.invoices WHERE quotation_id = p_quotation_id;

    -- 5d. TODOS los contratos (incluyendo con archivo)
    DELETE FROM public.contracts WHERE quotation_id = p_quotation_id;
  ELSE
    -- NORMAL: solo eliminar lo permitido
    DELETE FROM public.invoices WHERE quotation_id = p_quotation_id AND uuid IS NULL;
    DELETE FROM public.contracts WHERE quotation_id = p_quotation_id AND file_url IS NULL;
  END IF;

  -- 5e. Eliminar la proforma (CASCADE items, SET NULL pagos)
  DELETE FROM public.quotations WHERE id = p_quotation_id;

  -- =========================================
  -- PASO 6: Retornar resultado
  -- =========================================
  RETURN jsonb_build_object(
    'success', true, 'dry_run', false, 'force', p_force,
    'message', 'Proforma ' || v_proforma_number || ' eliminada exitosamente',
    'deleted', jsonb_build_object(
      'items', v_deleted_items, 'invoices', v_deleted_invoices,
      'contracts', v_deleted_contracts, 'evidence', v_deleted_evidence
    ),
    'orphaned_payments', jsonb_build_object(
      'count', v_orphaned_payments, 'total_amount', v_orphaned_amount,
      'message', CASE WHEN v_orphaned_payments > 0 THEN
        'Existen ' || v_orphaned_payments || ' pago(s) ($' || v_orphaned_amount::TEXT || ') que quedaron huerfanos. Puede reasignarlos desde Pagos.'
        ELSE 'No habia pagos asociados.' END
    ),
    'storage_files', to_jsonb(v_storage_files)
  );
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.delete_proforma_safe(UUID, BOOLEAN, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.delete_proforma_safe IS 'Eliminacion de proformas. p_force=true permite al ADMIN eliminar sin restricciones (incluye facturas timbradas, contratos, evidencia). p_force=false verifica dependencias antes de eliminar.';
