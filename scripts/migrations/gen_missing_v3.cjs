const fs = require('fs');
const src = JSON.parse(fs.readFileSync('units_data.json', 'utf8'));
const dbStr = fs.readFileSync('db_codes_fixed.json', 'utf8');
const db = JSON.parse(dbStr);
const dbCodes = new Set(db.map(x => x.code));
const missing = src.filter(u => !dbCodes.has(u.code));

console.log('Missing count:', missing.length);

if (missing.length > 0) {
    let sql = 'INSERT INTO public.cat_cfdi_unidades (code, name, description, symbol) VALUES \n';
    sql += missing.map(u => {
        const name = u.name ? `'${u.name.replace(/'/g, "''")}'` : 'NULL';
        const desc = u.description ? `'${u.description.replace(/'/g, "''")}'` : 'NULL';
        const sym = u.symbol ? `'${u.symbol.replace(/'/g, "''")}'` : 'NULL';
        return `('${u.code}', ${name}, ${desc}, ${sym})`;
    }).join(',\n');

    sql += `\nON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        symbol = EXCLUDED.symbol,
        updated_at = NOW();`;

    fs.writeFileSync('batch_final_101.sql', sql);
    console.log('Generated batch_final_101.sql');
}
