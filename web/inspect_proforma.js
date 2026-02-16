import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const folderPath = path.join(__dirname, '..', 'Ejemplos');
const files = [
    'M PROFORMA SEIDCO-CESMA_SERV. LIMP. Y CONS. DE OFCNAS 2 de 24, Q2 ENE. 2026 (1).xlsx',
    'PROFORMA MVC CESMA SERV. ASESORIA FIN. 2 de 24, Q2 ENE. 2026.xlsx'
];

files.forEach(fileName => {
    const filePath = path.join(folderPath, fileName);
    console.log(`\n--- INSPECTING: ${fileName} ---`);
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        data.slice(0, 45).forEach((row, index) => {
            if (row && row.length > 0) {
                console.log(`Row ${index}:`, row.map(c => c === null ? 'null' : (typeof c === 'string' ? c.substring(0, 30) : c)).join(' | '));
            }
        });
    } catch (error) {
        console.error(`Error reading ${fileName}:`, error.message);
    }
});
