import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { LayoutDashboard } from 'lucide-react';
import { TextGlitch } from '../components/ui/TextGlitch';

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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <LayoutDashboard className="text-white text-xl" />
                        </div>
                        <TextGlitch 
                            text="Panel de Control"
                            className="text-3xl font-black text-white tracking-tight"
                        />
                    </div>
                    <p className="text-slate-400 text-sm font-medium mt-1">Sincronización: {stats.dbStatus}</p>
                </div>
            </div>
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
