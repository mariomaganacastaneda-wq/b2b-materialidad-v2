const fs = require('fs');

const units = JSON.parse(fs.readFileSync('C:/Proyectos/Memoria/B2B_Materialidad/units_data.json', 'utf8'));

function escapeSql(str) {
    if (!str) return 'NULL';
    return "'" + str.replace(/'/g, "''") + "'";
}

const batchSize = 100;
const batches = [];

for (let i = 0; i < units.length; i += batchSize) {
    const batch = units.slice(i, i + batchSize);
    const values = batch.map(u => `(${escapeSql(u.code)}, ${escapeSql(u.name)}, ${escapeSql(u.description)}, ${escapeSql(u.symbol)})`).join(',\n');
    const sql = `INSERT INTO public.cat_cfdi_unidades (code, name, description, symbol)
VALUES ${values}
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    symbol = EXCLUDED.symbol,
    updated_at = NOW();`;
    batches.push(sql);
}

fs.writeFileSync('C:/Proyectos/Memoria/B2B_Materialidad/units_insert.json', JSON.stringify(batches, null, 2), 'utf8');
console.log(`Generados ${batches.length} lotes de inserción SQL.`);
