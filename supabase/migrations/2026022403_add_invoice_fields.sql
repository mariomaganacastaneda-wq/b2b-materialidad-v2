-- Add new fields for invoice documentation processing
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS preinvoice_comments TEXT,
ADD COLUMN IF NOT EXISTS invoice_comments TEXT,
ADD COLUMN IF NOT EXISTS preinvoice_authorized BOOLEAN DEFAULT false;
