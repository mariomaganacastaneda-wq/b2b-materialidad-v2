const fs = require('fs');

async function run() {
    try {
        const sourceData = JSON.parse(fs.readFileSync('units_data.json', 'utf8'));
        const sourceCodes = sourceData.map(u => u.code);

        // Output file from execute_sql
        const outputPath = 'C:\\Users\\MARIO MAGAÑA\\.gemini\\antigravity\\brain\\66da03fc-eb77-41ef-b71c-8ca0a11e2b0a\\.system_generated\\steps\\507\\output.txt';
        const rawOutput = fs.readFileSync(outputPath, 'utf8');

        // Find the JSON block
        const start = rawOutput.indexOf('[{"code":');
        const end = rawOutput.lastIndexOf('}]') + 2;

        if (start === -1 || end === -1) {
            console.error("JSON block not found.");
            return;
        }

        const dbJson = rawOutput.substring(start, end);
        const dbCodes = JSON.parse(dbJson).map(o => o.code);
        const dbSet = new Set(dbCodes);

        const missing = sourceData.filter(u => !dbSet.has(u.code));
        console.log(`Missing count: ${missing.length}`);

        if (missing.length > 0) {
            // Split into batches of 100 to be safe with SQL length if needed, 
            // but let's try 500 first.
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
