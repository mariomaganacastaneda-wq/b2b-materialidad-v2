import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testInsert() {
    console.log("Testing invoice insert...");

    // Hardcoded known values from previous logs or random UUIDs that satisfy FKs (if known)
    // To be safe, we'll try to get ANY valid organization and quotation first.
    const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
    const { data: quotes } = await supabase.from('quotations').select('id, organization_id').limit(1);

    if (!quotes || quotes.length === 0) {
        console.log("No quotations found, cannot test insert cleanly.");
        return;
    }

    const testInvoice = {
        organization_id: quotes[0].organization_id,
        quotation_id: quotes[0].id,
        status: 'PREFACTURA_CANDIDATA',
        is_preinvoice: true,
        amount_total: 1000
    };

    console.log("Payload:", testInvoice);

    const { data, error } = await supabase.from('invoices').insert([testInvoice]).select();

    if (error) {
        console.error("INSERT ERROR DETAILS:", JSON.stringify(error, null, 2));
    } else {
        console.log("INSERT SUCCESS:", data);
    }
}

testInsert();
