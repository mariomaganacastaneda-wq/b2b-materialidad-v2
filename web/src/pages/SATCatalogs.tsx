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
            <div className="glass-card" style={{
                position: 'relative',
                overflow: 'hidden',
                padding: '32px',
                background: 'linear-gradient(to bottom right, rgba(99, 102, 241, 0.1), rgba(15, 23, 42, 0.6))',
                borderRadius: '24px'
            }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '256px', height: '256px', background: 'var(--primary-glow)', filter: 'blur(100px)', marginRight: '-128px', marginTop: '-128px', opacity: 0.3 }}></div>
                <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', backgroundColor: 'var(--primary-light)', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
                            <LayoutGrid color="var(--primary-base)" size={24} />
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--primary-base)' }}>Inteligencia Fiscal</span>
                    </div>
                    <div>
                        <h1 style={{ fontSize: '36px', fontWeight: '900', color: 'white', margin: 0, letterSpacing: '-0.025em' }}>
                            Centro de <span className="text-gradient-premium">Catálogos SAT</span>
                        </h1>
                        <p style={{ color: '#94a3b8', marginTop: '8px', maxWidth: '600px', fontSize: '14px', lineHeight: '1.6' }}>
                            Plataforma unificada para la consulta de marcos regulatorios, taxonomías de actividades
                            y validaciones de cumplimiento bajo el esquema CFDI 2026.
                        </p>
                    </div>
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
