import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    Plus,
    Search,
    SearchX,
    Trash2,
    Shield
} from 'lucide-react';
import DeleteProformaDialog from './DeleteProformaDialog';
import { GlowCard } from '../ui/GlowCard';
import { TextGlitch } from '../ui/TextGlitch';
import NumberTicker from '../ui/NumberTicker';

// Material Symbols mapping
const Icon = ({ name, className = "" }: { name: string, className?: string }) => (
    <span className={`material-symbols-outlined ${className}`} style={{ fontSize: 'inherit' }}>{name}</span>
);

// Colores por módulo — coinciden EXACTAMENTE con cada pantalla respectiva

const getInvoiceColor = (status: string | null | undefined): string | null => {
    if (!status) return null;
    const s = status.toUpperCase();
    switch (s) {
        case 'SOLICITUD': return 'bg-amber-500/20 border-amber-500/40 text-amber-400';
        case 'PREFACTURA_PENDIENTE':
        case 'PREFACTURA_CANDIDATA':
        case 'EN_REVISION_VENDEDOR': return 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400';
        case 'EN_CAPTURA':
        case 'POR_TIMBRAR': return 'bg-amber-500/20 border-amber-500/40 text-amber-400';
        case 'VALIDADA':
        case 'TIMBRADA': return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
        case 'TIMBRADA_INCOMPLETA': return 'bg-orange-500/20 border-orange-500/40 text-orange-400';
        case 'RECHAZADA':
        case 'CANCELADA': return 'bg-red-500/20 border-red-500/40 text-red-400';
        default: return null;
    }
};

const getContractColor = (status: string | null | undefined): string | null => {
    if (!status) return null;
    const s = status.toLowerCase();
    switch (s) {
        case 'solicitado':
        case 'solicitada':
        case 'requerido': return 'bg-amber-500/20 border-amber-500/40 text-amber-400';
        case 'en_revision':
        case 'negociando': return 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400';
        case 'autorizado': return 'bg-blue-500/20 border-blue-500/40 text-blue-400';
        case 'firmado':
        case 'rubricado': return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
        case 'completado':
        case 'legalizado': return 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400';
        case 'rechazado':
        case 'cancelado': return 'bg-red-500/20 border-red-500/40 text-red-400';
        default: return null;
    }
};

const getQuotationColor = (status: string | null | undefined): string | null => {
    if (!status) return null;
    const s = status.toLowerCase();
    switch (s) {
        case 'solicitada':
        case 'solicitud': return 'bg-amber-500/20 border-amber-500/40 text-amber-400';
        case 'enviada': return 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400';
        case 'aceptada': return 'bg-blue-500/20 border-blue-500/40 text-blue-400';
        case 'completada': return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
        case 'rechazada': return 'bg-red-500/20 border-red-500/40 text-red-400';
        default: return null;
    }
};

const getEvidenceColor = (status: string | null | undefined): string | null => {
    if (!status) return null;
    const s = status.toLowerCase();
    switch (s) {
        case 'solicitada':
        case 'boceto': return 'bg-amber-500/20 border-amber-500/40 text-amber-400';
        case 'en_revision': return 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400';
        case 'entregada':
        case 'completada': return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
        case 'rechazada': return 'bg-red-500/20 border-red-500/40 text-red-400';
        default: return null;
    }
};

const getPurchaseOrderColor = (status: string | null): string | null => {
    if (status === 'solicitada') return 'bg-amber-500/20 border-amber-500/40 text-amber-400';
    if (status === 'emitida')    return 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400';
    if (status === 'autorizada') return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
    if (status === 'rechazada')  return 'bg-red-500/20 border-red-500/40 text-red-400';
    return null;
};

const formatStatus = (s: string | null | undefined): string | null => {
    if (!s) return null;
    return s.replace(/_/g, ' ');
};

const MaterialityBoard = ({ selectedOrg, userProfile }: { selectedOrg: any, userProfile?: any }) => {
    const navigate = useNavigate();
    const [quotations, setQuotations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
    const isAdmin = userProfile?.role === 'ADMIN';

    const fetchQuotations = async () => {
        if (!selectedOrg?.id) return;
        try {
            setLoading(true);
            // Query with joins to check materiality status
            const { data, error } = await supabase
                .from('quotations')
                .select(`
                    *,
                    organizations(name, rfc),
                    contracts(id, file_url, lifecycle_status, requerido_url, requerido_authorized, rubricado_url, legalizado_url),
                    contract_quotations(contract:contracts(id, lifecycle_status)),
                    invoices(id, status, evidence(id, type, file_url)),
                    purchase_order_requests(id, status),
                    quotation_payments(amount),
                    invoice_status,
                    contract_status,
                    evidence_status,
                    related_quotation_status,
                    is_contract_required,
                    request_direct_invoice,
                    req_quotation,
                    req_evidence,
                    req_purchase_order,
                    purchase_order_status
                `)
                .eq('organization_id', selectedOrg.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setQuotations(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuotations();
    }, [selectedOrg?.id]);

    const filtered = quotations.filter(q => {
        const matchesSearch =
            q.description?.toLowerCase().includes(search.toLowerCase()) ||
            q.client_name?.toLowerCase().includes(search.toLowerCase()) ||
            q.consecutive_id?.toString().includes(search);

        const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getMaterialityStatus = (q: any) => {
        // --- OC IMPORTADA: vino de la pantalla de Importación de Archivos ---
        const hasImportedPO = !!q.from_po_id;

        // --- OC SOLICITADA: Fix B+C — activo solo cuando toggle req_purchase_order está ON ---
        const hasOCRequest = q.req_purchase_order === true;
        const finalOCStatus = q.req_purchase_order === true
            ? (q.purchase_order_status || 'solicitada')   // Fix C: fallback al estado inicial
            : null;

        const contractsList = Array.isArray(q.contracts) ? q.contracts : (q.contracts ? [q.contracts] : []);
        const invoicesList = Array.isArray(q.invoices) ? q.invoices : (q.invoices ? [q.invoices] : []);

        // --- FACTURA: Siempre preferir el status REAL del join ---
        const realInvoiceStatus = invoicesList.length > 0 ? invoicesList[0].status : null;
        const finalInvoiceStatus = realInvoiceStatus || q.invoice_status || (q.request_direct_invoice ? 'SOLICITUD' : null);
        const hasInvoice = !!finalInvoiceStatus;

        // --- CONTRATO: Verificar directo + vinculado ---
        const contractLifecycle = contractsList.length > 0 ? (contractsList[0].lifecycle_status || (contractsList[0].file_url ? 'requerido' : null)) : null;
        // Verificar contratos vinculados via contract_quotations
        const linkedContracts = Array.isArray(q.contract_quotations) ? q.contract_quotations : [];
        const linkedContractLifecycle = linkedContracts.length > 0 ? (linkedContracts[0]?.contract?.lifecycle_status || null) : null;
        const bestContractStatus = contractLifecycle || linkedContractLifecycle;
        // Activo si toggle ON o si tiene contrato vinculado
        const finalContractStatus = (q.is_contract_required || linkedContracts.length > 0)
            ? (bestContractStatus || q.contract_status || 'requerido')
            : null;
        const hasContract = !!finalContractStatus;

        // --- EVIDENCIA: Fix B+C — activo solo cuando toggle req_evidence está ON ---
        const hasEvidenceRecords = invoicesList.some((i: any) => {
            const evList = Array.isArray(i.evidence) ? i.evidence : (i.evidence ? [i.evidence] : []);
            return evList.length > 0;
        });
        // Count FOTO evidence with file_url (actual uploaded photos)
        const evidencePhotoCount = invoicesList.reduce((total: number, inv: any) => {
            const evList = Array.isArray(inv.evidence) ? inv.evidence : (inv.evidence ? [inv.evidence] : []);
            return total + evList.filter((e: any) => e.type === 'FOTO' && e.file_url).length;
        }, 0);

        // Fix B: activo solo cuando toggle req_evidence está ON
        // Fix C: si hay fotos → 'completada', si hay registros → status real, si no → 'solicitada'
        const finalEvidenceStatus = q.req_evidence
            ? (evidencePhotoCount > 0 ? 'completada' : (hasEvidenceRecords ? (q.evidence_status || 'entregada') : (q.evidence_status || 'solicitada')))
            : null;
        const hasEvidence = !!finalEvidenceStatus;

        // --- COTIZACIÓN: Usar quotation_lifecycle si existe ---
        // Activo solo si el toggle req_quotation está ON
        const finalQuotationStatus = q.req_quotation
            ? (q.quotation_lifecycle || q.related_quotation_status || 'solicitud')
            : null;
        const hasQuotation = !!finalQuotationStatus;

        // --- PAGO: Porcentaje real de quotation_payments ---
        const totalPaid = (q.quotation_payments || []).reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
        const paymentPercentage = q.amount_total > 0 ? Math.min(Math.round((totalPaid / q.amount_total) * 100), 100) : 0;

        return { hasImportedPO, hasOCRequest, finalOCStatus, hasContract, hasInvoice, hasEvidence, hasQuotation, paymentPercentage, finalContractStatus, finalInvoiceStatus, finalEvidenceStatus, finalQuotationStatus, evidencePhotoCount };
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* HEADER AREA */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <div className="flex items-center gap-4 bg-transparent p-1 rounded-2xl w-fit group cursor-default">
                    <div className="w-12 h-12 bg-slate-800/80 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-cyan-500/20 group-hover:-translate-y-1 transition-all border border-slate-700/50">
                        <Shield className="text-cyan-400 w-6 h-6" />
                    </div>
                    <div className="flex flex-col justify-center h-full">
                        <div className="text-3xl md:text-3xl flex items-center gap-2 tracking-tighter font-mono">
                            <span className="font-bold text-slate-100"><TextGlitch text="Proforma -" /></span>
                            <span className="font-bold text-slate-100"><TextGlitch text="Materialidad" /></span>
                            <span className="font-medium text-cyan-400"><TextGlitch text="Fiscal" /></span>
                        </div>
                    </div>
                </div>

                <a
                    href="/proformas/nueva"
                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-cyan-600/30 hover:-translate-y-0.5"
                    onClick={(e) => {
                        e.preventDefault();
                        window.history.pushState({}, '', '/proformas/nueva');
                        window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                >
                    <Plus size={18} /> Nueva Proforma
                </a>
            </div>

            {/* SEARCH & FILTERS */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente, descripción o folio..."
                        className="w-full bg-slate-800/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition-all placeholder:text-slate-600 font-medium"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="bg-slate-800/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all font-bold cursor-pointer"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                >
                    <option value="ALL">TODOS LOS ESTADOS</option>
                    <option value="PENDIENTE">PENDientes</option>
                    <option value="ACEPTADA">ACEPTADAS</option>
                    <option value="EXPIRADA">EXPIRADAS</option>
                </select>
            </div>

            {/* ERROR STATE */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3">
                    <Icon name="error" className="text-xl" />
                    <span className="text-sm font-bold uppercase tracking-tight">{error}</span>
                </div>
            )}

            {/* DASHBOARD GRID */}
            <div className="grid grid-cols-1 gap-4">
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-4 grayscale opacity-50">
                        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">Sincronizando con BBDD...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-4 bg-slate-800/20 border border-dashed border-white/5 rounded-3xl">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                            <SearchX className="text-slate-600" size={32} />
                        </div>
                        <div className="text-center">
                            <h3 className="text-white font-bold">No se encontraron registros</h3>
                            <p className="text-slate-500 text-sm">Intenta con otros términos o filtros</p>
                        </div>
                    </div>
                ) : (
                    <GlowCard className="p-0 overflow-hidden bg-slate-950/80 backdrop-blur-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse table-fixed min-w-[1100px]">
                                <thead>
                                    <tr className="bg-white/5 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-white/5">
                                        <th className="p-5 w-[240px]">Folio / Cliente</th>
                                        <th className="p-5 w-[100px]">Total</th>
                                        <th className="p-5 w-[120px] text-center">Estatus Fiscal</th>
                                        <th className="p-5 text-center">Gatillos de Materialidad</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filtered.map(q => {
                                        const { hasOCRequest, finalOCStatus, hasContract, hasInvoice, hasEvidence, hasQuotation, paymentPercentage, finalContractStatus, finalInvoiceStatus, finalEvidenceStatus, finalQuotationStatus, evidencePhotoCount } = getMaterialityStatus(q);

                                        return (
                                            <tr key={q.id} className="hover:bg-cyan-500/5 transition-colors group border-b border-white/5">
                                                <td className="p-5 overflow-hidden">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {(() => {
                                                            // Permitir eliminar si es admin O si la proforma no tiene documentos asociados
                                                            const hasAnyDoc = hasContract || hasInvoice || hasEvidence || hasQuotation || hasOCRequest || paymentPercentage > 0;
                                                            const canDelete = isAdmin || !hasAnyDoc;
                                                            return canDelete ? (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const orgPrefix = q.organizations?.rfc?.match(/^[A-Z&]{3,4}/)?.[0] || 'PF';
                                                                        const dateStr = new Date(q.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '');
                                                                        const folNum = (q.proforma_number || 1).toString().padStart(2, '0');
                                                                        setDeleteTarget({ id: q.id, label: `${orgPrefix}-${dateStr}-${folNum}` });
                                                                    }}
                                                                    className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                                                                    title={hasAnyDoc ? "Eliminar Proforma (Admin)" : "Eliminar Proforma (sin documentos)"}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            ) : null;
                                                        })()}
                                                        <div className="flex flex-col min-w-0">
                                                            <span
                                                                onClick={() => navigate(`/proformas/${q.id}`)}
                                                                className="cursor-pointer font-mono text-cyan-400 font-bold bg-cyan-500/10 hover:bg-cyan-500/20 px-2 py-1 rounded text-xs border border-cyan-500/30 whitespace-nowrap transition-colors inline-block w-fit shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                                                            >
                                                                {(() => {
                                                                    const orgPrefix = q.organizations?.rfc?.match(/^[A-Z&]{3,4}/)?.[0] || 'PF';
                                                                    const dateStr = new Date(q.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '');
                                                                    const folNum = (q.proforma_number || 1).toString().padStart(2, '0');
                                                                    return `${orgPrefix}-${dateStr}-${folNum}`;
                                                                })()}
                                                            </span>
                                                            <span className="text-slate-200 font-bold text-[12px] mt-1 group-hover:text-white transition-colors uppercase truncate" title={q.client_name}>
                                                                {q.client_name || 'Cliente sin asignar'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-5">
                                                    <div className="flex flex-col">
                                                        <span className="text-white font-bold text-sm font-mono">
                                                            ${new Intl.NumberFormat('es-MX').format(q.amount_total)}
                                                        </span>
                                                        <span className="text-slate-500 text-[10px] font-bold">
                                                            {q.currency || 'MXN'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-5 text-center">
                                                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm border ${q.status === 'ACEPTADA' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10' :
                                                        q.status === 'PENDIENTE' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/10' :
                                                            'bg-slate-500/10 text-slate-400 border-slate-500/20 shadow-slate-500/10'
                                                        }`}>
                                                        {q.status}
                                                    </span>
                                                </td>
                                                <td className="p-5">
                                                    <div className="flex items-start justify-between w-full pt-1 gap-2">
                                                        <MaterialityIndicator
                                                            icon="shopping_bag"
                                                            label="O.C."
                                                            active={hasOCRequest}
                                                            tooltip={finalOCStatus ? `O.C. ${finalOCStatus}` : 'Orden de Compra'}
                                                            statusText={finalOCStatus ? formatStatus(finalOCStatus) : undefined}
                                                            colorOverride={finalOCStatus ? getPurchaseOrderColor(finalOCStatus) : undefined}
                                                            onClick={() => navigate('/ordenes-compra')}
                                                        />
                                                        <MaterialityIndicator
                                                            icon="receipt_long"
                                                            label="COT"
                                                            active={hasQuotation}
                                                            tooltip="Ver Cotizaciones"
                                                            onClick={() => navigate(`/cotizaciones/${q.id}`)}
                                                            statusText={formatStatus(finalQuotationStatus)}
                                                            colorOverride={getQuotationColor(finalQuotationStatus)}
                                                        />
                                                        <MaterialityIndicator
                                                            icon="description"
                                                            label="CONT"
                                                            active={hasContract}
                                                            tooltip="Ver Contratos"
                                                            onClick={() => navigate(`/contratos/${q.id}`)}
                                                            statusText={formatStatus(finalContractStatus)}
                                                            colorOverride={getContractColor(finalContractStatus)}
                                                        />
                                                        <MaterialityIndicator
                                                            icon="payments"
                                                            label="FACT"
                                                            active={hasInvoice}
                                                            tooltip="Ver/Editar Factura"
                                                            onClick={() => navigate(`/facturas/${q.id}`)}
                                                            statusText={formatStatus(finalInvoiceStatus)}
                                                            colorOverride={getInvoiceColor(finalInvoiceStatus)}
                                                        />
                                                        <MaterialityIndicator
                                                            icon="account_balance_wallet"
                                                            label={paymentPercentage > 0 ? `${paymentPercentage}%` : "PAGO"}
                                                            active={paymentPercentage > 0}
                                                            colorOverride={
                                                                paymentPercentage === 0 ? undefined :
                                                                    paymentPercentage === 100 ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" :
                                                                        "bg-amber-500/20 border-amber-500/40 text-amber-400"
                                                            }
                                                            tooltip={`Pagado: ${paymentPercentage}%`}
                                                            onClick={() => navigate(`/pagos/${q.id}`)}
                                                        />
                                                        <MaterialityIndicator
                                                            icon="photo_camera"
                                                            label={evidencePhotoCount > 0 ? `${evidencePhotoCount} FOTO${evidencePhotoCount !== 1 ? 'S' : ''}` : "EVI"}
                                                            active={hasEvidence}
                                                            tooltip={evidencePhotoCount > 0 ? `${evidencePhotoCount} fotografía${evidencePhotoCount !== 1 ? 's' : ''} subida${evidencePhotoCount !== 1 ? 's' : ''}` : "Ver/Editar Evidencia"}
                                                            onClick={() => navigate(`/evidencia/${q.id}`)}
                                                            statusText={formatStatus(finalEvidenceStatus)}
                                                            colorOverride={evidencePhotoCount > 0 ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : getEvidenceColor(finalEvidenceStatus)}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </GlowCard>
                )}
            </div>

            {/* FOOTER STATS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                <StatCard
                    label="Materialización Completa"
                    value={quotations.filter(q => getMaterialityStatus(q).hasEvidence).length}
                    total={quotations.length}
                    color="emerald"
                />
                <StatCard
                    label="Contratos Pendientes"
                    value={quotations.filter(q => q.status === 'ACEPTADA' && !getMaterialityStatus(q).hasContract).length}
                    total={quotations.filter(q => q.status === 'ACEPTADA').length}
                    color="amber"
                />
                <StatCard
                    label="Total Cotizado ($)"
                    value={new Intl.NumberFormat('es-MX', { notation: 'compact' }).format(quotations.reduce((acc, q) => acc + (q.amount_total || 0), 0))}
                    total={null}
                    color="cyan"
                />
            </div>

            {/* Modal de eliminacion (solo admin) */}
            {deleteTarget && (
                <DeleteProformaDialog
                    quotationId={deleteTarget.id}
                    proformaLabel={deleteTarget.label}
                    isOpen={true}
                    onClose={() => setDeleteTarget(null)}
                    onDeleted={() => {
                        setDeleteTarget(null);
                        fetchQuotations();
                    }}
                    isAdmin={true}
                />
            )}
        </div>
    );
};

const MaterialityIndicator = ({ icon, label, active, tooltip, onClick, colorOverride, statusText }: any) => (
    <div
        className={`flex flex-col items-center gap-1 group/ind relative cursor-pointer hover:-translate-y-0.5 transition-transform w-[76px]`}
        title={tooltip}
        onClick={onClick}
    >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${colorOverride ? colorOverride :
            active
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 ring-4 ring-cyan-500/5'
                : 'bg-slate-900 border-white/5 text-slate-700 opacity-40 hover:opacity-100 hover:border-white/20'
            }`}>
            <Icon name={icon} className="text-lg" />
        </div>
        <span className={`text-[7px] font-black uppercase tracking-widest ${colorOverride ? colorOverride.split(' ')[0] : (active ? 'text-cyan-400' : 'text-slate-500')}`}>
            {label}
        </span>
        {statusText && (
            <span className={`text-[6px] font-bold uppercase tracking-wider px-1 py-0.5 rounded -mt-0.5 text-center leading-tight break-words max-w-full w-full ${colorOverride ? colorOverride : (active ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-500')}`}>
                {statusText}
            </span>
        )}
        {active && !statusText && (
            <div className="absolute -top-1 -right-1">
                <span className="flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
            </div>
        )}
    </div>
);

const StatCard = ({ label, value, total, color }: any) => {
    const defaultColor = 'rgba(6, 182, 212, 0.15)'; // base cyan
    const glowColor =
        color === 'emerald' ? 'rgba(16, 185, 129, 0.15)' :
        color === 'amber' ? 'rgba(245, 158, 11, 0.15)' :
        defaultColor;
        
    const textColors: any = {
        emerald: 'text-emerald-400',
        amber: 'text-amber-400',
        cyan: 'text-cyan-400',
    };

    return (
        <GlowCard glowColor={glowColor} className="flex flex-col gap-1 p-5 border-white/5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
            <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-3xl font-bold tracking-tight ${textColors[color]}`}>
                    {typeof value === 'number' ? <NumberTicker value={value} /> : value}
                </span>
                {total !== null && <span className="text-xs font-bold text-slate-500">de {total}</span>}
            </div>
        </GlowCard>
    );
};

export default MaterialityBoard;
