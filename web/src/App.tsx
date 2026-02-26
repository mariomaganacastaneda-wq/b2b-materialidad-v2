import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  FileCheck,
  LayoutGrid,
  Settings,
  LogOut,
  ImageIcon,
  BarChart3,
  CheckCircle2,
  Shield,
  FileSignature
} from 'lucide-react';
import { supabase, hasSupabaseConfig, updateSupabaseAuth, setClerkTokenProvider } from './lib/supabase';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useUser,
  useAuth
} from '@clerk/clerk-react';

// Componentes importados
import ProformaManager from './components/commercial/ProformaManager';
import MaterialityBoard from './components/commercial/MaterialityBoard';
import Quotations from './pages/Proformas';
import QuotationRequests from './pages/QuotationRequests';
import Evidence from './pages/Evidence';
import Contracts from './pages/Contracts';
import { SettingsPage } from './components/settings/SettingsPage';
import SATCatalogsPage from './pages/SATCatalogs';
import BankAccountsPage from './pages/BankAccounts';
import Invoices from './pages/Invoices';
import { SecurityCenter } from './pages/SecurityCenter';
import { PurchaseOrders } from './pages/PurchaseOrders';

// Branding and Diagnostics
export const EnvDiagnostic = () => {
  if (!hasSupabaseConfig) {
    return (
      <div style={{ padding: '20px', background: '#450a0a', color: '#fecaca', fontSize: '12px', textAlign: 'center', zIndex: 9999, position: 'relative' }}>
        ⚠️ Error de Configuración: Faltan variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en Vercel.
      </div>
    );
  }
  return null;
};

// Custom Hook para el branding dinámico
const useTheme = (org: any) => {
  useEffect(() => {
    if (org) {
      // 1. PRIMARY (30%)
      const primaryBase = org.theme_config?.primary_color || '#6366f1';
      const primaryLight = org.theme_config?.primary_light || '#a5b4fc';
      const primaryDark = org.theme_config?.primary_dark || '#4338ca';

      // 2. SECONDARY / ACCENT (10%)
      const accent = org.theme_config?.accent_color || '#FFC107';
      const secondaryBase = org.theme_config?.secondary_color || '#929292';

      // 3. NEUTRALS (60%)
      const bgGeneral = org.theme_config?.bg_general || '#0f172a';
      const textDark = org.theme_config?.text_dark || '#ffffff';
      const textLight = org.theme_config?.text_light || '#94a3b8';
      const borderColor = org.theme_config?.border_color || '#334155';

      // 4. SEMANTIC
      const success = org.theme_config?.color_success || '#10b981';
      const error = org.theme_config?.color_error || '#ef4444';
      const warning = org.theme_config?.color_warning || '#f59e0b';
      const info = org.theme_config?.color_info || '#17A2B8';

      const root = document.documentElement;

      // Rule 60 (Neutrals)
      root.style.setProperty('--bg-60', bgGeneral);
      root.style.setProperty('--border-60', borderColor);
      root.style.setProperty('--text-light-60', textLight);
      root.style.setProperty('--text-dark-60', textDark);

      // Rule 30 (Primary)
      root.style.setProperty('--primary-30', primaryBase);
      root.style.setProperty('--primary-light-30', primaryLight);
      root.style.setProperty('--primary-dark-30', primaryDark);
      root.style.setProperty('--primary-glow', `${primaryBase}4d`);

      // Rule 10 (Accent)
      root.style.setProperty('--accent-10', accent);
      root.style.setProperty('--secondary-10', secondaryBase);

      // Semantics
      root.style.setProperty('--color-success', success);
      root.style.setProperty('--color-error', error);
      root.style.setProperty('--color-warning', warning);
      root.style.setProperty('--color-info', info);

      // Mapeo de compatibilidad anterior
      root.style.setProperty('--primary-base', primaryBase);
      root.style.setProperty('--primary-light', primaryLight);
      root.style.setProperty('--accent-color', accent);
      root.style.setProperty('--primary-color', primaryBase);

      if (org.logo_url) {
        root.style.setProperty('--logo-url', `url(${org.logo_url})`);
      } else {
        root.style.setProperty('--logo-url', 'none');
      }

      // Dynamic Document Title
      if (org.brand_name || org.name) {
        document.title = `${org.brand_name || org.name} | B2B Materialidad`;
      }
    } else {
      document.title = 'B2B Materialidad Fiscal';
    }
  }, [org]);
};

// Diagnostic Header
export const DiagnosticBar = () => {
  const [conn, setConn] = useState('Probando...');
  const [stats, setStats] = useState({ q: 0, i: 0 });

  useEffect(() => {
    const check = async () => {
      if (!supabase) {
        setConn('No configurado (Vercel ENV)');
        return;
      }
      try {
        const { error } = await supabase.from('organizations').select('id', { count: 'exact', head: true });
        if (error) setConn('Error: ' + error.message);
        else {
          setConn('Conectado a Supabase Cloud');
          const { count: q } = await supabase.from('quotations').select('id', { count: 'exact', head: true });
          const { count: i } = await supabase.from('invoices').select('id', { count: 'exact', head: true });
          setStats({ q: q || 0, i: i || 0 });
        }
      } catch (e: any) {
        setConn('Error de conexión');
      }
    };
    check();
  }, []);

  return (
    <div style={{
      backgroundColor: 'var(--primary-dark-30, #1e1b4b)',
      color: 'var(--primary-light-30, #818cf8)',
      padding: '6px 20px',
      fontSize: '11px',
      textAlign: 'center',
      borderBottom: '1px solid var(--primary-glow)',
      display: 'flex',
      justifyContent: 'center',
      gap: '20px',
      transition: 'all 0.5s ease'
    }}>
      <span>● {conn}</span>
      <span style={{ color: 'var(--color-success, #4ade80)' }}>● {stats.q} Cotizaciones</span>
      <span style={{ color: 'var(--accent-10, #60a5fa)' }}>● {stats.i} Facturas</span>
    </div>
  );
};

// --- PAGES ---

const CurrentUserDetails = () => {
  const { user } = useUser();
  return <>{user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Usuario'}</>;
};

const PlaceholderPage = ({ title }: { title: string }) => (
  <div style={{ padding: '100px', textAlign: 'center', opacity: 0.5 }}>
    <ImageIcon size={64} style={{ marginBottom: '20px', margin: '0 auto' }} />
    <h1 style={{ fontSize: '24px' }}>{title}</h1>
    <p>Módulo en desarrollo para SEIDCO V1.2</p>
  </div>
);


const DashboardPage = ({ userProfile }: { userProfile: any }) => {
  const [data, setData] = useState<any>(null);
  const [compliance, setCompliance] = useState<any[]>([]);

  useEffect(() => {
    if (!supabase) return;

    let quoteQuery = supabase.from('quotations').select('*').limit(5);
    let complianceQuery = supabase.from('v_organizations_csf_status').select('*').limit(10);

    // Si el perfil activo no es ADMIN, filtramos por su ID de perfil (Esto simula RLS para el Admin suplantador)
    if (userProfile && userProfile.role !== 'ADMIN') {
      quoteQuery = quoteQuery.eq('profile_id', userProfile.id);
      // Nota: v_organizations_csf_status ya debería estar filtrada si restringimos la lista de orgs, 
      // pero por seguridad también podemos filtrar aquí si la vista lo permite.
    }

    quoteQuery.then(({ data }: any) => setData(data));
    complianceQuery.then(({ data }: any) => setCompliance(data || []));
  }, [userProfile]);

  const getComplianceColor = (status: string) => {
    switch (status) {
      case 'VALID': return 'var(--color-success)';
      case 'WARNING': return 'var(--color-warning)';
      case 'EXPIRED': return 'var(--color-error)';
      default: return 'var(--primary-glow)';
    }
  };

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '24px' }}>Panel de Control</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Volumen de Ventas (Cotizado)</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold' }}>$1,245,000</div>
            </div>
            <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'var(--primary-light)', color: 'var(--primary-base)' }}>
              <BarChart3 size={24} />
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Monitoreo Fiscal (CSF)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {compliance && compliance.filter(c => c.status_compliance !== 'VALID').length > 0 ? (
                  compliance.filter(c => c.status_compliance !== 'VALID').map(c => (
                    <div key={c.id} style={{ fontSize: '12px', color: getComplianceColor(c.status_compliance), fontWeight: '600' }}>
                      ⚠️ {c.name}: {c.status_compliance === 'EXPIRED' ? 'Expirada' : 'Pronta a vencer'}
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '14px', color: '#10b981', fontWeight: '600' }}>✓ Todas las CSF vigentes</div>
                )}
              </div>
            </div>
            <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'var(--primary-light)', color: 'var(--color-warning)', opacity: 0.8 }}>
              <FileCheck size={24} />
            </div>
          </div>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Estatus de Cumplimiento</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#10b981' }}>98%</div>
            </div>
            <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'var(--primary-light)', color: 'var(--color-success)' }}>
              <CheckCircle2 size={24} />
            </div>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Actividad Reciente</h2>
      <div className="glass-card" style={{ padding: '0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <th style={{ padding: '16px 24px', color: '#94a3b8', fontWeight: '500', fontSize: '14px' }}>Cliente / Proyecto</th>
              <th style={{ padding: '16px 24px', color: '#94a3b8', fontWeight: '500', fontSize: '14px' }}>Monto</th>
              <th style={{ padding: '16px 24px', color: '#94a3b8', fontWeight: '500', fontSize: '14px' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {(data && Array.isArray(data)) ? data.map((q: any) => (
              <tr key={q.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ fontWeight: '500' }}>{q.description || 'Suministro Industrial'}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>#{q.consecutive_id} - Goodyear</div>
                </td>
                <td style={{ padding: '16px 24px', fontWeight: 'bold' }}>${q.amount_total?.toLocaleString()}</td>
                <td style={{ padding: '16px 24px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '99px', fontSize: '12px', backgroundColor: '#312e81', color: '#818cf8', border: '1px solid #4338ca' }}>
                    {q.status}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No hay actividad cargada</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- MAIN LAYOUT ---

export function App() {
  const location = useLocation();
  const [orgs, setOrgs] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  // --- SINCRONIZACIÓN DE SESIÓN Y CARGA DE DATOS ---
  const { user: clerkUser, isLoaded } = useUser();
  const { getToken, signOut } = useAuth();
  const [userPermissions, setUserPermissions] = useState<any[]>([]);
  const [userRolePermissions, setUserRolePermissions] = useState<any[]>([]);
  const [impersonatedUser, setImpersonatedUser] = useState<any>(null);
  const [realUserProfile, setRealUserProfile] = useState<any>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // Exponer para diagnóstico desde consola y botones de emergencia
  useEffect(() => {
    (window as any)._GET_TOKEN = getToken;
    (window as any)._CLERK_USER = clerkUser;
    (window as any)._SUPABASE = supabase;
    console.log('App: Global diagnostics exposed');
  }, [getToken, clerkUser]);

  // Hooking the Clerk JWT getter to the Supabase global fetch interceptor
  useEffect(() => {
    setClerkTokenProvider(async () => {
      try {
        return await getToken({ template: 'supabase' });
      } catch (e) {
        console.warn('App: Supabase JWT template not found for interceptor, falling back to default token.');
        return await getToken();
      }
    });
  }, [getToken]);

  useEffect(() => {
    const syncProfileAndLoadData = async () => {
      if (!isLoaded || !clerkUser || !supabase) {
        console.log('App: Wait for Clerk/Supabase...', { isLoaded, hasUser: !!clerkUser });
        return;
      }

      try {
        console.log('App: Syncing token and performing HARD RESET if needed...');

        // Diagnóstico: Limpiar ruido en el almacenamiento local si hay problemas persistentes
        if (orgs.length === 0 && sessionReady) {
          console.warn('App: Diagnostic -> Cleaning Supabase local storage to force refresh');
          Object.keys(localStorage).forEach(key => {
            if (key.includes('supabase.auth.token')) localStorage.removeItem(key);
          });
        }

        // 0. Sincronizar Token de Clerk con Supabase (Asegurar encabezado Auth)
        let token: string | null = null;
        try {
          token = await getToken({ template: 'supabase' });
        } catch (tErr) {
          console.warn('App: Supabase JWT template not found, falling back to default token.');
          token = await getToken();
        }

        if (token) {
          console.log('App: Token acquired, syncing headers and session');

          // 0.1 Inyección Directa de Cabeceras (Bypass de latencia de sesión)
          updateSupabaseAuth(token);

          // 0.2 Sincronización de Sesión estándar
          const { data: { session }, error: sessionError } = await supabase.auth.setSession({
            access_token: token,
            refresh_token: ''
          });

          console.log('App: Supabase session status (CLERK_JWT):', {
            active: !!session,
            user: session?.user?.id,
            error: sessionError?.message
          });
        } else {
          console.warn('App: No JWT token "supabase". Falling back to ANON_KEY for visibility.');
          // Si no hay token de Clerk, nos aseguramos de que Supabase use la anonKey por defecto
          // @ts-ignore
          await supabase.auth.signOut(); // Limpiar rastro de sesiones fallidas
        }

        const email = clerkUser.primaryEmailAddress?.emailAddress;
        if (!email) {
          console.warn('App: User has no email');
          return;
        }

        console.log('App: Loading profiles and data...');

        // 1. Verificar/Sincronizar el perfil REAL (solo si no estamos suplantando o es la primera vez)
        if (!realUserProfile) {
          let { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', clerkUser.id)
            .single();

          if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error verificando perfil real:', fetchError);
          }

          if (!profile) {
            const { data: newProfile, error: insertError } = await supabase.from('profiles').insert({
              id: clerkUser.id,
              email: email,
              full_name: clerkUser.fullName || 'Usuario Nuevo',
              role: null,
              organization_id: null,
              notification_prefered_channels: ['EMAIL']
            }).select().single();

            if (insertError) {
              console.error('App: CRITICAL ERROR creating profile:', insertError);
              // Fallback for visual rendering even if DB rejected
              profile = {
                id: clerkUser.id,
                email: email,
                full_name: clerkUser.fullName || 'Usuario (Sin DB)',
                role: null
              };
            } else {
              profile = newProfile;
            }
          }
          setRealUserProfile(profile);
        }

        // 2. Determinar qué perfil mostrar (real o suplantado)
        const targetUserId = impersonatedUser?.id || clerkUser.id;
        console.log('App: Fetching active profile for:', targetUserId);

        let { data: activeProfile, error: activeError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', targetUserId)
          .single();

        if (activeError && activeError.code !== 'PGRST116') {
          console.error('App: Error loading active profile:', activeError);
        }

        // Fallback de seguridad definitivo: Si es un admin conocido y NO estamos suplantando, forzamos su rol
        const hardcodedAdmins = ['user_39fz5fO1nTqgiZdV3oBEevy2FfT', 'user_39ldmMY70oeZqxolww1N55Ptvw6'];
        const isKnownAdmin = clerkUser && hardcodedAdmins.includes(clerkUser.id);

        if (isKnownAdmin && !impersonatedUser) {
          console.log('App: [SECURITY_BYPASS] Forcing ADMIN status for known user:', clerkUser.id);
          activeProfile = activeProfile || {
            id: clerkUser.id,
            role: 'ADMIN',
            full_name: clerkUser.fullName || 'Administrador',
            email: email
          };
          activeProfile.role = 'ADMIN';
        }

        console.log('App: Final userProfile context:', { id: activeProfile?.id, role: activeProfile?.role });
        setUserProfile(activeProfile);

        // 3. Cargar Organizaciones
        console.log('App: Loading profiles and data...');

        const { data: orgData, error: orgError } = await supabase.from('organizations').select('*');

        if (orgError) {
          console.error('App: SUPABASE_FETCH_ERROR:', orgError);
          // Solo mostrar errores reales que no sean transitorios (401 suele ser transitorio en el arranque)
          if (orgError.status !== 401) {
            // @ts-ignore
            window.__SUPABASE_ERROR_MSG = orgError.message;
          }
        } else {
          // Limpiar mensaje de error si logramos cargar algo
          // @ts-ignore
          window.__SUPABASE_ERROR_MSG = null;
        }

        // 4. Cargar Permisos específicos
        const { data: accessData, error: accessError } = await supabase
          .from('user_organization_access')
          .select('*')
          .eq('profile_id', targetUserId);

        if (accessError) console.error('App: Error loading permissions:', accessError);
        setUserPermissions(accessData || []);

        // 4. Cargar Permisos de ROL (Matriz de Pantallas)
        if (activeProfile?.role) {
          const { data: rolePerms, error: rolePermsError } = await supabase
            .from('role_permissions')
            .select('*')
            .eq('role_id', activeProfile.role);

          if (rolePermsError) {
            console.error('App: Error loading role permissions:', rolePermsError);
          } else {
            console.log(`App: Loaded ${rolePerms?.length || 0} role permissions for ${activeProfile.role}`);
            setUserRolePermissions(rolePerms || []);
          }
        }

        if (orgData && orgData.length > 0) {
          let filteredOrgs = orgData;

          // Filtrado de seguridad:
          // Un ADMIN real (no suplantando) siempre ve TODO.
          // Un usuario normal o un ADMIN suplantando ve solo lo permitido por accessData.

          const isActingAsAdmin = activeProfile?.role === 'ADMIN' && !impersonatedUser;

          if (!isActingAsAdmin) {
            const allowedIds = accessData?.map((a: any) => a.organization_id) || [];
            filteredOrgs = orgData.filter((o: any) => allowedIds.includes(o.id));
            console.log(`App: [SECURITY_FILTER] Mode: ${impersonatedUser ? 'Impersonation' : 'Standard'}. Showing ${filteredOrgs.length}/${orgData.length} orgs.`);
          } else {
            console.log(`App: [ADMIN_BYPASS] Showing all ${orgData.length} orgs.`);
          }

          setOrgs(filteredOrgs);

          // Asegurar que selectedOrg sea válido dentro del set filtrado
          if (filteredOrgs.length > 0) {
            const currentIsValid = selectedOrg && filteredOrgs.some((o: any) => o.id === selectedOrg.id);
            if (!currentIsValid) {
              // Usar default_org_id del perfil si existe y pertenece al set filtrado
              const defaultOrg = activeProfile?.default_org_id
                ? filteredOrgs.find((o: any) => o.id === activeProfile.default_org_id)
                : null;
              setSelectedOrg(defaultOrg || filteredOrgs[0]);
            }
          } else {
            setSelectedOrg(null);
          }
        }

      } catch (err) {
        console.error('Initial Load Exception:', err);
      } finally {
        console.log('App: Sync sequence completed');
        setSessionReady(true);
      }
    };

    syncProfileAndLoadData();
  }, [clerkUser, isLoaded, supabase, impersonatedUser, getToken]);

  useTheme(selectedOrg);

  const handleSetDefaultOrg = async (orgId: string) => {
    const targetUserId = impersonatedUser?.id || clerkUser?.id;
    if (!targetUserId) return;
    const { error } = await supabase
      .from('profiles')
      .update({ default_org_id: orgId })
      .eq('id', targetUserId);
    if (!error) {
      setUserProfile((prev: any) => ({ ...prev, default_org_id: orgId }));
    }
  };

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, screenId: 'dashboard', roles: ['*'] },
    { label: 'Materialidad', path: '/materialidad', icon: Shield, screenId: 'materialidad', roles: ['ADMIN', 'CONTABLE', 'FACTURACION'] },
    { label: 'Cotizaciones', path: '/cotizaciones', icon: FileText, screenId: 'cotizaciones', roles: ['ADMIN', 'VENDEDOR', 'REPRESENTANTE'] },
    { label: 'Órdenes Compra', path: '/ordenes-compra', icon: FileText, screenId: 'ordenes_compra', roles: ['ADMIN', 'VENDEDOR', 'FACTURACION', 'CXC'] },
    { label: 'Facturación', path: '/facturas', icon: FileCheck, screenId: 'facturas', roles: ['ADMIN', 'FACTURACION', 'CXC', 'CONTABLE', 'CLIENTE'] },
    { label: 'Bancos', path: '/bancos', icon: FileCheck, screenId: 'bancos', roles: ['ADMIN', 'FACTURACION', 'CXC', 'REPRESENTANTE'] },
    { label: 'Evidencia', path: '/evidencia', icon: ImageIcon, screenId: 'evidencia', roles: ['ADMIN', 'VENDEDOR', 'FACTURACION'] },
    { label: 'Contratos', path: '/contratos', icon: FileSignature, screenId: 'contratos', roles: ['ADMIN', 'VENDEDOR', 'FACTURACION'] },
    { label: 'Reportes', path: '/reportes', icon: BarChart3, screenId: 'reportes', roles: ['ADMIN', 'CONTABLE', 'REPRESENTANTE'] },
    { label: 'Catálogos SAT', path: '/catalogos-sat', icon: LayoutGrid, screenId: 'catalogos-sat', roles: ['ADMIN', 'FACTURACION', 'CONTABLE'] },
    { label: 'Configuración', path: '/settings', icon: Settings, screenIds: ['settings_empresa', 'settings_usuarios', 'settings_roles'], roles: ['ADMIN', 'VENDEDOR', 'CXC', 'CONTABLE'] },
    { label: 'Seguridad', path: '/security', icon: Shield, screenId: 'security', roles: ['ADMIN'] },
  ];

  const hardcodedAdmins = ['user_39fz5fO1nTqgiZdV3oBEevy2FfT', 'user_39ldmMY70oeZqxolww1N55Ptvw6'];
  const isActualAdmin = (clerkUser && hardcodedAdmins.includes(clerkUser.id) && !impersonatedUser) || (userProfile?.role === 'ADMIN' && !impersonatedUser);

  const filteredNavItems = navItems.filter(item => {
    if (item.roles.includes('*')) return true;
    if (isActualAdmin) return true;

    // Buscar permiso para esta pantalla específica o lista de pantallas
    if (item.screenIds) {
      return item.screenIds.some(id => userRolePermissions.find(p => p.screen_id === id)?.can_view);
    }
    const perm = userRolePermissions.find(p => p.screen_id === item.screenId);
    return perm?.can_view;
  });

  // Nuclear Protection: Si estamos cargando Clerk, o TENEMOS usuario pero la sesión AÚN NO está lista, BLOQUEAR renderizado.
  if (!isLoaded || (clerkUser && !sessionReady)) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: 'white' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '18px', fontWeight: 'bold' }}>
              {!isLoaded ? 'Cargando Autenticación...' : 'Sincronizando con B2B Cloud...'}
            </p>
            <p style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              Identidad: {isLoaded ? (clerkUser ? 'Verificada ✅' : 'Esperando usuario...') : 'Cargando Clerk...'}
            </p>
            {/* @ts-ignore */}
            {(window as any).__SUPABASE_ERROR_MSG && (
              <p style={{ color: '#ef4444', fontSize: '10px', marginTop: '4px' }}>
                Error SDK: {(window as any).__SUPABASE_ERROR_MSG}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: '20px', background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}
            >
              Forzar Recarga Completa
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SignedOut>
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#020617',
          color: 'white',
          gap: '24px',
          backgroundImage: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.15) 0%, transparent 70%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <div style={{ width: '60px', height: '60px', backgroundColor: 'var(--primary-color)', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '24px', boxShadow: '0 0 30px var(--primary-glow)' }}>B2B</div>
            <div style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.025em' }}>Materialidad <span style={{ color: 'var(--primary-base)', fontWeight: '400' }}>Fiscal</span></div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '16px', marginBottom: '10px' }}>Bienvenido al sistema de cumplimiento forense corporativo.</p>
          <div className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <SignInButton mode="modal">
              <button className="primary-button" style={{ width: '280px', height: '45px', fontSize: '15px' }}>Iniciar Sesión</button>
            </SignInButton>
          </div>
          <div style={{ marginTop: '40px', fontSize: '12px', color: '#475569' }}>SEIDCO V1.3 - Advanced Compliance Architecture</div>
        </div>
      </SignedOut>

      <SignedIn>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#020617', color: 'white', fontFamily: '"Inter", sans-serif' }}>
          {impersonatedUser && (
            <div style={{
              backgroundColor: '#991b1b',
              color: 'white',
              padding: '8px 20px',
              fontSize: '12px',
              fontWeight: 'bold',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '20px',
              zIndex: 1000
            }}>
              <span>⚠️ MODO SUPLANTACIÓN ACTIVO: Estás viendo el sistema como <strong>{impersonatedUser.full_name}</strong></span>
              <button
                onClick={() => setImpersonatedUser(null)}
                style={{
                  backgroundColor: 'white',
                  color: '#991b1b',
                  border: 'none',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: '800'
                }}
              >
                DETENER SUPLANTACIÓN
              </button>
            </div>
          )}

          <header
            className="notranslate"
            // @ts-ignore
            translate="no"
            style={{ height: '70px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between', backgroundColor: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 100 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '45px', height: '45px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 0 20px var(--primary-glow)' }}>
                {selectedOrg?.logo_url ? (
                  <img src={selectedOrg.logo_url} alt="Logo" style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', transition: 'background-color 0.5s' }}>B2B</div>
                )}
              </div>
              <div style={{ fontWeight: '800', fontSize: '20px', letterSpacing: '-0.025em' }}>Materialidad <span style={{ color: 'var(--primary-base)', fontWeight: '400', transition: 'color 0.5s' }}>Fiscal</span></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ textAlign: 'right' }}>
                <SignedIn>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>
                    <CurrentUserDetails />
                  </div>
                  <div style={{ color: impersonatedUser ? '#ef4444' : '#64748b', fontSize: '12px', fontWeight: impersonatedUser ? 'bold' : 'normal' }}>
                    {impersonatedUser ? `Suplantando a: ${impersonatedUser.full_name}` : (selectedOrg?.name || 'Administrador')}
                  </div>
                </SignedIn>
              </div>
              <SignedIn>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: {
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        border: '1px solid #334155'
                      }
                    }
                  }}
                />
              </SignedIn>
            </div>
          </header>

          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <aside
              className="notranslate"
              // @ts-ignore
              translate="no"
              style={{ width: '260px', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'var(--neutro-claro)' }}
            >
              {filteredNavItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: location.pathname === item.path ? 'white' : '#94a3b8',
                    backgroundColor: location.pathname === item.path ? 'var(--primary-glow)' : 'transparent',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                    fontWeight: location.pathname === item.path ? '600' : '400',
                    border: location.pathname === item.path ? '1px solid var(--primary-glow)' : '1px solid transparent'
                  }}
                >
                  <item.icon size={18} color={location.pathname === item.path ? 'var(--primary-base)' : '#94a3b8'} style={{ transition: 'color 0.5s' }} />
                  <span>{item.label}</span>
                </Link>
              ))}

              <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    signOut({ redirectUrl: '/' });
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', background: 'none', border: 'none', color: '#f87171', padding: '12px 16px', cursor: 'pointer', textAlign: 'left', fontSize: '14px' }}
                >
                  <LogOut size={18} />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </aside>

            <main style={{
              flex: 1,
              overflowY: 'auto',
              padding: '40px',
              background: 'radial-gradient(circle at top right, var(--primary-glow), transparent)',
              position: 'relative'
            }}>
              {/* Marca de agua sutil del logotipo en el fondo */}
              {selectedOrg?.logo_url && (
                <div style={{
                  position: 'absolute',
                  bottom: '40px',
                  right: '40px',
                  width: '300px',
                  height: '300px',
                  backgroundImage: `url(${selectedOrg.logo_url})`,
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  opacity: 0.03,
                  pointerEvents: 'none',
                  filter: 'grayscale(100%)'
                }} />
              )}
              <Routes>
                <Route path="/" element={<DashboardPage userProfile={userProfile} />} />
                <Route path="/materialidad" element={<MaterialityBoard selectedOrg={selectedOrg} />} />
                <Route path="/materialidad/:id" element={<MaterialityBoard selectedOrg={selectedOrg} />} />
                <Route path="/cotizaciones" element={<QuotationRequests selectedOrg={selectedOrg} />} />
                <Route path="/cotizaciones/:id" element={<QuotationRequests selectedOrg={selectedOrg} />} />
                <Route path="/proformas" element={<Quotations selectedOrg={selectedOrg} />} />
                <Route path="/ordenes-compra" element={<PurchaseOrders currentUser={userProfile} selectedOrg={selectedOrg} />} />
                <Route path="/proformas/:id" element={<ProformaManager selectedOrg={selectedOrg} />} />
                <Route path="/proformas/nueva" element={<ProformaManager selectedOrg={selectedOrg} />} />
                <Route path="/facturas" element={<Invoices userProfile={userProfile} />} />
                <Route path="/facturas/:id" element={<Invoices userProfile={userProfile} />} />
                <Route path="/evidencia" element={<Evidence userProfile={userProfile} selectedOrg={selectedOrg} />} />
                <Route path="/evidencia/:id" element={<Evidence userProfile={userProfile} selectedOrg={selectedOrg} />} />
                <Route path="/catalogos-sat" element={<SATCatalogsPage />} />
                <Route path="/bancos" element={<BankAccountsPage selectedOrg={selectedOrg} />} />
                <Route path="/contratos" element={<Contracts selectedOrg={selectedOrg} />} />
                <Route path="/contratos/:id" element={<Contracts selectedOrg={selectedOrg} />} />
                <Route path="/reportes" element={<PlaceholderPage title="Generador de Reportes" />} />
                <Route path="/settings" element={<SettingsPage orgs={orgs} setOrgs={setOrgs} selectedOrg={selectedOrg} setSelectedOrg={setSelectedOrg} supabase={supabase} currentUser={userProfile} userPermissions={userPermissions} userRolePermissions={userRolePermissions} setImpersonatedUser={setImpersonatedUser} realUserProfile={realUserProfile} defaultOrgId={userProfile?.default_org_id} onSetDefaultOrg={handleSetDefaultOrg} />} />
                <Route path="/security" element={<SecurityCenter supabase={supabase} clerkUser={clerkUser} getToken={getToken} impersonatedUser={impersonatedUser} />} />
              </Routes>
            </main>
          </div>

          <style>{`
            :root {
              --primary-base: #6366f1;
              --primary-light: rgba(99, 102, 241, 0.1);
              --primary-glow: rgba(99, 102, 241, 0.3);
              --accent-color: #818cf8;
              --neutro-oscuro: #ffffff;
              --neutro-claro: #020617;
              --color-success: #10b981;
              --color-error: #ef4444;
              --color-warning: #f59e0b;
              --primary-color: var(--primary-base);
            }
            body { 
              margin: 0; 
              overflow: hidden; 
              background-color: var(--neutro-claro); 
              color: var(--neutro-oscuro); 
              font-family: "Inter", sans-serif;
              transition: background-color 0.5s, color 0.5s;
            }
            .glass-card {
                background: rgba(30, 41, 59, 0.4);
                backdrop-filter: blur(8px);
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 16px;
                padding: 24px;
                transition: transform 0.2s ease, border-color 0.2s ease;
            }
            .glass-card:hover { border-color: var(--primary-glow); }
            .fade-in { animation: fadeIn 0.5s ease-out; }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .primary-button {
                background-color: var(--primary-color);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 10px;
                font-weight: bold;
                cursor: pointer;
                transition: 0.2s;
                display: flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 4px 12px var(--primary-glow);
            }
            .primary-button:hover { 
              transform: translateY(-1px);
              box-shadow: 0 6px 16px var(--primary-glow);
            }
            .secondary-button {
                background: none;
                border: 1px solid #334155;
                color: #94a3b8;
                padding: 10px 20px;
                border-radius: 10px;
                cursor: pointer;
                transition: 0.2s;
            }
            .secondary-button:hover:not(:disabled) {
                border-color: var(--primary-color);
                color: white;
            }
            .tab-button {
                background: none;
                border: none;
                padding: 12px 20px;
                color: #64748b;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                border-bottom: 2px solid transparent;
                transition: all 0.3s;
            }
            .tab-button.active {
                color: var(--primary-color);
                border-bottom-color: var(--primary-color);
            }
            .input-group label {
                display: block;
                font-size: 13px;
                color: #94a3b8;
                margin-bottom: 8px;
            }
            .input-group input {
                width: 100%;
                background: #0f172a;
                border: 1px solid #334155;
                padding: 12px;
                border-radius: 8px;
                color: white;
                outline: none;
                transition: border-color 0.3s;
            }
            .input-group input:focus { border-color: var(--primary-base); }
            * { box-sizing: border-box; }
          `}</style>
        </div>
      </SignedIn >
    </>
  );
}

export default function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  );
}
