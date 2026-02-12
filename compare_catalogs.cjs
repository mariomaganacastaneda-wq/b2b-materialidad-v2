const XLSX = require('./web/node_modules/xlsx/xlsx.js');
const fs = require('fs');
const path = require('path');

async function compareCatalogs() {
    console.log('Iniciando comparación de catálogos...');

    // 1. Cargar Catálogo Extraído del PDF (2019)
    console.log('Cargando catálogo extraído (2019)...');
    const wb2019 = XLSX.readFile('Cat_logo_Actividades_Procesado.xlsx');
    const data2019 = XLSX.utils.sheet_to_json(wb2019.Sheets[wb2019.SheetNames[0]]);

    // 2. Cargar Catálogo Actual (Copia de Cat_Actividad.xls)
    console.log('Cargando catálogo actual...');
    const wbActual = XLSX.readFile('Copia de Cat_Actividad.xls');
    const dataActual = XLSX.utils.sheet_to_json(wbActual.Sheets[wbActual.SheetNames[0]]);

    // 3. Cargar Actualizaciones 2026 (Anexo 6)
    console.log('Cargando actualizaciones 2026...');
    const wb2026 = XLSX.readFile('Anexo6_RMF_2026_Catalogo.xlsx');
    const data2026 = XLSX.utils.sheet_to_json(wb2026.Sheets[wb2026.SheetNames[0]]);

    // Análisis
    const codes2019 = new Set(data2019.map(r => String(r.Clave)));
    const codesActual = new Set(dataActual.map(r => String(r.Codigo || r.Clave)));

    const missingInActual = data2019.filter(r => !codesActual.has(String(r.Clave)));
    const extraInActual = dataActual.filter(r => !codes2019.has(String(r.Codigo || r.Clave)));

    console.log('\n--- RESULTADOS DEL ANÁLISIS ---');
    console.log(`Total registros en PDF 2019: ${data2019.length}`);
    console.log(`Total registros en Sistema Actual: ${dataActual.length}`);
    console.log(`Registros en PDF 2019 que NO están en el sistema: ${missingInActual.length}`);
    console.log(`Registros en Sistema que NO están en PDF 2019: ${extraInActual.length}`);
    console.log(`Total registros en Anexo 6 (2026) detectados: ${data2026.length}`);

    // Crear un reporte consolidado
    const report = {
        resumen: {
            pdf_2019_total: data2019.length,
            sistema_actual_total: dataActual.length,
            potenciales_adiciones: missingInActual.length,
            desactualizados_o_especiales: extraInActual.length,
            actualizaciones_2026: data2026.length
        },
        ejemplos_adiciones: missingInActual.slice(0, 10).map(r => ({ clave: r.Clave, desc: r.Descripcion })),
        ejemplos_faltantes_en_pdf: extraInActual.slice(0, 10).map(r => ({ clave: r.Codigo || r.Clave, desc: r.Nombre || r.Descripcion }))
    };

    fs.writeFileSync('reporte_comparativo.json', JSON.stringify(report, null, 2));
    console.log('\nReporte detallado guardado en: reporte_comparativo.json');

    // Generar un Excel con las adiciones recomendadas (sólo códigos de 6 dígitos que no están en el sistema)
    const recommendedAdds = missingInActual.filter(r => String(r.Clave).length === 6);
    const wsAdds = XLSX.utils.json_to_sheet(recommendedAdds);
    const wbAdds = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbAdds, wsAdds, 'Adiciones Recomendadas');
    XLSX.writeFile(wbAdds, 'Adiciones_Recomendadas_SAT.xlsx');
    console.log(`Excel de adiciones generado: Adiciones_Recomendadas_SAT.xlsx (${recommendedAdds.length} registros)`);
}

compareCatalogs().catch(err => console.error('Error en la comparación:', err));
