import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Quotation } from '../types';

const Quotations = () => {
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchQuotations = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('quotations')
                    .select('*')
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
    }, []);

    return (
        <div className="space-y-6 text-white">
            <h1 className="text-3xl font-bold">Cotizaciones</h1>
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
                            quotations.map(q => (
                                <tr key={q.id} className="border-t border-white/5 hover:bg-white/5">
                                    <td className="p-4 font-mono text-indigo-400">#{q.consecutive_id}</td>
                                    <td className="p-4">{q.description}</td>
                                    <td className="p-4 font-bold">${new Intl.NumberFormat('es-MX').format(q.amount_total)}</td>
                                    <td className="p-4">{q.status}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Quotations;
