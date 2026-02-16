import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'Ejemplos', 'M PROFORMA SEIDCO-CESMA_SERV. LIMP. Y CONS. DE OFCNAS 2 de 24, Q2 ENE. 2026 (1).xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(JSON.stringify(data.slice(0, 30), null, 2));
} catch (error) {
    console.error('Error reading file:', error.message);
}
