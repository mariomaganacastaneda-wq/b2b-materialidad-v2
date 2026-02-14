const fs = require('fs');

const data = JSON.parse(fs.readFileSync('units_data.json', 'utf8'));

// We know SET was the last code in batch 1999
// and TW was the first code in batch 2099
const missing = data.filter(u => u.code > 'SET' && u.code < 'TW');

console.log(`Found ${missing.length} missing units.`);

if (missing.length > 0) {
    let sql = "INSERT INTO public.cat_cfdi_unidades (code, name, description, symbol)\nVALUES ";
    sql += missing.map(u => {
        const desc = u.description ? `'${u.description.replace(/'/g, "''")}'` : 'NULL';
        const sym = u.symbol ? `'${u.symbol.replace(/'/g, "''")}'` : 'NULL';
        const name = u.name ? `'${u.name.replace(/'/g, "''")}'` : 'NULL';
        return `('${u.code}', ${name}, ${desc}, ${sym})`;
    }).join(",\n");

    sql += `\nON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    symbol = EXCLUDED.symbol,
    updated_at = NOW();`;

    fs.writeFileSync('batch_missing_set_tw.sql', sql);
    console.log('Generated batch_missing_set_tw.sql');
}
