import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: qs, error } = await supabase
        .from('quotations')
        .select(`
          id, consecutive_id, invoice_status, request_direct_invoice,
          invoices(id, status)
      `)
        .not('invoices', 'is', null)
        .limit(5);

    for (const q of qs || []) {
        const invoicesList = Array.isArray(q.invoices) ? q.invoices : (q.invoices ? [q.invoices] : []);
        const computedInvoiceStatus = invoicesList.length > 0 ? invoicesList[0].status : q.invoice_status;
        const finalInvoiceStatus = computedInvoiceStatus || (q.request_direct_invoice ? 'solicitada' : null);

        console.log(`Q ID: ${q.consecutive_id}, invoicesList.length: ${invoicesList.length}, q.invoice_status: ${q.invoice_status}, final computed: ${finalInvoiceStatus}`);
    }
}

run();
