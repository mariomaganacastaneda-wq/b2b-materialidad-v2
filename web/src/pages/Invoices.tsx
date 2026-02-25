import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Invoice } from '../types';
import {
    FileCheck,
    FileText,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Eye,
    Upload,
    FileEdit
} from 'lucide-react';

interface InvoicesProps {
    userProfile: any;
}

const Invoices = ({ userProfile }: InvoicesProps) => {
    const { id: quotationId } = useParams();
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'SOLICITUD' | 'PREFACTURA' | 'FACTURADA' | 'CANCELADA' | 'TODAS'>('TODAS');

    // Modal states
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [uploading, setUploading] = useState(false);

    // File inputs
    const [files, setFiles] = useState<{ pdf: File | null; xml: File | null; facturaPdf: File | null }>({ pdf: null, xml: null, facturaPdf: null });

    // Metadata inputs
    const [preinvoiceComments, setPreinvoiceComments] = useState('');
    const [invoiceComments, setInvoiceComments] = useState('');
    const [preinvoiceAuthorized, setPreinvoiceAuthorized] = useState(false);
    const [preinvoiceRejected, setPreinvoiceRejected] = useState(false);

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            const { data: rawData, error: fetchError } = await supabase
                .from('quotations')
                .select(`
                    id, proforma_number, created_at, amount_total, request_direct_invoice, invoice_status, organization_id,
                    organizations!inner(id, name, rfc),
                    invoices(*)
                `)
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;

            const flattenedInvoices: any[] = [];

            rawData?.forEach((q: any) => {
                // Ignore if user isn't admin and organization isn't in their access list
                if (userProfile && userProfile.role !== 'ADMIN') {
                    // This relies on the org IDs from userProfile, assume checked elsewhere or we can skip this check if RLS handles it.
                    // Actually, let's keep it simple: RLS will filter `quotations` automatically!
                }

                const invoicesList = Array.isArray(q.invoices) ? q.invoices : (q.invoices ? [q.invoices] : []);

                if (invoicesList.length > 0) {
                    invoicesList.forEach((inv: Invoice) => {
                        flattenedInvoices.push({
                            ...inv,
                            organization: q.organizations,
                            quotations: {
                                request_direct_invoice: q.request_direct_invoice,
                                proforma_number: q.proforma_number
                            }
                        });
                    });
                } else if (q.request_direct_invoice || q.invoice_status === 'solicitada') {
                    flattenedInvoices.push({
                        id: `pending-${q.id}`,
                        quotation_id: q.id,
                        status: 'SOLICITUD',
                        isPending: true,
                        organization_id: q.organization_id,
                        created_at: q.created_at,
                        amount_total: q.amount_total,
                        organization: q.organizations,
                        quotations: {
                            request_direct_invoice: q.request_direct_invoice,
                            proforma_number: q.proforma_number
                        }
                    });
                }
            });

            if (quotationId) {
                setInvoices(flattenedInvoices.filter(i => i.quotation_id === quotationId));
            } else {
                setInvoices(flattenedInvoices);
            }
        } catch (err: any) {
            console.error('Error fetching invoices:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, [quotationId, userProfile]);

    const handleUpload = async () => {
        if (!selectedInvoice) return;
        // Verify at least one file or comment changed.
        if (!files.pdf && !files.xml && !files.facturaPdf && !preinvoiceComments && !invoiceComments && preinvoiceAuthorized === selectedInvoice.preinvoice_authorized) return;

        try {
            setUploading(true);
            let updates: any = {};

            let currentInvoiceId = selectedInvoice.id;

            // If it's a pending invoice, we must create the record first before uploading files
            if (selectedInvoice.isPending) {
                const newInvoice = {
                    quotation_id: selectedInvoice.quotation_id,
                    organization_id: selectedInvoice.organization_id || selectedInvoice.organization?.id,
                    amount_total: selectedInvoice.amount_total || 0,
                    internal_number: selectedInvoice.quotations?.proforma_number?.toString() || 'S/N',
                    rfc_receptor: selectedInvoice.organization?.rfc || 'S/N',
                    rfc_emisor: 'S/N',
                    status: 'SOLICITUD'
                };

                const { data: insertedData, error: insertError } = await supabase
                    .from('invoices')
                    .insert(newInvoice)
                    .select()
                    .single();

                if (insertError) throw insertError;
                currentInvoiceId = insertedData.id;
            }

            // We only change to PREFACTURA_PENDIENTE if we are currently handling the initial request and not rejecting.
            if (selectedInvoice.status === 'SOLICITUD' && (files.pdf || files.xml) && !preinvoiceRejected) {
                updates.status = 'PREFACTURA_PENDIENTE';
                updates.is_preinvoice = true;
            } else if ((selectedInvoice.status === 'PREFACTURA_CANDIDATA' || selectedInvoice.status === 'POR_TIMBRAR') && (files.facturaPdf || files.xml)) {
                // If they uploading final invoice docs
                updates.status = 'TIMBRADA';
            }

            // Handle status rejection explicitly
            if (preinvoiceRejected) {
                updates.status = 'RECHAZADA';
            } else if (selectedInvoice.status === 'RECHAZADA' && !preinvoiceRejected && preinvoiceAuthorized) {
                updates.status = 'VALIDADA';
            }

            // 1. Upload Prefactura PDF
            if (files.pdf) {
                const fileName = `${currentInvoiceId}/prefactura_${Date.now()}.pdf`;
                const { data: pData, error: pError } = await supabase.storage
                    .from('invoices')
                    .upload(fileName, files.pdf);
                if (pError) throw pError;
                updates.preinvoice_url = pData.path;
            }

            // 2. Upload XML (It can be either the preinvoice XML or the final XML depending on status)
            if (files.xml) {
                const fileName = `${currentInvoiceId}/xml_${Date.now()}.xml`;
                const { data: xData, error: xError } = await supabase.storage
                    .from('invoices')
                    .upload(fileName, files.xml);
                if (xError) throw xError;
                updates.xml_url = xData.path;
            }

            // 3. Upload Factura Timbrada PDF
            if (files.facturaPdf) {
                const fileName = `${currentInvoiceId}/factura_${Date.now()}.pdf`;
                const { data: fData, error: fError } = await supabase.storage
                    .from('invoices')
                    .upload(fileName, files.facturaPdf);
                if (fError) throw fError;
                updates.pdf_url = fData.path;
            }

            // Text fields
            if (preinvoiceComments !== selectedInvoice.preinvoice_comments) updates.preinvoice_comments = preinvoiceComments;
            if (invoiceComments !== selectedInvoice.invoice_comments) updates.invoice_comments = invoiceComments;
            if (preinvoiceAuthorized !== selectedInvoice.preinvoice_authorized) updates.preinvoice_authorized = preinvoiceAuthorized;

            if (Object.keys(updates).length > 0) {
                // Update Record
                const { error: uError } = await supabase
                    .from('invoices')
                    .update(updates)
                    .eq('id', currentInvoiceId);

                if (uError) throw uError;
            }

            // Si se subió la prefactura a una cotizacion solicitada, actualizar la proforma
            if (selectedInvoice.status === 'SOLICITUD') {
                await supabase
                    .from('quotations')
                    .update({ invoice_status: 'en_revision' })
                    .eq('id', selectedInvoice.quotation_id);
            } else if (updates.status === 'TIMBRADA') {
                await supabase
                    .from('quotations')
                    .update({ invoice_status: 'timbrada' })
                    .eq('id', selectedInvoice.quotation_id);
            }

            alert('Archivos y comentarios guardados con éxito.');
            setShowUploadModal(false);
            setFiles({ pdf: null, xml: null, facturaPdf: null });
            fetchInvoices();
        } catch (err: any) {
            console.error('Upload Error:', err);
            alert(`Error al procesar: ${err.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleValidate = async (invoiceId: string) => {
        if (!confirm('¿Desea validar esta prefactura? Esto la marcará como lista para timbrado.')) return;

        try {
            const { error } = await supabase
                .from('invoices')
                .update({
                    status: 'VALIDADA',
                    validated_at: new Date().toISOString(),
                    validated_by: userProfile?.id
                })
                .eq('id', invoiceId);

            if (error) throw error;
            fetchInvoices();
        } catch (err: any) {
            alert('Error al validar: ' + err.message);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'SOLICITUD': return <Clock className="w-4 h-4 text-amber-500" />;
            case 'PREFACTURA_PENDIENTE': return <FileText className="w-4 h-4 text-blue-500" />;
            case 'EN_REVISION_VENDEDOR': return <AlertCircle className="w-4 h-4 text-amber-400" />;
            case 'VALIDADA': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'TIMBRADA': return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
            case 'CANCELADA': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'RECHAZADA': return <XCircle className="w-4 h-4 text-red-400" />;
            default: return <FileCheck className="w-4 h-4 text-slate-400" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'SOLICITUD': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'PREFACTURA_PENDIENTE': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'VALIDADA':
            case 'TIMBRADA': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'RECHAZADA':
            case 'CANCELADA': return 'bg-red-500/10 text-red-500 border-red-500/20';
            default: return 'bg-slate-500/10 text-slate-400 border-white/5';
        }
    };

    const filteredInvoices = invoices.filter(inv => {
        if (activeTab === 'TODAS') return true;
        if (activeTab === 'SOLICITUD') return inv.status === 'SOLICITUD';
        if (activeTab === 'PREFACTURA') return inv.status === 'PREFACTURA_PENDIENTE' || inv.status === 'EN_REVISION_VENDEDOR';
        if (activeTab === 'FACTURADA') return inv.status === 'VALIDADA' || inv.status === 'TIMBRADA';
        if (activeTab === 'CANCELADA') return inv.status === 'CANCELADA' || inv.status === 'RECHAZADA';
        return true;
    });

    return (
        <div className="fade-in space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <FileCheck className="text-blue-500" />
                        {quotationId ? 'Facturas de Proforma' : 'Gestión de Facturación'}
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Control de ciclo de vida fiscal: Solicitudes, Prefacturas y Timbrado.
                    </p>
                </div>

                <div className="flex bg-slate-800/40 p-1 rounded-xl border border-white/5">
                    {['TODAS', 'SOLICITUD', 'PREFACTURA', 'FACTURADA', 'CANCELADA'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* LEYENDA DE COLORES */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 bg-slate-800/30 p-3 rounded-xl border border-white/5">
                <span className="font-bold text-slate-300">Estados de Archivo en Tabla:</span>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-yellow-500"></div> Aún no cargada</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Cargada (Pendiente de Autorizar)</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Archivo cargado y autorizado</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500"></div> Rechazada / Cancelada</div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3">
                    <XCircle className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}

            <div className="glass-card !p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/5">
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Folio P. / Org</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Monto Total</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Archivos</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Estado</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Fecha</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-4 h-16 bg-white/5" />
                                    </tr>
                                ))
                            ) : filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">
                                        No se encontraron registros en este estado.
                                    </td>
                                </tr>
                            ) : filteredInvoices.map((inv: any) => (
                                <tr key={inv.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {inv.isPending ? (
                                                <button
                                                    onClick={() => navigate(`/proformas/${inv.quotation_id}`)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors flex-shrink-0 opacity-50 cursor-pointer"
                                                    title="Ir a Configurar Proforma"
                                                >
                                                    <FileEdit className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                inv.quotation_id && (
                                                    <button
                                                        onClick={() => navigate(`/proformas/${inv.quotation_id}`)}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors flex-shrink-0"
                                                        title="Abrir Proforma Original"
                                                    >
                                                        <FileEdit className="w-4 h-4" />
                                                    </button>
                                                )
                                            )}
                                            <div>
                                                <div className="font-bold text-white leading-tight font-mono text-sm max-w-[150px] truncate">
                                                    {(() => {
                                                        const orgPrefix = inv.organization?.rfc?.match(/^[A-Z&]{3,4}/)?.[0] || 'PF';
                                                        const dateStr = inv.quotations?.created_at ? new Date(inv.quotations.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '') : '000000';
                                                        const folNum = (inv.quotations?.proforma_number || 1).toString().padStart(2, '0');
                                                        return `${orgPrefix}-${dateStr}-${folNum}`;
                                                    })()}
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-tighter truncate max-w-[150px]">
                                                    {inv.organization?.name || 'Org Desconocida'}
                                                </div>
                                                {inv.internal_number && inv.internal_number !== 'SOLICITUD_S/F' && (
                                                    <div className="text-[10px] font-bold text-blue-400 mt-1">
                                                        Folio Fiscal: {inv.internal_number}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="font-bold text-emerald-500">
                                            {inv.amount_total?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-1.5">
                                            <div title={inv.preinvoice_url ? (['RECHAZADA', 'CANCELADA'].includes(inv.status) ? 'Prefactura Rechazada/Cancelada' : (inv.status === 'PREFACTURA_PENDIENTE' ? 'Prefactura Pendiente' : 'Prefactura Autorizada')) : 'Sin Prefactura'} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white cursor-help ${inv.preinvoice_url ? (['RECHAZADA', 'CANCELADA'].includes(inv.status) ? 'bg-red-500' : (inv.status === 'PREFACTURA_PENDIENTE' ? 'bg-blue-500' : 'bg-emerald-500')) : 'bg-yellow-500'}`}>PF</div>
                                            <div title={inv.pdf_url ? (inv.status === 'CANCELADA' ? 'Factura Cancelada' : 'Factura Cargada') : 'Sin Factura'} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white cursor-help ${inv.pdf_url ? (inv.status === 'CANCELADA' ? 'bg-red-500' : 'bg-emerald-500') : 'bg-yellow-500'}`}>F</div>
                                            <div title={inv.xml_url ? (inv.status === 'CANCELADA' ? 'XML Cancelado' : 'XML Cargado') : 'Sin XML'} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white cursor-help ${inv.xml_url ? (inv.status === 'CANCELADA' ? 'bg-red-500' : 'bg-emerald-500') : 'bg-yellow-500'}`}>X</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${getStatusColor(inv.status)}`}>
                                            {getStatusIcon(inv.status)}
                                            {inv.status?.replace(/_/g, ' ')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-slate-400">
                                            {new Date(inv.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3 justify-center">
                                            {inv.isPending ? (
                                                <button
                                                    className="p-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition-colors cursor-not-allowed opacity-50"
                                                    title="Sube evidencia desde la Proforma o una vez creada la factura"
                                                >
                                                    <Upload size={18} />
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedInvoice(inv);
                                                            setPreinvoiceComments(inv.preinvoice_comments || '');
                                                            setInvoiceComments(inv.invoice_comments || '');
                                                            setPreinvoiceAuthorized(inv.preinvoice_authorized || false);
                                                            setPreinvoiceRejected(inv.status === 'RECHAZADA');
                                                            setShowUploadModal(true);
                                                            setFiles({ pdf: null, xml: null, facturaPdf: null });
                                                        }}
                                                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                                                        title="Gestionar Archivos"
                                                    >
                                                        <Upload className="w-4 h-4" />
                                                    </button>

                                                    {(inv.status === 'PREFACTURA_PENDIENTE' || inv.status === 'EN_REVISION_VENDEDOR') && userProfile?.role === 'ADMIN' && (
                                                        <button
                                                            onClick={() => handleValidate(inv.id)}
                                                            className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all"
                                                            title="Validar Prefactura"
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </button>
                                                    )}

                                                    {inv.status === 'VALIDADA' && (
                                                        <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg cursor-help shrink-0" title="Validado Pospago">
                                                            <CheckCircle2 size={18} />
                                                        </span>
                                                    )}

                                                    {(inv.pdf_url || inv.xml_url) && (
                                                        <button
                                                            onClick={() => {
                                                                // Handle view details optionally
                                                            }}
                                                            className="p-1.5 bg-slate-500/10 text-slate-400 hover:text-white rounded-lg transition-colors"
                                                            title="Ver Detalles"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DE CARGA */}
            {showUploadModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden shadow-blue-500/10">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Upload className="text-blue-500 w-5 h-5" />
                                    Documentación de Facturación
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">Sube la documentación y añade comentarios al proceso.</p>
                            </div>
                            <button onClick={() => setShowUploadModal(false)} className="text-slate-500 hover:text-white transition-colors">&times;</button>
                        </div>

                        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                            <div className="space-y-6">
                                {/* SECCIÓN PREFACTURA */}
                                <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-emerald-500" />
                                        1. Prefactura
                                    </h4>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archivo PDF (Prefactura)</label>
                                        {selectedInvoice?.preinvoice_url && !files.pdf ? (
                                            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                                    <FileCheck size={16} /> Archivo Cargado
                                                </div>
                                            </div>
                                        ) : (
                                            <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${files.pdf ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-blue-500/30'}`}>
                                                <input
                                                    type="file"
                                                    accept=".pdf"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    onChange={(e) => setFiles(prev => ({ ...prev, pdf: e.target.files?.[0] || null }))}
                                                />
                                                <div className="text-center">
                                                    {files.pdf ? (
                                                        <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                                                            <FileCheck size={16} /> {files.pdf.name}
                                                        </div>
                                                    ) : (
                                                        <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
                                                            <Upload size={20} className="text-slate-600" />
                                                            Sube la prefactura en PDF
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comentarios (Prefactura)</label>
                                        <textarea
                                            value={preinvoiceComments}
                                            onChange={(e) => setPreinvoiceComments(e.target.value)}
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors custom-scrollbar"
                                            placeholder="Añade observaciones sobre la prefactura..."
                                            rows={2}
                                        />
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2">
                                        <div className={`flex items-center gap-3 border p-3 rounded-xl cursor-pointer transition-colors flex-1 w-full ${preinvoiceAuthorized ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-900 border-white/5 hover:bg-slate-800'}`}
                                            onClick={() => {
                                                setPreinvoiceAuthorized(!preinvoiceAuthorized);
                                                if (!preinvoiceAuthorized) setPreinvoiceRejected(false);
                                            }}>
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${preinvoiceAuthorized ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/20 text-transparent'}`}>
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                            </div>
                                            <span className={`text-sm font-medium ${preinvoiceAuthorized ? 'text-emerald-400' : 'text-slate-300'}`}>Prefactura Autorizada</span>
                                        </div>

                                        <div className={`flex items-center gap-3 border p-3 rounded-xl cursor-pointer transition-colors flex-1 w-full ${preinvoiceRejected ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-900 border-white/5 hover:bg-slate-800'}`}
                                            onClick={() => {
                                                setPreinvoiceRejected(!preinvoiceRejected);
                                                if (!preinvoiceRejected) setPreinvoiceAuthorized(false);
                                            }}>
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${preinvoiceRejected ? 'bg-red-500 border-red-500 text-white' : 'border-white/20 text-transparent'}`}>
                                                <XCircle className="w-3.5 h-3.5" />
                                            </div>
                                            <span className={`text-sm font-medium ${preinvoiceRejected ? 'text-red-400' : 'text-slate-300'}`}>Prefactura Rechazada</span>
                                        </div>
                                    </div>
                                </div>

                                {/* SECCIÓN FACTURA TIMBRADA */}
                                <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <FileCheck className="w-4 h-4 text-blue-500" />
                                        2. Factura Timbrada
                                    </h4>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archivo PDF (Factura Final)</label>
                                        {selectedInvoice?.pdf_url && !files.facturaPdf ? (
                                            <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl">
                                                <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                                                    <FileCheck size={16} /> Archivo Cargado
                                                </div>
                                            </div>
                                        ) : (
                                            <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${files.facturaPdf ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-blue-500/30'}`}>
                                                <input
                                                    type="file"
                                                    accept=".pdf"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    onChange={(e) => setFiles(prev => ({ ...prev, facturaPdf: e.target.files?.[0] || null }))}
                                                />
                                                <div className="text-center">
                                                    {files.facturaPdf ? (
                                                        <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                                                            <FileCheck size={16} /> {files.facturaPdf.name}
                                                        </div>
                                                    ) : (
                                                        <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
                                                            <Upload size={20} className="text-slate-600" />
                                                            Sube la factura timbrada (PDF)
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comentarios (Factura)</label>
                                        <textarea
                                            value={invoiceComments}
                                            onChange={(e) => setInvoiceComments(e.target.value)}
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors custom-scrollbar"
                                            placeholder="Añade observaciones sobre la factura final..."
                                            rows={2}
                                        />
                                    </div>
                                </div>

                                {/* SECCIÓN XML */}
                                <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-purple-500" />
                                        3. Archivo XML
                                    </h4>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archivo XML (CFDI)</label>
                                        {selectedInvoice?.xml_url && !files.xml ? (
                                            <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl">
                                                <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                                                    <FileCheck size={16} /> Archivo XML Cargado
                                                </div>
                                            </div>
                                        ) : (
                                            <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${files.xml ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-blue-500/30'}`}>
                                                <input
                                                    type="file"
                                                    accept=".xml"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    onChange={(e) => setFiles(prev => ({ ...prev, xml: e.target.files?.[0] || null }))}
                                                />
                                                <div className="text-center">
                                                    {files.xml ? (
                                                        <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                                                            <FileCheck size={16} /> {files.xml.name}
                                                        </div>
                                                    ) : (
                                                        <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
                                                            <FileText size={20} className="text-slate-600" />
                                                            Arrastra o selecciona el XML
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-6 border-t border-white/5">
                                <button
                                    onClick={() => setShowUploadModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl transition-all"
                                >
                                    Cerrar
                                </button>
                                <button
                                    disabled={uploading}
                                    onClick={handleUpload}
                                    className={`flex-1 px-4 py-2.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg ${uploading
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20'
                                        }`}
                                >                            {uploading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                        Subiendo...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={16} />
                                        Subir y Notificar
                                    </>
                                )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Invoices;
