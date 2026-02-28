import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    Wallet,
    Plus,
    Eye,
    FileEdit,
    Search,
    Link2,
    CheckCircle2,
    Clock,
    XCircle,
    SearchX
} from 'lucide-react';
import paymentFormsData from '../lib/payment_forms.json';

interface PagosProps {
    selectedOrg: any;
}

const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
        case 'VERIFICADO': return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
        case 'PENDIENTE': return 'bg-amber-500/20 border-amber-500/40 text-amber-400';
        case 'RECHAZADO': return 'bg-red-500/20 border-red-500/40 text-red-400';
        default: return 'bg-slate-500/20 border-slate-500/40 text-slate-400';
    }
};

const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
        case 'VERIFICADO': return CheckCircle2;
        case 'PENDIENTE': return Clock;
        case 'RECHAZADO': return XCircle;
        default: return Clock;
    }
};

const getMethodName = (code: string) => {
    const method = paymentFormsData.find((m: any) => String(m.code).padStart(2, '0') === code || String(m.code) === code);
    return method ? method.name : code;
};

const buildFolio = (q: any, orgRfc?: string) => {
    if (!q) return null;
    const rfc = orgRfc || q.organizations?.rfc;
    const orgPrefix = rfc?.match(/^[A-Z&]{3,4}/)?.[0] || 'PF';
    const dateStr = q.created_at ? new Date(q.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '') : '000000';
    const folNum = (q.proforma_number || 1).toString().padStart(2, '0');
    return `${orgPrefix}-${dateStr}-${folNum}`;
};

const Pagos = ({ selectedOrg }: PagosProps) => {
    const navigate = useNavigate();
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'TODOS' | 'VERIFICADO' | 'PENDIENTE' | 'RECHAZADO'>('TODOS');

    // Modal para crear pago nuevo
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [proformas, setProformas] = useState<any[]>([]);
    const [paymentFile, setPaymentFile] = useState<File | null>(null);

    // Modal para asignar proforma
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assigningPayment, setAssigningPayment] = useState<any>(null);

    const fetchPayments = async () => {
        if (!selectedOrg?.id) return;
        try {
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from('quotation_payments')
                .select(`
                    *,
                    quotations(id, proforma_number, client_name, amount_total, created_at, organizations(rfc)),
                    org_bank_accounts(bank_name, account_number, currency)
                `)
                .eq('organization_id', selectedOrg.id)
                .order('payment_date', { ascending: false });

            if (fetchError) throw fetchError;
            setPayments(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchBankAccounts = async () => {
        if (!selectedOrg?.id) return;
        const { data } = await supabase
            .from('org_bank_accounts')
            .select('*')
            .eq('organization_id', selectedOrg.id)
            .eq('is_active', true)
            .order('created_at', { ascending: true });
        setBankAccounts(data || []);
    };

    const fetchProformas = async () => {
        if (!selectedOrg?.id) return;
        const { data } = await supabase
            .from('quotations')
            .select('id, proforma_number, client_name, amount_total, created_at')
            .eq('organization_id', selectedOrg.id)
            .order('created_at', { ascending: false });
        setProformas(data || []);
    };

    useEffect(() => {
        fetchPayments();
    }, [selectedOrg?.id]);

    const handleCreatePayment = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedOrg?.id) return;
        try {
            setCreating(true);
            const form = new FormData(e.currentTarget);

            let evidenceUrl = null;
            if (paymentFile) {
                const ext = paymentFile.name.split('.').pop();
                const path = `${selectedOrg.id}/${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from('payment-evidence')
                    .upload(path, paymentFile);
                if (!uploadError) evidenceUrl = path;
            }

            const quotationId = form.get('quotation_id') as string;
            const { error: insertError } = await supabase
                .from('quotation_payments')
                .insert([{
                    organization_id: selectedOrg.id,
                    quotation_id: quotationId || null,
                    amount: parseFloat(form.get('amount') as string),
                    payment_date: form.get('payment_date') as string,
                    payment_method_code: form.get('payment_method_code') as string,
                    bank_account_id: (form.get('bank_account_id') as string) || null,
                    reference: (form.get('reference') as string) || null,
                    notes: (form.get('notes') as string) || null,
                    evidence_url: evidenceUrl,
                    status: 'VERIFICADO'
                }]);

            if (insertError) throw insertError;
            setShowCreateModal(false);
            setPaymentFile(null);
            fetchPayments();
        } catch (err: any) {
            alert('Error al registrar pago: ' + err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleAssignProforma = async (quotationId: string) => {
        if (!assigningPayment) return;
        try {
            const { error } = await supabase
                .from('quotation_payments')
                .update({ quotation_id: quotationId })
                .eq('id', assigningPayment.id);
            if (error) throw error;
            setShowAssignModal(false);
            setAssigningPayment(null);
            fetchPayments();
        } catch (err: any) {
            alert('Error al asignar: ' + err.message);
        }
    };

    const handleViewEvidence = async (evidenceUrl: string) => {
        const { data } = await supabase.storage
            .from('payment-evidence')
            .createSignedUrl(evidenceUrl, 300);
        if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    };

    // Filtrado
    const filtered = payments.filter(p => {
        if (activeTab !== 'TODOS' && p.status?.toUpperCase() !== activeTab) return false;
        if (search) {
            const s = search.toLowerCase();
            const clientName = p.quotations?.client_name?.toLowerCase() || '';
            const ref = p.reference?.toLowerCase() || '';
            const bankName = p.org_bank_accounts?.bank_name?.toLowerCase() || '';
            return clientName.includes(s) || ref.includes(s) || bankName.includes(s);
        }
        return true;
    });

    const totalAmount = filtered.reduce((acc, p) => acc + Number(p.amount || 0), 0);

    const tabs = [
        { key: 'TODOS', label: 'Todos' },
        { key: 'VERIFICADO', label: 'Verificados' },
        { key: 'PENDIENTE', label: 'Pendientes' },
        { key: 'RECHAZADO', label: 'Rechazados' },
    ] as const;

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight uppercase">Pagos</h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">Control de pagos recibidos y por asignar</p>
                </div>
                <button
                    onClick={() => { fetchBankAccounts(); fetchProformas(); setShowCreateModal(true); }}
                    className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors shadow-lg shadow-emerald-500/20"
                >
                    <Plus size={16} />
                    Registrar Pago
                </button>
            </div>

            {/* SUMMARY CARD */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'Total Pagos', value: payments.length, color: 'text-white' },
                    { label: 'Verificados', value: payments.filter(p => p.status === 'VERIFICADO').length, color: 'text-emerald-400' },
                    { label: 'Sin Proforma', value: payments.filter(p => !p.quotation_id).length, color: 'text-amber-400' },
                    { label: 'Monto Filtrado', value: totalAmount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }), color: 'text-cyan-400' },
                ].map((s, i) => (
                    <div key={i} className="bg-slate-800/40 border border-white/10 rounded-xl p-4">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{s.label}</div>
                        <div className={`text-xl font-black mt-1 ${s.color}`}>{s.value}</div>
                    </div>
                ))}
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
                        placeholder="Buscar por cliente, referencia o banco..."
                        className="w-full bg-slate-800/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition-all placeholder:text-slate-600 font-medium"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* ERROR */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3">
                    <XCircle size={18} />
                    <span className="text-sm font-bold uppercase tracking-tight">{error}</span>
                </div>
            )}

            {/* TABLE */}
            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4 grayscale opacity-50">
                    <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">Cargando pagos...</span>
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4 bg-slate-800/20 border border-dashed border-white/5 rounded-3xl">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                        <SearchX className="text-slate-600" size={32} />
                    </div>
                    <h3 className="text-white font-bold">No se encontraron pagos</h3>
                    <p className="text-slate-500 text-sm">Intenta con otros filtros o registra un nuevo pago</p>
                </div>
            ) : (
                <div className="bg-slate-800/40 border border-white/10 rounded-2xl overflow-x-auto shadow-2xl backdrop-blur-sm">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-white/5 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                                <th className="p-4">Fecha</th>
                                <th className="p-4">Folio / Cliente</th>
                                <th className="p-4 text-right">Monto</th>
                                <th className="p-4">Forma de Pago</th>
                                <th className="p-4">Banco / Referencia</th>
                                <th className="p-4 text-center">Estado</th>
                                <th className="p-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filtered.map(p => {
                                const StatusIcon = getStatusIcon(p.status);
                                return (
                                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            <span className="text-white text-sm font-mono font-bold">
                                                {new Date(p.payment_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {p.quotations ? (
                                                <div>
                                                    <button
                                                        onClick={() => navigate(`/proformas/${p.quotation_id}`)}
                                                        className="text-cyan-400 hover:text-cyan-300 font-mono text-sm font-bold transition-colors"
                                                    >
                                                        {buildFolio(p.quotations, selectedOrg?.rfc)}
                                                    </button>
                                                    <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[200px]">{p.quotations.client_name}</div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-amber-400 text-xs font-bold uppercase">Sin asignar</span>
                                                    <button
                                                        onClick={() => { setAssigningPayment(p); fetchProformas(); setShowAssignModal(true); }}
                                                        className="p-1 text-cyan-400 hover:bg-cyan-500/10 rounded transition-colors"
                                                        title="Asignar a proforma"
                                                    >
                                                        <Link2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="text-emerald-400 font-bold text-sm">
                                                {Number(p.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-slate-300 text-xs">{getMethodName(p.payment_method_code)}</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-slate-300 text-xs font-medium">{p.org_bank_accounts?.bank_name || '—'}</div>
                                            <div className="text-slate-500 text-[10px] font-mono">{p.reference || 'Sin referencia'}</div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(p.status)}`}>
                                                <StatusIcon size={12} />
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {p.evidence_url && (
                                                    <button
                                                        onClick={() => handleViewEvidence(p.evidence_url)}
                                                        className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
                                                        title="Ver comprobante"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                )}
                                                {p.quotation_id && (
                                                    <button
                                                        onClick={() => navigate(`/proformas/${p.quotation_id}`)}
                                                        className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
                                                        title="Ir a proforma"
                                                    >
                                                        <FileEdit size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODAL: CREAR PAGO */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
                        <div className="p-6 border-b border-white/10">
                            <h2 className="text-white font-black text-lg uppercase tracking-tight flex items-center gap-2">
                                <Wallet size={20} className="text-emerald-400" />
                                Registrar Pago
                            </h2>
                            <p className="text-slate-500 text-xs mt-1">Puedes asignar una proforma ahora o dejarlo sin asignar para vincularlo despues.</p>
                        </div>
                        <form onSubmit={handleCreatePayment} className="p-6 space-y-4">
                            {/* Proforma (opcional) */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Proforma (opcional)</label>
                                <select name="quotation_id" className="mt-1 w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                                    <option value="">Sin asignar</option>
                                    {proformas.map(q => (
                                        <option key={q.id} value={q.id}>
                                            {buildFolio(q, selectedOrg?.rfc)} — {q.client_name} ({Number(q.amount_total).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {/* Monto */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Monto *</label>
                                <input name="amount" type="number" step="0.01" min="0.01" required className="mt-1 w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="0.00" />
                            </div>
                            {/* Fecha */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fecha *</label>
                                <input name="payment_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="mt-1 w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                            </div>
                            {/* Forma de pago */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Forma de Pago SAT *</label>
                                <select name="payment_method_code" required defaultValue="03" className="mt-1 w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                                    {paymentFormsData.map((m: any) => (
                                        <option key={m.code} value={String(m.code).padStart(2, '0')}>{String(m.code).padStart(2, '0')} - {m.name}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Cuenta bancaria */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cuenta Receptora</label>
                                <select name="bank_account_id" className="mt-1 w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                                    <option value="">Sin especificar</option>
                                    {bankAccounts.map(ba => (
                                        <option key={ba.id} value={ba.id}>{ba.bank_name} (****{ba.account_number?.slice(-4)}) - {ba.currency}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Referencia */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Referencia / Tracking</label>
                                <input name="reference" type="text" className="mt-1 w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="N° Operacion o Cheque" />
                            </div>
                            {/* Notas */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Notas</label>
                                <input name="notes" type="text" className="mt-1 w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="Opcional" />
                            </div>
                            {/* Comprobante */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Comprobante PDF/Imagen</label>
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={e => setPaymentFile(e.target.files?.[0] || null)}
                                    className="mt-1 w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-700 file:text-slate-300 hover:file:bg-slate-600"
                                />
                            </div>
                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => { setShowCreateModal(false); setPaymentFile(null); }} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={creating} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                                    {creating ? 'Guardando...' : 'Registrar Pago'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: ASIGNAR PROFORMA */}
            {showAssignModal && assigningPayment && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
                        <div className="p-6 border-b border-white/10">
                            <h2 className="text-white font-black text-lg uppercase tracking-tight flex items-center gap-2">
                                <Link2 size={20} className="text-cyan-400" />
                                Asignar a Proforma
                            </h2>
                            <p className="text-slate-500 text-xs mt-1">
                                Pago de {Number(assigningPayment.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} del {new Date(assigningPayment.payment_date).toLocaleDateString('es-MX')}
                            </p>
                        </div>
                        <div className="p-6 space-y-2 max-h-[400px] overflow-y-auto">
                            {proformas.map(q => (
                                <button
                                    key={q.id}
                                    onClick={() => handleAssignProforma(q.id)}
                                    className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 border border-white/5 hover:border-cyan-500/30 rounded-xl transition-all text-left"
                                >
                                    <div>
                                        <div className="text-white font-bold text-sm font-mono">{buildFolio(q, selectedOrg?.rfc)}</div>
                                        <div className="text-slate-500 text-xs">{q.client_name}</div>
                                    </div>
                                    <div className="text-emerald-400 font-bold text-sm">
                                        {Number(q.amount_total).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="p-4 border-t border-white/10">
                            <button onClick={() => { setShowAssignModal(false); setAssigningPayment(null); }} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Pagos;
