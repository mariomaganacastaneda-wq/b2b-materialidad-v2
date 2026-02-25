import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    FileText,
    Clock,
    CheckCircle2,
    XCircle,
    Eye,
    Upload,
    Send,
    FileEdit
} from 'lucide-react';

interface QuotationRequestsProps {
    selectedOrg: any;
}

const QuotationRequests = ({ selectedOrg }: QuotationRequestsProps) => {
    const { id: quotationId } = useParams();
    const navigate = useNavigate();
    const [quotes, setQuotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'TODAS' | 'SOLICITADA' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA'>('TODAS');

    // Modal states
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState<any>(null);
    const [uploading, setUploading] = useState(false);
    const [files, setFiles] = useState<{ pdf: File | null }>({ pdf: null });

    const fetchQuotes = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('quotations')
                .select(`
                    id, proforma_number, description, amount_total,
                    req_quotation, related_quotation_status,
                    created_at, request_file_url,
                    organizations(name, rfc)
                `)
                .or('req_quotation.eq.true,related_quotation_status.eq.solicitada')
                .order('created_at', { ascending: false });

            if (quotationId) {
                query = query.eq('id', quotationId);
            }

            if (selectedOrg?.id) {
                query = query.eq('organization_id', selectedOrg.id);
            }

            const { data, error: fetchError } = await query;
            if (fetchError) throw fetchError;
            setQuotes(data || []);
        } catch (err: any) {
            console.error('Error fetching quotes:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedOrg?.id) {
            fetchQuotes();
        }
    }, [quotationId, selectedOrg]);

    const handleUpload = async () => {
        if (!selectedQuote || !files.pdf) return;

        try {
            setUploading(true);
            const fileName = `${selectedQuote.id}/cotizacion_enviada_${Date.now()}.pdf`;
            const { data: pData, error: pError } = await supabase.storage
                .from('quotations')
                .upload(fileName, files.pdf);

            if (pError) throw pError;

            // Update Quotation record
            const { error: uError } = await supabase
                .from('quotations')
                .update({
                    request_file_url: pData.path,
                    related_quotation_status: 'enviada'
                })
                .eq('id', selectedQuote.id);

            if (uError) throw uError;

            alert('Cotización PDF subida con éxito.');
            setShowUploadModal(false);
            setFiles({ pdf: null });
            fetchQuotes();
        } catch (err: any) {
            alert('Error al subir cotización: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleValidate = async (quoteId: string, status: string) => {
        if (!confirm(`¿Desea marcar esta cotización como ${status}?`)) return;

        try {
            const { error: qError } = await supabase
                .from('quotations')
                .update({ related_quotation_status: status })
                .eq('id', quoteId);

            if (qError) throw qError;

            fetchQuotes();
        } catch (err: any) {
            alert('Error al actualizar estado: ' + err.message);
        }
    };

    const getStatusIcon = (status: string) => {
        const s = status ? status.toLowerCase() : 'solicitada';
        switch (s) {
            case 'solicitada': return <Clock className="w-4 h-4 text-amber-500" />;
            case 'enviada': return <Send className="w-4 h-4 text-blue-500" />;
            case 'aceptada': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'completada': return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
            case 'rechazada': return <XCircle className="w-4 h-4 text-red-500" />;
            default: return <FileText className="w-4 h-4 text-slate-400" />;
        }
    };

    const getStatusColor = (status: string) => {
        const s = status ? status.toLowerCase() : 'solicitada';
        switch (s) {
            case 'solicitada': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'enviada': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'aceptada': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'completada': return 'bg-emerald-600/10 text-emerald-400 border-emerald-500/20';
            case 'rechazada': return 'bg-red-500/10 text-red-500 border-red-500/20';
            default: return 'bg-slate-500/10 text-slate-400 border-white/5';
        }
    };

    const filteredQuotes = quotes.filter(q => {
        if (activeTab === 'TODAS') return true;
        const status = q.related_quotation_status ? q.related_quotation_status.toUpperCase() : 'SOLICITADA';
        return status === activeTab;
    });

    return (
        <div className="fade-in space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <FileText className="text-indigo-500" />
                        {quotationId ? 'Documento de Cotización' : 'Gestión de Cotizaciones'}
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Control de solicitudes y envíos de documentos de cotización al cliente.
                    </p>
                </div>

                <div className="flex bg-slate-800/40 p-1 rounded-xl border border-white/5 overflow-x-auto">
                    {['TODAS', 'SOLICITADA', 'ENVIADA', 'ACEPTADA', 'RECHAZADA'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
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
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Descripción</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Monto</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Estado</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Fecha Solicitud</th>
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
                            ) : filteredQuotes.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">
                                        No se encontraron requerimientos de cotización formal.
                                    </td>
                                </tr>
                            ) : filteredQuotes.map((q: any) => (
                                <tr key={q.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => navigate(`/proformas/${q.id}`)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors flex-shrink-0"
                                                title="Abrir Proforma Original"
                                            >
                                                <FileEdit className="w-4 h-4" />
                                            </button>
                                            <div>
                                                <div className="font-bold text-white leading-tight font-mono text-sm max-w-[150px] truncate">
                                                    {(() => {
                                                        const orgPrefix = q.organizations?.rfc?.match(/^[A-Z&]{3,4}/)?.[0] || 'PF';
                                                        const dateStr = q.created_at ? new Date(q.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '') : '000000';
                                                        const folNum = (q.proforma_number || 1).toString().padStart(2, '0');
                                                        return `${orgPrefix}-${dateStr}-${folNum}`;
                                                    })()}
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-tighter truncate max-w-[150px]">
                                                    {q.organizations?.name || 'Org Desconocida'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-slate-300 max-w-[200px] truncate">
                                            {q.description || 'Sin descripción'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="font-bold text-slate-300">
                                            {q.amount_total?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) || '$0.00'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${getStatusColor(q.related_quotation_status)}`}>
                                            {getStatusIcon(q.related_quotation_status)}
                                            {q.related_quotation_status || 'SOLICITADA'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-slate-400">
                                            {new Date(q.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => navigate(`/proformas/${q.id}`)}
                                                className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-all"
                                                title="Ir a Proforma Maestra"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>

                                            {(!q.related_quotation_status || q.related_quotation_status === 'solicitada' || q.related_quotation_status === 'rechazada') && (
                                                <button
                                                    onClick={() => { setSelectedQuote(q); setShowUploadModal(true); }}
                                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                                                    title="Subir PDF de Cotización"
                                                >
                                                    <Upload className="w-4 h-4" />
                                                </button>
                                            )}

                                            {(q.related_quotation_status === 'enviada') && (
                                                <>
                                                    <button
                                                        onClick={() => handleValidate(q.id, 'aceptada')}
                                                        className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all"
                                                        title="Marcar como Aceptada"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleValidate(q.id, 'rechazada')}
                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                        title="Marcar como Rechazada"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
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
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden shadow-indigo-500/10">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-600/10 to-transparent">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Upload className="text-indigo-500 w-5 h-5" />
                                    Subir Cotización
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">Sube el documento PDF o Imagen de la cotización formal.</p>
                            </div>
                            <button onClick={() => setShowUploadModal(false)} className="text-slate-500 hover:text-white transition-colors">&times;</button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archivo PDF/Imagen</label>
                                    <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${files.pdf ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/10 hover:border-indigo-500/30'}`}>
                                        <input
                                            type="file"
                                            accept=".pdf,.png,.jpg,.jpeg"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={(e) => setFiles(prev => ({ ...prev, pdf: e.target.files?.[0] || null }))}
                                        />
                                        <div className="text-center">
                                            {files.pdf ? (
                                                <div className="flex items-center justify-center gap-2 text-blue-400 font-bold text-sm">
                                                    <FileText size={16} /> {files.pdf.name}
                                                </div>
                                            ) : (
                                                <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
                                                    <Upload size={20} className="text-slate-600" />
                                                    Arrastra o selecciona el documento
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-white/5">
                                <button
                                    onClick={() => setShowUploadModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={uploading || !files.pdf}
                                    onClick={handleUpload}
                                    className={`flex-1 px-4 py-2.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg ${uploading || !files.pdf
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/20'
                                        }`}
                                >
                                    {uploading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                            Subiendo...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={16} />
                                            Subir Cotización
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

export default QuotationRequests;
