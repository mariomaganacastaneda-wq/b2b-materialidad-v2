const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ywovtkubsanalddsdedi.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_4TZm-phlmGg4Hu-IA_Weqg_IkhwANh1';

async function fetchSupa(path) {
  const url = new URL(\`/rest/v1/\${path}\`, supabaseUrl);
  const res = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': \`Bearer \${supabaseKey}\`,
      'Content-Profile': 'public'
    }
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("HTTP Error:", res.status, err);
    return null;
  }
  return await res.json();
}

async function checkOrgs() {
  console.log("=== REVISANDO ORGANIZATIONS ===");
  const orgs = await fetchSupa('organizations?select=id,name,rfc,is_active,logo_url&or=(name.ilike.*umami*,name.ilike.*seidco*,name.ilike.*seico*,rfc.ilike.*umami*,rfc.ilike.*sei*)');
  
  if (orgs) {
    console.table(orgs);
    if(orgs.length > 0) {
      console.log("\\n=== REVISANDO PROFORMAS (QUOTATIONS) DE ESTAS ORGS ===");
      for (const org of orgs) {
        const quotes = await fetchSupa(\`quotations?select=id,consecutive_id,client_id,status,amount_total&organization_id=eq.\${org.id}&limit=5\`);
        console.log(\`\\nProformas para \${org.name} (\${org.id}):\`);
        if (quotes) console.table(quotes);
      }
    }
  }

  console.log("\\n=== REVISANDO ISSUERS (Emisores) ===");
  const issuers = await fetchSupa('issuers?select=id,business_name,rfc,organization_id&or=(business_name.ilike.*umami*,business_name.ilike.*seidco*,business_name.ilike.*seico*,rfc.ilike.*umami*,rfc.ilike.*sei*)');
  if (issuers) {
    console.table(issuers);
  }
}

checkOrgs();
