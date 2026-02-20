
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configurar __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BACKUP_DIR = path.join(__dirname, '..', 'csf_backup');

async function downloadAllCsf() {
    console.log(`🚀 Iniciando descarga masiva de CSF a: ${BACKUP_DIR}`);

    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log(`📂 Directorio creado: ${BACKUP_DIR}`);
    }

    try {
        // 1. Listar archivos
        const { data: files, error } = await supabase
            .storage
            .from('csf')
            .list('', { limit: 100, offset: 0 }); // Ajustar limite si hay muchos

        if (error) {
            throw new Error(`Error listando archivos: ${error.message}`);
        }

        console.log(`📋 Encontrados ${files.length} archivos en el bucket 'csf'.`);

        for (const file of files) {
            if (file.name === '.emptyFolderPlaceholder') continue; // Ignorar placeholder

            console.log(`⬇️ Descargando: ${file.name}...`);

            const { data: blob, error: downloadError } = await supabase
                .storage
                .from('csf')
                .download(file.name);

            if (downloadError) {
                console.error(`❌ Error descargando ${file.name}:`, downloadError.message);
                continue;
            }

            const buffer = Buffer.from(await blob.arrayBuffer());
            const filePath = path.join(BACKUP_DIR, file.name);

            fs.writeFileSync(filePath, buffer);
            console.log(`✅ Guardado: ${file.name}`);
        }

        console.log("\n✨ Proceso completado. Revisa la carpeta 'csf_backup'.");

    } catch (err) {
        console.error("❌ Error general:", err.message);
    }
}

downloadAllCsf();
