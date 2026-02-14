import XLSX from 'xlsx';
import path from 'path';

const workbook = XLSX.readFile('c:/Proyectos/Memoria/B2B_Materialidad/Proforma.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log(JSON.stringify(data, null, 2));
