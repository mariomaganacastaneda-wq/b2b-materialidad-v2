import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Invoice } from '../types';

const Invoices = () => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchInvoices = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('invoices')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setInvoices(data || []);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchInvoices();
    }, []);

    return (
        <div className="space-y-6 text-white">
            <h1 className="text-3xl font-bold">Facturación</h1>
            {error && <div className="p-4 bg-red-500/10 text-red-400">{error}</div>}
            <div className="bg-slate-800/40 rounded-xl p-4">
                <table className="w-full">
                    <thead>
                        <tr className="text-left text-slate-400">
                            <th>Folio</th>
                            <th>Monto</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={3}>Cargando...</td></tr>
                        ) : invoices.map(inv => (
                            <tr key={inv.id} className="border-t border-white/5">
                                <td className="py-2">{inv.internal_number}</td>
                                <td className="py-2">${inv.amount_total}</td>
                                <td className="py-2">{inv.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Invoices;
