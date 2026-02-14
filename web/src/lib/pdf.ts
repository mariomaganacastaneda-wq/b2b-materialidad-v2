import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

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
    total: number;
    orgName: string;
    orgRFC: string;
    orgLogoUrl?: string;
    orgColor?: string;
}

export const generateProformaPDF = async (data: ProformaData) => {
    const doc = new jsPDF();
    const primaryColor = data.orgColor || '#1e40af';

    // Configuración de resolución y márgenes
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();

    // --- HEADER: LOGO Y DATOS EMISOR ---
    if (data.orgLogoUrl && data.orgLogoUrl !== 'none') {
        try {
            // Intentar cargar imagen si es URL base64 o accesible
            doc.addImage(data.orgLogoUrl, 'PNG', margin, margin, 40, 40);
        } catch (e) {
            console.error('Error loading logo in PDF:', e);
        }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(primaryColor);
    doc.text('PROFORMA DE SERVICIOS', pageWidth - margin, 30, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor('#64748b');
    doc.text(`Folio: ${new Date().getTime().toString().slice(-6)}`, pageWidth - margin, 38, { align: 'right' });
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, pageWidth - margin, 44, { align: 'right' });

    // Datos Emisor
    doc.setFontSize(12);
    doc.setTextColor('#1e293b');
    doc.text(data.orgName, margin + 45, 25);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`RFC: ${data.orgRFC}`, margin + 45, 31);
    doc.text('Emisor Autorizado', margin + 45, 37);

    doc.setDrawColor(primaryColor);
    doc.setLineWidth(0.5);
    doc.line(margin, 55, pageWidth - margin, 55);

    // --- DATOS DEL CLIENTE ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryColor);
    doc.text('RECEPTOR / CLIENTE', margin, 65);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#1e293b');
    doc.setFontSize(11);
    doc.text(data.clientName, margin, 72);
    doc.setFontSize(10);
    doc.text(`RFC: ${data.clientRFC}`, margin, 78);
    doc.text(`Régimen: ${data.clientRegime}`, margin, 84);
    doc.text(data.clientAddress, margin, 90, { maxWidth: 100 });

    // Actividad Económica
    doc.setFont('helvetica', 'bold');
    doc.text('ACTIVIDAD VINCULADA:', pageWidth - margin, 72, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    const activityWrap = doc.splitTextToSize(data.economicActivity, 70);
    doc.text(activityWrap, pageWidth - margin, 78, { align: 'right' });

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

    (doc as any).autoTable({
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

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // --- TOTALES ---
    const totalsX = pageWidth - margin - 60;
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', totalsX, finalY);
    doc.text(`$${data.subtotal.toLocaleString()}`, pageWidth - margin, finalY, { align: 'right' });

    doc.text('IVA (16%):', totalsX, finalY + 7);
    doc.text(`$${data.iva.toLocaleString()}`, pageWidth - margin, finalY + 7, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(primaryColor);
    doc.text('TOTAL:', totalsX, finalY + 15);
    doc.text(`$${data.total.toLocaleString()} ${data.currency}`, pageWidth - margin, finalY + 15, { align: 'right' });

    // --- FOOTER / NOTAS ---
    doc.setFontSize(8);
    doc.setTextColor('#94a3b8');
    doc.text('Este documento es una representación gráfica de una proforma de servicios. No constituye una factura fiscal CFDI.', margin, doc.internal.pageSize.getHeight() - 20);
    doc.text('B2B Materialidad - Gestión Forense de Negocios', pageWidth - margin, doc.internal.pageSize.getHeight() - 20, { align: 'right' });

    // Abrir en nueva pestaña
    window.open(doc.output('bloburl'), '_blank');
};
