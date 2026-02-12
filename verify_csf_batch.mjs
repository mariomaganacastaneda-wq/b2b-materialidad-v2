/**
 * verify_csf_batch.mjs
 * Automatización de carga masiva para pruebas E2E de Onboarding CSF v2.0
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// Configuración - Ajustar si es necesario
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ywovtkubsanalddsdedi.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // NECESARIO para storage
const FOLDER_PATH = './Carargar_Empresa_CSF';
const BUCKET_NAME = 'csf';

if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: Se requiere SUPABASE_SERVICE_ROLE_KEY en el entorno.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function processBatch() {
    const files = fs.readdirSync(FOLDER_PATH).filter(f => f.endsWith('.pdf'));
    console.log(`🚀 Iniciando procesamiento de ${files.length} archivos...\n`);

    for (const fileName of files) {
        const filePath = path.join(FOLDER_PATH, fileName);
        const fileBuffer = fs.readFileSync(filePath);
        const storagePath = `batch_test_${Date.now()}_${fileName.replace(/\s+/g, '_')}`;

        console.log(`--- [PROCESANDO: ${fileName}] ---`);

        // 1. Upload to Storage
        console.log(`  📤 Subiendo a Storage: ${storagePath}...`);
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(storagePath, fileBuffer, { contentType: 'application/pdf', upsert: true });

        if (uploadError) {
            console.error(`  ❌ Error al subir: ${uploadError.message}`);
            continue;
        }

        // 2. Invoke Edge Function
        console.log(`  ⚙️ Invocando Edge Function process-csf...`);
        const { data, error: functionError } = await supabase.functions.invoke('process-csf', {
            body: { filePath: storagePath, isCreatingNew: true }
        });

        if (functionError) {
            console.error(`  ❌ Error en función: ${functionError.message}`);
        } else if (data && !data.success) {
            console.warn(`  ⚠️ Resultado fallido: ${data.error}`);
        } else {
            console.log(`  ✅ ÉXITO: Org ID ${data.data?.orgId} | RFC: ${data.data?.rfc} | Emisión: ${data.data?.emissionDate}`);
        }
        console.log('');
    }

    console.log('🏁 Batch completado.');
}

processBatch();
