
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_DIR = path.join(__dirname, '..', 'csf_backup');

function calculateMD5(filePath) {
    const buffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('md5');
    hashSum.update(buffer);
    return hashSum.digest('hex');
}

async function deduplicate() {
    console.log(`🧹 Iniciando limpieza de duplicados en: ${TARGET_DIR}`);

    if (!fs.existsSync(TARGET_DIR)) {
        console.error("❌ Directorio no encontrado.");
        return;
    }

    const files = fs.readdirSync(TARGET_DIR);
    const map = new Map(); // hash -> [files]

    console.log(`📊 Total archivos encontrados: ${files.length}`);

    // 1. Calcular hashes
    for (const file of files) {
        const fullPath = path.join(TARGET_DIR, file);
        if (fs.statSync(fullPath).isDirectory()) continue;

        const hash = calculateMD5(fullPath);

        if (!map.has(hash)) {
            map.set(hash, []);
        }
        map.get(hash).push(file);
    }

    // 2. Eliminar duplicados
    let deletedCount = 0;
    let keptCount = 0;

    for (const [hash, fileList] of map.entries()) {
        if (fileList.length > 1) {
            // Ordenar para determinismo (ej: preferir nombres más cortos o alfabéticos)
            // Aquí simplemente ordenamos alfabéticamente y nos quedamos con el primero
            fileList.sort();

            const keeper = fileList[0];
            const duplicates = fileList.slice(1);

            console.log(`\n🔗 Grupo Hash: ${hash.substring(0, 8)}...`);
            console.log(`   ✅ Mantenido: ${keeper}`);

            for (const dup of duplicates) {
                const dupPath = path.join(TARGET_DIR, dup);
                fs.unlinkSync(dupPath);
                console.log(`   🗑️ Eliminado: ${dup}`);
                deletedCount++;
            }
            keptCount++;
        } else {
            keptCount++;
        }
    }

    console.log(`\n✨ Limpieza terminada.`);
    console.log(`   - Archivos originales: ${files.length}`);
    console.log(`   - Duplicados eliminados: ${deletedCount}`);
    console.log(`   - Archivos únicos restantes: ${keptCount}`);
}

deduplicate();
