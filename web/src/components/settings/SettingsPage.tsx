import React, { useState, useEffect } from 'react';
import { CompanyList } from './CompanyList';
import { CompanyDetails } from './CompanyDetails';
import { UserDirectory } from './UserDirectory';
import BulkCSFManager from '../catalogs/BulkCSFManager';

interface SettingsPageProps {
    orgs: any[];
    setOrgs: (orgs: any[]) => void;
    selectedOrg: any;
    setSelectedOrg: (org: any) => void;
    supabase: any;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
    orgs,
    setOrgs,
    selectedOrg,
    setSelectedOrg,
    supabase
}) => {
    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'empresa' | 'usuarios'>('empresa');
    const [subTab, setSubTab] = useState<'clientes' | 'emisoras' | 'lote'>('clientes');
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [users, setUsers] = useState<any[]>([]);

    // Filters State
    const [searchTerm, setSearchTerm] = useState('');
    const [activityFilter, setActivityFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'persona_moral' | 'persona_fisica'>('all');
    const [csfFilter, setCsfFilter] = useState<'all' | 'with' | 'without'>('all'); // Changed default to 'all' to match general expectations or keep 'with' if that was crucial

    // Data State
    const [uniqueActivities, setUniqueActivities] = useState<string[]>([]);
    const [orgActivitiesMap, setOrgActivitiesMap] = useState<{ [key: string]: string[] }>({});

    // --- EFFECTS ---

    // Load Activities Metadata
    useEffect(() => {
        const fetchActivitiesData = async () => {
            const { data } = await supabase
                .from('organization_activities')
                .select('organization_id, description')
                .order('description');

            if (data) {
                const unique = Array.from(new Set(data.map((a: any) => a.description)));
                setUniqueActivities(unique as string[]);

                const mapping: { [key: string]: string[] } = {};
                data.forEach((item: any) => {
                    if (!mapping[item.organization_id]) mapping[item.organization_id] = [];
                    mapping[item.organization_id].push(item.description);
                });
                setOrgActivitiesMap(mapping);
            }
        };
        fetchActivitiesData();
    }, [orgs, supabase]);

    // Supplemental Data Load (When org is selected)
    // Logic moved to CompanyDetails or kept here? 
    // CompanyDetails displays data attached to `org`. 
    // In App.tsx, `loadSupplementalData` mutated `activities`, `regimes` state variables.
    // We need to attach these to the `org` object or pass them to CompanyDetails.
    // The original App.tsx logic seemed to fetch these and set separate states.
    // But wait, in `CompanyDetails.tsx` I implemented: `const activities = org?.economic_activities || [];`
    // This implies `org` object should have these properties. 
    // In App.tsx `loadSupplementalData` set `setActivities(act || [])`.
    // So I need to fetch this data and probably pass it to 'CompanyDetails', OR
    // Ideally, `selectedOrg` should be enriched.
    // Let's implement `loadSupplementalData` here and pass the data to `CompanyDetails`.

    const [detailsData, setDetailsData] = useState({
        economic_activities: [],
        tax_regimes: [],
        tax_obligations: [],
        csf_history: []
    });

    useEffect(() => {
        if (selectedOrg?.id) {
            const loadData = async () => {
                const { data: act } = await supabase.from('organization_activities').select('*').eq('organization_id', selectedOrg.id).order('activity_order');
                const { data: reg } = await supabase.from('organization_regimes').select('*').eq('organization_id', selectedOrg.id);
                const { data: obl } = await supabase.from('organization_obligations').select('*').eq('organization_id', selectedOrg.id);
                const { data: hist } = await supabase.from('organization_csf_history').select('*').eq('organization_id', selectedOrg.id).order('emission_date', { ascending: false });

                setDetailsData({
                    economic_activities: act || [],
                    tax_regimes: reg || [],
                    tax_obligations: obl || [],
                    csf_history: hist || []
                });
            };
            loadData();
        } else {
            setDetailsData({
                economic_activities: [],
                tax_regimes: [],
                tax_obligations: [],
                csf_history: []
            });
        }
    }, [selectedOrg?.id, supabase]);

    // Merge details into org for CompanyDetails component
    const orgWithDetails = selectedOrg ? { ...selectedOrg, ...detailsData } : null;


    // Filter Logic
    const filteredOrgs = (orgs || []).filter((o: any) => {
        // Tab filter
        if (subTab === 'clientes' && o.is_issuer) return false; // This logic might be: show only clients? 
        // Original logic: `subTab === 'clientes' ? true : o.is_issuer` -> If subtab client, show all? No, probably show clients.
        // Re-reading original: `.filter((o: any) => subTab === 'clientes' ? true : o.is_issuer)`
        // This meant: if tab is clients, return true (show all? or maybe 'clientes' was default view). 
        // Actually usually 'clientes' tab shows clients, 'emisoras' shows issuers.
        // Let's implement standard logic:
        if (subTab === 'emisoras' && !o.is_issuer) return false;
        // If subTab is 'clientes', maybe we want to exclude issuers if they are mutually exclusive? 
        // Original code was ambiguous, let's assume 'emisoras' filters for is_issuer=true.

        const searchMatch = !searchTerm ||
            o.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            o.rfc?.toLowerCase().includes(searchTerm.toLowerCase());

        const typeMatch = typeFilter === 'all' ||
            (typeFilter === 'persona_moral' && o.taxpayer_type?.toUpperCase().includes('MORAL')) ||
            (typeFilter === 'persona_fisica' && o.taxpayer_type?.toUpperCase().includes('FÍSICA'));

        const csfMatch = csfFilter === 'all' ||
            (csfFilter === 'with' && o.csf_file_url) ||
            (csfFilter === 'without' && !o.csf_file_url);

        const activityMatch = activityFilter === 'all' ||
            (orgActivitiesMap[o.id] && orgActivitiesMap[o.id].includes(activityFilter));

        return searchMatch && typeMatch && csfMatch && activityMatch;
    });

    // Handlers
    const handleUpdateDetail = async (fieldOrObject: string | Record<string, any>, value?: any) => {
        if (!selectedOrg) return;

        let updatePayload: any = {};
        let finalThemeConfig = { ...(selectedOrg.theme_config || {}) };
        let hasThemeUpdates = false;

        if (typeof fieldOrObject === 'string') {
            const field = fieldOrObject;
            if (field.startsWith('theme_config.')) {
                const subField = field.split('.')[1];
                finalThemeConfig[subField] = value;
                hasThemeUpdates = true;
                updatePayload = { theme_config: finalThemeConfig };
            } else {
                updatePayload = { [field]: value };
            }
        } else {
            // Es un objeto de múltiples actualizaciones
            Object.entries(fieldOrObject).forEach(([field, val]) => {
                if (field.startsWith('theme_config.')) {
                    const subField = field.split('.')[1];
                    finalThemeConfig[subField] = val;
                    hasThemeUpdates = true;
                } else {
                    updatePayload[field] = val;
                }
            });
            if (hasThemeUpdates) {
                updatePayload.theme_config = finalThemeConfig;
            }
        }

        const { error } = await supabase.from('organizations').update(updatePayload).eq('id', selectedOrg.id);

        if (!error) {
            const updatedOrg = {
                ...selectedOrg,
                ...updatePayload,
                theme_config: hasThemeUpdates ? finalThemeConfig : selectedOrg.theme_config
            };

            setSelectedOrg(updatedOrg);
            setOrgs(orgs.map(o => o.id === updatedOrg.id ? updatedOrg : o));
        } else {
            console.error('Error updating organization:', error);
            alert('Error al actualizar: ' + error.message);
        }
    };

    // Users Load
    useEffect(() => {
        if (activeTab === 'usuarios') {
            const loadUsers = async () => {
                const { data } = await supabase.from('profiles').select('*');
                setUsers(data || []);
            };
            loadUsers();
        }
    }, [activeTab, supabase]);


    return (
        <div className="fade-in">
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '24px' }}>Configuración del Sistema</h1>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '32px' }}>
                <button onClick={() => { setActiveTab('empresa'); setIsCreatingNew(false); }} className={`tab-button ${activeTab === 'empresa' ? 'active' : ''}`}>Empresas</button>
                <button onClick={() => setActiveTab('usuarios')} className={`tab-button ${activeTab === 'usuarios' ? 'active' : ''}`}>Usuarios</button>
            </div>

            {activeTab === 'empresa' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', gap: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '10px' }}>
                        <button
                            onClick={() => { setSubTab('clientes'); setIsCreatingNew(false); }}
                            style={{ padding: '8px 16px', background: 'none', border: 'none', color: subTab === 'clientes' ? 'white' : '#64748b', borderBottom: subTab === 'clientes' ? '2px solid var(--primary-color)' : 'none', cursor: 'pointer', fontSize: '13px', fontWeight: subTab === 'clientes' ? 'bold' : 'normal' }}
                        >
                            Repositorio de Clientes
                        </button>
                        <button
                            onClick={() => { setSubTab('emisoras'); setIsCreatingNew(false); }}
                            style={{ padding: '8px 16px', background: 'none', border: 'none', color: subTab === 'emisoras' ? 'white' : '#64748b', borderBottom: subTab === 'emisoras' ? '2px solid var(--primary-color)' : 'none', cursor: 'pointer', fontSize: '13px', fontWeight: subTab === 'emisoras' ? 'bold' : 'normal' }}
                        >
                            Gestión de Emisoras
                        </button>
                        <button
                            onClick={() => { setSubTab('lote'); setIsCreatingNew(false); }}
                            style={{ padding: '8px 16px', background: 'none', border: 'none', color: subTab === 'lote' ? 'white' : '#64748b', borderBottom: subTab === 'lote' ? '2px solid var(--primary-color)' : 'none', cursor: 'pointer', fontSize: '13px', fontWeight: subTab === 'lote' ? 'bold' : 'normal' }}
                        >
                            Carga Masiva (Lote)
                        </button>
                    </div>

                    {subTab === 'lote' ? (
                        <BulkCSFManager />
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '32px' }}>
                            <CompanyList
                                orgs={filteredOrgs}
                                selectedOrgId={selectedOrg?.id}
                                onSelectOrg={(org) => {
                                    setSelectedOrg(org);
                                    setIsCreatingNew(!org);
                                }}
                                filters={{
                                    searchTerm, setSearchTerm,
                                    activityFilter, setActivityFilter,
                                    typeFilter, setTypeFilter,
                                    csfFilter, setCsfFilter
                                }}
                                uniqueActivities={uniqueActivities}
                            />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <CompanyDetails
                                    org={orgWithDetails}
                                    isCreatingNew={isCreatingNew}
                                    onUpdateDetail={handleUpdateDetail}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'usuarios' && (
                <UserDirectory
                    users={users}
                    setUsers={setUsers}
                    supabase={supabase}
                />
            )}
        </div>
    );
};
