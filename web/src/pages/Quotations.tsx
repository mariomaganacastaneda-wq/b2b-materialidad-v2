import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    Plus,
    Search,
    ArrowRight,
    SearchX
} from 'lucide-react';

// Material Symbols mapping
const Icon = ({ name, className = "" }: { name: string, className?: string }) => (
    <span className={`material-symbols-outlined ${className}`} style={{ fontSize: 'inherit' }}>{name}</span>
);

const ProformaDashboard = () => {
    const navigate = useNavigate();
    const [quotations, setQuotations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    const fetchQuotations = async () => {
        try {
            setLoading(true);
            // Query with joins to check materiality status
            const { data, error } = await supabase
                .from('quotations')
                .select(`
                    *,
                    organizations(name, rfc),
                    contracts(id),
                    invoices(id, status, evidence(id))
                `)
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
    }, []);

    const filtered = quotations.filter(q => {
        const matchesSearch =
            q.description?.toLowerCase().includes(search.toLowerCase()) ||
            q.organizations?.name?.toLowerCase().includes(search.toLowerCase()) ||
            q.consecutive_id?.toString().includes(search);

        const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getMaterialityStatus = (q: any) => {
        const hasContract = q.contracts?.length > 0;
        const hasInvoice = q.invoices?.length > 0;
        const hasEvidence = q.invoices?.some((i: any) => i.evidence?.length > 0);

        return { hasContract, hasInvoice, hasEvidence };
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* HEADER AREA */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Icon name="analytics" className="text-white text-2xl" />
                        </div>
                        Gis Materialidad B2B
                    </h1>
                    <p className="text-slate-400 text-sm font-medium mt-1">Gestión forense de proformas y cumplimiento fiscal</p>
                </div>

                <a
                    href="/cotizaciones/nueva"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30 hover:-translate-y-0.5"
                    onClick={(e) => {
                        e.preventDefault();
                        window.history.pushState({}, '', '/cotizaciones/nueva');
                        window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                >
                    <Plus size={18} /> Nueva Proforma
                </a>
            </div>

            {/* SEARCH & FILTERS */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente, descripción o folio..."
                        className="w-full bg-slate-800/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 font-medium"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="bg-slate-800/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all font-bold cursor-pointer"
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
                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Sincronizando con BBDD...</span>
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
                    <div className="bg-slate-800/40 border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/5 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                                    <th className="p-5 w-24">Folio</th>
                                    <th className="p-5">Receptor / Concepto</th>
                                    <th className="p-5 w-32">Total</th>
                                    <th className="p-5 w-40 text-center">Estatus Fiscal</th>
                                    <th className="p-5 w-56 text-center">Gatillos de Materialidad</th>
                                    <th className="p-5 w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filtered.map(q => {
                                    const { hasContract, hasInvoice, hasEvidence } = getMaterialityStatus(q);

                                    return (
                                        <tr key={q.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="p-5">
                                                <span className="font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2 py-1 rounded text-xs border border-indigo-500/20">
                                                    #{q.consecutive_id}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold text-[13px] group-hover:text-indigo-300 transition-colors uppercase truncate max-w-md">
                                                        {q.organizations?.name || 'Cliente sin nombre'}
                                                    </span>
                                                    <span className="text-slate-500 text-[11px] mt-0.5 italic line-clamp-1">
                                                        {q.description || 'Sin descripción del servicio'}
                                                    </span>
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
                                                <div className="flex items-center justify-center gap-3">
                                                    <MaterialityIndicator
                                                        icon="receipt_long"
                                                        label="PROF"
                                                        active={true}
                                                        tooltip="Ver/Editar Proforma"
                                                        onClick={() => navigate(`/proformas/${q.id}`)}
                                                    />
                                                    <div className="h-px w-3 bg-white/10" />
                                                    <MaterialityIndicator
                                                        icon="description"
                                                        label="COTI"
                                                        active={hasContract}
                                                        tooltip="Ver/Editar Contrato"
                                                        onClick={() => navigate(`/cotizaciones/${q.id}`)}
                                                    />
                                                    <div className="h-px w-3 bg-white/10" />
                                                    <MaterialityIndicator
                                                        icon="payments"
                                                        label="FACT"
                                                        active={hasInvoice}
                                                        tooltip="Ver/Editar Factura"
                                                        onClick={() => navigate(`/facturas/${q.id}`)}
                                                    />
                                                    <div className="h-px w-3 bg-white/10" />
                                                    <MaterialityIndicator
                                                        icon="photo_camera"
                                                        label="EVI"
                                                        active={hasEvidence}
                                                        tooltip="Ver/Editar Evidencia"
                                                        onClick={() => navigate(`/evidencia/${q.id}`)}
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-5 text-right">
                                                <button className="p-2 text-slate-600 hover:text-white transition-colors">
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
                    color="indigo"
                />
            </div>
        </div>
    );
};

const MaterialityIndicator = ({ icon, label, active, tooltip, onClick }: any) => (
    <div
        className={`flex flex-col items-center gap-1 group/ind relative cursor-pointer hover:-translate-y-0.5 transition-transform`}
        title={tooltip}
        onClick={onClick}
    >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${active
            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400 ring-4 ring-indigo-500/5'
            : 'bg-slate-900 border-white/5 text-slate-700 opacity-40 hover:opacity-100 hover:border-white/20'
            }`}>
            <Icon name={icon} className="text-lg" />
        </div>
        <span className={`text-[7px] font-black uppercase tracking-widest ${active ? 'text-indigo-400' : 'text-slate-800'}`}>
            {label}
        </span>
        {active && (
            <div className="absolute -top-1 -right-1">
                <span className="flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
            </div>
        )}
    </div>
);

const StatCard = ({ label, value, total, color }: any) => {
    const colors: any = {
        emerald: 'from-emerald-600/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
        amber: 'from-amber-600/20 to-amber-500/5 border-amber-500/20 text-amber-400',
        indigo: 'from-indigo-600/20 to-indigo-500/5 border-indigo-500/20 text-indigo-400',
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

export default ProformaDashboard;
