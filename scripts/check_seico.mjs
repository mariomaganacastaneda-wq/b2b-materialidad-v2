import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ywovtkubsanalddsdedi.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_4TZm-phlmGg4Hu-IA_Weqg_IkhwANh1';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrgs() {
  console.log("=== REVISANDO ORGANIZATIONS ===");
  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, name, rfc, is_active, logo_url')
    .or('name.ilike.%umami%,name.ilike.%seidco%,name.ilike.%seico%,rfc.ilike.%umami%,rfc.ilike.%sei%');
    
  if (error) {
    console.error("Error orgs:", error.message);
  } else {
    console.table(orgs);
    if(orgs.length > 0) {
      console.log("\n=== REVISANDO PROFORMAS (QUOTATIONS) DE ESTAS ORGS ===");
      for (const org of orgs) {
        const { data: quotes, error: qErr } = await supabase
          .from('quotations')
          .select('id, consecutive_id, client_id, status, amount_total')
          .eq('organization_id', org.id)
          .limit(3);
          
        console.log(`\nProformas para ${org.name} (${org.id}):`);
        if (qErr) {
            console.error(qErr.message);
        } else {
            console.table(quotes);
        }
      }
    }
  }

  console.log("\n=== REVISANDO ISSUERS (Emisores) ===");
  const { data: issuers, error: iErr } = await supabase
    .from('issuers')
    .select('id, business_name, rfc, organization_id')
    .or('business_name.ilike.%umami%,business_name.ilike.%seidco%,business_name.ilike.%seico%,rfc.ilike.%umami%,rfc.ilike.%sei%');
    
  if (iErr) {
    console.log("Error emitters (o no existe la tabla):", iErr.message);
  } else {
    console.table(issuers);
  }
}

checkOrgs();
