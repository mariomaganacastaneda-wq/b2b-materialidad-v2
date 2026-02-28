import fs from "fs";
const envStr = fs.readFileSync("web/.env.local", "utf8");
const vars = {};
envStr.split("\n").forEach(line => {
    const match = line.match(/^\s*([\w]+)\s*=\s*(.*)?\s*$/);
    if (match) vars[match[1]] = match[2];
});

fetch(vars.VITE_SUPABASE_URL + "/rest/v1/quotations?limit=1", {
    headers: { "apikey": vars.VITE_SUPABASE_ANON_KEY }
}).then(r => r.json()).then(console.log).catch(console.error);
