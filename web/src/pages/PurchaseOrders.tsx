import React, { useState, useEffect } from 'react';
import { UploadCloud, FileText, CheckCircle, Clock, Search, X, FileCheck, ArrowRight, Eye, RefreshCw, AlertTriangle, SearchX, ExternalLink, StickyNote, FileSignature, ScrollText, Banknote } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';

interface PurchaseOrderProps {
    currentUser: any;
    selectedOrg: any;
}

export const PurchaseOrders: React.FC<PurchaseOrderProps> = ({ selectedOrg, currentUser }) => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewingOrder, setViewingOrder] = useState<any | null>(null);
    const [activeTab, setActiveTab] = useState<'TODOS' | 'PENDING_REVIEW' | 'APPROVED' | 'CONVERTED_TO_PROFORMA'>('TODOS');

    const navigate = useNavigate();

    useEffect(() => {
        if (selectedOrg?.id) {
            fetchOrders();
        } else {
            setOrders([]);
            setLoading(false);
        }
    }, [selectedOrg?.id]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('purchase_orders')
                .select(`
          *,
          issuer:organizations!issuer_org_id(name, rfc),
          quotations!from_po_id(id, proforma_number, created_at, organizations(rfc))
        `)
                .eq('client_org_id', selectedOrg.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (err) {
            console.error('Error cargando Órdenes de Compra:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadOrderDetails = async (orderId: string) => {
        try {
            const { data, error } = await supabase
                .from('purchase_order_items')
                .select('*')
                .eq('purchase_order_id', orderId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error("Error cargando items de OC:", err);
            return [];
        }
    }

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedOrg?.id) return;

        const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
        ];
        const allowedExts = ['.pdf', '.xlsx', '.xls'];
        const fileExt = '.' + (file.name.split('.').pop()?.toLowerCase() || '');

        if (!allowedTypes.includes(file.type) && !allowedExts.includes(fileExt)) {
            alert("Formatos aceptados: PDF, Excel (.xlsx, .xls)");
            return;
        }

        setUploading(true);
        try {
            const uploadExt = file.name.split('.').pop();
            const fileName = `${selectedOrg.id}_${Date.now()}.${uploadExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('purchase_orders')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true,
                    contentType: file.type || 'application/octet-stream'
                });

            if (uploadError) throw uploadError;

            const formData = new FormData();
            formData.append('data', file);

            const profileId = currentUser?.id || '';
            formData.append('profile_id', profileId);

            const response = await fetch('https://n8n-n8n.5gad6x.easypanel.host/webhook/process-po-pdf', {
                method: 'POST',
                headers: {
                    'x-profile-id': profileId,
                },
                body: formData
            });

            const responseText = await response.text();

            if (!response.ok) {
                throw new Error(`Error en n8n (${response.status}): ${responseText || 'Respuesta vacía'}`);
            }

            let n8nData;
            try {
                const parsed = JSON.parse(responseText);
                n8nData = Array.isArray(parsed) ? parsed[0] : parsed;
            } catch (e) {
                throw new Error(`Respuesta de n8n no es un JSON válido: ${responseText.substring(0, 100)}...`);
            }

            if (!n8nData.success) {
                throw new Error(n8nData.error || n8nData.summary || "La IA no pudo procesar este documento correctamente.");
            }

            const { quotation, quotation_items, validation_messages } = n8nData;

            let issuerOrgId = null;
            if (quotation.client_rfc) {
                const { data: orgData } = await supabase
                    .from('organizations')
                    .select('id')
                    .eq('rfc', quotation.client_rfc)
                    .single();
                if (orgData) issuerOrgId = orgData.id;
            }

            const clientOrgId = selectedOrg.id;

            const { data: urlData } = supabase.storage
                .from('purchase_orders')
                .getPublicUrl(filePath);

            const sourceFileUrl = urlData.publicUrl;

            const rawPo = quotation.po_number || n8nData.summary?.po_number || "";
            const isProbablyDescription = rawPo.includes(' ') && rawPo.length > 20;
            const finalPo = isProbablyDescription ? (n8nData.summary?.po_number || `OCR-${Date.now()}`) : rawPo;

            const { data: poInserted, error: poError } = await supabase
                .from('purchase_orders')
                .insert({
                    po_number: finalPo || `OCR-${Date.now()}`,
                    emission_date: quotation.po_date || new Date().toISOString().split('T')[0],
                    issuer_org_id: issuerOrgId,
                    client_org_id: clientOrgId,
                    currency: quotation.currency || 'MXN',
                    subtotal: quotation.amount_subtotal || 0,
                    tax_total: (quotation.amount_iva || 0) + (quotation.amount_ieps || 0),
                    grand_total: quotation.amount_total || 0,
                    status: 'PENDING_REVIEW',
                    source_file_url: sourceFileUrl,
                    raw_ocr_data: n8nData,
                    validation_messages: validation_messages || [],
                    client_rfc: quotation.client_rfc,
                    client_name: quotation.client_name,
                    client_address: quotation.client_address,
                    client_regime_code: quotation.client_regime_code,
                    payment_method: quotation.payment_method,
                    payment_form: quotation.payment_form,
                    usage_cfdi_code: quotation.usage_cfdi_code,
                    notes: quotation.notes,
                    description: quotation.description,
                    is_licitation: quotation.is_licitation || false,
                    is_contract_required: quotation.is_contract_required || false,
                    request_direct_invoice: quotation.request_direct_invoice || false,
                    billing_type: quotation.billing_type || 'PREFACTURA',
                    requires_quotation: quotation.requires_quotation || false,
                    has_advance_payment: quotation.has_advance_payment || false,
                    advance_payment_amount: quotation.advance_payment_amount || 0
                })
                .select()
                .single();

            if (poError) throw poError;

            if (quotation_items && quotation_items.length > 0) {
                const itemsToInsert = quotation_items.map((item: any) => ({
                    purchase_order_id: poInserted.id,
                    item_code: item.sat_product_key,
                    description: item.description,
                    quantity: item.quantity,
                    unit_measure: item.unit_id,
                    unit_price: item.unit_price,
                    tax_amount: (item.subtotal * 0.16),
                    total_amount: item.subtotal,
                    sat_product_key: item.sat_product_key,
                    sat_match_score: item.sat_match_score,
                    sat_search_hint: item.sat_search_hint,
                    has_iva: item.has_iva ?? true,
                    has_ieps: item.has_ieps ?? false
                }));

                const { error: itemsError } = await supabase
                    .from('purchase_order_items')
                    .insert(itemsToInsert);

                if (itemsError) console.error("Error insertando items de OC:", itemsError);
            }

            await fetchOrders();

        } catch (error: any) {
            console.error('Error al procesar la órden de compra:', error);
            alert(`Ocurrió un error: ${error.message}`);
        } finally {
            setUploading(false);
            if (event.target) event.target.value = '';
        }
    };

    const handleDeleteOrder = async (e: React.MouseEvent, orderId: string) => {
        e.stopPropagation();
        if (!confirm('¿Estás seguro de que deseas eliminar esta Orden de Compra? Esta acción no se puede deshacer.')) return;

        try {
            const { error: itemsError } = await supabase
                .from('purchase_order_items')
                .delete()
                .eq('purchase_order_id', orderId);

            if (itemsError) {
                console.warn('Advertencia al borrar items de OC:', itemsError);
            }

            const { error } = await supabase
                .from('purchase_orders')
                .delete()
                .eq('id', orderId);

            if (error) throw error;

            setOrders(prev => prev.filter(o => o.id !== orderId));
            if (viewingOrder?.id === orderId) setViewingOrder(null);
        } catch (error: any) {
            console.error('Error al eliminar la órden de compra:', error);
            alert(`Error al eliminar: ${error.message}`);
        }
    };

    const handleConvertToProforma = async (order: any) => {
        try {
            await supabase
                .from('purchase_orders')
                .update({ status: 'CONVERTED_TO_PROFORMA' })
                .eq('id', order.id);
        } catch (err) {
            console.error('Error actualizando status de OC:', err);
        }

        // Cargar items de la OC
        const items = order.items || await loadOrderDetails(order.id);

        // Excluir campos pesados que revientan el límite de URL
        const { raw_ocr_data, validation_messages, quotations, issuer, ...cleanOrder } = order;
        cleanOrder.items = items;

        const queryStr = encodeURIComponent(JSON.stringify({
            from_po_id: order.id,
            po_data: cleanOrder
        }));

        navigate(`/proformas/nueva?po_full=${queryStr}`);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING_REVIEW': return 'bg-amber-500/20 border-amber-500/40 text-amber-400';
            case 'APPROVED': return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
            case 'CONVERTED_TO_PROFORMA': return 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400';
            case 'REJECTED': return 'bg-red-500/20 border-red-500/40 text-red-400';
            default: return 'bg-slate-500/20 border-slate-500/40 text-slate-400';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PENDING_REVIEW': return 'PENDIENTE';
            case 'APPROVED': return 'APROBADA';
            case 'CONVERTED_TO_PROFORMA': return 'CONVERTIDA';
            case 'REJECTED': return 'RECHAZADA';
            default: return status;
        }
    };

    const StatusIcon = ({ status, size = 12 }: { status: string, size?: number }) => {
        switch (status) {
            case 'PENDING_REVIEW': return <Clock size={size} />;
            case 'APPROVED': return <CheckCircle size={size} />;
            case 'CONVERTED_TO_PROFORMA': return <FileCheck size={size} />;
            case 'REJECTED': return <AlertTriangle size={size} />;
            default: return null;
        }
    };

    const formatCurrency = (amount: number, currency: string = 'MXN') => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency }).format(amount);
    };

    const getLinkedQuotation = (order: any) => {
        const q = Array.isArray(order.quotations) ? order.quotations[0] : order.quotations;
        if (!q || !q.proforma_number) return null;
        return q;
    };

    const buildFolio = (order: any) => {
        const q = getLinkedQuotation(order);
        if (!q) return null;
        const rfc = q.organizations?.rfc || '';
        const prefix = rfc.length >= 3 ? rfc.substring(0, rfc.length === 13 ? 4 : 3).toUpperCase() : '???';
        const d = new Date(q.created_at);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        const num = String(q.proforma_number).padStart(2, '0');
        return `${prefix}-${dd}${mm}${yy}-${num}`;
    };

    const filteredOrders = orders.filter(o => {
        if (activeTab !== 'TODOS' && o.status !== activeTab) return false;
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            const folio = buildFolio(o)?.toLowerCase() || '';
            return (o.po_number?.toLowerCase().includes(s) ||
                o.issuer?.name?.toLowerCase().includes(s) ||
                o.client_name?.toLowerCase().includes(s) ||
                folio.includes(s));
        }
        return true;
    });

    const tabs = [
        { key: 'TODOS', label: 'Todas' },
        { key: 'PENDING_REVIEW', label: 'Pendientes' },
        { key: 'APPROVED', label: 'Aprobadas' },
        { key: 'CONVERTED_TO_PROFORMA', label: 'Convertidas' },
    ] as const;

    if (!selectedOrg) {
        return (
            <div className="py-20 flex flex-col items-center justify-center gap-4 bg-slate-800/20 border border-dashed border-white/5 rounded-3xl">
                <FileText size={48} className="text-slate-600" />
                <h3 className="text-white font-bold">Selecciona una Organización</h3>
                <p className="text-slate-500 text-sm">Debes operar bajo el contexto de una empresa para gestionar Órdenes de Compra.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight uppercase">Órdenes de Compra</h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">OCs recibidas para {selectedOrg.name}</p>
                </div>
                <div className="relative">
                    <input type="file" accept=".pdf,.xlsx,.xls" id="file-upload-po" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    <label
                        htmlFor="file-upload-po"
                        className={`flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors shadow-lg shadow-emerald-500/20 cursor-pointer ${uploading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {uploading ? <RefreshCw size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                        {uploading ? 'Procesando (AI)...' : 'Subir OC (PDF/Excel)'}
                    </label>
                </div>
            </div>

            {/* TABS + SEARCH */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex bg-slate-800/40 border border-white/10 rounded-xl p-1 gap-1">
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === t.key ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por folio OC, emisor o cliente..."
                        className="w-full bg-slate-800/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition-all placeholder:text-slate-600 font-medium"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* TABLE */}
            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4 grayscale opacity-50">
                    <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">Cargando OCs...</span>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4 bg-slate-800/20 border border-dashed border-white/5 rounded-3xl">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                        <SearchX className="text-slate-600" size={32} />
                    </div>
                    <h3 className="text-white font-bold">No se encontraron Órdenes de Compra</h3>
                    <p className="text-slate-500 text-sm">Sube un PDF para que la IA extraiga los datos automáticamente</p>
                </div>
            ) : (
                <div className="bg-slate-800/40 border border-white/10 rounded-2xl overflow-x-auto shadow-2xl backdrop-blur-sm">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-white/5 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                                <th className="p-4">Folio OC / Emisor</th>
                                <th className="p-4">Proforma</th>
                                <th className="p-4">Cliente</th>
                                <th className="p-4 text-right">Total</th>
                                <th className="p-4 text-center">Estado</th>
                                <th className="p-4">Fecha</th>
                                <th className="p-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredOrders.map(order => (
                                <tr key={order.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <div className="font-bold text-white leading-tight font-mono text-sm">
                                                    {(order.po_number && order.po_number.length > 25 && order.po_number.includes(' '))
                                                        ? (order.raw_ocr_data?.summary?.po_number || 'S/F')
                                                        : (order.po_number || 'S/N')}
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-tighter truncate max-w-[200px]">
                                                    {order.issuer ? order.issuer.name : 'Sin identificar'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {buildFolio(order) ? (
                                            <Link
                                                to={`/proformas/${getLinkedQuotation(order)?.id}`}
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 font-mono hover:text-cyan-300 hover:underline transition-colors"
                                                title="Ver proforma"
                                            >
                                                {buildFolio(order)}
                                                <ExternalLink size={12} />
                                            </Link>
                                        ) : (
                                            <span className="text-[10px] text-slate-600 italic">Sin proforma</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="text-slate-300 text-xs font-medium truncate max-w-[180px]">
                                            {order.client_name || selectedOrg.name}
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-mono">{order.client_rfc || ''}</div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="font-bold text-emerald-400 text-sm">
                                            {formatCurrency(order.grand_total, order.currency)}
                                        </div>
                                        <div className="text-[10px] text-slate-500">{order.currency}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                                            <StatusIcon status={order.status} />
                                            {getStatusLabel(order.status)}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-slate-400 text-xs">
                                            {order.emission_date ? new Date(order.emission_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={async () => {
                                                    const items = await loadOrderDetails(order.id);
                                                    setViewingOrder({ ...order, items });
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
                                                title="Ver detalle"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            {order.source_file_url && (
                                                <button
                                                    onClick={() => window.open(order.source_file_url, '_blank')}
                                                    className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
                                                    title="Ver PDF original"
                                                >
                                                    <FileText size={16} />
                                                </button>
                                            )}
                                            {order.status === 'PENDING_REVIEW' && (
                                                <button
                                                    onClick={() => handleConvertToProforma(order)}
                                                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                    title="Convertir en Proforma"
                                                >
                                                    <ArrowRight size={16} />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => handleDeleteOrder(e, order.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Eliminar OC"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODAL: DETALLE DE OC */}
            {viewingOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col">
                        {/* Header */}
                        <div className="p-6 border-b border-white/10 flex items-center justify-between">
                            <div>
                                <h2 className="text-white font-black text-lg uppercase tracking-tight flex items-center gap-2">
                                    <FileText size={20} className="text-cyan-400" />
                                    OC {viewingOrder.po_number || 'S/N'}
                                </h2>
                                <p className="text-slate-500 text-xs mt-1">
                                    {viewingOrder.issuer?.name || viewingOrder.client_name || 'Emisor no identificado'}
                                    {buildFolio(viewingOrder) && (
                                        <Link
                                            to={`/proformas/${getLinkedQuotation(viewingOrder)?.id}`}
                                            className="ml-3 inline-flex items-center gap-1 text-cyan-400 font-mono font-bold hover:text-cyan-300 hover:underline transition-colors"
                                        >
                                            Proforma: {buildFolio(viewingOrder)}
                                            <ExternalLink size={11} />
                                        </Link>
                                    )}
                                </p>
                            </div>
                            <button onClick={() => setViewingOrder(null)} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* Validation Messages */}
                            {((viewingOrder.validation_messages?.length > 0) || (viewingOrder.raw_ocr_data?.validation_messages?.length > 0)) && (
                                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                                    <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <AlertTriangle size={14} />
                                        Observaciones de Validación (IA)
                                    </h4>
                                    <div className="space-y-1.5">
                                        {(viewingOrder.validation_messages || viewingOrder.raw_ocr_data?.validation_messages || []).map((msg: any, idx: number) => (
                                            <div key={idx} className={`text-xs flex gap-2 ${msg.level === 'error' ? 'text-red-400' : msg.level === 'warning' ? 'text-amber-400' : msg.level === 'fix' ? 'text-cyan-400' : 'text-emerald-400'}`}>
                                                <span>{msg.level === 'error' ? '!' : msg.level === 'warning' ? '!' : msg.level === 'fix' ? '*' : '-'}</span>
                                                <span>{msg.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Metadata */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cliente (Receptor)</div>
                                    <div className="text-sm text-white font-medium mt-1">{viewingOrder.client_name || '---'}</div>
                                    <div className="text-xs text-slate-400">{viewingOrder.client_rfc || ''} {viewingOrder.client_regime_code ? `| ${viewingOrder.client_regime_code}` : ''}</div>
                                </div>
                                {[
                                    { label: 'Uso CFDI', value: viewingOrder.usage_cfdi_code },
                                    { label: 'Método / Forma Pago', value: `${viewingOrder.payment_method || '---'} / ${viewingOrder.payment_form || '---'}` },
                                    { label: 'Fecha Emisión', value: viewingOrder.emission_date },
                                    { label: 'Subtotal', value: formatCurrency(viewingOrder.subtotal, viewingOrder.currency) },
                                    { label: 'Impuestos', value: formatCurrency(viewingOrder.tax_total, viewingOrder.currency) },
                                ].map((f, i) => (
                                    <div key={i}>
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{f.label}</div>
                                        <div className="text-sm text-slate-200 font-medium mt-1">{f.value || '---'}</div>
                                    </div>
                                ))}
                                <div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total</div>
                                    <div className="text-sm text-emerald-400 font-bold mt-1">{formatCurrency(viewingOrder.grand_total, viewingOrder.currency)}</div>
                                </div>
                            </div>

                            {/* Toggles de facturación */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: 'Tipo Comprobante', value: viewingOrder.billing_type || 'PREFACTURA', icon: <FileSignature size={14} />, color: viewingOrder.billing_type ? 'emerald' : 'slate' },
                                    { label: 'Req. Cotización', value: viewingOrder.requires_quotation ? 'SÍ' : 'NO', icon: <ScrollText size={14} />, color: viewingOrder.requires_quotation ? 'emerald' : 'slate' },
                                    { label: 'Req. Contrato', value: viewingOrder.is_contract_required ? 'SÍ' : 'NO', icon: <FileText size={14} />, color: viewingOrder.is_contract_required ? 'emerald' : 'slate' },
                                    { label: 'Anticipo', value: viewingOrder.has_advance_payment ? (viewingOrder.advance_payment_amount ? formatCurrency(viewingOrder.advance_payment_amount, viewingOrder.currency) : 'SÍ') : 'NO', icon: <Banknote size={14} />, color: viewingOrder.has_advance_payment ? 'amber' : 'slate' },
                                ].map((toggle, i) => (
                                    <div key={i} className={`p-3 rounded-xl border ${toggle.color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/20' : toggle.color === 'cyan' ? 'bg-cyan-500/10 border-cyan-500/20' : toggle.color === 'amber' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-slate-800/40 border-white/10'}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`${toggle.color === 'emerald' ? 'text-emerald-400' : toggle.color === 'cyan' ? 'text-cyan-400' : toggle.color === 'amber' ? 'text-amber-400' : 'text-slate-500'}`}>{toggle.icon}</span>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{toggle.label}</span>
                                        </div>
                                        <div className={`text-sm font-bold ${toggle.color === 'emerald' ? 'text-emerald-400' : toggle.color === 'cyan' ? 'text-cyan-400' : toggle.color === 'amber' ? 'text-amber-400' : 'text-slate-400'}`}>{toggle.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Notas */}
                            {viewingOrder.notes && (
                                <div className="p-4 bg-slate-800/40 border border-white/10 rounded-xl">
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <StickyNote size={14} className="text-amber-400" />
                                        Notas
                                    </h4>
                                    <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{viewingOrder.notes}</div>
                                </div>
                            )}

                            {/* Items */}
                            <div>
                                <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                                    Partidas <span className="px-2 py-0.5 bg-white/10 rounded-full text-[10px]">{viewingOrder.items?.length || 0}</span>
                                </h4>
                                <div className="border border-white/10 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-white/5 text-slate-500">
                                            <tr>
                                                <th className="p-3 text-left">Descripción</th>
                                                <th className="p-3 text-center">Cant.</th>
                                                <th className="p-3 text-right">P.U.</th>
                                                <th className="p-3 text-right">Importe</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {viewingOrder.items?.map((item: any, idx: number) => (
                                                <tr key={item.id || idx}>
                                                    <td className="p-3 text-slate-200 max-w-[250px]">
                                                        <div className="font-medium truncate">{item.description}</div>
                                                        {item.sat_product_key && (
                                                            <span className="text-[9px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded mt-1 inline-block">SAT: {item.sat_product_key}</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center text-slate-400">{item.quantity} {item.unit_measure}</td>
                                                    <td className="p-3 text-right text-slate-400">{formatCurrency(item.unit_price, viewingOrder.currency)}</td>
                                                    <td className="p-3 text-right text-slate-200 font-medium">{formatCurrency(item.total_amount, viewingOrder.currency)}</td>
                                                </tr>
                                            ))}
                                            {(!viewingOrder.items || viewingOrder.items.length === 0) && (
                                                <tr><td colSpan={4} className="p-6 text-center text-slate-500">No se extrajeron partidas detalladas.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Source PDF */}
                            {viewingOrder.source_file_url && (
                                <button
                                    onClick={() => window.open(viewingOrder.source_file_url, '_blank')}
                                    className="w-full flex items-center gap-3 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl hover:bg-cyan-500/20 transition-colors"
                                >
                                    <FileText size={16} className="text-cyan-400" />
                                    <div className="text-left">
                                        <div className="text-xs text-cyan-300 font-medium">Ver Documento Original</div>
                                        <div className="text-[10px] text-cyan-500">PDF fuente de esta orden</div>
                                    </div>
                                    <Eye size={14} className="text-cyan-400 ml-auto" />
                                </button>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-white/10 flex gap-3">
                            <button onClick={() => setViewingOrder(null)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                                Cerrar
                            </button>
                            {viewingOrder.status === 'PENDING_REVIEW' && (
                                <button
                                    onClick={() => handleConvertToProforma(viewingOrder)}
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                                >
                                    <ArrowRight size={16} />
                                    Convertir en Proforma
                                </button>
                            )}
                            {viewingOrder.status === 'CONVERTED_TO_PROFORMA' && (
                                <button disabled className="flex-1 py-3 bg-slate-800 text-slate-500 rounded-xl text-xs font-bold uppercase tracking-widest cursor-not-allowed flex items-center justify-center gap-2">
                                    <CheckCircle size={16} />
                                    Ya Convertida
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
