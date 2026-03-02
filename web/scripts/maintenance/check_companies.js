
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
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
    console.error('❌ Faltan variables de entorno.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function searchCompanies() {
    console.log("🔍 Buscando empresas 'Magaña' y 'Viera'...");

    const { data, error } = await supabase
        .from('organizations')
        .select('rfc, name, taxpayer_type, csf_emission_date')
        .or('name.ilike.%Magaña%,name.ilike.%Viera%');

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    if (data.length === 0) {
        console.log("⚠️ No se encontraron coincidencias.");
    } else {
        console.table(data);
    }
}

searchCompanies();
