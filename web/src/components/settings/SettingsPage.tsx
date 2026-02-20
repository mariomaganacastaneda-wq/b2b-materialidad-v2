import React, { useState, useEffect, useRef } from 'react';
import { CompanyList } from './CompanyList';
import { CompanyDetails } from './CompanyDetails';
import { UserDirectory } from './UserDirectory';
import { RoleManager } from './RoleManager';
import BulkCSFManager from '../catalogs/BulkCSFManager';

interface SettingsPageProps {
    orgs: any[];
    setOrgs: (orgs: any[]) => void;
    selectedOrg: any;
    setSelectedOrg: (org: any) => void;
    supabase: any;
    currentUser: any;
    userPermissions?: any[];
    setImpersonatedUser?: (user: any) => void;
    realUserProfile?: any;
    userRolePermissions?: any[];
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
    orgs,
    setOrgs,
    selectedOrg,
    setSelectedOrg,
    supabase,
    currentUser,
    userPermissions = [],
    userRolePermissions = [],
    setImpersonatedUser,
    realUserProfile
}) => {
    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'empresa' | 'usuarios' | 'roles'>('empresa');
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

    // Permission Checking Logic
    const isAdmin = currentUser?.role === 'ADMIN';
    const canViewTab = (tabId: string) => {
        if (isAdmin) return true;
        const perm = userRolePermissions.find((p: any) => p.screen_id === `settings_${tabId}`);
        return perm?.can_view || false;
    };

    // Auto-select first available tab if current is denied
    useEffect(() => {
        if (!canViewTab(activeTab)) {
            if (canViewTab('empresa')) setActiveTab('empresa');
            else if (canViewTab('usuarios')) setActiveTab('usuarios');
            else if (canViewTab('roles')) setActiveTab('roles');
        }
    }, [userRolePermissions, currentUser, activeTab]);

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
        csf_history: [],
        related_products: [] as any[]
    });

    useEffect(() => {
        if (selectedOrg?.id) {
            const loadData = async () => {
                const { data: act } = await supabase.from('organization_activities').select('*').eq('organization_id', selectedOrg.id).order('activity_order');
                const { data: reg } = await supabase.from('organization_regimes').select('*').eq('organization_id', selectedOrg.id);
                const { data: obl } = await supabase.from('organization_obligations').select('*').eq('organization_id', selectedOrg.id);
                const { data: hist } = await supabase.from('organization_csf_history').select('*').eq('organization_id', selectedOrg.id).order('emission_date', { ascending: false });

                // Fetch related products for the activities found
                let products: any[] = [];
                if (act && act.length > 0) {
                    const activityCodes = act.map((a: any) => a.activity_code);
                    const { data: prodData } = await supabase
                        .from('rel_activity_product')
                        .select('*, cat_cfdi_productos_servicios(code, name)')
                        .in('activity_code', activityCodes);
                    products = prodData || [];
                }

                setDetailsData({
                    economic_activities: act || [],
                    tax_regimes: reg || [],
                    tax_obligations: obl || [],
                    csf_history: hist || [],
                    related_products: products
                });
            };
            loadData();
        } else {
            setDetailsData({
                economic_activities: [],
                tax_regimes: [],
                tax_obligations: [],
                csf_history: [],
                related_products: []
            });
        }
    }, [selectedOrg?.id, supabase]);

    // Merge details into org for CompanyDetails component
    const orgWithDetails = selectedOrg
        ? { ...selectedOrg, ...detailsData }
        : (isCreatingNew ? { id: 'new', _is_placeholder: true } : null);

    // DEBUG: Ver qué datos reales tiene la empresa seleccionada
    useEffect(() => {
        if (selectedOrg) {
            console.log('--- SELECCIÓN DE EMPRESA ---', {
                id: selectedOrg.id,
                nombre: selectedOrg.name,
                actividades: detailsData.economic_activities.length,
                regimenes: detailsData.tax_regimes.length
            });
        }
    }, [selectedOrg?.id, detailsData]);


    // Filter Logic
    const filteredOrgs = (orgs || []).filter((o: any) => {
        const userRole = currentUser?.role?.toUpperCase();
        const isAdmin = userRole === 'ADMIN';

        // Log de diagnóstico para el primer elemento (solo para debug)
        if (orgs.length > 0 && o.id === orgs[0].id) {
            console.log('SettingsPage Filter Debug:', {
                userRole,
                isAdmin,
                subTab,
                org_is_issuer: o.is_issuer,
                permissionsCount: userPermissions?.length
            });
        }

        // Filtro estricto de acceso (incluso para Admins, para que funcione el ocultamiento)
        const permission = userPermissions?.find((p: any) => p.organization_id === o.id);
        if (!permission) return false;

        // La visualización en "emisoras" o "clientes" ahora depende ÚNICAMENTE del permiso en el perfil de usuario.
        if (subTab === 'emisoras' && !permission.can_manage_quotations) return false;
        if (subTab === 'clientes' && !permission.can_manage_payments) return false;

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
    const pendingUpdates = useRef<any>({});
    const debounceTimer = useRef<any>(null);

    const handleUpdateDetail = (fieldOrObject: string | Record<string, any>, value?: any) => {
        if (!selectedOrg) return;

        // 1. Calcular el nuevo estado local (Optimistic Update)
        let localUpdate: any = {};
        let finalThemeConfig = { ...(selectedOrg.theme_config || {}) };
        let hasThemeUpdates = false;

        if (typeof fieldOrObject === 'string') {
            const field = fieldOrObject;
            if (field.startsWith('theme_config.')) {
                const subField = field.split('.')[1];
                finalThemeConfig[subField] = value;
                hasThemeUpdates = true;
                localUpdate = { theme_config: finalThemeConfig };
            } else {
                localUpdate = { [field]: value };
            }
        } else {
            // Es un objeto de múltiples actualizaciones
            Object.entries(fieldOrObject).forEach(([field, val]) => {
                if (field.startsWith('theme_config.')) {
                    const subField = field.split('.')[1];
                    finalThemeConfig[subField] = val;
                    hasThemeUpdates = true;
                } else {
                    localUpdate[field] = val;
                }
            });
            if (hasThemeUpdates) {
                localUpdate.theme_config = finalThemeConfig;
            }
        }

        // Actualizar UI inmediatamente para respuesta instantánea
        const updatedOrg = {
            ...selectedOrg,
            ...localUpdate,
            theme_config: hasThemeUpdates ? finalThemeConfig : selectedOrg.theme_config
        };

        setSelectedOrg(updatedOrg);
        setOrgs(orgs.map(o => o.id === updatedOrg.id ? updatedOrg : o));

        // 2. Acumular cambios para el guardado persistente
        pendingUpdates.current = { ...pendingUpdates.current, ...localUpdate };

        // 3. Debounce el guardado real en Supabase para evitar condiciones de carrera
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(async () => {
            const payload = { ...pendingUpdates.current };
            pendingUpdates.current = {}; // Limpiamos el buffer antes de la petición para capturar cambios nuevos durante el await

            // Diagnóstico de sesión
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.warn('SettingsPage: Intento de guardado sin sesión activa de Supabase.');
            }

            const { error } = await supabase.from('organizations').update(payload).eq('id', selectedOrg.id);

            if (error) {
                console.error('Error synchronizing organization:', error);
                // Si falla, mostramos alerta para que el usuario sepa que la persistencia falló
                alert('Error de sincronización: ' + error.message);
            }
        }, 1000);
    };
    const handleUnlinkClient = async (orgId: string) => {
        if (!confirm('¿Estás seguro de remover este cliente? Ya no aparecerá en tu lista.')) return;

        try {
            const { error } = await supabase.functions.invoke('manage-user-access', {
                body: {
                    profile_id: currentUser.id,
                    organization_id: orgId,
                    action: 'delete'
                }
            });

            if (error) throw error;

            // Refrescar toda la pantalla porque la DB cambió
            window.location.reload();
        } catch (err: any) {
            console.error('Error unlinking client:', err);
            alert('Error al remover cliente: ' + err.message);
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
                {canViewTab('empresa') && (
                    <button onClick={() => { setActiveTab('empresa'); setIsCreatingNew(false); }} className={`tab-button ${activeTab === 'empresa' ? 'active' : ''}`}>Empresas</button>
                )}
                {canViewTab('usuarios') && (
                    <button onClick={() => setActiveTab('usuarios')} className={`tab-button ${activeTab === 'usuarios' ? 'active' : ''}`}>Usuarios</button>
                )}
                {canViewTab('roles') && (
                    <button onClick={() => setActiveTab('roles')} className={`tab-button ${activeTab === 'roles' ? 'active' : ''}`}>Roles</button>
                )}
            </div>

            {activeTab === 'empresa' && canViewTab('empresa') && (
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
                                onUnlinkOrg={handleUnlinkClient}
                                subTab={subTab}
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

            {activeTab === 'usuarios' && canViewTab('usuarios') && (
                <UserDirectory
                    users={users}
                    setUsers={setUsers}
                    supabase={supabase}
                    currentUser={currentUser}
                    setImpersonatedUser={setImpersonatedUser}
                    realUserProfile={realUserProfile}
                />
            )}

            {activeTab === 'roles' && canViewTab('roles') && (
                <RoleManager
                    supabase={supabase}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
};
