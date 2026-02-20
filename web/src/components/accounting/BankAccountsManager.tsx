import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const Icon = ({ name, className = "" }: { name: string, className?: string }) => (
    <span className={`material-symbols-outlined select-none ${className}`} style={{ fontSize: 'inherit' }}>
        {name}
    </span>
);

interface BankAccount {
    id: string;
    organization_id: string;
    account_type: 'BANCO' | 'EFECTIVO';
    bank_name: string;
    account_number: string;
    holder_name: string;
    currency: string;
    is_active: boolean;
    current_balance?: number;
    created_at: string;
}

interface BankAccountsManagerProps {
    selectedOrg: any;
}

const BankAccountsManager: React.FC<BankAccountsManagerProps> = ({ selectedOrg }) => {
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [bankCatalog, setBankCatalog] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const [formData, setFormData] = useState({
        account_type: 'BANCO',
        bank_name: '',
        account_number: '',
        currency: 'MXN'
    });

    useEffect(() => {
        if (selectedOrg?.id) {
            loadAccounts();
        }
    }, [selectedOrg]);

    useEffect(() => {
        fetchBankCatalog();
    }, []);

    const fetchBankCatalog = async () => {
        const { data } = await supabase.from('cat_mexican_banks').select('*').order('name');
        setBankCatalog(data || []);
    };

    const loadAccounts = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('org_bank_accounts')
                .select('*')
                .eq('organization_id', selectedOrg.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAccounts(data || []);
        } catch (err) {
            console.error('Error loading accounts:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrg?.id) return;

        setIsSaving(true);
        try {
            if (editingId) {
                const { error } = await supabase
                    .from('org_bank_accounts')
                    .update(formData)
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('org_bank_accounts')
                    .insert([{
                        ...formData,
                        organization_id: selectedOrg.id,
                        holder_name: selectedOrg.name,
                        is_active: true
                    }]);
                if (error) throw error;
            }

            setFormData({ account_type: 'BANCO', bank_name: '', account_number: '', currency: 'MXN' });
            setSearchTerm('');
            setIsDropdownOpen(false);
            setEditingId(null);
            loadAccounts();
        } catch (err) {
            console.error('Error saving account:', err);
            alert('Error al guardar la cuenta');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStatus = async (account: BankAccount) => {
        try {
            const { error } = await supabase
                .from('org_bank_accounts')
                .update({ is_active: !account.is_active })
                .eq('id', account.id);
            if (error) throw error;
            loadAccounts();
        } catch (err) {
            console.error('Error toggling status:', err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Icon name="add_business" className="text-[#1e40af]" />
                        <h3 className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                            {editingId ? 'Editar Cuenta' : 'Registrar Nueva Cuenta o Caja'}
                        </h3>
                    </div>
                </div>

                <form onSubmit={handleSave} className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase ml-1">Tipo de Cuenta</label>
                            <select
                                value={formData.account_type}
                                onChange={(e) => setFormData({ ...formData, account_type: e.target.value as any })}
                                className="w-full px-3 py-2 bg-slate-50 border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="BANCO">CUENTA BANCARIA</option>
                                <option value="EFECTIVO">CAJA DE EFECTIVO</option>
                            </select>
                        </div>

                        <div className="space-y-1.5 flex-[2] relative">
                            <label className="block text-[10px] font-black text-slate-400 uppercase ml-1">Institución / Nombre de Caja</label>
                            {formData.account_type === 'BANCO' ? (
                                <div className="relative">
                                    <input
                                        required
                                        value={formData.bank_name || searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setFormData({ ...formData, bank_name: e.target.value });
                                            setIsDropdownOpen(true);
                                        }}
                                        onFocus={() => setIsDropdownOpen(true)}
                                        placeholder="Buscar banco (BBVA, Banorte...)"
                                        className="w-full px-3 py-2 bg-slate-50 border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300"
                                    />
                                    {isDropdownOpen && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                                            {bankCatalog
                                                .filter(b => b.name.toLowerCase().includes((formData.bank_name || searchTerm).toLowerCase()))
                                                .map(bank => (
                                                    <button
                                                        key={bank.code}
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData({ ...formData, bank_name: bank.name });
                                                            setSearchTerm(bank.name);
                                                            setIsDropdownOpen(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center justify-between group transition-colors"
                                                    >
                                                        <span className="text-[10px] font-bold text-slate-700 uppercase">{bank.name}</span>
                                                        <span className="text-[8px] font-black text-slate-300 group-hover:text-blue-400">{bank.code}</span>
                                                    </button>
                                                ))}
                                            <div
                                                className="p-2 border-t border-slate-50 text-center cursor-pointer hover:bg-slate-50"
                                                onClick={() => setIsDropdownOpen(false)}
                                            >
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cerrar Catálogo</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <input
                                    required
                                    value={formData.bank_name}
                                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                    placeholder="Nombre de la Caja (ej: Caja Chica)"
                                    className="w-full px-3 py-2 bg-slate-50 border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-100"
                                />
                            )}
                        </div>

                        <div className="space-y-1.5 flex-[2]">
                            <label className="block text-[10px] font-black text-slate-400 uppercase ml-1">N° Cuenta / CLABE / Referencia</label>
                            <input
                                required
                                value={formData.account_number}
                                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                                placeholder="0123... o Referencia interna"
                                className="w-full px-3 py-2 bg-slate-50 border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase ml-1">Moneda</label>
                            <select
                                value={formData.currency}
                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="MXN">MXN - PESOS</option>
                                <option value="USD">USD - DÓLARES</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                        {editingId && (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingId(null);
                                    setFormData({ account_type: 'BANCO', bank_name: '', account_number: '', currency: 'MXN' });
                                }}
                                className="px-4 py-2 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                            >
                                Cancelar
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="bg-[#1e40af] text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-800 transition-all disabled:opacity-50"
                        >
                            {isSaving ? 'Guardando...' : editingId ? 'Actualizar Cuenta' : 'Registrar Cuenta'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Icon name="list_alt" className="text-[#1e40af]" />
                        <h3 className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Cuentas Registradas</h3>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{accounts.length} cuentas en total</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Institución</th>
                                <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Referencia / N°</th>
                                <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Moneda</th>
                                <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Saldo Actual</th>
                                <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-[10px] font-black uppercase animate-pulse">
                                        Cargando cuentas bancarias...
                                    </td>
                                </tr>
                            ) : accounts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-300 italic text-[10px] font-bold uppercase">
                                        No hay cuentas registradas para esta organización
                                    </td>
                                </tr>
                            ) : (
                                accounts.map(acc => (
                                    <tr key={acc.id} className={`hover:bg-slate-50/50 transition-colors ${!acc.is_active ? 'opacity-60 bg-slate-50/20' : ''}`}>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => toggleStatus(acc)}
                                                className={`px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${acc.is_active ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}
                                            >
                                                {acc.is_active ? 'Activa' : 'Inactiva'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{acc.bank_name}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{acc.account_type}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-[10px] font-bold text-slate-500">
                                            {acc.account_number}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                                                {acc.currency}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`text-xs font-black ${(acc.current_balance ?? 0) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                                {Number(acc.current_balance || 0).toLocaleString('en-US', { style: 'currency', currency: acc.currency })}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-1">
                                            <button
                                                onClick={() => {
                                                    setEditingId(acc.id);
                                                    setFormData({
                                                        account_type: acc.account_type,
                                                        bank_name: acc.bank_name,
                                                        account_number: acc.account_number,
                                                        currency: acc.currency
                                                    });
                                                    setSearchTerm(acc.bank_name);
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Editar"
                                            >
                                                <Icon name="edit" className="text-sm" />
                                            </button>
                                            <button
                                                onMouseDown={async (e) => {
                                                    e.preventDefault();
                                                    if (confirm('¿Eliminar permanentemente esta cuenta?')) {
                                                        const { error } = await supabase.from('org_bank_accounts').delete().eq('id', acc.id);
                                                        if (error) alert('No se puede eliminar porque tiene pagos asociados. Desactívela en su lugar.');
                                                        loadAccounts();
                                                    }
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                title="Eliminar"
                                            >
                                                <Icon name="delete" className="text-sm" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BankAccountsManager;
