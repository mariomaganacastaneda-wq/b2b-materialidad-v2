import { useState } from 'react';
import {
    LayoutGrid,
    ListChecks,
    Package,
    ShieldAlert,
    Briefcase,
    HelpCircle,
    History
} from 'lucide-react';
import { TextGlitch } from '../components/ui/TextGlitch';

import EconomicActivitiesTab from '../components/catalogs/EconomicActivitiesTab';
import ProductsServicesTab from '../components/catalogs/ProductsServicesTab';
import RegimesTab from '../components/catalogs/RegimesTab';
import UsesTab from '../components/catalogs/UsesTab';
import BlacklistTab from '../components/catalogs/BlacklistTab';
import SystemVersionsTab from '../components/catalogs/SystemVersionsTab';

type TabType = 'activities' | 'products' | 'regimes' | 'uses' | 'blacklist' | 'versions';

const SATCatalogs = () => {
    const [activeTab, setActiveTab] = useState<TabType>('activities');

    const tabs = [
        { id: 'activities', label: 'Actividades', icon: ListChecks, description: 'Taxonomía SCIAN y jerarquía fiscal' },
        { id: 'products', label: 'Productos/Servicios', icon: Package, description: 'Catálogo masivo para facturación (CFDI 4.0)' },
        { id: 'regimes', label: 'Regímenes', icon: Briefcase, description: 'Regímenes fiscales PF y PM' },
        { id: 'uses', label: 'Usos CFDI', icon: HelpCircle, description: 'Claves de uso para facturación' },
        { id: 'blacklist', label: 'Estatus 69-B', icon: ShieldAlert, description: 'Lista negra oficial del SAT (EFOS/EDOS)' },
        { id: 'versions', label: 'Versiones', icon: History, description: 'Registro de cambios del sistema' },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'activities': return <EconomicActivitiesTab />;
            case 'products': return <ProductsServicesTab />;
            case 'regimes': return <RegimesTab />;
            case 'uses': return <UsesTab />;
            case 'blacklist': return <BlacklistTab />;
            case 'versions': return <SystemVersionsTab />;
            default: return <EconomicActivitiesTab />;
        }
    };


    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '48px' }}>
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <LayoutGrid className="text-white text-xl" />
                        </div>
                        <TextGlitch 
                            text="Centro de Catálogos SAT"
                            className="text-3xl font-black text-white tracking-tight"
                        />
                    </div>
                    <p className="text-slate-400 text-sm mt-1 font-medium">
                        Plataforma unificada para la consulta de marcos regulatorios y taxonomías bajo el esquema CFDI 2026.
                    </p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2px' }}>
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`tab-button ${isActive ? 'active' : ''}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '12px 24px',
                                fontSize: '14px',
                                fontWeight: isActive ? '700' : '500',
                                position: 'relative',
                                cursor: 'pointer'
                            }}
                        >
                            <Icon size={18} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Dynamic Content Area */}
            <div style={{ position: 'relative' }}>
                <div className="glass-card" style={{ padding: '32px', minHeight: '500px' }}>
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default SATCatalogs;
