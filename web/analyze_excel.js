import * as XLSX from 'xlsx';
import fs from 'fs';

const filePath = process.argv[2] || 'C:/Proyectos/Memoria/B2B_Materialidad/Ejemplos/L PROFORMA SOLUTIONS MIMI-CESMA_SERV. SOP. REDES Y COMP.. 2 de 24, Q2 ENE. 2026.xlsx';

if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
}

try {
    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    // header: 1 means we get an array of arrays
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Print the first 30 rows to see headers and some data
    console.log(JSON.stringify(data.slice(0, 30), null, 2));
} catch (error) {
    console.error('Error reading excel:', error);
}
