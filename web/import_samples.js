import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const folderPath = path.join(__dirname, '..', 'Ejemplos');

// Mapeo manual de nombres encontrados en Excel a IDs de Supabase conocidos
// Basado en la inspección previa
const ORG_MAP = {
    'SEIDCO': '573a0822-5845-4eac-8894-ab4251b07cac',
    'SUSANA DEL MORAL': '9607b0d5-8ab5-4026-a820-22e492feefbb',
    'SOLUTIONS MIMI': '580ba646-1f42-4593-93e3-65f110854556',
    'MVC': 'ce5595e7-fddf-4a3f-88ac-513f71f37d08'
};

async function importProforma(fileName) {
    const filePath = path.join(folderPath, fileName);
    console.log(`Processing: ${fileName}`);

    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Extraer Emisor
        let emisorName = '';
        data.forEach(row => {
            if (Array.isArray(row) && row[0] && typeof row[0] === 'string' && row[0].toLowerCase().includes('emite:')) {
                emisorName = row[3] || '';
            }
        });

        // Extraer Receptor
        let receptorName = '';
        data.forEach(row => {
            if (Array.isArray(row) && row[0] && typeof row[0] === 'string' && row[0].toLowerCase().includes('favor de:')) {
                receptorName = row[3] || '';
            }
        });

        // Buscar IDs
        const orgId = ORG_MAP[Object.keys(ORG_MAP).find(k => emisorName.includes(k))] || ORG_MAP['SEIDCO'];

        // Items a partir de la fila 18
        const items = [];
        for (let i = 18; i < data.length; i++) {
            const row = data[i];
            if (row && row[2] && typeof row[2] === 'string' && row[2].length > 5) {
                items.push({
                    description: row[2],
                    quantity: parseFloat(row[8]) || 1,
                    unit_price: parseFloat(row[9]) || 0,
                    subtotal: parseFloat(row[8]) * parseFloat(row[9]) || 0
                });
            }
            if (row && row[8] === 'Total') break;
        }

        const total = items.reduce((sum, it) => sum + it.subtotal, 0);

        // Insertar Quotation
        const { data: quote, error: qError } = await supabase
            .from('quotations')
            .insert({
                organization_id: orgId,
                description: `Importada: ${fileName}`,
                amount_subtotal: total,
                amount_iva: total * 0.16,
                amount_total: total * 1.16,
                status: 'PENDIENTE'
            })
            .select()
            .single();

        if (qError) throw qError;

        // Insertar Items
        if (items.length > 0) {
            const { error: iError } = await supabase
                .from('quotation_items')
                .insert(items.map(it => ({
                    ...it,
                    quotation_id: quote.id
                })));
            if (iError) throw iError;
        }

        console.log(`Successfully imported: ${fileName} as Quote ID: ${quote.id}`);
    } catch (err) {
        console.error(`Error in ${fileName}:`, err.message);
    }
}

async function main() {
    const files = [
        'M PROFORMA SEIDCO-CESMA_SERV. LIMP. Y CONS. DE OFCNAS 2 de 24, Q2 ENE. 2026 (1).xlsx',
        'PROFORMA MVC CESMA SERV. ASESORIA FIN. 2 de 24, Q2 ENE. 2026.xlsx',
        'PROFORMA MVC CESMA SERV. ASESORIA FISCAL 2 de 24, Q2 ENE. 2026.xlsx',
        'PROFORMA MVC CESMA SERV. ASESORIA JURIDICA CORPORATIVA 2 de 24, Q2 ENE. 2026.xlsx'
    ];

    for (const f of files) {
        await importProforma(f);
    }
}

main();
