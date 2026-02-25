import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Check,
    Trash2,
    AlertCircle,
    Clock,
    Printer,
    Edit3,
    FileSearch,
    Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MaterialityStep {
    id: string;
    description: string;
    amount_total: number;
    status: string;
    proforma_number?: string;
    total_proformas?: number;
    created_at: string;
    // Relaciones para estados
    contract_id?: string;
    invoice_id?: string;
    has_evidence?: boolean;
    consecutive_id?: number;
    req_quotation?: boolean;
    req_evidence?: boolean;
    is_contract_required?: boolean;
    request_direct_invoice?: boolean;
    invoice_status?: string | null;
    contract_status?: string | null;
    evidence_status?: string | null;
    related_quotation_status?: string | null;
}

const MaterialityBoard = ({ selectedOrg }: { selectedOrg: any }) => {
    const [loading, setLoading] = useState(true);
    const [proformas, setProformas] = useState<MaterialityStep[]>([]);
    const [totalSystemProformas, setTotalSystemProformas] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        fetchGlobalStats();
        if (selectedOrg?.id) {
            fetchProformas();
        }
    }, [selectedOrg]);

    const fetchGlobalStats = async () => {
        const { count, error } = await supabase
            .from('quotations')
            .select('*', { count: 'exact', head: true });
        if (!error && count !== null) setTotalSystemProformas(count);
    };

    const fetchProformas = async () => {
        setLoading(true);
        try {
            // Consulta compleja para traer proformas y sus estados vinculados
            const { data, error } = await supabase
                .from('quotations')
                .select(`
                    id, 
                    description, 
                    amount_total, 
                    status, 
                    proforma_number, 
                    total_proformas, 
                    created_at,
                    consecutive_id,
                    req_quotation,
                    req_evidence,
                    is_contract_required,
                    request_direct_invoice,
                    invoice_status,
                    contract_status,
                    evidence_status,
                    related_quotation_status,
                    contracts (id),
                    invoices (id)
                `)
                .eq('organization_id', selectedOrg.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mappedData = data.map((q: any) => ({
                id: q.id,
                description: q.description || 'Sin descripción',
                amount_total: q.amount_total,
                status: q.status,
                proforma_number: q.proforma_number,
                total_proformas: q.total_proformas,
                created_at: q.created_at,
                contract_id: q.contracts?.[0]?.id,
                invoice_id: q.invoices?.[0]?.id,
                has_evidence: false,
                consecutive_id: q.consecutive_id,
                req_quotation: q.req_quotation,
                req_evidence: q.req_evidence,
                is_contract_required: q.is_contract_required,
                request_direct_invoice: q.request_direct_invoice,
                invoice_status: q.invoice_status,
                contract_status: q.contract_status,
                evidence_status: q.evidence_status,
                related_quotation_status: q.related_quotation_status
            }));

            setProformas(mappedData);
        } catch (err) {
            console.error('Error fetching proformas for board:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar esta proforma? Esta acción no se puede deshacer.')) return;

        try {
            // El borrado en cascada debería manejar los items si está configurado en DB, 
            // pero si no, borramos ítems primero por precaución.
            await supabase.from('quotation_items').delete().eq('quotation_id', id);
            const { error } = await supabase.from('quotations').delete().eq('id', id);

            if (error) throw error;

            setProformas(prev => prev.filter(p => p.id !== id));
            fetchGlobalStats();
        } catch (err) {
            console.error('Error deleting proforma:', err);
            alert('No se pudo eliminar la proforma.');
        }
    };

    const StatusBadge = ({ active, label, onClick, required = true, statusText }: { active: boolean, label: string, onClick?: () => void, required?: boolean, statusText?: string | null }) => (
        <div
            onClick={onClick}
            className={`flex flex-col items-center gap-1.5 transition-all duration-200 ${onClick ? 'cursor-pointer hover:scale-105' : 'cursor-default'} ${active ? 'opacity-100' : required ? 'opacity-40' : 'opacity-15'}`}
        >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${active ? 'bg-cyan-600 shadow-[0_0_15px_rgba(8,145,178,0.3)]' : !required ? 'bg-slate-100 border border-dashed border-slate-300' : 'bg-slate-200'}`}>
                {active ? <Check size={18} className="text-white" strokeWidth={3} /> : !required ? <Clock size={16} className="text-slate-300" /> : <Clock size={18} className="text-slate-500" />}
            </div>
            <div className="flex flex-col items-center">
                <span className={`text-[9px] font-black tracking-widest uppercase ${active ? 'text-cyan-700' : 'text-slate-400'}`}>
                    {label}
                    {!required && active && <span className="ml-1 text-[7px] bg-slate-100 px-1 rounded text-slate-400">OPT</span>}
                </span>
                {statusText && required !== false && (
                    <span className={`mt-0.5 text-[7px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${active ? 'bg-cyan-50 text-cyan-600 border border-cyan-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {statusText}
                    </span>
                )}
            </div>
        </div>
    );

    return (
        <div className="fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-slate-900">
            <div className="flex justify-between items-end mb-8 gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight">Tablero de Materialidad</h1>
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-slate-500 font-medium text-slate-900">Ciclo de vida de servicios y cumplimiento fiscal.</p>
                        <div className="bg-cyan-50 text-cyan-700 px-3 py-1 rounded-full text-[10px] font-black border border-cyan-100 uppercase tracking-widest">
                            {totalSystemProformas} Registros Globales
                        </div>
                    </div>
                </div>
                <button
                    className="premium-button flex items-center gap-2"
                    onClick={() => navigate('/proformas')}
                >
                    <Plus size={16} />
                    Nueva Proforma
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="w-12 h-12 border-4 border-slate-100 border-t-cyan-600 rounded-full animate-spin"></div>
                    <p className="text-sm text-slate-400 font-bold animate-pulse tracking-widest uppercase">Cargando Tablero...</p>
                </div>
            ) : proformas.length === 0 ? (
                <div className="premium-panel flex flex-col items-center justify-center py-20 px-6 text-center animate-in fade-in zoom-in-95 duration-500">
                    {totalSystemProformas > 0 ? (
                        <div className="space-y-4 max-w-md">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 shadow-inner">
                                <AlertCircle size={40} className="text-cyan-600/50" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-700">Filtro de Empresa Activo</h3>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed mt-2 text-slate-900">
                                    Hay <span className="text-cyan-600 font-black">{totalSystemProformas} registros</span> en el sistema, pero ninguno vinculado a <span className="font-bold text-slate-800">{selectedOrg?.name}</span>.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 shadow-inner">
                                <Edit3 size={40} className="text-slate-400" />
                            </div>
                            <h3 className="text-lg font-black text-slate-700">Sin proformas registradas</h3>
                            <p className="text-sm text-slate-500 font-medium text-slate-900">Inicia el proceso de materialidad creando tu primera proforma.</p>
                        </div>
                    )}
                    <button className="premium-button mt-8" onClick={() => navigate('/proformas')}>Empezar Proceso</button>
                </div>
            ) : (
                <div className="premium-panel p-0 overflow-hidden border-standard shadow-premium">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-1/3">Servicio / Proforma</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Flujo de Materialidad</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Monto</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {proformas.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="text-[13px] font-bold text-slate-800 mb-1 group-hover:text-cyan-700 transition-colors">{p.description}</div>
                                            <div className="flex items-center gap-2">
                                                <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-2 py-0.5 rounded tracking-tight uppercase border border-slate-200 shadow-sm font-mono" translate="no">
                                                    {p.proforma_number && typeof p.proforma_number === 'string' && p.proforma_number.includes('-')
                                                        ? p.proforma_number
                                                        : (() => {
                                                            const orgPrefix = selectedOrg?.rfc?.match(/^[A-Z&]{3,4}/)?.[0] || 'PF';
                                                            const dateStr = new Date(p.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '');
                                                            const folNum = (p.proforma_number || 1).toString().padStart(2, '0');
                                                            return `${orgPrefix}-${dateStr}-${folNum}`;
                                                        })()
                                                    }
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium">Emisión: {new Date(p.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex justify-center gap-7">
                                                <StatusBadge active={true} label="Proforma" onClick={() => navigate(`/proformas/${p.id}`)} />
                                                <div className="w-8 h-px bg-slate-100 mt-4.5 self-start opacity-50"></div>
                                                <StatusBadge
                                                    active={p.status === 'APROBADA' || !!p.invoice_id || p.related_quotation_status === 'aceptada' || p.related_quotation_status === 'completada'}
                                                    label="Cotización"
                                                    required={p.req_quotation !== false}
                                                    statusText={p.related_quotation_status}
                                                />
                                                <div className="w-8 h-px bg-slate-100 mt-4.5 self-start opacity-50"></div>
                                                <StatusBadge
                                                    active={!!p.contract_id || p.contract_status === 'firmado' || p.contract_status === 'completado'}
                                                    label="Contrato"
                                                    required={p.is_contract_required === true}
                                                    statusText={p.contract_status}
                                                />
                                                <div className="w-8 h-px bg-slate-100 mt-4.5 self-start opacity-50"></div>
                                                <StatusBadge
                                                    active={!!p.has_evidence || p.evidence_status === 'completada' || p.evidence_status === 'entregada'}
                                                    label="Evidencia"
                                                    required={p.req_evidence !== false}
                                                    statusText={p.evidence_status}
                                                />
                                                <div className="w-8 h-px bg-slate-100 mt-4.5 self-start opacity-50"></div>
                                                <StatusBadge
                                                    active={!!p.invoice_id || p.invoice_status === 'emitida' || p.invoice_status === 'timbrada'}
                                                    label="Factura"
                                                    required={p.request_direct_invoice === true}
                                                    statusText={p.invoice_status}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="text-base font-black text-slate-800 tracking-tight">
                                                {p.amount_total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-slate-900">
                                            <div className="flex justify-end gap-2 text-slate-900">
                                                <button
                                                    title="Ver Detalles"
                                                    onClick={() => navigate(`/proformas/${p.id}`)}
                                                    className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-cyan-600 hover:border-cyan-200 hover:bg-cyan-50 rounded-lg transition-all shadow-sm"
                                                >
                                                    <FileSearch size={16} />
                                                </button>
                                                <button
                                                    title="Imprimir"
                                                    className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 rounded-lg transition-all shadow-sm"
                                                >
                                                    <Printer size={16} />
                                                </button>
                                                <button
                                                    title="Eliminar"
                                                    onClick={() => handleDelete(p.id)}
                                                    className="w-8 h-8 flex items-center justify-center bg-white border border-red-100 text-red-300 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-lg transition-all shadow-sm"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaterialityBoard;
