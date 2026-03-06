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
    FileEdit,
    ExternalLink,
    Trash2,
    FileCheck,
    Shield
} from 'lucide-react';
import { GlowCard } from '../components/ui/GlowCard';
import { TextGlitch } from '../components/ui/TextGlitch';

type QuotationLifecycle = 'solicitud' | 'enviada' | 'aceptada' | 'completada';
type TabFilter = 'TODAS' | 'SOLICITUD' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA';
type StageKey = 'solicitud' | 'revision_emisor' | 'revision_cliente';

interface QuotationRequestsProps {
    selectedOrg: any;
}

const QuotationRequests = ({ selectedOrg }: QuotationRequestsProps) => {
    const { id: quotationId } = useParams();
    const navigate = useNavigate();
    const [quotes, setQuotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabFilter>('TODAS');

    // Modal states
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState<any>(null);
    const [uploading, setUploading] = useState(false);

    // File inputs for each stage
    const [files, setFiles] = useState<{
        solicitud: File | null;
        revision_emisor: File | null;
        revision_cliente: File | null;
    }>({ solicitud: null, revision_emisor: null, revision_cliente: null });

    // Comments for each stage
    const [comments, setComments] = useState({
        solicitud: '',
        revision_emisor: '',
        revision_cliente: ''
    });

    // Authorization toggles for each stage
    const [authorized, setAuthorized] = useState({
        solicitud: false,
        revision_emisor: false,
        revision_cliente: false
    });

    const fetchQuotes = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('quotations')
                .select(`
                    id, proforma_number, description, amount_total,
                    req_quotation, related_quotation_status, quotation_lifecycle,
                    created_at, request_file_url,
                    solicitud_url, solicitud_comments, solicitud_authorized, solicitud_at, solicitud_authorized_at,
                    revision_emisor_url, revision_emisor_comments, revision_emisor_authorized, revision_emisor_at, revision_emisor_authorized_at,
                    revision_cliente_url, revision_cliente_comments, revision_cliente_authorized, revision_cliente_at, revision_cliente_authorized_at,
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

    const computeLifecycle = (quote: any, auth: { solicitud: boolean; revision_emisor: boolean; revision_cliente: boolean }): QuotationLifecycle => {
        const allAuthorized = auth.solicitud && auth.revision_emisor && auth.revision_cliente;
        const anyAuthorized = auth.solicitud || auth.revision_emisor || auth.revision_cliente;
        const anyFile = quote.solicitud_url || quote.revision_emisor_url || quote.revision_cliente_url ||
            files.solicitud || files.revision_emisor || files.revision_cliente;

        if (allAuthorized) return 'completada';
        if (anyAuthorized) return 'aceptada';
        if (anyFile) return 'enviada';
        return 'solicitud';
    };

    const mapToLegacyStatus = (lifecycle: QuotationLifecycle): string => {
        switch (lifecycle) {
            case 'solicitud': return 'solicitada';
            case 'enviada': return 'enviada';
            case 'aceptada': return 'aceptada';
            case 'completada': return 'completada';
        }
    };

    const handleUpload = async () => {
        if (!selectedQuote) return;

        const noFileChanges = !files.solicitud && !files.revision_emisor && !files.revision_cliente;
        const noCommentChanges =
            comments.solicitud === (selectedQuote.solicitud_comments || '') &&
            comments.revision_emisor === (selectedQuote.revision_emisor_comments || '') &&
            comments.revision_cliente === (selectedQuote.revision_cliente_comments || '') &&
            authorized.solicitud === (selectedQuote.solicitud_authorized || false) &&
            authorized.revision_emisor === (selectedQuote.revision_emisor_authorized || false) &&
            authorized.revision_cliente === (selectedQuote.revision_cliente_authorized || false);

        if (noFileChanges && noCommentChanges) return;

        try {
            setUploading(true);
            const updates: any = {};

            // Upload solicitud file
            if (files.solicitud) {
                const fileName = `${selectedQuote.id}/solicitud_${Date.now()}.pdf`;
                const { data: pData, error: pError } = await supabase.storage
                    .from('quotations')
                    .upload(fileName, files.solicitud);
                if (pError) throw pError;
                updates.solicitud_url = pData.path;
                updates.solicitud_at = new Date().toISOString();
                updates.request_file_url = pData.path; // Legacy compatibility
            }

            // Upload revision emisor file
            if (files.revision_emisor) {
                const fileName = `${selectedQuote.id}/revision_emisor_${Date.now()}.pdf`;
                const { data: pData, error: pError } = await supabase.storage
                    .from('quotations')
                    .upload(fileName, files.revision_emisor);
                if (pError) throw pError;
                updates.revision_emisor_url = pData.path;
                updates.revision_emisor_at = new Date().toISOString();
            }

            // Upload revision cliente file
            if (files.revision_cliente) {
                const fileName = `${selectedQuote.id}/revision_cliente_${Date.now()}.pdf`;
                const { data: pData, error: pError } = await supabase.storage
                    .from('quotations')
                    .upload(fileName, files.revision_cliente);
                if (pError) throw pError;
                updates.revision_cliente_url = pData.path;
                updates.revision_cliente_at = new Date().toISOString();
            }

            // Comments
            if (comments.solicitud !== (selectedQuote.solicitud_comments || ''))
                updates.solicitud_comments = comments.solicitud;
            if (comments.revision_emisor !== (selectedQuote.revision_emisor_comments || ''))
                updates.revision_emisor_comments = comments.revision_emisor;
            if (comments.revision_cliente !== (selectedQuote.revision_cliente_comments || ''))
                updates.revision_cliente_comments = comments.revision_cliente;

            // Authorization
            if (authorized.solicitud !== (selectedQuote.solicitud_authorized || false)) {
                updates.solicitud_authorized = authorized.solicitud;
                updates.solicitud_authorized_at = authorized.solicitud ? new Date().toISOString() : null;
            }
            if (authorized.revision_emisor !== (selectedQuote.revision_emisor_authorized || false)) {
                updates.revision_emisor_authorized = authorized.revision_emisor;
                updates.revision_emisor_authorized_at = authorized.revision_emisor ? new Date().toISOString() : null;
            }
            if (authorized.revision_cliente !== (selectedQuote.revision_cliente_authorized || false)) {
                updates.revision_cliente_authorized = authorized.revision_cliente;
                updates.revision_cliente_authorized_at = authorized.revision_cliente ? new Date().toISOString() : null;
            }

            // Compute lifecycle
            const merged = { ...selectedQuote, ...updates };
            const newAuth = {
                solicitud: updates.solicitud_authorized ?? selectedQuote.solicitud_authorized ?? false,
                revision_emisor: updates.revision_emisor_authorized ?? selectedQuote.revision_emisor_authorized ?? false,
                revision_cliente: updates.revision_cliente_authorized ?? selectedQuote.revision_cliente_authorized ?? false
            };
            const newLifecycle = computeLifecycle(merged, newAuth);
            updates.quotation_lifecycle = newLifecycle;
            updates.related_quotation_status = mapToLegacyStatus(newLifecycle);

            if (Object.keys(updates).length > 0) {
                const { error: uError } = await supabase
                    .from('quotations')
                    .update(updates)
                    .eq('id', selectedQuote.id);
                if (uError) throw uError;
            }

            alert('Cotizacion actualizada con exito.');
            setShowUploadModal(false);
            resetModalState();
            fetchQuotes();
        } catch (err: any) {
            alert('Error al procesar cotizacion: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteFile = async (stage: StageKey) => {
        if (!confirm('¿Seguro que deseas eliminar este archivo? Tendras que subir uno nuevo.')) return;

        try {
            setUploading(true);
            const urlField = `${stage}_url`;
            const atField = `${stage}_at`;
            const authField = `${stage}_authorized`;
            const authAtField = `${stage}_authorized_at`;

            const updates: any = {
                [urlField]: null,
                [atField]: null,
                [authField]: false,
                [authAtField]: null
            };

            // If deleting solicitud, also clear legacy field
            if (stage === 'solicitud') {
                updates.request_file_url = null;
            }

            // Recalculate lifecycle
            const merged = { ...selectedQuote, ...updates };
            const newAuth = {
                solicitud: stage === 'solicitud' ? false : (selectedQuote.solicitud_authorized || false),
                revision_emisor: stage === 'revision_emisor' ? false : (selectedQuote.revision_emisor_authorized || false),
                revision_cliente: stage === 'revision_cliente' ? false : (selectedQuote.revision_cliente_authorized || false)
            };
            const newLifecycle = computeLifecycle(merged, newAuth);
            updates.quotation_lifecycle = newLifecycle;
            updates.related_quotation_status = mapToLegacyStatus(newLifecycle);

            const { error } = await supabase
                .from('quotations')
                .update(updates)
                .eq('id', selectedQuote.id);

            if (error) throw error;

            alert('Archivo eliminado correctamente.');
            setSelectedQuote({ ...selectedQuote, ...updates });
            // Update local authorized state
            setAuthorized(prev => ({ ...prev, [stage]: false }));
            fetchQuotes();
        } catch (err: any) {
            alert('Error al eliminar el archivo: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleViewFile = async (filePath: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('quotations')
                .createSignedUrl(filePath, 3600);
            if (error) throw error;
            if (data?.signedUrl) {
                window.open(data.signedUrl, '_blank');
            }
        } catch (err: any) {
            alert('Error al abrir archivo: ' + err.message);
        }
    };

    const openModal = (quote: any) => {
        setSelectedQuote(quote);
        setComments({
            solicitud: quote.solicitud_comments || '',
            revision_emisor: quote.revision_emisor_comments || '',
            revision_cliente: quote.revision_cliente_comments || ''
        });
        setAuthorized({
            solicitud: quote.solicitud_authorized || false,
            revision_emisor: quote.revision_emisor_authorized || false,
            revision_cliente: quote.revision_cliente_authorized || false
        });
        setFiles({ solicitud: null, revision_emisor: null, revision_cliente: null });
        setShowUploadModal(true);
    };

    const resetModalState = () => {
        setFiles({ solicitud: null, revision_emisor: null, revision_cliente: null });
        setComments({ solicitud: '', revision_emisor: '', revision_cliente: '' });
        setAuthorized({ solicitud: false, revision_emisor: false, revision_cliente: false });
        setSelectedQuote(null);
    };

    const getLifecycle = (q: any): QuotationLifecycle => {
        return (q.quotation_lifecycle as QuotationLifecycle) || 'solicitud';
    };

    const getStatusIcon = (status: QuotationLifecycle) => {
        switch (status) {
            case 'solicitud': return <Clock className="w-4 h-4 text-amber-500" />;
            case 'enviada': return <Send className="w-4 h-4 text-cyan-500" />;
            case 'aceptada': return <Shield className="w-4 h-4 text-blue-500" />;
            case 'completada': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
        }
    };

    const getStatusColor = (status: QuotationLifecycle) => {
        switch (status) {
            case 'solicitud': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'enviada': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
            case 'aceptada': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'completada': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
        }
    };

    const getStatusLabel = (status: QuotationLifecycle) => {
        switch (status) {
            case 'solicitud': return 'SOLICITUD';
            case 'enviada': return 'ENVIADA';
            case 'aceptada': return 'ACEPTADA';
            case 'completada': return 'COMPLETADA';
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleDateString('es-MX', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const filteredQuotes = quotes.filter(q => {
        if (activeTab === 'TODAS') return true;
        const lifecycle = getLifecycle(q);
        switch (activeTab) {
            case 'SOLICITUD': return lifecycle === 'solicitud';
            case 'ENVIADA': return lifecycle === 'enviada';
            case 'ACEPTADA': return lifecycle === 'aceptada' || lifecycle === 'completada';
            case 'RECHAZADA': return q.related_quotation_status === 'rechazada';
            default: return true;
        }
    });

    return (
        <div className="fade-in space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <FileText className="text-white text-xl" />
                        </div>
                        <TextGlitch
                            text={quotationId ? 'Documento de Cotizacion' : 'Gestion de Cotizaciones'}
                            className="text-2xl font-black text-white tracking-tight"
                        />
                    </div>
                    <p className="text-slate-400 text-sm mt-1">
                        Ciclo de vida: Solicitud Cliente, Revision Emisor y Revision Cliente.
                    </p>
                </div>

                <div className="flex bg-slate-800/40 p-1 rounded-xl border border-white/5 flex-wrap">
                    {(['TODAS', 'SOLICITUD', 'ENVIADA', 'ACEPTADA', 'RECHAZADA'] as TabFilter[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${activeTab === tab
                                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
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
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-yellow-500"></div> Sin documento</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Archivo cargado</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Autorizado</div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3">
                    <XCircle className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}

            <GlowCard className="overflow-hidden p-0 bg-slate-900/40 border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/5">
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Folio P. / Org</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Descripcion</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Monto</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">Semaforo</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Estado</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Fecha</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-6 py-4 h-16 bg-white/5" />
                                    </tr>
                                ))
                            ) : filteredQuotes.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 italic">
                                        No se encontraron requerimientos de cotizacion formal.
                                    </td>
                                </tr>
                            ) : filteredQuotes.map((q: any) => {
                                const lifecycle = getLifecycle(q);
                                return (
                                    <tr key={q.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => navigate(`/proformas/${q.id}`)}
                                                    className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors flex-shrink-0"
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
                                                {q.description || 'Sin descripcion'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="font-bold text-slate-300">
                                                {q.amount_total?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) || '$0.00'}
                                            </div>
                                        </td>
                                        {/* SEMAFORO: 3 circulos S, E, C */}
                                        <td className="px-6 py-4">
                                            <div className="flex gap-1.5 justify-center">
                                                <div
                                                    title={q.solicitud_authorized ? 'Solicitud Autorizada' : (q.solicitud_url ? 'Documento Cargado' : 'Sin Documento')}
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${q.solicitud_authorized
                                                        ? 'bg-blue-500 cursor-pointer hover:ring-2 hover:ring-white/30'
                                                        : q.solicitud_url
                                                            ? 'bg-emerald-500 cursor-pointer hover:ring-2 hover:ring-white/30'
                                                            : 'bg-yellow-500 cursor-help'
                                                        }`}
                                                    onClick={() => q.solicitud_url && handleViewFile(q.solicitud_url)}
                                                >S</div>
                                                <div
                                                    title={q.revision_emisor_authorized ? 'Revision Emisor Autorizada' : (q.revision_emisor_url ? 'Documento Cargado' : 'Sin Documento')}
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${q.revision_emisor_authorized
                                                        ? 'bg-blue-500 cursor-pointer hover:ring-2 hover:ring-white/30'
                                                        : q.revision_emisor_url
                                                            ? 'bg-emerald-500 cursor-pointer hover:ring-2 hover:ring-white/30'
                                                            : 'bg-yellow-500 cursor-help'
                                                        }`}
                                                    onClick={() => q.revision_emisor_url && handleViewFile(q.revision_emisor_url)}
                                                >E</div>
                                                <div
                                                    title={q.revision_cliente_authorized ? 'Revision Cliente Autorizada' : (q.revision_cliente_url ? 'Documento Cargado' : 'Sin Documento')}
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${q.revision_cliente_authorized
                                                        ? 'bg-blue-500 cursor-pointer hover:ring-2 hover:ring-white/30'
                                                        : q.revision_cliente_url
                                                            ? 'bg-emerald-500 cursor-pointer hover:ring-2 hover:ring-white/30'
                                                            : 'bg-yellow-500 cursor-help'
                                                        }`}
                                                    onClick={() => q.revision_cliente_url && handleViewFile(q.revision_cliente_url)}
                                                >C</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${getStatusColor(lifecycle)}`}>
                                                {getStatusIcon(lifecycle)}
                                                {getStatusLabel(lifecycle)}
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
                                                    className="p-2 text-slate-400 hover:text-cyan-500 hover:bg-cyan-500/10 rounded-lg transition-all"
                                                    title="Ir a Proforma Maestra"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openModal(q)}
                                                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all"
                                                    title="Gestionar Cotizacion"
                                                >
                                                    <Upload className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </GlowCard>

            {/* MODAL DE GESTION DE COTIZACION */}
            {showUploadModal && selectedQuote && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <GlowCard className="w-full max-w-2xl p-0 overflow-hidden bg-slate-900 border-white/10 shadow-2xl shadow-cyan-500/10">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-cyan-600/10 to-transparent">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <FileText className="text-cyan-500 w-5 h-5" />
                                    Gestionar Cotizacion
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Sube documentos y gestiona el ciclo de vida de la cotizacion.
                                </p>
                            </div>
                            <button
                                onClick={() => { setShowUploadModal(false); resetModalState(); }}
                                className="text-slate-500 hover:text-white transition-colors text-2xl"
                            >&times;</button>
                        </div>

                        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                            {/* SECCION 1: Solicitud Cliente (S) */}
                            <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-amber-500" />
                                    1. Solicitud Cliente
                                </h4>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archivo PDF/Imagen</label>
                                    {selectedQuote?.solicitud_url && !files.solicitud ? (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                                    <FileCheck size={16} /> Archivo Cargado
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => handleViewFile(selectedQuote.solicitud_url)} className="text-cyan-400 hover:text-cyan-300 p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors" title="Ver Documento"><Eye size={16} /></button>
                                                    <button onClick={() => handleDeleteFile('solicitud')} className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar Archivo"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                            {selectedQuote.solicitud_at && (
                                                <p className="text-[10px] text-slate-500">Subido: {formatDate(selectedQuote.solicitud_at)}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${files.solicitud ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-cyan-500/30'}`}>
                                            <input
                                                type="file"
                                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={(e) => setFiles(prev => ({ ...prev, solicitud: e.target.files?.[0] || null }))}
                                            />
                                            <div className="text-center">
                                                {files.solicitud ? (
                                                    <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                                                        <FileCheck size={16} /> {files.solicitud.name}
                                                    </div>
                                                ) : (
                                                    <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
                                                        <Upload size={20} className="text-slate-600" />
                                                        Sube la solicitud del cliente
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comentarios</label>
                                    <textarea
                                        value={comments.solicitud}
                                        onChange={(e) => setComments(prev => ({ ...prev, solicitud: e.target.value }))}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors custom-scrollbar"
                                        placeholder="Observaciones sobre la solicitud..."
                                        rows={2}
                                    />
                                </div>
                                <div className={`flex items-center gap-3 border p-3 rounded-xl cursor-pointer transition-colors ${authorized.solicitud ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-900 border-white/5 hover:bg-slate-800'}`}
                                    onClick={() => setAuthorized(prev => ({ ...prev, solicitud: !prev.solicitud }))}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${authorized.solicitud ? 'bg-blue-500 border-blue-500 text-white' : 'border-white/20 text-transparent'}`}>
                                        <Shield className="w-3.5 h-3.5" />
                                    </div>
                                    <span className={`text-sm font-medium ${authorized.solicitud ? 'text-blue-400' : 'text-slate-300'}`}>Autorizado</span>
                                </div>
                                {selectedQuote.solicitud_authorized_at && authorized.solicitud && (
                                    <p className="text-[10px] text-blue-400/70">Autorizado: {formatDate(selectedQuote.solicitud_authorized_at)}</p>
                                )}
                            </div>

                            {/* SECCION 2: Revision Emisor (E) */}
                            <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Send className="w-4 h-4 text-cyan-500" />
                                    2. Revision Emisor
                                </h4>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archivo PDF/Imagen</label>
                                    {selectedQuote?.revision_emisor_url && !files.revision_emisor ? (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                                    <FileCheck size={16} /> Archivo Cargado
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => handleViewFile(selectedQuote.revision_emisor_url)} className="text-cyan-400 hover:text-cyan-300 p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors" title="Ver Documento"><Eye size={16} /></button>
                                                    <button onClick={() => handleDeleteFile('revision_emisor')} className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar Archivo"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                            {selectedQuote.revision_emisor_at && (
                                                <p className="text-[10px] text-slate-500">Subido: {formatDate(selectedQuote.revision_emisor_at)}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${files.revision_emisor ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-cyan-500/30'}`}>
                                            <input
                                                type="file"
                                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={(e) => setFiles(prev => ({ ...prev, revision_emisor: e.target.files?.[0] || null }))}
                                            />
                                            <div className="text-center">
                                                {files.revision_emisor ? (
                                                    <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                                                        <FileCheck size={16} /> {files.revision_emisor.name}
                                                    </div>
                                                ) : (
                                                    <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
                                                        <Upload size={20} className="text-slate-600" />
                                                        Sube la revision del emisor
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comentarios</label>
                                    <textarea
                                        value={comments.revision_emisor}
                                        onChange={(e) => setComments(prev => ({ ...prev, revision_emisor: e.target.value }))}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors custom-scrollbar"
                                        placeholder="Observaciones sobre la revision del emisor..."
                                        rows={2}
                                    />
                                </div>
                                <div className={`flex items-center gap-3 border p-3 rounded-xl cursor-pointer transition-colors ${authorized.revision_emisor ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-900 border-white/5 hover:bg-slate-800'}`}
                                    onClick={() => setAuthorized(prev => ({ ...prev, revision_emisor: !prev.revision_emisor }))}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${authorized.revision_emisor ? 'bg-blue-500 border-blue-500 text-white' : 'border-white/20 text-transparent'}`}>
                                        <Shield className="w-3.5 h-3.5" />
                                    </div>
                                    <span className={`text-sm font-medium ${authorized.revision_emisor ? 'text-blue-400' : 'text-slate-300'}`}>Autorizado</span>
                                </div>
                                {selectedQuote.revision_emisor_authorized_at && authorized.revision_emisor && (
                                    <p className="text-[10px] text-blue-400/70">Autorizado: {formatDate(selectedQuote.revision_emisor_authorized_at)}</p>
                                )}
                            </div>

                            {/* SECCION 3: Revision Cliente (C) */}
                            <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    3. Revision Cliente
                                </h4>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archivo PDF/Imagen</label>
                                    {selectedQuote?.revision_cliente_url && !files.revision_cliente ? (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                                    <FileCheck size={16} /> Archivo Cargado
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => handleViewFile(selectedQuote.revision_cliente_url)} className="text-cyan-400 hover:text-cyan-300 p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors" title="Ver Documento"><Eye size={16} /></button>
                                                    <button onClick={() => handleDeleteFile('revision_cliente')} className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar Archivo"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                            {selectedQuote.revision_cliente_at && (
                                                <p className="text-[10px] text-slate-500">Subido: {formatDate(selectedQuote.revision_cliente_at)}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${files.revision_cliente ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-cyan-500/30'}`}>
                                            <input
                                                type="file"
                                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={(e) => setFiles(prev => ({ ...prev, revision_cliente: e.target.files?.[0] || null }))}
                                            />
                                            <div className="text-center">
                                                {files.revision_cliente ? (
                                                    <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                                                        <FileCheck size={16} /> {files.revision_cliente.name}
                                                    </div>
                                                ) : (
                                                    <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
                                                        <Upload size={20} className="text-slate-600" />
                                                        Sube la revision del cliente
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comentarios</label>
                                    <textarea
                                        value={comments.revision_cliente}
                                        onChange={(e) => setComments(prev => ({ ...prev, revision_cliente: e.target.value }))}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors custom-scrollbar"
                                        placeholder="Observaciones sobre la revision del cliente..."
                                        rows={2}
                                    />
                                </div>
                                <div className={`flex items-center gap-3 border p-3 rounded-xl cursor-pointer transition-colors ${authorized.revision_cliente ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-900 border-white/5 hover:bg-slate-800'}`}
                                    onClick={() => setAuthorized(prev => ({ ...prev, revision_cliente: !prev.revision_cliente }))}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${authorized.revision_cliente ? 'bg-blue-500 border-blue-500 text-white' : 'border-white/20 text-transparent'}`}>
                                        <Shield className="w-3.5 h-3.5" />
                                    </div>
                                    <span className={`text-sm font-medium ${authorized.revision_cliente ? 'text-blue-400' : 'text-slate-300'}`}>Autorizado</span>
                                </div>
                                {selectedQuote.revision_cliente_authorized_at && authorized.revision_cliente && (
                                    <p className="text-[10px] text-blue-400/70">Autorizado: {formatDate(selectedQuote.revision_cliente_authorized_at)}</p>
                                )}
                            </div>

                            {/* BOTONES DE ACCION */}
                            <div className="flex gap-3 pt-4 border-t border-white/5">
                                <button
                                    onClick={() => { setShowUploadModal(false); resetModalState(); }}
                                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={uploading}
                                    onClick={handleUpload}
                                    className={`flex-1 px-4 py-2.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg ${uploading
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-cyan-500/20'
                                        }`}
                                >
                                    {uploading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={16} />
                                            Guardar Cambios
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </GlowCard>
                </div>
            )}
        </div>
    );
};

export default QuotationRequests;
