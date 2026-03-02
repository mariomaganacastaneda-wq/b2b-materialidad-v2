import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase.from('quotations').select('id, consecutive_id, invoice_status, request_direct_invoice, invoices(id, status)').eq('consecutive_id', 3).single();
    console.log("Q 3", JSON.stringify({ error, data }, null, 2));
}

run();
