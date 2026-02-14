const fs = require('fs');
const data = JSON.parse(fs.readFileSync('units_data.json', 'utf8'));

const batchSize = 100;
let currentBatch = [];

const escapeSql = (str) => {
    if (str === null || str === undefined || str === '') return 'NULL';
    return `'${str.replace(/'/g, "''")}'`;
};

for (let i = 0; i < data.length; i++) {
    currentBatch.push(data[i]);
    if (currentBatch.length === batchSize || i === data.length - 1) {
        const values = currentBatch.map(u =>
            `(${escapeSql(u.code)}, ${escapeSql(u.name)}, ${escapeSql(u.description)}, ${escapeSql(u.symbol)})`
        ).join(',\n');

        const sql = `INSERT INTO public.cat_cfdi_unidades (code, name, description, symbol)
VALUES ${values}
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    symbol = EXCLUDED.symbol,
    updated_at = NOW();`;

        fs.writeFileSync(`batch_${i}.sql`, sql);
        currentBatch = [];
    }
}
