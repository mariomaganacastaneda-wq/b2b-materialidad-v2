const fs = require('fs');
const path = require('path');

// Read the source data
const sourceData = JSON.parse(fs.readFileSync('units_data.json', 'utf8'));

// Path to the SQL output file
const outputPath = 'C:\\Users\\MARIO MAGAÑA\\.gemini\\antigravity\\brain\\66da03fc-eb77-41ef-b71c-8ca0a11e2b0a\\.system_generated\\steps\\507\\output.txt';

async function run() {
    try {
        let rawOutput = fs.readFileSync(outputPath, 'utf8');

        // The output might be wrapped in quotes or have extra text
        // Let's find the first '[' and last ']'
        const firstBracket = rawOutput.indexOf('[');
        const lastBracket = rawOutput.lastIndexOf(']');

        if (firstBracket === -1 || lastBracket === -1) {
            console.error("Could not find JSON array in output file.");
            return;
        }

        const dbCodesRaw = rawOutput.substring(firstBracket, lastBracket + 1);
        const dbCodes = JSON.parse(dbCodesRaw).map(o => o.code);
        const dbSet = new Set(dbCodes);

        const missing = sourceData.filter(u => !dbSet.has(u.code));

        console.log(`Found ${missing.length} missing units total.`);

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

            fs.writeFileSync('batch_all_missing_final.sql', sql);
            console.log('Generated batch_all_missing_final.sql');
        }
    } catch (e) {
        console.error("Error running script:", e);
    }
}

run();
