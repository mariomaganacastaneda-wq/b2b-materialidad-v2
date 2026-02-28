import React, { useState, useEffect, useRef } from 'react';
import { CompanyList } from './CompanyList';
import { CompanyDetails } from './CompanyDetails';
import { UserDirectory } from './UserDirectory';
import { RoleManager } from './RoleManager';
import { Check, Save, Smartphone, Send } from 'lucide-react';
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
    defaultOrgId?: string;
    onSetDefaultOrg?: (orgId: string) => void;
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
    realUserProfile,
    defaultOrgId,
    onSetDefaultOrg
}) => {
    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'empresa' | 'usuarios' | 'roles' | 'mi_perfil'>('empresa');
    const [subTab, setSubTab] = useState<'clientes' | 'emisoras' | 'lote'>('clientes');
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [users, setUsers] = useState<any[]>([]);

    // Filters State
    const [profileData, setProfileData] = useState({
        phone_whatsapp: '',
        telegram_chat_id: ''
    });
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [profileUpdateSuccess, setProfileUpdateSuccess] = useState(false);
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
        if (currentUser) {
            setProfileData({
                phone_whatsapp: currentUser.phone_whatsapp || '',
                telegram_chat_id: currentUser.telegram_chat_id || ''
            });
        }
    }, [currentUser]);

    const handleUpdateProfile = async () => {
        if (!currentUser) return;
        setIsUpdatingProfile(true);
        setProfileUpdateSuccess(false);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    phone_whatsapp: profileData.phone_whatsapp,
                    telegram_chat_id: profileData.telegram_chat_id
                })
                .eq('id', currentUser.id);

            if (error) throw error;

            setProfileUpdateSuccess(true);
            setTimeout(() => setProfileUpdateSuccess(false), 3000);

            // Recargar datos suavemente si es necesario, o confiar en el estado local
        } catch (error: any) {
            alert('Error al actualizar perfil: ' + error.message);
        } finally {
            setIsUpdatingProfile(false);
        }
    };
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
        const finalThemeConfig = { ...(selectedOrg.theme_config || {}) };
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
            const { data, error } = await supabase.functions.invoke('manage-user-access', {
                body: {
                    profile_id: currentUser.id,
                    organization_id: orgId,
                    action: 'delete'
                }
            });

            if (error) {
                console.error('Invoke error:', error);
                // Si la función retornó un error estructurado, usarlo
                const bodyError = data?.error;
                throw new Error(bodyError || error.message || 'Error al procesar la solicitud');
            }

            if (data?.success === false) {
                throw new Error(data.error || 'Operación fallida en el servidor');
            }

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
                <button onClick={() => setActiveTab('mi_perfil')} className={`tab-button ${activeTab === 'mi_perfil' ? 'active' : ''}`}>Mi Perfil</button>
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
                                defaultOrgId={defaultOrgId}
                                onSetDefaultOrg={onSetDefaultOrg}
                            />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="notranslate" translate="no">
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

            {activeTab === 'mi_perfil' && (
                <div className="premium-panel p-8 max-w-2xl mx-auto mt-8 relative overflow-hidden">
                    {/* Decorative Background Element */}
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="relative z-10">
                        <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
                            <div className="w-2 h-8 bg-gradient-to-b from-emerald-400 to-cyan-500 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.3)]"></div>
                            Configuración de Perfil
                        </h2>

                        <div className="grid grid-cols-1 gap-6">
                            {/* Locked Fields Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-sm mb-2">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            value={currentUser?.full_name || ''}
                                            disabled
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-400 cursor-not-allowed shadow-sm transition-all"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-slate-100 px-2 py-0.5 rounded font-black text-slate-300">SISTEMA</div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                                    <div className="relative group">
                                        <input
                                            type="email"
                                            value={currentUser?.email || ''}
                                            disabled
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-400 cursor-not-allowed shadow-sm transition-all"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-slate-100 px-2 py-0.5 rounded font-black text-slate-300">SSO</div>
                                    </div>
                                </div>
                            </div>

                            {/* Editable Fields Section */}
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest ml-1">Teléfono / WhatsApp</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                <Smartphone size={16} />
                                            </div>
                                            <input
                                                type="text"
                                                value={profileData.phone_whatsapp}
                                                onChange={(e) => setProfileData(prev => ({ ...prev, phone_whatsapp: e.target.value }))}
                                                placeholder="+52 000 000 0000"
                                                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-slate-900 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 outline-none transition-all shadow-sm placeholder:text-slate-300"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest ml-1">Telegram (Vía Bot)</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                <Send size={16} />
                                            </div>
                                            <input
                                                type="text"
                                                value={profileData.telegram_chat_id}
                                                onChange={(e) => setProfileData(prev => ({ ...prev, telegram_chat_id: e.target.value }))}
                                                placeholder="Telegram ID Numerico"
                                                className="w-full bg-white border-2 border-emerald-100 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm placeholder:text-slate-200"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center gap-4">
                                    <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5 ml-1">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                        Para Telegram: Envía <code className="bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded">/id</code> al bot institucional
                                    </p>

                                    <button
                                        onClick={handleUpdateProfile}
                                        disabled={isUpdatingProfile}
                                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${profileUpdateSuccess
                                            ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                                            : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg active:scale-95 disabled:opacity-50'
                                            }`}
                                    >
                                        {isUpdatingProfile ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : profileUpdateSuccess ? (
                                            <Check size={16} strokeWidth={3} />
                                        ) : (
                                            <Save size={16} />
                                        )}
                                        {profileUpdateSuccess ? 'Actualizado' : 'Actualizar Perfil'}
                                    </button>
                                </div>

                                <div className="pt-6 mt-2 border-t border-slate-100">
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4">Canales de Notificación Premium</h3>
                                    <div className="flex flex-wrap gap-4">
                                        {['EMAIL', 'TELEGRAM', 'WHATSAPP'].map(channel => {
                                            const isSelected = currentUser?.notification_prefered_channels?.includes(channel);
                                            const colors = {
                                                'EMAIL': 'peer-checked:bg-cyan-500 peer-checked:border-cyan-500 hover:border-cyan-200',
                                                'TELEGRAM': 'peer-checked:bg-emerald-500 peer-checked:border-emerald-500 hover:border-emerald-200',
                                                'WHATSAPP': 'peer-checked:bg-green-500 peer-checked:border-green-500 hover:border-green-200'
                                            } as any;

                                            return (
                                                <label key={channel} className="relative cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={isSelected}
                                                        onChange={async () => {
                                                            const current = currentUser?.notification_prefered_channels || [];
                                                            const updated = isSelected
                                                                ? current.filter((c: string) => c !== channel)
                                                                : [...current, channel];
                                                            const { error } = await supabase.from('profiles').update({ notification_prefered_channels: updated }).eq('id', currentUser.id);
                                                            if (error) alert('Error al actualizar canales: ' + error.message);
                                                            else window.location.reload();
                                                        }}
                                                    />
                                                    <div className={`flex items-center gap-2.5 px-4 py-2 rounded-full border border-slate-200 bg-white shadow-sm transition-all duration-300 peer-checked:text-white ${colors[channel]}`}>
                                                        {isSelected ? (
                                                            <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                                                                <Check size={10} strokeWidth={4} />
                                                            </div>
                                                        ) : (
                                                            <div className="w-4 h-4 rounded-full bg-slate-50 border border-slate-200 group-hover:bg-slate-100 transition-colors"></div>
                                                        )}
                                                        <span className="text-xs font-black tracking-tight">{channel}</span>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
