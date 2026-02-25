const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPolicies() {
    const query = `SELECT cmd, roles, qual, with_check FROM pg_policies WHERE tablename = 'invoices';`;
    const { data, error } = await supabaseAdmin.rpc('execute_sql', { query });
    console.log('Invoices Policies:', data || error);
}

checkPolicies();
