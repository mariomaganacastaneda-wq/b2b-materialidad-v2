-- Agregar columna para vincular la cuenta bancaria de la emisora a la proforma/cotización
ALTER TABLE public.quotations
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- Habilitar lectura para el caso de uso
CREATE INDEX IF NOT EXISTS idx_quotations_bank_account_id ON public.quotations(bank_account_id);

-- Actualizar el schema cache de PostgREST para reflejar los cambios
NOTIFY pgrst, 'reload schema';
