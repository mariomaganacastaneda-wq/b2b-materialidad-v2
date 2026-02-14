/**
 * smart_split_load.cjs
 * 
 * Divide el archivo SQL línea por línea en lotes de tamaño fijo
 * para evitar archivos gigantes que bloqueen el tool de Supabase.
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = 'load_integrated_sat_data.sql';
const OUTPUT_DIR = 'sql_batches';
const SENTENCES_PER_BATCH = 100;

async function main() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error('No se encuentra el archivo SQL');
        return;
    }

    const content = fs.readFileSync(INPUT_FILE, 'utf8');
    const lines = content.split('\n');

    if (fs.existsSync(OUTPUT_DIR)) {
        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(OUTPUT_DIR);

    let batchCount = 0;
    let currentBatchLines = [];
    let sentenceCountInBatch = 0;

    for (let line of lines) {
        currentBatchLines.push(line);
        if (line.trim().endsWith(';')) {
            sentenceCountInBatch++;
        }

        if (sentenceCountInBatch >= SENTENCES_PER_BATCH) {
            saveBatch(batchCount++, currentBatchLines);
            currentBatchLines = [];
            sentenceCountInBatch = 0;
        }
    }

    // Guardar el último lote si tiene contenido
    if (currentBatchLines.length > 0) {
        saveBatch(batchCount++, currentBatchLines);
    }

    console.log(`Proceso completado. Se generaron ${batchCount} lotes.`);
}

function saveBatch(index, lines) {
    const fileName = `batch_${index.toString().padStart(4, '0')}.sql`;
    let content = lines.join('\n');

    // Asegurar que cada lote sea una transacción atómica si no contiene BEGIN/COMMIT globales
    if (!content.includes('BEGIN;')) content = 'BEGIN;\n' + content;
    if (!content.includes('COMMIT;')) content = content + '\nCOMMIT;';

    fs.writeFileSync(path.join(OUTPUT_DIR, fileName), content);
}

main().catch(console.error);
