import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus } from 'lucide-react';
import type { Quotation } from '../types';

interface ProformasProps {
    selectedOrg: any;
}

const Proformas = ({ selectedOrg }: ProformasProps) => {
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchQuotations = async () => {
            if (!selectedOrg?.id) return;
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('quotations')
                    .select('*, organizations(rfc)')
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
        fetchQuotations();
    }, [selectedOrg]);

    return (
        <div className="space-y-6 text-white">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Proformas</h1>
                <a
                    href="/proformas/nueva"
                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-cyan-600/20"
                    onClick={(e) => {
                        e.preventDefault();
                        window.history.pushState({}, '', '/proformas/nueva');
                        window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                >
                    <Plus size={18} /> Nueva Proforma
                </a>
            </div>
            {error && <div className="p-4 bg-red-500/10 text-red-400 rounded-xl">{error}</div>}
            <div className="bg-slate-800/40 border border-white/10 rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-slate-400">
                        <tr>
                            <th className="p-4">Folio</th>
                            <th className="p-4">Descripción</th>
                            <th className="p-4">Total</th>
                            <th className="p-4">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} className="p-10 text-center">Cargando...</td></tr>
                        ) : quotations.length === 0 ? (
                            <tr><td colSpan={4} className="p-20 text-center text-slate-500">No hay registros.</td></tr>
                        ) : (
                            quotations.map(q => {
                                const orgPrefix = (q as any).organizations?.rfc?.match(/^[A-Z&]{3,4}/)?.[0] || 'PF';
                                const dateStr = new Date(q.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '');
                                const folNum = ((q as any).proforma_number || 1).toString().padStart(2, '0');
                                const customFolio = `${orgPrefix}-${dateStr}-${folNum}`;

                                return (
                                    <tr key={q.id} className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => {
                                        window.history.pushState({}, '', `/proformas/${q.id}`);
                                        window.dispatchEvent(new PopStateEvent('popstate'));
                                    }}>
                                        <td className="p-4 font-mono text-cyan-400 font-bold">{customFolio}</td>
                                        <td className="p-4 text-slate-300">{q.description || 'Proforma sin descripción'}</td>
                                        <td className="p-4 font-bold text-white">${new Intl.NumberFormat('es-MX').format(q.amount_total)}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider ${q.status === 'ACEPTADA' ? 'bg-emerald-500/20 text-emerald-400' :
                                                q.status === 'PENDIENTE' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-slate-500/20 text-slate-400'
                                                }`}>
                                                {q.status}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Proformas;
