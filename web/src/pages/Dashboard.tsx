import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalAmount: 0,
        pendingInvoices: 0,
        totalQuotations: 0,
        dbStatus: 'connecting'
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data: qData, error: qError } = await supabase.from('quotations').select('amount_total');
                const { count: invCount, error: invError } = await supabase.from('invoices').select('*', { count: 'exact', head: true });

                if (qError || invError) throw qError || invError;

                const total = qData?.reduce((acc: number, curr: any) => acc + (Number(curr.amount_total) || 0), 0) || 0;

                setStats({
                    totalAmount: total,
                    pendingInvoices: invCount || 0,
                    totalQuotations: qData?.length || 0,
                    dbStatus: 'connected'
                });
            } catch (err) {
                console.error('Dashboard Error:', err);
                setStats(s => ({ ...s, dbStatus: 'error' }));
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="space-y-6 text-white">
            <h1 className="text-3xl font-bold">Panel de Control</h1>
            <p className="text-slate-400">Sincronización: {stats.dbStatus}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-800/60 p-6 rounded-2xl border border-white/10">
                    <p className="text-slate-400 text-sm">Monto en Cotizaciones</p>
                    <p className="text-3xl font-bold mt-2">${new Intl.NumberFormat('es-MX').format(stats.totalAmount)}</p>
                </div>
                <div className="bg-slate-800/60 p-6 rounded-2xl border border-white/10">
                    <p className="text-slate-400 text-sm">Total Facturas</p>
                    <p className="text-3xl font-bold mt-2">{stats.pendingInvoices}</p>
                </div>
                <div className="bg-slate-800/60 p-6 rounded-2xl border border-white/10">
                    <p className="text-slate-400 text-sm">Total Cotizaciones</p>
                    <p className="text-3xl font-bold mt-2">{stats.totalQuotations}</p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
