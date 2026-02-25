-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION update_bank_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE org_bank_accounts
        SET current_balance = COALESCE(current_balance, 0) + NEW.amount
        WHERE id = NEW.bank_account_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only update if the amount or bank account changed
        IF OLD.amount IS DISTINCT FROM NEW.amount OR OLD.bank_account_id IS DISTINCT FROM NEW.bank_account_id THEN
            -- Revert old amount from old account
            IF OLD.bank_account_id IS NOT NULL THEN
                UPDATE org_bank_accounts
                SET current_balance = COALESCE(current_balance, 0) - OLD.amount
                WHERE id = OLD.bank_account_id;
            END IF;
            -- Add new amount to new account
            IF NEW.bank_account_id IS NOT NULL THEN
                UPDATE org_bank_accounts
                SET current_balance = COALESCE(current_balance, 0) + NEW.amount
                WHERE id = NEW.bank_account_id;
            END IF;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE org_bank_accounts
        SET current_balance = COALESCE(current_balance, 0) - OLD.amount
        WHERE id = OLD.bank_account_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS tr_update_bank_balance_on_payment ON quotation_payments;
CREATE TRIGGER tr_update_bank_balance_on_payment
AFTER INSERT OR UPDATE OR DELETE ON quotation_payments
FOR EACH ROW
EXECUTE FUNCTION update_bank_account_balance();

-- 3. Retroactive update to fix current balances based on existing payments
UPDATE org_bank_accounts oba
SET current_balance = (
    SELECT COALESCE(SUM(amount), 0)
    FROM quotation_payments qp
    WHERE qp.bank_account_id = oba.id
);
