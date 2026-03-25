import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    Search,
    SearchX,
    ShoppingBag,
    Upload,
    FileCheck,
    Eye,
    XCircle,
    CheckCircle2,
    Clock,
    ExternalLink,
    FileText,
    Trash2,
    Save,
} from 'lucide-react';
import { GlowCard } from '../components/ui/GlowCard';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type POStatus = 'solicitada' | 'emitida' | 'autorizada' | 'rechazada';
type TabFilter = 'TODAS' | 'SOLICITADA' | 'EMITIDA' | 'AUTORIZADA' | 'RECHAZADA';

interface PurchaseOrderRequest {
    id: string;
    organization_id: string;
    quotation_id: string;
    status: POStatus;
    file_url: string | null;
    po_number: string | null;
    comments: string | null;
    created_at: string;
    // Joins
    quotations: {
        id: string;
        proforma_number: number | null;
        amount_total: number | null;
        created_at: string;
        organizations: {
            id: string;
            name: string;
            rfc: string | null;
        } | null;
    } | null;
}

interface PurchaseOrderRequestsProps {
    selectedOrg: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStatusStyles = (status: POStatus) => {
    switch (status) {
        case 'solicitada':
            return {
                badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                icon: <Clock className="w-3.5 h-3.5" />,
                label: 'SOLICITADA',
                dot: 'bg-amber-400',
            };
        case 'emitida':
            return {
                badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
                icon: <FileCheck className="w-3.5 h-3.5" />,
                label: 'EMITIDA',
                dot: 'bg-cyan-400',
            };
        case 'autorizada':
            return {
                badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                label: 'AUTORIZADA',
                dot: 'bg-emerald-400',
            };
        case 'rechazada':
            return {
                badge: 'bg-red-500/10 text-red-400 border-red-500/20',
                icon: <XCircle className="w-3.5 h-3.5" />,
                label: 'RECHAZADA',
                dot: 'bg-red-400',
            };
    }
};

const buildFolio = (q: PurchaseOrderRequest['quotations']) => {
    if (!q) return 'S/F';
    const org = q.organizations;
    const prefix = org?.rfc?.match(/^[A-Z&]{3,4}/)?.[0] ?? 'PF';
    const dateStr = new Date(q.created_at)
        .toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })
        .replace(/\//g, '');
    const num = (q.proforma_number ?? 1).toString().padStart(2, '0');
    return `${prefix}-${dateStr}-${num}`;
};

const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
};

// ─── Componente Principal ─────────────────────────────────────────────────────

const PurchaseOrderRequests = ({ selectedOrg }: PurchaseOrderRequestsProps) => {
    const navigate = useNavigate();

    // Lista
    const [requests, setRequests] = useState<PurchaseOrderRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<TabFilter>('TODAS');

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [selected, setSelected] = useState<PurchaseOrderRequest | null>(null);
    const [saving, setSaving] = useState(false);

    // Campos del modal
    const [poFile, setPoFile] = useState<File | null>(null);
    const [poNumber, setPoNumber] = useState('');
    const [poComments, setPoComments] = useState('');
    const [rejectComment, setRejectComment] = useState('');
    const [pendingDecision, setPendingDecision] = useState<'autorizar' | 'rechazar' | null>(null);

    // ─── Fetch ────────────────────────────────────────────────────────────────

    const fetchRequests = useCallback(async () => {
        if (!selectedOrg?.id) return;
        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('purchase_order_requests')
                .select(`
                    id,
                    organization_id,
                    quotation_id,
                    status,
                    file_url,
                    po_number,
                    comments,
                    created_at,
                    quotations (
                        id,
                        proforma_number,
                        amount_total,
                        created_at,
                        organizations (
                            id,
                            name,
                            rfc
                        )
                    )
                `)
                .eq('organization_id', selectedOrg.id)
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            setRequests((data as unknown as PurchaseOrderRequest[]) ?? []);
        } catch (err: any) {
            setError(err.message ?? 'Error al cargar las órdenes de compra.');
        } finally {
            setLoading(false);
        }
    }, [selectedOrg?.id]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    // ─── Filtrado ─────────────────────────────────────────────────────────────

    const filtered = requests.filter((r) => {
        const folio = buildFolio(r.quotations).toLowerCase();
        const client = (r.quotations?.organizations?.name ?? '').toLowerCase();
        const term = search.toLowerCase();
        const matchSearch = !search || folio.includes(term) || client.includes(term);
        const matchTab = activeTab === 'TODAS' || r.status.toUpperCase() === activeTab;
        return matchSearch && matchTab;
    });

    // ─── Acciones del modal ───────────────────────────────────────────────────

    const openModal = (req: PurchaseOrderRequest) => {
        setSelected(req);
        setPoNumber(req.po_number ?? '');
        setPoComments(req.comments ?? '');
        setPoFile(null);
        setRejectComment('');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelected(null);
        setPoFile(null);
        setPoNumber('');
        setPoComments('');
        setRejectComment('');
        setPendingDecision(null);
    };

    const handleViewFile = async (filePath: string) => {
        try {
            const { data, error: signError } = await supabase.storage
                .from('purchase-orders')
                .createSignedUrl(filePath, 3600);
            if (signError) throw signError;
            if (data?.signedUrl) window.open(data.signedUrl, '_blank');
        } catch (err: any) {
            alert('Error al abrir el archivo: ' + err.message);
        }
    };

    const handleSaveEmitida = async () => {
        if (!selected) return;
        try {
            setSaving(true);
            const updates: Record<string, any> = {
                po_number: poNumber.trim() || null,
                comments: poComments.trim() || null,
                status: 'emitida',
            };
            if (poFile) {
                const fileName = `${selected.id}/${Date.now()}_${poFile.name}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('purchase-orders')
                    .upload(fileName, poFile, { upsert: true });
                if (uploadError) throw uploadError;
                updates.file_url = uploadData.path;
            }
            const { error: updateError } = await supabase
                .from('purchase_order_requests')
                .update(updates)
                .eq('id', selected.id);
            if (updateError) throw updateError;
            if (selected.quotation_id) {
                await supabase.from('quotations')
                    .update({ purchase_order_status: 'emitida' })
                    .eq('id', selected.quotation_id);
            }
            setSelected(prev => prev ? { ...prev, status: 'emitida', file_url: updates.file_url ?? prev.file_url } : prev);
            setPoFile(null);
            fetchRequests();
        } catch (err: any) {
            alert('Error al guardar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAuthorize = async () => {
        if (!selected) return;

        try {
            setSaving(true);
            const updates: Record<string, any> = {
                status: 'autorizada',
                po_number: poNumber.trim() || null,
                comments: poComments.trim() || null,
            };

            // Subir PDF si hay uno seleccionado
            if (poFile) {
                const fileName = `${selected.id}/${Date.now()}_${poFile.name}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('purchase-orders')
                    .upload(fileName, poFile, { upsert: true });
                if (uploadError) throw uploadError;
                updates.file_url = uploadData.path;
            }

            const { error: updateError } = await supabase
                .from('purchase_order_requests')
                .update(updates)
                .eq('id', selected.id);
            if (updateError) throw updateError;

            // Sincronizar status en quotations si existe la columna
            if (selected.quotation_id) {
                await supabase
                    .from('quotations')
                    .update({ purchase_order_status: 'autorizada' })
                    .eq('id', selected.quotation_id);
            }

            alert('Orden de compra autorizada correctamente.');
            closeModal();
            fetchRequests();
        } catch (err: any) {
            alert('Error al autorizar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleReject = async () => {
        if (!selected) return;
        if (!rejectComment.trim()) {
            alert('Debes ingresar un comentario para rechazar la orden de compra.');
            return;
        }

        try {
            setSaving(true);
            const { error: updateError } = await supabase
                .from('purchase_order_requests')
                .update({
                    status: 'rechazada',
                    comments: rejectComment.trim(),
                })
                .eq('id', selected.id);
            if (updateError) throw updateError;

            // Sincronizar status en quotations
            if (selected.quotation_id) {
                await supabase
                    .from('quotations')
                    .update({ purchase_order_status: 'rechazada' })
                    .eq('id', selected.quotation_id);
            }

            alert('Orden de compra rechazada.');
            closeModal();
            fetchRequests();
        } catch (err: any) {
            alert('Error al rechazar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selected) return;
        if (!window.confirm('¿Eliminar esta solicitud de OC? Esta acción también desactivará el toggle en la proforma.')) return;

        try {
            setSaving(true);
            const { error: deleteError } = await supabase
                .from('purchase_order_requests')
                .delete()
                .eq('id', selected.id);
            if (deleteError) throw deleteError;

            if (selected.quotation_id) {
                await supabase
                    .from('quotations')
                    .update({ req_purchase_order: false, purchase_order_status: null })
                    .eq('id', selected.quotation_id);
            }

            closeModal();
            fetchRequests();
        } catch (err: any) {
            alert('Error al eliminar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // ─── Stats ────────────────────────────────────────────────────────────────

    const stats = {
        total: requests.length,
        solicitadas: requests.filter((r) => r.status === 'solicitada').length,
        emitidas: requests.filter((r) => r.status === 'emitida').length,
        autorizadas: requests.filter((r) => r.status === 'autorizada').length,
        rechazadas: requests.filter((r) => r.status === 'rechazada').length,
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    const tabs: TabFilter[] = ['TODAS', 'SOLICITADA', 'EMITIDA', 'AUTORIZADA', 'RECHAZADA'];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
                            <ShoppingBag className="text-white w-5 h-5" />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight">
                            Órdenes de Compra
                        </h1>
                    </div>
                    <p className="text-slate-400 text-sm mt-1">
                        Ciclo de vida de solicitudes de OC vinculadas a proformas.
                    </p>
                </div>

                {/* TABS con conteos integrados */}
                <div className="flex bg-slate-800/40 p-1 rounded-xl border border-white/5 flex-wrap gap-0.5">
                    {([
                        { id: 'TODAS',     label: 'Todas',      count: stats.total,       dot: 'bg-slate-400' },
                        { id: 'SOLICITADA',label: 'Solicitada', count: stats.solicitadas, dot: 'bg-amber-400' },
                        { id: 'EMITIDA',   label: 'Emitida',    count: stats.emitidas,    dot: 'bg-cyan-400' },
                        { id: 'AUTORIZADA',label: 'Autorizada', count: stats.autorizadas, dot: 'bg-emerald-400' },
                        { id: 'RECHAZADA', label: 'Rechazada',  count: stats.rechazadas,  dot: 'bg-red-400' },
                    ] as { id: TabFilter; label: string; count: number; dot: string }[]).map(({ id, label, count, dot }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`px-3 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                                activeTab === id
                                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {label}
                            {count > 0 && (
                                <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black ${
                                    activeTab === id ? 'bg-white/20 text-white' : `${dot} text-slate-900`
                                }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* SEARCH */}
            <div className="relative group">
                <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-violet-400 transition-colors"
                    size={18}
                />
                <input
                    type="text"
                    placeholder="Buscar por folio de proforma o nombre de cliente..."
                    aria-label="Buscar solicitudes de orden de compra"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-800/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white text-sm focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 outline-none transition-all placeholder:text-slate-600 font-medium"
                />
            </div>

            {/* ERROR */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3">
                    <XCircle className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}

            {/* TABLA */}
            <GlowCard className="overflow-hidden p-0 bg-slate-900/40 border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/5">
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    Folio Proforma
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    Cliente
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">
                                    Monto
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">
                                    Estado
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    No. OC
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    Fecha
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-6 py-4 h-16">
                                            <div className="h-4 bg-white/5 rounded-lg" />
                                        </td>
                                    </tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20">
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                                                <SearchX className="text-slate-600" size={32} />
                                            </div>
                                            <div className="text-center">
                                                <h3 className="text-white font-bold">
                                                    No se encontraron solicitudes
                                                </h3>
                                                <p className="text-slate-500 text-sm mt-1">
                                                    {search
                                                        ? 'Intenta con otros términos de búsqueda'
                                                        : 'Activa el toggle de OC en una proforma para crear solicitudes'}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((req) => {
                                    const folio = buildFolio(req.quotations);
                                    const client = req.quotations?.organizations?.name ?? 'Cliente desconocido';
                                    const amount = req.quotations?.amount_total ?? null;
                                    const styles = getStatusStyles(req.status);

                                    return (
                                        <tr
                                            key={req.id}
                                            className="hover:bg-white/5 transition-colors group cursor-pointer"
                                            onClick={() => openModal(req)}
                                        >
                                            {/* Folio */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/proformas/${req.quotation_id}`);
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors flex-shrink-0"
                                                        title="Abrir Proforma"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </button>
                                                    <span className="font-mono text-violet-400 font-bold bg-violet-500/10 hover:bg-violet-500/20 px-2 py-1 rounded text-xs border border-violet-500/20 whitespace-nowrap transition-colors">
                                                        {folio}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Cliente */}
                                            <td className="px-6 py-4">
                                                <span className="text-white font-bold text-sm uppercase group-hover:text-violet-300 transition-colors truncate max-w-[200px] block">
                                                    {client}
                                                </span>
                                            </td>

                                            {/* Monto */}
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-slate-300 font-bold text-sm">
                                                    {formatCurrency(amount)}
                                                </span>
                                            </td>

                                            {/* Estado */}
                                            <td className="px-6 py-4 text-center">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${styles.badge}`}
                                                >
                                                    {styles.icon}
                                                    {styles.label}
                                                </span>
                                            </td>

                                            {/* No. OC */}
                                            <td className="px-6 py-4">
                                                {req.po_number ? (
                                                    <span className="text-xs font-mono text-slate-300 font-bold">
                                                        {req.po_number}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-600 italic">
                                                        Sin asignar
                                                    </span>
                                                )}
                                            </td>

                                            {/* Fecha */}
                                            <td className="px-6 py-4">
                                                <span className="text-xs text-slate-400">
                                                    {formatDate(req.created_at)}
                                                </span>
                                            </td>

                                            {/* Acciones */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openModal(req);
                                                        }}
                                                        className="p-2 text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-all"
                                                        title="Gestionar OC"
                                                    >
                                                        <Upload className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </GlowCard>

            {/* MODAL DE GESTIÓN */}
            {showModal && selected && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeModal();
                    }}
                >
                    <GlowCard className="w-full max-w-2xl p-0 overflow-hidden bg-slate-900 border-white/10 shadow-2xl shadow-violet-500/10">

                        {/* Header del modal */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-violet-600/10 to-transparent">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <ShoppingBag className="text-violet-400 w-5 h-5" />
                                    Gestionar Orden de Compra
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Folio: <span className="font-mono text-violet-400 font-bold">{buildFolio(selected.quotations)}</span>
                                    {' — '}
                                    {selected.quotations?.organizations?.name ?? 'Sin organización'}
                                </p>
                            </div>
                            <button
                                onClick={closeModal}
                                className="text-slate-500 hover:text-white transition-colors text-2xl leading-none"
                                aria-label="Cerrar modal"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

                            {/* INFO DE PROFORMA (solo lectura) */}
                            <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 space-y-3">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-violet-400" />
                                    Datos de la Proforma Vinculada
                                </h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                            Folio
                                        </span>
                                        <span className="font-mono font-bold text-violet-400">
                                            {buildFolio(selected.quotations)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                            Cliente
                                        </span>
                                        <span className="text-white font-bold uppercase text-xs">
                                            {selected.quotations?.organizations?.name ?? '—'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                            Monto Total
                                        </span>
                                        <span className="text-emerald-400 font-bold">
                                            {formatCurrency(selected.quotations?.amount_total ?? null)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                            Estado OC
                                        </span>
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black border uppercase ${getStatusStyles(selected.status).badge}`}>
                                            {getStatusStyles(selected.status).icon}
                                            {getStatusStyles(selected.status).label}
                                        </span>
                                    </div>
                                </div>
                                <div className="pt-1">
                                    <button
                                        onClick={() => {
                                            closeModal();
                                            navigate(`/proformas/${selected.quotation_id}`);
                                        }}
                                        className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        Ver Proforma Completa
                                    </button>
                                </div>
                            </div>

                            {/* PDF DE LA OC */}
                            <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 space-y-3">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Upload className="w-4 h-4 text-cyan-400" />
                                    Documento PDF de la OC
                                </h4>

                                {selected.file_url && !poFile ? (
                                    <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                            <FileCheck size={16} />
                                            Archivo cargado
                                        </div>
                                        <button
                                            onClick={() => handleViewFile(selected.file_url!)}
                                            className="text-cyan-400 hover:text-cyan-300 p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                                            title="Ver documento"
                                        >
                                            <Eye size={14} />
                                            Ver PDF
                                        </button>
                                    </div>
                                ) : null}

                                {/* Drop zone para subir o reemplazar */}
                                <div
                                    className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${
                                        poFile
                                            ? 'border-emerald-500/50 bg-emerald-500/5'
                                            : 'border-white/10 hover:border-violet-500/30'
                                    }`}
                                >
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0] ?? null;
                                            setPoFile(file);
                                            // Al subir un PDF, pasar a "emitida" si estaba en "solicitada"
                                            if (file && selected && selected.status === 'solicitada') {
                                                setSelected(prev => prev ? { ...prev, status: 'emitida' } : prev);
                                                await supabase.from('purchase_order_requests')
                                                    .update({ status: 'emitida' })
                                                    .eq('id', selected.id);
                                                await supabase.from('quotations')
                                                    .update({ purchase_order_status: 'emitida' })
                                                    .eq('id', selected.quotation_id);
                                            }
                                        }}
                                        aria-label="Seleccionar PDF de la Orden de Compra"
                                    />
                                    <div className="text-center">
                                        {poFile ? (
                                            <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                                                <FileCheck size={16} />
                                                {poFile.name}
                                            </div>
                                        ) : (
                                            <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
                                                <Upload size={20} className="text-slate-600" />
                                                {selected.file_url
                                                    ? 'Sube un nuevo PDF para reemplazar el actual'
                                                    : 'Sube el PDF de la Orden de Compra'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* NÚMERO DE OC */}
                            <div className="space-y-2">
                                <label
                                    htmlFor="po-number"
                                    className="text-[10px] font-black text-slate-400 uppercase tracking-widest block"
                                >
                                    Número de Orden de Compra
                                </label>
                                <input
                                    id="po-number"
                                    type="text"
                                    value={poNumber}
                                    onChange={(e) => setPoNumber(e.target.value)}
                                    placeholder="Ej. OC-2026-001"
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-colors font-mono placeholder:text-slate-600"
                                />
                            </div>

                            {/* COMENTARIOS */}
                            <div className="space-y-2">
                                <label
                                    htmlFor="po-comments"
                                    className="text-[10px] font-black text-slate-400 uppercase tracking-widest block"
                                >
                                    Comentarios
                                </label>
                                <textarea
                                    id="po-comments"
                                    value={poComments}
                                    onChange={(e) => setPoComments(e.target.value)}
                                    placeholder="Observaciones sobre esta orden de compra..."
                                    rows={3}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-colors placeholder:text-slate-600 resize-none"
                                />
                            </div>

                            {/* MOTIVO DE RECHAZO (solo cuando status no es rechazada aún) */}
                            {selected.status !== 'autorizada' && (
                                <div className="space-y-2">
                                    <label
                                        htmlFor="reject-comment"
                                        className="text-[10px] font-black text-red-400 uppercase tracking-widest block"
                                    >
                                        Motivo de Rechazo <span className="text-red-500">(requerido para rechazar)</span>
                                    </label>
                                    <textarea
                                        id="reject-comment"
                                        value={rejectComment}
                                        onChange={(e) => setRejectComment(e.target.value)}
                                        placeholder="Describe el motivo del rechazo..."
                                        rows={2}
                                        className="w-full bg-slate-900 border border-red-500/20 rounded-xl px-4 py-3 text-white text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500/30 outline-none transition-colors placeholder:text-slate-600 resize-none"
                                    />
                                </div>
                            )}

                            {/* BOTONES DE ACCIÓN */}
                            <div className="space-y-3 pt-3 border-t border-white/5">

                                {/* Fila 1: Guardar (independiente) */}
                                {selected.status !== 'autorizada' && selected.status !== 'rechazada' && (
                                    <button
                                        onClick={handleSaveEmitida}
                                        disabled={saving}
                                        className="w-full px-5 py-3 rounded-xl text-sm font-bold bg-violet-600 text-white hover:bg-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2 hover:-translate-y-0.5"
                                    >
                                        <Save className="w-4 h-4" />
                                        {saving ? 'Guardando...' : 'Guardar OC'}
                                    </button>
                                )}

                                {/* Fila 2: Autorizar / Rechazar — toggle mutuo excluyente */}
                                {selected.status !== 'autorizada' && selected.status !== 'rechazada' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                if (pendingDecision === 'rechazar') {
                                                    handleReject();
                                                } else {
                                                    setPendingDecision('rechazar');
                                                }
                                            }}
                                            disabled={saving || (pendingDecision === 'rechazar' && !rejectComment.trim())}
                                            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                                                pendingDecision === 'rechazar'
                                                    ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/20'
                                                    : 'bg-transparent text-red-400 border-red-500/30 hover:bg-red-600/20 hover:border-red-500/60 opacity-60 hover:opacity-100'
                                            }`}
                                        >
                                            <XCircle className="w-4 h-4" />
                                            {saving && pendingDecision === 'rechazar' ? 'Procesando...' : pendingDecision === 'rechazar' ? 'Confirmar Rechazo' : 'Rechazar'}
                                        </button>

                                        <button
                                            onClick={() => {
                                                if (pendingDecision === 'autorizar') {
                                                    handleAuthorize();
                                                } else {
                                                    setPendingDecision('autorizar');
                                                }
                                            }}
                                            disabled={saving}
                                            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                                                pendingDecision === 'autorizar'
                                                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/20'
                                                    : 'bg-transparent text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/20 hover:border-emerald-500/60 opacity-60 hover:opacity-100'
                                            }`}
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            {saving && pendingDecision === 'autorizar' ? 'Procesando...' : pendingDecision === 'autorizar' ? 'Confirmar Autorización' : 'Autorizar'}
                                        </button>
                                    </div>
                                )}

                                {/* Fila 3: Cancelar / Eliminar */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={closeModal}
                                            disabled={saving}
                                            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleDelete}
                                            disabled={saving}
                                            className="px-3 py-2 rounded-xl text-sm font-bold text-red-500 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Eliminar
                                        </button>
                                    </div>
                                    {/* Guardar cambios si ya está autorizada */}
                                    {selected.status === 'autorizada' && (
                                        <button
                                            onClick={handleAuthorize}
                                            disabled={saving}
                                            className="px-5 py-2 rounded-xl text-sm font-bold bg-violet-600 text-white hover:bg-violet-500 transition-all disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <Save className="w-4 h-4" />
                                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </GlowCard>
                </div>
            )}
        </div>
    );
};


export default PurchaseOrderRequests;
