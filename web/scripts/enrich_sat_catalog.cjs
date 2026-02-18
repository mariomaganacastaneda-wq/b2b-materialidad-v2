const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

async function enrichCatalog() {
    const excelPath = path.resolve(__dirname, '../../catalogo-productos-servicios-sat.xls');
    if (!fs.existsSync(excelPath)) {
        console.error('Excel no encontrado en:', excelPath);
        return;
    }

    console.log('Leyendo Excel...');
    const workbook = xlsx.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // Usar raw: false para intentar normalizar textos
    const rows = xlsx.utils.sheet_to_json(sheet, { raw: false });

    console.log(`Procesando ${rows.length} filas...`);

    // El Excel tiene una estructura con cabeceras en la fila 3 (índice 2 aprox)
    // Pero sheet_to_json por defecto usa la primera fila. 
    // Según nuestro análisis previo, los datos reales empiezan después de las primeras filas de metadata.

    const updates = [];
    rows.forEach((row, index) => {
        // Mapeo basado en el análisis de command_status previo
        const code = String(row['Catálogo de Claves de Productos y Servicios.']).trim();
        const description = row['__EMPTY'];
        const iva = row['__EMPTY_1'];
        const ieps = row['__EMPTY_2'];
        const similar = row['__EMPTY_7'];

        // Validar que sea un código numérico de 8 dígitos (Producto/Clase)
        if (code && /^\d+$/.test(code)) {
            updates.push({
                code,
                name: description,
                includes_iva_transfered: iva === 'SÍ' || iva === 'Opcional',
                includes_ieps_transfered: ieps === 'SÍ' || ieps === 'Opcional',
                similar_words: similar || null
            });
        }
    });

    console.log(`Generadas ${updates.length} actualizaciones potenciales.`);

    // Generar SQL optimizado en batches de 1000
    const batchSize = 1000;
    const batches = [];
    for (let i = 0; i < updates.length; i += batchSize) {
        const chunk = updates.slice(i, i + batchSize);
        const values = chunk.map(u => {
            const code = `'${u.code}'`;
            const iva = u.includes_iva_transfered;
            const ieps = u.includes_ieps_transfered;
            const similar = u.similar_words ? `'${u.similar_words.replace(/'/g, "''")}'` : 'NULL';
            return `(${code}, ${iva}, ${ieps}, ${similar})`;
        }).join(',\n  ');

        const sql = `UPDATE public.cat_cfdi_productos_servicios AS t SET
  includes_iva_transfered = v.iva,
  includes_ieps_transfered = v.ieps,
  similar_words = v.sw,
  updated_at = NOW()
FROM (VALUES
  ${values}
) AS v(code, iva, ieps, sw)
WHERE t.code = v.code;`;

        batches.push(sql);
    }

    const outputPath = path.resolve(__dirname, 'update_catalog_batches.sql');
    fs.writeFileSync(outputPath, batches.join('\n\n-- BATCH BREAK --\n\n'));
    console.log(`Archivo SQL generado en batches: ${outputPath}`);
}

enrichCatalog();
