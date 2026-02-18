const fs = require('fs');
const path = require('path');

const inputPath = path.resolve(__dirname, 'update_catalog_batches.sql');
const content = fs.readFileSync(inputPath, 'utf8');
const batches = content.split('-- BATCH BREAK --');

console.log(`Total de lotes encontrados: ${batches.length}`);

const chunkSize = 5;
for (let i = 0; i < batches.length; i += chunkSize) {
    const chunk = batches.slice(i, i + chunkSize).join('\n\n');
    const outputPath = path.resolve(__dirname, `chunk_${i}.sql`);
    fs.writeFileSync(outputPath, chunk);
}
console.log('División completada.');
