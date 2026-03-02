require('dotenv').config({ path: require('path').resolve(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Fetching all invoices from DB...");
    const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*');

    if (error) {
        console.error("Error fetching invoices:", error);
    } else {
        console.log(`Found ${invoices.length} invoices:`, invoices);
    }
}
main();
