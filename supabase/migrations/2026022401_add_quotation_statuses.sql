-- Add missing columns for config toggles and manual statuses in quotations
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS req_quotation BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS req_evidence BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS contract_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS evidence_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS related_quotation_status VARCHAR(50);
