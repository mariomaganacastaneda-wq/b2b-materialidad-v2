const fs = require('fs');

async function run() {
    try {
        const sourceData = JSON.parse(fs.readFileSync('units_data.json', 'utf8'));
        const dbCodesRaw = JSON.parse(fs.readFileSync('db_codes.json', 'utf8'));
        const dbCodes = dbCodesRaw.map(u => u.code);
        const dbSet = new Set(dbCodes);

        const missing = sourceData.filter(u => !dbSet.has(u.code));
        console.log(`Missing count: ${missing.length}`);

        if (missing.length > 0) {
            let sql = "INSERT INTO public.cat_cfdi_unidades (code, name, description, symbol)\nVALUES \n";
            sql += missing.map(u => {
                const name = u.name ? `'${u.name.replace(/'/g, "''")}'` : 'NULL';
                const desc = u.description ? `'${u.description.replace(/'/g, "''")}'` : 'NULL';
                const sym = u.symbol ? `'${u.symbol.replace(/'/g, "''")}'` : 'NULL';
                return `('${u.code}', ${name}, ${desc}, ${sym})`;
            }).join(",\n");

            sql += `\nON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                symbol = EXCLUDED.symbol,
                updated_at = NOW();`;

            fs.writeFileSync('batch_final_missing_101.sql', sql);
            console.log('File generated: batch_final_missing_101.sql');
        }
    } catch (e) {
        console.error(e);
    }
}

run();
