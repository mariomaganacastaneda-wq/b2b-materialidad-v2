import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProformaData {
    clientName: string;
    clientRFC: string;
    clientAddress: string;
    clientCP: string;
    clientRegime: string;
    economicActivity: string;
    currency: string;
    items: any[];
    subtotal: number;
    iva: number;
    ieps: number;
    total: number;
    orgName: string;
    orgRFC: string;
    orgLogoUrl?: string;
    orgColor?: string;
    orgSecondaryColor?: string;
    orgAccentColor?: string;
    execution_period?: string;
    proforma_number?: number;
    total_proformas?: number;
    consecutive_id?: number;
    contract_reference?: string;
    bankAccounts?: { bank: string; clabe?: string; number?: string }[];
}

export const generateProformaPDF = async (data: ProformaData) => {
    console.log('PDF: Iniciando generación...', data);
    try {
        const doc = new jsPDF();
        const primaryColor = data.orgColor || '#1e40af';

        // Configuración de resolución y márgenes
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // --- WATERMARK (FONDO) ---
        if (data.orgLogoUrl && data.orgLogoUrl !== 'none') {
            try {
                // Configurar transparencia para la marca de agua
                doc.saveGraphicsState();
                doc.setGState(new (doc as any).GState({ opacity: 0.1 })); // 10% de opacidad

                const watermarkSize = 120; // 120mm de tamaño
                const watermarkX = (pageWidth - watermarkSize) / 2;
                const watermarkY = (pageHeight - watermarkSize) / 2;

                doc.addImage(data.orgLogoUrl, 'PNG', watermarkX, watermarkY, watermarkSize, watermarkSize, undefined, 'FAST');

                doc.restoreGraphicsState();
            } catch (e) {
                console.error('Error adding watermark to PDF:', e);
            }
        }


        // --- HEADER: LOGO Y DATOS EMISOR ---
        if (data.orgLogoUrl && data.orgLogoUrl !== 'none') {
            try {
                // Ajuste proporcional del logo (max ancho 35mm)
                doc.addImage(data.orgLogoUrl, 'PNG', margin, margin, 35, 35, undefined, 'FAST');
            } catch (e) {
                console.error('Error loading logo in PDF:', e);
            }
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(primaryColor);
        doc.text('Proforma Materialidad Fiscal B2B', pageWidth / 2, 18, { align: 'center' });

        doc.setFontSize(9);
        doc.setTextColor('#64748b');

        // Folio y Fecha
        const folioText = data.consecutive_id
            ? `Folio: #${data.consecutive_id}`
            : (data.proforma_number && data.total_proformas)
                ? `Folio Seq: ${data.proforma_number} de ${data.total_proformas}`
                : `Folio: ${new Date().getTime().toString().slice(-6)}`;

        doc.text(folioText, pageWidth - margin, 26, { align: 'right' });
        doc.text(`Fecha Emisión: ${new Date().toLocaleDateString()}`, pageWidth - margin, 31, { align: 'right' });

        if (data.execution_period) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(primaryColor);
            doc.text(`Periodo: ${data.execution_period.toUpperCase()}`, pageWidth - margin, 36, { align: 'right' });
        }

        // Datos Emisor - Centrados verticalmente con el logo (35mm de altura, centro en 37.5)
        const emisorX = (data.orgLogoUrl && data.orgLogoUrl !== 'none') ? margin + 40 : margin;
        const orgNameWrap = doc.splitTextToSize(data.orgName, 80);

        // Cálculo de altura para centrado vertical
        // Línea de nombre (orgNameWrap.length) + RFC + Emisor Autorizado = Total + 2 líneas
        const totalEmisorLines = orgNameWrap.length + 2;
        const emisorLineHeight = 5;
        const emisorTotalHeight = totalEmisorLines * emisorLineHeight;
        const logoCenterY = margin + (35 / 2);
        const emisorStartY = logoCenterY - (emisorTotalHeight / 2) + 3; // +3 para compensar el baseline del texto

        doc.setFontSize(11);
        doc.setTextColor('#1e293b');
        doc.text(orgNameWrap, emisorX, emisorStartY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const yAfterName = emisorStartY + (orgNameWrap.length * emisorLineHeight);
        doc.text(`RFC: ${data.orgRFC}`, emisorX, yAfterName);
        doc.text('Emisor Autorizado', emisorX, yAfterName + 5);

        doc.setDrawColor(primaryColor);
        doc.setLineWidth(0.5);
        doc.line(margin, 58, pageWidth - margin, 58); // Bajada la línea de 55 a 58

        // --- DATOS DEL CLIENTE ---
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(primaryColor);
        doc.text('RECEPTOR / CLIENTE', margin, 68); // Bajado de 65

        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#1e293b');
        const clientNameWrap = doc.splitTextToSize(data.clientName, 100);
        doc.text(clientNameWrap, margin, 75);

        doc.setFontSize(10);
        const yAfterClientName = 75 + (clientNameWrap.length * 5);
        doc.text(`RFC: ${data.clientRFC}`, margin, yAfterClientName);
        doc.text(`Régimen: ${data.clientRegime}`, margin, yAfterClientName + 6);
        doc.text(data.clientAddress, margin, yAfterClientName + 12, { maxWidth: 100 });

        doc.setFont('helvetica', 'bold');
        doc.text('ACTIVIDAD VINCULADA:', pageWidth - margin, 68, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const activityWrap = doc.splitTextToSize(data.economicActivity, 80);
        doc.text(activityWrap, pageWidth - margin, 74, { align: 'right' });

        if (data.contract_reference) {
            const nextY = 74 + (activityWrap.length * 4) + 5;
            doc.setFont('helvetica', 'bold');
            doc.text('REFERENCIA CONTRATO:', pageWidth - margin, nextY, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.text(data.contract_reference, pageWidth - margin, nextY + 6, { align: 'right' });
        }

        // --- TABLA DE CONCEPTOS ---
        const tableHeaders = [['Clave SAT', 'Descripción', 'Cant.', 'Unidad', 'P. Unitario', 'Importe']];
        const tableData = data.items.map(item => [
            item.code,
            item.description,
            item.quantity,
            item.unit,
            `$${item.unitPrice.toLocaleString()}`,
            `$${(item.quantity * item.unitPrice).toLocaleString()}`
        ]);

        autoTable(doc, {
            startY: 105,
            head: tableHeaders,
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 10, halign: 'center' },
            columnStyles: {
                0: { cellWidth: 25, halign: 'center' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 15, halign: 'center' },
                3: { cellWidth: 20, halign: 'center' },
                4: { cellWidth: 25, halign: 'right' },
                5: { cellWidth: 30, halign: 'right' }
            },
            styles: { fontSize: 9, cellPadding: 3 }
        });

        const finalY = (doc as any).lastAutoTable?.finalY || 150;
        const accentColor = data.orgAccentColor || '#f59e0b';
        const secondaryColor = data.orgSecondaryColor || '#64748b';

        // --- TOTALES ---
        const totalsX = pageWidth - margin - 60;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#64748b');
        doc.text('Subtotal:', totalsX, finalY + 10);
        doc.setTextColor('#1e293b');
        doc.text(`$${data.subtotal.toLocaleString()}`, pageWidth - margin, finalY + 10, { align: 'right' });

        doc.setTextColor('#64748b');
        doc.text('IVA (16%):', totalsX, finalY + 17);
        doc.setTextColor('#1e293b');
        doc.text(`$${data.iva.toLocaleString()}`, pageWidth - margin, finalY + 17, { align: 'right' });

        let currentY = finalY + 17;
        if (data.ieps > 0) {
            currentY += 7;
            doc.setTextColor('#64748b');
            doc.text('IEPS (8%):', totalsX, currentY);
            doc.setTextColor('#1e293b');
            doc.text(`$${data.ieps.toLocaleString()}`, pageWidth - margin, currentY, { align: 'right' });
        }

        doc.setDrawColor(accentColor);
        doc.setLineWidth(0.8);
        doc.line(totalsX, currentY + 5, pageWidth - margin, currentY + 5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(accentColor);
        doc.text('TOTAL:', totalsX, currentY + 13);
        doc.text(`$${data.total.toLocaleString()} ${data.currency}`, pageWidth - margin, currentY + 13, { align: 'right' });

        // --- FOOTER / NOTAS ---
        // --- DATOS BANCARIOS ---
        if (data.bankAccounts && data.bankAccounts.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(secondaryColor);
            doc.text('DATOS PARA TRANSFERENCIA BANCARIA:', margin, finalY + 10);

            doc.setFont('helvetica', 'normal');
            doc.setTextColor('#475569');
            data.bankAccounts.forEach((acc, i) => {
                const accText = `${acc.bank}: ${acc.clabe || acc.number}`;
                doc.text(accText, margin, finalY + 16 + (i * 5));
            });
        }

        // --- FOOTER / NOTAS ---
        doc.setFontSize(8);
        doc.setTextColor('#94a3b8');
        const footerY = doc.internal.pageSize.getHeight();
        doc.text('Este documento es una representación gráfica de una proforma de servicios. No constituye una factura fiscal CFDI.', pageWidth / 2, footerY - 15, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.text('B2B Materialidad - Gestión Forense de Negocios | fiscerta.com', pageWidth / 2, footerY - 8, { align: 'center' });

        // Abrir en nueva pestaña
        // Abrir en nueva pestaña con respaldo de seguridad
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);

        const win = window.open(pdfUrl, '_blank');
        if (!win || win.closed) {
            // Si el bloqueador de popups lo detiene, intentar descargar como respaldo
            doc.save(`Proforma_${data.clientName.replace(/\s+/g, '_')}.pdf`);
            alert('El navegador bloqueó la vista previa. El archivo se ha descargado automáticamente.');
        }
    } catch (error) {
        console.error('CRITICAL ERROR in PDF Generation:', error);
        alert('Error crítico al generar PDF: ' + (error instanceof Error ? error.message : String(error)));
    }
};
