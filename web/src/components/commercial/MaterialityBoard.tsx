import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    Plus,
    Search,
    ArrowRight,
    SearchX,
    FileEdit
} from 'lucide-react';

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
        case 'solicitada': return 'bg-amber-500/20 border-amber-500/40 text-amber-400';
        case 'en_revision':
        case 'negociando': return 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400';
        case 'firmado':
        case 'completado': return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
        case 'rechazado':
        case 'cancelado': return 'bg-red-500/20 border-red-500/40 text-red-400';
        default: return null;
    }
};

const getQuotationColor = (status: string | null | undefined): string | null => {
    if (!status) return null;
    const s = status.toLowerCase();
    switch (s) {
        case 'solicitada': return 'bg-amber-500/20 border-amber-500/40 text-amber-400';
        case 'enviada': return 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400';
        case 'aceptada':
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

const formatStatus = (s: string | null | undefined): string | null => {
    if (!s) return null;
    return s.replace(/_/g, ' ');
};

const MaterialityBoard = ({ selectedOrg }: { selectedOrg: any }) => {
    const navigate = useNavigate();
    const [quotations, setQuotations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

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
                    contracts(id, file_url),
                    invoices(id, status, evidence(id)),
                    quotation_payments(amount),
                    invoice_status,
                    contract_status,
                    evidence_status,
                    related_quotation_status,
                    is_contract_required,
                    request_direct_invoice,
                    req_quotation,
                    req_evidence
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
        const hasPO = !!q.from_po_id;

        const contractsList = Array.isArray(q.contracts) ? q.contracts : (q.contracts ? [q.contracts] : []);
        const invoicesList = Array.isArray(q.invoices) ? q.invoices : (q.invoices ? [q.invoices] : []);

        // --- FACTURA: Siempre preferir el status REAL del join ---
        const realInvoiceStatus = invoicesList.length > 0 ? invoicesList[0].status : null;
        const finalInvoiceStatus = realInvoiceStatus || q.invoice_status || (q.request_direct_invoice ? 'SOLICITUD' : null);
        const hasInvoice = !!finalInvoiceStatus;

        // --- CONTRATO: Inferir status del join (no tiene columna status) ---
        const realContractStatus = contractsList.length > 0 ? (contractsList[0].file_url ? 'firmado' : 'solicitado') : null;
        const finalContractStatus = realContractStatus || q.contract_status || (q.is_contract_required ? 'solicitado' : null);
        const hasContract = !!finalContractStatus;

        // --- EVIDENCIA: Del campo en quotations (no hay join directo) ---
        const hasEvidenceRecords = invoicesList.some((i: any) => {
            const evList = Array.isArray(i.evidence) ? i.evidence : (i.evidence ? [i.evidence] : []);
            return evList.length > 0;
        });
        const finalEvidenceStatus = hasEvidenceRecords ? (q.evidence_status || 'entregada') : (q.evidence_status || (q.req_evidence ? 'solicitada' : null));
        const hasEvidence = !!finalEvidenceStatus;

        // --- COTIZACIÓN: Del campo en quotations ---
        const finalQuotationStatus = q.related_quotation_status || (q.req_quotation ? 'solicitada' : null);
        const hasQuotation = !!finalQuotationStatus;

        // --- PAGO: Porcentaje real de quotation_payments ---
        const totalPaid = (q.quotation_payments || []).reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
        const paymentPercentage = q.amount_total > 0 ? Math.min(Math.round((totalPaid / q.amount_total) * 100), 100) : 0;

        return { hasPO, hasContract, hasInvoice, hasEvidence, hasQuotation, paymentPercentage, finalContractStatus, finalInvoiceStatus, finalEvidenceStatus, finalQuotationStatus };
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* HEADER AREA */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <Icon name="analytics" className="text-white text-2xl" />
                        </div>
                        Gis Materialidad B2B
                    </h1>
                    <p className="text-slate-400 text-sm font-medium mt-1">Gestión forense de proformas y cumplimiento fiscal</p>
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
                    <div className="bg-slate-800/40 border border-white/10 rounded-2xl overflow-x-auto shadow-2xl backdrop-blur-sm">
                        <table className="w-full text-left border-collapse table-fixed min-w-[1200px]">
                            <thead>
                                <tr className="bg-white/5 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                                    <th className="p-5 w-[240px]">Folio / Cliente</th>
                                    <th className="p-5 w-[100px]">Total</th>
                                    <th className="p-5 w-[120px] text-center">Estatus Fiscal</th>
                                    <th className="p-5 text-center">Gatillos de Materialidad</th>
                                    <th className="p-5 w-[50px]"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filtered.map(q => {
                                    const { hasPO, hasContract, hasInvoice, hasEvidence, hasQuotation, paymentPercentage, finalContractStatus, finalInvoiceStatus, finalEvidenceStatus, finalQuotationStatus } = getMaterialityStatus(q);

                                    return (
                                        <tr key={q.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="p-5 overflow-hidden">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <button
                                                        onClick={() => navigate(`/proformas/${q.id}`)}
                                                        className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors flex-shrink-0"
                                                        title="Abrir Proforma"
                                                    >
                                                        <FileEdit className="w-4 h-4" />
                                                    </button>
                                                    <div className="flex flex-col min-w-0">
                                                        <span
                                                            onClick={() => navigate(`/proformas/${q.id}`)}
                                                            className="cursor-pointer font-mono text-cyan-400 font-bold bg-cyan-500/10 hover:bg-cyan-500/20 px-2 py-1 rounded text-xs border border-cyan-500/20 whitespace-nowrap transition-colors inline-block w-fit"
                                                        >
                                                            {(() => {
                                                                const orgPrefix = q.organizations?.rfc?.match(/^[A-Z&]{3,4}/)?.[0] || 'PF';
                                                                const dateStr = new Date(q.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '');
                                                                const folNum = (q.proforma_number || 1).toString().padStart(2, '0');
                                                                return `${orgPrefix}-${dateStr}-${folNum}`;
                                                            })()}
                                                        </span>
                                                        <span className="text-white font-bold text-[12px] mt-1 group-hover:text-cyan-300 transition-colors uppercase truncate" title={q.client_name}>
                                                            {q.client_name || 'Cliente sin asignar'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold text-sm">
                                                        ${new Intl.NumberFormat('es-MX').format(q.amount_total)}
                                                    </span>
                                                    <span className="text-slate-600 text-[10px] font-bold">
                                                        {q.currency || 'MXN'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-5 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border ${q.status === 'ACEPTADA' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                    q.status === 'PENDIENTE' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                    }`}>
                                                    {q.status}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex items-start justify-between w-full pt-1">
                                                    <MaterialityIndicator
                                                        icon="shopping_cart"
                                                        label="O.C."
                                                        active={hasPO}
                                                        tooltip="Ver Orden de Compra de origen"
                                                        onClick={() => q.from_po_id && navigate(`/ordenes-compra/${q.from_po_id}`)}
                                                    />
                                                    <div className="h-[2px] w-4 bg-white/10 mt-4 rounded-full" />
                                                    <MaterialityIndicator
                                                        icon="receipt_long"
                                                        label="COT"
                                                        active={hasQuotation}
                                                        tooltip="Ver Cotizaciones"
                                                        onClick={() => navigate(`/cotizaciones/${q.id}`)}
                                                        statusText={formatStatus(finalQuotationStatus)}
                                                        colorOverride={getQuotationColor(finalQuotationStatus)}
                                                    />
                                                    <div className="h-[2px] w-4 bg-white/10 mt-4 rounded-full" />
                                                    <MaterialityIndicator
                                                        icon="description"
                                                        label="CONT"
                                                        active={hasContract}
                                                        tooltip="Ver Contratos"
                                                        onClick={() => navigate(`/contratos/${q.id}`)}
                                                        statusText={formatStatus(finalContractStatus)}
                                                        colorOverride={getContractColor(finalContractStatus)}
                                                    />
                                                    <div className="h-[2px] w-4 bg-white/10 mt-4 rounded-full" />
                                                    <MaterialityIndicator
                                                        icon="payments"
                                                        label="FACT"
                                                        active={hasInvoice}
                                                        tooltip="Ver/Editar Factura"
                                                        onClick={() => navigate(`/facturas/${q.id}`)}
                                                        statusText={formatStatus(finalInvoiceStatus)}
                                                        colorOverride={getInvoiceColor(finalInvoiceStatus)}
                                                    />
                                                    <div className="h-[2px] w-4 bg-white/10 mt-4 rounded-full" />
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
                                                    <div className="h-[2px] w-4 bg-white/10 mt-4 rounded-full" />
                                                    <MaterialityIndicator
                                                        icon="photo_camera"
                                                        label="EVI"
                                                        active={hasEvidence}
                                                        tooltip="Ver/Editar Evidencia"
                                                        onClick={() => navigate(`/evidencia/${q.id}`)}
                                                        statusText={formatStatus(finalEvidenceStatus)}
                                                        colorOverride={getEvidenceColor(finalEvidenceStatus)}
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-5 text-right">
                                                <button
                                                    className="p-2 text-slate-600 hover:text-white transition-colors"
                                                    onClick={() => navigate(`/proformas/${q.id}`)}
                                                >
                                                    <ArrowRight size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
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
            <span className={`text-[6px] font-bold uppercase tracking-wider px-1 py-0.5 rounded -mt-0.5 whitespace-nowrap ${colorOverride ? colorOverride : (active ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-500')}`}>
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
    const colors: any = {
        emerald: 'from-emerald-600/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
        amber: 'from-amber-600/20 to-amber-500/5 border-amber-500/20 text-amber-400',
        cyan: 'from-cyan-600/20 to-cyan-500/5 border-cyan-500/20 text-cyan-400',
    };

    return (
        <div className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-5 flex flex-col gap-1`}>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</span>
            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black">{value}</span>
                {total !== null && <span className="text-xs font-bold opacity-40">de {total}</span>}
            </div>
        </div>
    );
};

export default MaterialityBoard;
