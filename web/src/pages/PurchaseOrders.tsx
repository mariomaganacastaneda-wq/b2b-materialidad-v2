import React, { useState, useEffect } from 'react';
import { UploadCloud, FileText, CheckCircle, Clock, Search, X, FileCheck, ArrowRight, Eye, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface PurchaseOrderProps {
    currentUser: any;
    selectedOrg: any; // La org actual (B2B)
}

export const PurchaseOrders: React.FC<PurchaseOrderProps> = ({ selectedOrg, currentUser }) => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewingOrder, setViewingOrder] = useState<any | null>(null);

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
          issuer:organizations!issuer_org_id(name, rfc)
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

        if (file.type !== 'application/pdf') {
            alert("Por favor, sube únicamente archivos PDF.");
            return;
        }

        setUploading(true);
        try {
            // 1. Upload to Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${selectedOrg.id}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('purchase_orders')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true,
                    contentType: 'application/pdf'
                });

            if (uploadError) throw uploadError;

            // 2. Trigger n8n Webhook for AI Parsing
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
                // n8n suele devolver un array de items, o un objeto directo dependiendo de la configuración
                n8nData = Array.isArray(parsed) ? parsed[0] : parsed;
            } catch (e) {
                throw new Error(`Respuesta de n8n no es un JSON válido: ${responseText.substring(0, 100)}...`);
            }

            if (!n8nData.success) {
                throw new Error(n8nData.error || n8nData.summary || "La IA no pudo procesar este documento correctamente.");
            }

            // 3. Mapear e Insertar en DB
            const { quotation, quotation_items, validation_messages } = n8nData;

            // En el esquema de la DB:
            // issuer_org_id = El que EMITE la orden (El Cliente externo, ej: Goodyear)
            // client_org_id = El que RECIBE la orden (Nosotros, ej: MEX EPIC)

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

            // Get Public URL for the file
            const { data: urlData } = supabase.storage
                .from('purchase_orders')
                .getPublicUrl(filePath);

            const sourceFileUrl = urlData.publicUrl;

            // Inserción de Cabecera
            // Validar po_number: Si tiene espacios y es largo, probablemente es una descripción, no un folio.
            const rawPo = quotation.po_number || n8nData.summary?.po_number || "";
            const isProbablyDescription = rawPo.includes(' ') && rawPo.length > 20;
            const finalPo = isProbablyDescription ? (n8nData.summary?.po_number || `OCR-${Date.now()}`) : rawPo;

            const { data: poInserted, error: poError } = await supabase
                .from('purchase_orders')
                .insert({
                    po_number: finalPo || `OCR-${Date.now()}`,
                    emission_date: quotation.po_date || new Date().toISOString().split('T')[0],
                    issuer_org_id: issuerOrgId, // El que emite (ej: Goodyear)
                    client_org_id: clientOrgId, // El que recibe (nosotros: MEX EPIC / selectedOrg)
                    currency: quotation.currency || 'MXN',
                    subtotal: quotation.amount_subtotal || 0,
                    tax_total: (quotation.amount_iva || 0) + (quotation.amount_ieps || 0),
                    grand_total: quotation.amount_total || 0,
                    status: 'PENDING_REVIEW',
                    source_file_url: sourceFileUrl,
                    raw_ocr_data: n8nData,
                    validation_messages: validation_messages || [],
                    // Campos extra de proforma
                    client_rfc: quotation.client_rfc,
                    client_name: quotation.client_name,
                    client_address: quotation.client_address,
                    client_cp: quotation.client_cp,
                    client_regime_code: quotation.client_regime_code,
                    payment_method: quotation.payment_method,
                    payment_form: quotation.payment_form,
                    usage_cfdi_code: quotation.usage_cfdi_code,
                    notes: quotation.notes,
                    description: quotation.description,
                    is_licitation: quotation.is_licitation || false,
                    is_contract_required: quotation.is_contract_required || false,
                    request_direct_invoice: quotation.request_direct_invoice || false
                })
                .select()
                .single();

            if (poError) throw poError;

            // Inserción de Partidas
            if (quotation_items && quotation_items.length > 0) {
                const itemsToInsert = quotation_items.map((item: any) => ({
                    purchase_order_id: poInserted.id,
                    item_code: item.sat_product_key,
                    description: item.description,
                    quantity: item.quantity,
                    unit_measure: item.unit_id,
                    unit_price: item.unit_price,
                    tax_amount: (item.subtotal * 0.16), // Estimación si no viene
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

            // 4. Refresh list
            await fetchOrders();

        } catch (error: any) {
            console.error('Error al procesar la órden de compra:', error);
            alert(`Ocurrió un error: ${error.message}`);
        } finally {
            setUploading(false);
            if (event.target) event.target.value = ''; // reset input
        }
    };

    const handleDeleteOrder = async (e: React.MouseEvent, orderId: string) => {
        e.stopPropagation();
        if (!confirm('¿Estás seguro de que deseas eliminar esta Orden de Compra? Esta acción no se puede deshacer.')) return;

        try {
            // 1. Borrar items primero (por si acaso el CASCADE no es suficiente en el cliente o RLS)
            const { error: itemsError } = await supabase
                .from('purchase_order_items')
                .delete()
                .eq('purchase_order_id', orderId);

            if (itemsError) {
                console.warn('Advertencia al borrar items de OC:', itemsError);
            }

            // 2. Borrar la OC
            const { error } = await supabase
                .from('purchase_orders')
                .delete()
                .eq('id', orderId);

            if (error) throw error;

            setOrders(prev => prev.filter(o => o.id !== orderId));
            if (viewingOrder?.id === orderId) setViewingOrder(null);
            alert('Orden de Compra eliminada correctamente.');
        } catch (error: any) {
            console.error('Error al eliminar la órden de compra:', error);
            alert(`Error al eliminar: ${error.message}`);
        }
    };


    const handleConvertToProforma = () => {
        if (!viewingOrder) return;

        // Navegar a "cotizaciones/nueva" pasando el query param para autorrellenar
        // Ahora enviamos el objeto completo de la OC para que el ProformaManager lo use
        const queryStr = encodeURIComponent(JSON.stringify({
            from_po_id: viewingOrder.id,
            po_data: viewingOrder
        }));

        navigate(`/cotizaciones/nueva?po_full=${queryStr}`);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING_REVIEW': return { bg: 'rgba(234, 179, 8, 0.1)', text: '#facc15', border: 'rgba(234, 179, 8, 0.2)', label: 'PENDING REVIEW' };
            case 'APPROVED': return { bg: 'rgba(16, 185, 129, 0.1)', text: '#34d399', border: 'rgba(16, 185, 129, 0.2)', label: 'APPROVED' };
            case 'CONVERTED_TO_PROFORMA': return { bg: 'rgba(99, 102, 241, 0.1)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.2)', label: 'CONVERTED TO PROFORMA' };
            case 'REJECTED': return { bg: 'rgba(239, 68, 68, 0.1)', text: '#f87171', border: 'rgba(239, 68, 68, 0.2)', label: 'REJECTED' };
            default: return { bg: 'rgba(148, 163, 184, 0.1)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.2)', label: status };
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

    const filteredOrders = orders.filter(o =>
        o.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.issuer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!selectedOrg) {
        return (
            <div className="empty-state">
                <FileText size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                <h3>Selecciona una Organización</h3>
                <p>Debes operar bajo el contexto de una empresa para gestionar Órdenes de Compra.</p>
            </div>
        );
    }

    return (
        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: viewingOrder ? '1fr 1fr' : '1fr', gap: '24px', position: 'relative' }}>

            {/* Columna Izquierda: Lista de OCs */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={20} style={{ color: 'var(--primary-color)' }} />
                            <span>Gestor de Órdenes de Compra</span>
                        </h2>
                        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                            OCs recibidas para <span style={{ fontWeight: '600' }}>{selectedOrg.name}</span>
                        </p>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <input
                            type="file"
                            accept=".pdf"
                            id="file-upload-po"
                            style={{ display: 'none' }}
                            onChange={handleFileUpload}
                            disabled={uploading}
                        />
                        <label
                            htmlFor="file-upload-po"
                            className="primary-button"
                            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}
                        >
                            {uploading ? <RefreshCw size={16} className="spin" /> : <UploadCloud size={16} />}
                            <span>{uploading ? 'Procesando (AI)...' : 'Subir OC (PDF)'}</span>
                        </label>
                    </div>
                </div>

                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                            type="text"
                            placeholder="Buscar por número de OC o proveedor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px 10px 36px', fontSize: '13px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                        />
                        {searchTerm && <X size={14} onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', cursor: 'pointer' }} />}
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: '#64748b' }}>
                            <RefreshCw size={24} className="spin" />
                        </div>
                    ) : filteredOrders.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {filteredOrders.map(order => {
                                const statusInfo = getStatusColor(order.status);
                                const isSelected = viewingOrder?.id === order.id;

                                return (
                                    <div
                                        key={order.id}
                                        onClick={async () => {
                                            if (!isSelected) {
                                                const items = await loadOrderDetails(order.id);
                                                setViewingOrder({ ...order, items });
                                            } else {
                                                setViewingOrder(null);
                                            }
                                        }}
                                        style={{
                                            padding: '16px',
                                            borderRadius: '12px',
                                            backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${isSelected ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)'}`,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px', display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                                    <span>FOLIO OC</span>
                                                    <span style={{ fontWeight: 'normal' }}>
                                                        {order.emission_date ? new Date(order.emission_date).toLocaleDateString() : '--'}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span>
                                                        {(order.po_number && order.po_number.length > 25 && order.po_number.includes(' '))
                                                            ? (order.raw_ocr_data?.summary?.po_number || 'S/F')
                                                            : (order.po_number || 'S/N')}
                                                    </span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '20px', backgroundColor: statusInfo.bg, border: `1px solid ${statusInfo.border}`, color: statusInfo.text, fontSize: '10px', fontWeight: '600' }}>
                                                    <StatusIcon status={order.status} />
                                                    <span>{statusInfo.label}</span>
                                                </div>
                                                <button
                                                    onClick={(e) => handleDeleteOrder(e, order.id)}
                                                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '4px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    title="Eliminar OC"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ fontSize: '12px' }}>
                                                <div style={{ color: '#64748b', fontSize: '10px' }}>CLIENTE (EMISIÓN OC)</div>
                                                <div style={{ color: '#e2e8f0', fontWeight: '700', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    <span>{order.issuer ? order.issuer.name : (order.client_name || 'Sin identificar')}</span>
                                                </div>
                                            </div>

                                            <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '4px', borderLeft: '2px solid var(--primary-color)' }}>
                                                <span>{order.description || order.notes || 'Sin descripción'}</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div>
                                                <div style={{ color: '#64748b', fontSize: '10px' }}>RECEPTOR / PROVEEDOR</div>
                                                <div style={{ color: 'var(--primary-light-30, #818cf8)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    <span>{order.raw_ocr_data?.summary?.issuer?.split('(')[0] || selectedOrg.name}</span>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ color: '#64748b', fontSize: '10px' }}>TOTAL ({order.currency})</div>
                                                <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '16px' }}>
                                                    <span>{formatCurrency(order.grand_total, order.currency)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: '60px 20px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                            <FileText size={40} style={{ opacity: 0.3, marginBottom: '16px' }} />
                            <h4>No hay Órdenes de Compra</h4>
                            <p style={{ fontSize: '12px' }}>Sube el PDF de una Orden de Compra para que la Inteligencia Artificial extraiga sus datos automáticamente.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Columna Derecha: Detalles Visuales y Conversión */}
            <div
                className="glass-card"
                style={{
                    display: viewingOrder ? 'flex' : 'none',
                    flexDirection: 'column',
                    height: 'calc(100vh - 180px)',
                    animation: 'slideRight 0.3s ease',
                    overflow: 'hidden'
                }}
            >
                {viewingOrder && (
                    <>
                        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>
                                Detalle de Orden <span style={{ color: 'var(--primary-color)' }}>#{viewingOrder.po_number || 'S/N'}</span>
                            </h3>
                            <button onClick={() => setViewingOrder(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                            {/* AI Validation Messages */}
                            {((viewingOrder.validation_messages && viewingOrder.validation_messages.length > 0) ||
                                (viewingOrder.raw_ocr_data?.validation_messages && viewingOrder.raw_ocr_data.validation_messages.length > 0)) && (
                                    <div style={{ padding: '16px', backgroundColor: 'rgba(234, 179, 8, 0.05)', borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                                        <h4 style={{ fontSize: '11px', color: '#facc15', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                                            <AlertTriangle size={14} />
                                            <span>OBSERVACIONES DE VALIDACIÓN (IA)</span>
                                        </h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {(viewingOrder.validation_messages || viewingOrder.raw_ocr_data?.validation_messages || []).map((msg: any, idx: number) => {
                                                let icon = 'ℹ️';
                                                let color = '#94a3b8';
                                                if (msg.level === 'warning') { icon = '⚠️'; color = '#facc15'; }
                                                if (msg.level === 'fix') { icon = '🔧'; color = '#38bdf8'; }
                                                if (msg.level === 'error') { icon = '❌'; color = '#f87171'; }
                                                if (msg.level === 'info') { icon = '✅'; color = '#10b981'; }

                                                return (
                                                    <div key={`${viewingOrder.id}-msg-${idx}`} style={{ fontSize: '12px', color: color, display: 'flex', gap: '8px' }}>
                                                        <span>{icon}</span>
                                                        <span>{msg.message}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                            {/* Metadata Card */}
                            <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <h4 style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Información Fiscal Extraída</h4>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <div style={{ fontSize: '10px', color: '#64748b' }}>CLIENTE (RECEPTOR)</div>
                                        <div style={{ fontSize: '13px', fontWeight: '500' }}><span>{viewingOrder.client_name || '---'}</span></div>
                                        <div style={{ fontSize: '11px', color: '#94a3b8' }}><span>{viewingOrder.client_rfc || ''} | {viewingOrder.client_regime_code || ''}</span></div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b' }}>USO CFDI</div>
                                        <div style={{ fontSize: '11px', color: '#e2e8f0' }}><span>{viewingOrder.usage_cfdi_code || '---'}</span></div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b' }}>MÉTODO / FORMA PAGO</div>
                                        <div style={{ fontSize: '11px', color: '#e2e8f0' }}><span>{viewingOrder.payment_method || '---'} / {viewingOrder.payment_form || '---'}</span></div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b' }}>FECHA DE EMISIÓN</div>
                                        <div style={{ fontSize: '13px', fontWeight: '500' }}><span>{viewingOrder.emission_date}</span></div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b' }}>SUBTOTAL</div>
                                        <div style={{ fontSize: '13px', fontWeight: '500' }}><span>{formatCurrency(viewingOrder.subtotal, viewingOrder.currency)}</span></div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b' }}>IMPUESTOS</div>
                                        <div style={{ fontSize: '13px', fontWeight: '500' }}><span>{formatCurrency(viewingOrder.tax_total, viewingOrder.currency)}</span></div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b' }}>TOTAL</div>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#10b981' }}><span>{formatCurrency(viewingOrder.grand_total, viewingOrder.currency)}</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div>
                                <h4 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    Partidas <span style={{ padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.1)', fontSize: '10px' }}>{viewingOrder.items?.length || 0}</span>
                                </h4>

                                <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                        <thead style={{ backgroundColor: 'rgba(0,0,0,0.3)', color: '#94a3b8' }}>
                                            <tr>
                                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Descripción</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Cant.</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>P.U.</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Importe</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {viewingOrder.items?.map((item: any, idx: number) => (
                                                <tr key={item.id || `${viewingOrder.id}-item-${idx}`} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <td style={{ padding: '8px 12px', color: '#e2e8f0', maxWidth: '200px' }}>
                                                        <div style={{ fontWeight: '500' }}><span>{item.description}</span></div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                                            {item.sat_product_key && (
                                                                <div style={{ fontSize: '9px', color: '#818cf8', backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '2px 4px', borderRadius: '4px' }}>
                                                                    <span>SAT: {item.sat_product_key}</span>
                                                                </div>
                                                            )}
                                                            {item.sat_match_score !== undefined && item.sat_match_score !== null && (
                                                                <div style={{
                                                                    fontSize: '9px',
                                                                    color: item.sat_match_score < 0.5 ? '#facc15' : '#34d399',
                                                                    backgroundColor: item.sat_match_score < 0.5 ? 'rgba(234, 179, 8, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                                    padding: '2px 4px',
                                                                    borderRadius: '4px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '2px'
                                                                }}>
                                                                    <span>{Math.round(item.sat_match_score * 100)}% Match</span>
                                                                </div>
                                                            )}
                                                            {item.sat_search_hint && item.sat_match_score < 0.4 && (
                                                                <div style={{ fontSize: '9px', color: '#94a3b8', fontStyle: 'italic', width: '100%' }}>
                                                                    <span>Tip: {item.sat_search_hint}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#94a3b8' }}><span>{item.quantity} {item.unit_measure}</span></td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#94a3b8' }}><span>{formatCurrency(item.unit_price, viewingOrder.currency)}</span></td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: '#cbd5e1' }}><span>{formatCurrency(item.total_amount, viewingOrder.currency)}</span></td>
                                                </tr>
                                            ))}
                                            {(!viewingOrder.items || viewingOrder.items.length === 0) && (
                                                <tr>
                                                    <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No se extrajeron partidas detalladas.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Original Document Details */}
                            {viewingOrder.source_file_url && (
                                <div style={{ marginTop: 'auto', padding: '12px', backgroundColor: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => window.open(viewingOrder.source_file_url, '_blank')}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(14, 165, 233, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                                        <FileText size={16} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: '500', color: '#e0f2fe' }}>Ver Documento Original</div>
                                        <div style={{ fontSize: '10px', color: '#7dd3fc' }}>Abre el PDF fuente de esta orden</div>
                                    </div>
                                    <Eye size={14} style={{ marginLeft: 'auto', color: '#38bdf8' }} />
                                </div>
                            )}

                        </div>

                        {/* Footer Actions */}
                        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '12px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                            {viewingOrder.status === 'PENDING_REVIEW' && (
                                <button
                                    onClick={handleConvertToProforma}
                                    className="primary-button"
                                    style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                                >
                                    <ArrowRight size={16} />
                                    <span>Convertir en Proforma</span>
                                </button>
                            )}
                            {viewingOrder.status === 'CONVERTED_TO_PROFORMA' && (
                                <button disabled style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#64748b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'not-allowed' }}>
                                    <CheckCircle size={16} />
                                    <span>Ya Convertida</span>
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

        </div>
    );
};
