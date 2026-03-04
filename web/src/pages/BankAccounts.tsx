import React from 'react';
import BankAccountsManager from '../components/accounting/BankAccountsManager';
import { Landmark } from 'lucide-react';
import { TextGlitch } from '../components/ui/TextGlitch';

interface BankAccountsProps {
    selectedOrg: any;
}

const BankAccounts: React.FC<BankAccountsProps> = ({ selectedOrg }) => {
    // We need to get the selected organization.
    // In this app, many pages rely on a global state or a context for the active org.
    // Looking at other pages like Quotations.tsx, they might use a prop or context.

    // For now, let's assume it's passed or retrieved from a common place.
    // I will use a placeholder or check how Quotations.tsx does it.

    // Viewing Quotations.tsx to see how it handles selectedOrg:
    /*
    const Quotations: React.FC<{ selectedOrg: any }> = ({ selectedOrg }) => { ... }
    */

    // So typical page signature here seems to be { selectedOrg: any }
    return (
        <div className="p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <Landmark className="text-white text-xl" />
                        </div>
                        <TextGlitch 
                            text="Tesorería y Bancos"
                            className="text-2xl font-black text-white tracking-tight"
                        />
                    </div>
                    <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest">
                        Gestión de cuentas bancarias y cajas de efectivo del emisor
                    </p>
                </div>
            </header>

            <main>
                <BankAccountsManager selectedOrg={selectedOrg} />
            </main>
        </div>
    );
};

export default BankAccounts;
