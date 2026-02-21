import React, { useState, useEffect } from 'react';
import { UploadCloud, FileText, CheckCircle, Clock, Search, X, FileCheck, ArrowRight, Eye, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface PurchaseOrderProps {
    currentUser: any;
    selectedOrg: any; // La org actual (B2B)
}

export const PurchaseOrders: React.FC<PurchaseOrderProps> = ({ selectedOrg }) => {
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

            // 2. Trigger Edge Function for n8n Parsing
            const { data: funcData, error: funcError } = await supabase.functions.invoke('process-purchase-order', {
                body: {
                    filePath: filePath,
                    clientOrgId: selectedOrg.id
                }
            });

            if (funcError) throw funcError;
            if (funcData && funcData.success === false) {
                throw new Error(funcData.error || "Error interno dentro de la Edge Function.");
            }

            // 3. Refresh list
            await fetchOrders();

            // Open the newly created order
            if (funcData && funcData.data && funcData.data.po_id) {
                // We might need an extra fetch just for this single one to get full struct
                await fetchOrders();
            }

        } catch (error: any) {
            console.error('Error al procesar la órden de compra:', error);
            alert(`Ocurrió un error: ${error.message}`);
        } finally {
            setUploading(false);
            if (event.target) event.target.value = ''; // reset input
        }
    };


    const handleConvertToProforma = () => {
        if (!viewingOrder) return;

        // Convertir la estructura de items de la OC a la estructura que espera la Proforma
        const itemsParams = viewingOrder.items?.map((item: any) => ({
            desc: item.description,
            qty: item.quantity,
            price: item.unit_price,
        })) || [];

        // Navegar a "cotizaciones/nueva" pasando el query param para autorrellenar
        const queryStr = encodeURIComponent(JSON.stringify({
            po_id: viewingOrder.id,
            po_number: viewingOrder.po_number,
            items: itemsParams
        }));

        navigate(`/cotizaciones/nueva?po=${queryStr}`);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING_REVIEW': return { bg: 'rgba(234, 179, 8, 0.1)', text: '#facc15', border: 'rgba(234, 179, 8, 0.2)', icon: <Clock size={12} /> };
            case 'APPROVED': return { bg: 'rgba(16, 185, 129, 0.1)', text: '#34d399', border: 'rgba(16, 185, 129, 0.2)', icon: <CheckCircle size={12} /> };
            case 'CONVERTED_TO_PROFORMA': return { bg: 'rgba(99, 102, 241, 0.1)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.2)', icon: <FileCheck size={12} /> };
            case 'REJECTED': return { bg: 'rgba(239, 68, 68, 0.1)', text: '#f87171', border: 'rgba(239, 68, 68, 0.2)', icon: <AlertTriangle size={12} /> };
            default: return { bg: 'rgba(148, 163, 184, 0.1)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.2)', icon: <div /> };
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
                            Gestor de Órdenes de Compra
                        </h2>
                        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>OCs recibidas para {selectedOrg.name}</p>
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
                            {uploading ? 'Procesando (AI)...' : 'Subir OC (PDF)'}
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
                                            // Fetch Items if selecting
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
                                            <div>
                                                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>FOLIO OC</div>
                                                <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {order.po_number}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '20px', backgroundColor: statusInfo.bg, border: `1px solid ${statusInfo.border}`, color: statusInfo.text, fontSize: '10px', fontWeight: '600' }}>
                                                {statusInfo.icon}
                                                {order.status.replace(/_/g, ' ')}
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                                            <div>
                                                <div style={{ color: '#64748b', fontSize: '10px' }}>PROVEEDOR (EMISORA)</div>
                                                <div style={{ color: '#e2e8f0', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {order.issuer ? order.issuer.name : <span style={{ color: '#ef4444' }}>No Identificado</span>}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ color: '#64748b', fontSize: '10px' }}>TOTAL ({order.currency})</div>
                                                <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '14px' }}>
                                                    {formatCurrency(order.grand_total, order.currency)}
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
            {viewingOrder && (
                <div className="glass-card fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', animation: 'slideRight 0.3s ease' }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Detalle de Orden <span style={{ color: 'var(--primary-color)' }}>#{viewingOrder.po_number}</span></h3>
                        <button onClick={() => setViewingOrder(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* Metadata Card */}
                        <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <h4 style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Información Extraída (OCR)</h4>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#64748b' }}>PROVEEDOR DETECTADO</div>
                                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{viewingOrder.issuer?.name || '---'}</div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{viewingOrder.issuer?.rfc || ''}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#64748b' }}>FECHA DE EMISIÓN</div>
                                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{viewingOrder.emission_date}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#64748b' }}>SUBTOTAL</div>
                                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{formatCurrency(viewingOrder.subtotal, viewingOrder.currency)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#64748b' }}>IMPUESTOS</div>
                                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{formatCurrency(viewingOrder.tax_total, viewingOrder.currency)}</div>
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
                                        {viewingOrder.items?.map((item: any) => (
                                            <tr key={item.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '8px 12px', color: '#e2e8f0', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.description}>{item.description}</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'center', color: '#94a3b8' }}>{item.quantity} {item.unit_measure}</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#94a3b8' }}>{formatCurrency(item.unit_price, viewingOrder.currency)}</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: '#cbd5e1' }}>{formatCurrency(item.total_amount, viewingOrder.currency)}</td>
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
                                Convertir en Proforma
                            </button>
                        )}
                        {viewingOrder.status === 'CONVERTED_TO_PROFORMA' && (
                            <button disabled style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#64748b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'not-allowed' }}>
                                <CheckCircle size={16} />
                                Ya Convertida
                            </button>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
};
