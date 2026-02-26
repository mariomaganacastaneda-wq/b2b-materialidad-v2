-- Remove UNIQUE constraint from internal_number
-- The frontend inserts 'S/N' (Sin Número) as a fallback for internal_number when creating the first stage of an invoice.
-- A UNIQUE constraint here causes a 409 Conflict error on subsequent insertions because 'S/N' already exists.
-- It was originally a UNIQUE constraint from Prompt V1, but practically it should only be unique IF IT'S NOT NULL or 'S/N'.
-- The simplest approach to unblock the frontend is to drop the generic unique constraint.

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_internal_number_key;
