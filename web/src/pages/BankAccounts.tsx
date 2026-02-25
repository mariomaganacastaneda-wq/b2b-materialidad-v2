import React from 'react';
import BankAccountsManager from '../components/accounting/BankAccountsManager';

const Icon = ({ name, className = "" }: { name: string, className?: string }) => (
    <span className={`material-symbols-outlined select-none ${className}`} style={{ fontSize: 'inherit' }}>
        {name}
    </span>
);

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
            <header className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-[#1e40af] tracking-tight flex items-center gap-2 uppercase notranslate" translate="no">
                        <Icon name="account_balance_wallet" className="text-blue-600" />
                        Tesorería y Bancos
                    </h1>
                    <p className="text-[10px] font-black text-slate-400 mt-0.5 uppercase tracking-widest notranslate" translate="no">
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
