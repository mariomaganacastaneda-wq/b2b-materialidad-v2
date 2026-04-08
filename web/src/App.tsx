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
  FileSignature,
  ChevronDown,
  Wallet,
  ShoppingCart,
  UploadCloud
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

// Nuevos componentes UI Futuristas
import { GlowCard } from './components/ui/GlowCard';
import { RetroGrid } from './components/ui/RetroGrid';
import { TextGlitch } from './components/ui/TextGlitch';
import NumberTicker from './components/ui/NumberTicker';

// Componentes importados
import ProformaManager from './components/commercial/ProformaManager';
import MaterialityBoard from './components/commercial/MaterialityBoard';
import QuotationRequests from './pages/QuotationRequests';
import Evidence from './pages/Evidence';
import Contracts from './pages/Contracts';
import { SettingsPage } from './components/settings/SettingsPage';
import SATCatalogsPage from './pages/SATCatalogs';
import BankAccountsPage from './pages/BankAccounts';
import Invoices from './pages/Invoices';
import { SecurityCenter } from './pages/SecurityCenter';
import FileImport from './pages/FileImport';
import PurchaseOrderRequests from './pages/PurchaseOrderRequests';
import Pagos from './pages/Pagos';

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
      const primaryBase = org.theme_config?.primary_color || '#06b6d4';
      const primaryLight = org.theme_config?.primary_light || '#22d3ee';
      const primaryDark = org.theme_config?.primary_dark || '#0891b2';

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
    <p>Módulo en desarrollo para FISCERTA Materialidad Fiscal B2B</p>
  </div>
);


const DashboardPage = ({ userProfile }: { userProfile: any }) => {
  const [data, setData] = useState<any>(null);
  const [compliance, setCompliance] = useState<any[]>([]);

  useEffect(() => {
    if (!supabase) return;

    let quoteQuery = supabase.from('quotations').select('*').limit(5);
    const complianceQuery = supabase.from('v_organizations_csf_status').select('*').limit(10);

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
    <div className="fade-in relative z-0 min-h-[calc(100vh-120px)] w-full">
      <RetroGrid className="opacity-40" />
      <h1 className="text-[28px] font-bold mb-8 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
        <TextGlitch text="Panel de Control" />
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <GlowCard glowColor="rgba(6, 182, 212, 0.15)">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-slate-400 text-sm mb-2 font-medium tracking-wide">Volumen de Ventas (Cotizado)</div>
              <div className="text-[32px] font-bold text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]">
                <NumberTicker value={1245000} prefix="$" />
              </div>
            </div>
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20">
              <BarChart3 size={24} />
            </div>
          </div>
        </GlowCard>

        <GlowCard glowColor="rgba(245, 158, 11, 0.15)" className="border-l-2 border-l-amber-500/50">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-slate-400 text-sm mb-2 font-medium tracking-wide">Monitoreo Fiscal (CSF)</div>
              <div className="flex flex-col gap-1.5">
                {compliance && compliance.filter(c => c.status_compliance !== 'VALID').length > 0 ? (
                  compliance.filter(c => c.status_compliance !== 'VALID').map(c => (
                    <div key={c.id} className="text-xs font-semibold" style={{ color: getComplianceColor(c.status_compliance) }}>
                      ⚠️ {c.name}: {c.status_compliance === 'EXPIRED' ? 'Expirada' : 'Pronta a vencer'}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-emerald-400 font-semibold flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                    <CheckCircle2 size={16} /> TODAS LAS CSF VIGENTES
                  </div>
                )}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
              <FileCheck size={24} />
            </div>
          </div>
        </GlowCard>

        <GlowCard glowColor="rgba(16, 185, 129, 0.15)">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-slate-400 text-sm mb-2 font-medium tracking-wide">Estatus de Cumplimiento</div>
              <div className="text-[32px] font-bold text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                <NumberTicker value={98} suffix="%" />
              </div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
              <CheckCircle2 size={24} />
            </div>
          </div>
        </GlowCard>
      </div>

      <h2 className="text-xl font-semibold mb-4 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
        Actividad Reciente
      </h2>
      <GlowCard className="p-0 border border-white/5 bg-[#0a0f1d]/80 backdrop-blur-md">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left border-b border-white/5 bg-white/[0.02]">
              <th className="py-4 px-6 text-slate-400 font-medium text-sm tracking-wider">Cliente / Proyecto</th>
              <th className="py-4 px-6 text-slate-400 font-medium text-sm tracking-wider">Monto</th>
              <th className="py-4 px-6 text-slate-400 font-medium text-sm tracking-wider">Estado</th>
            </tr>
          </thead>
          <tbody>
            {(data && Array.isArray(data)) ? data.map((q: any) => (
              <tr key={q.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="py-4 px-6">
                  <div className="font-semibold text-slate-200">{q.description || 'Suministro Industrial'}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">#{q.consecutive_id} - Goodyear</div>
                </td>
                <td className="py-4 px-6 font-bold text-slate-200 font-mono">
                  ${q.amount_total?.toLocaleString()}
                </td>
                <td className="py-4 px-6">
                  <span className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                    {q.status}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={3} className="p-8 text-center text-slate-500 font-medium">No hay actividad cargada</td>
              </tr>
            )}
          </tbody>
        </table>
      </GlowCard>
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
            email: email,
            default_org_id: localStorage.getItem('fiscerta_default_org_id') || null
          };
          activeProfile.role = 'ADMIN';

          // Sincronizar rol ADMIN en la DB para que get_current_user_role() funcione en RLS
          if (activeProfile.id) {
            supabase.from('profiles').update({ role: 'ADMIN' }).eq('id', activeProfile.id).then(({ error }: { error: any }) => {
              if (error) console.warn('App: Could not sync ADMIN role to DB:', error.message);
              else console.log('App: [DB_SYNC] ADMIN role synced to profiles table');
            });
          }
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
              // Buscar default: 1) profile.default_org_id, 2) localStorage, 3) primera org
              const defaultOrgId = activeProfile?.default_org_id
                || localStorage.getItem('fiscerta_default_org_id');
              const defaultOrg = defaultOrgId
                ? filteredOrgs.find((o: any) => o.id === defaultOrgId)
                : null;
              setSelectedOrg(defaultOrg || filteredOrgs[0]);
              // Sincronizar localStorage
              const finalOrgId = (defaultOrg || filteredOrgs[0])?.id;
              if (finalOrgId) localStorage.setItem('fiscerta_default_org_id', finalOrgId);
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

  // Persistir la org seleccionada en BD + localStorage cada vez que cambie
  useEffect(() => {
    if (!selectedOrg?.id) return;
    const userId = impersonatedUser?.id || clerkUser?.id;
    if (!userId) return;

    // localStorage para persistir entre reloads
    localStorage.setItem('fiscerta_default_org_id', selectedOrg.id);

    // BD para persistir entre sesiones/dispositivos (fire-and-forget)
    supabase
      .from('profiles')
      .update({ default_org_id: selectedOrg.id })
      .eq('id', userId)
      .then(({ error }) => {
        if (error) console.warn('No se pudo persistir default_org_id:', error.message);
      });
  }, [selectedOrg?.id]);

  const handleSetDefaultOrg = async (orgId: string) => {
    const targetUserId = impersonatedUser?.id || clerkUser?.id;
    if (!targetUserId) return;
    const { error } = await supabase
      .from('profiles')
      .update({ default_org_id: orgId })
      .eq('id', targetUserId);
    if (!error) {
      setUserProfile((prev: any) => ({ ...prev, default_org_id: orgId }));
      // Cambiar la org activa inmediatamente
      const fullOrg = orgs.find(o => o.id === orgId);
      if (fullOrg) setSelectedOrg(fullOrg);
      // Backup en localStorage para sobrevivir reloads y race conditions de auth
      localStorage.setItem('fiscerta_default_org_id', orgId);
    }
  };

  // Sub-items del flujo de Materialidad (orden de negocio)
  const materialityChildren = [
    { label: 'Cotizaciones', path: '/cotizaciones', icon: FileText, screenId: 'cotizaciones', roles: ['ADMIN', 'VENDEDOR', 'REPRESENTANTE'] },
    { label: 'Contratos', path: '/contratos', icon: FileSignature, screenId: 'contratos', roles: ['ADMIN', 'VENDEDOR', 'FACTURACION'] },
    { label: 'Importación Archivos', path: '/importacion', icon: UploadCloud, screenId: 'ordenes_compra', roles: ['ADMIN', 'VENDEDOR', 'FACTURACION', 'CXC'] },
    { label: 'Órdenes de Compra', path: '/ordenes-compra', icon: ShoppingCart, screenId: 'ordenes_compra_req', roles: ['ADMIN', 'VENDEDOR', 'FACTURACION', 'CXC'] },
    { label: 'Facturación', path: '/facturas', icon: FileCheck, screenId: 'facturas', roles: ['ADMIN', 'FACTURACION', 'CXC', 'CONTABLE', 'CLIENTE'] },
    { label: 'Evidencia', path: '/evidencia', icon: ImageIcon, screenId: 'evidencia', roles: ['ADMIN', 'VENDEDOR', 'FACTURACION'] },
    { label: 'Pagos', path: '/pagos', icon: Wallet, screenId: 'pagos', roles: ['ADMIN', 'FACTURACION', 'CXC', 'CONTABLE'] },
  ];
  const materialityChildPaths = materialityChildren.map(c => c.path);

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, screenId: 'dashboard', roles: ['*'] },
    { label: 'Materialidad', path: '/materialidad', icon: Shield, screenId: 'materialidad', roles: ['ADMIN', 'CONTABLE', 'FACTURACION'], isParent: true },
    { label: 'Bancos', path: '/bancos', icon: FileCheck, screenId: 'bancos', roles: ['ADMIN', 'FACTURACION', 'CXC', 'REPRESENTANTE'] },
    { label: 'Reportes', path: '/reportes', icon: BarChart3, screenId: 'reportes', roles: ['ADMIN', 'CONTABLE', 'REPRESENTANTE'] },
    { label: 'Catálogos SAT', path: '/catalogos-sat', icon: LayoutGrid, screenId: 'catalogos-sat', roles: ['ADMIN', 'FACTURACION', 'CONTABLE'] },
    { label: 'Configuración', path: '/settings', icon: Settings, screenIds: ['settings_empresa', 'settings_usuarios', 'settings_roles', 'settings_emisoras'], roles: ['ADMIN', 'VENDEDOR', 'CXC', 'CONTABLE'] },
    { label: 'Seguridad', path: '/security', icon: Shield, screenId: 'security', roles: ['ADMIN'] },
  ];

  const [materialityOpen, setMaterialityOpen] = useState(true);

  const hardcodedAdmins = ['user_39fz5fO1nTqgiZdV3oBEevy2FfT', 'user_39ldmMY70oeZqxolww1N55Ptvw6'];
  const isActualAdmin = (clerkUser && hardcodedAdmins.includes(clerkUser.id) && !impersonatedUser) || (userProfile?.role === 'ADMIN' && !impersonatedUser);

  const canViewItem = (item: any) => {
    if (item.roles.includes('*')) return true;
    if (isActualAdmin) return true;
    if (item.screenIds) {
      return item.screenIds.some((id: string) => userRolePermissions.find((p: any) => p.screen_id === id)?.can_view);
    }
    const perm = userRolePermissions.find((p: any) => p.screen_id === item.screenId);
    return perm?.can_view;
  };

  const filteredNavItems = navItems.filter(canViewItem);
  const filteredMaterialityChildren = materialityChildren.filter(canViewItem);

  // Auto-expand cuando la ruta actual es un child de materialidad
  const isOnMaterialityChild = materialityChildPaths.some(p => location.pathname.startsWith(p));
  if (isOnMaterialityChild && !materialityOpen) setMaterialityOpen(true);

  // Nuclear Protection: Si estamos cargando Clerk, o TENEMOS usuario pero la sesión AÚN NO está lista, BLOQUEAR renderizado.
  if (!isLoaded || (clerkUser && !sessionReady)) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: 'white' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="animate-spin rounded-full h-11 w-11 border-b-2 border-cyan-500"></div>
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', justifyContent: 'center' }} className="group cursor-default hover:-translate-y-0.5 transition-transform duration-300">
                  <div className="flex items-center justify-center">
                    <img src="/escudo.png" alt="Escudo de Seguridad" className="drop-shadow-[0_0_15px_rgba(251,191,36,0.9)] animate-pulse object-contain" style={{ width: '90px', height: '90px', animationDuration: '3s' }} />
                  </div>
                  <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                      <span className="text-sm md:text-base font-black text-slate-500 tracking-[0.65em] md:tracking-[0.65em] uppercase -mb-1" style={{ transition: 'color 0.5s', zIndex: 10 }}>
                          FISCERTA B2B
                      </span>
                      <div className="text-4xl md:text-5xl flex items-center justify-center lg:justify-start gap-1.5 tracking-tighter drop-shadow-xl group-hover:drop-shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all mt-0">
                          <span className="font-bold text-slate-100"><TextGlitch text="Materialidad" /></span>
                          <span style={{ color: 'var(--primary-base)' }} className="font-mono font-normal"><TextGlitch text="Fiscal" /></span>
                      </div>
                  </div>
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '16px', marginBottom: '10px' }}>Bienvenido al sistema de cumplimiento forense corporativo.</p>
          <div className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <SignInButton mode="modal">
              <button className="premium-button flex items-center justify-center bg-cyan-600 hover:bg-cyan-500 text-white w-full rounded-lg" style={{ width: '280px', height: '45px', fontSize: '15px' }}>
                Acceder al Sistema
              </button>
            </SignInButton>
          </div>
          <div style={{ marginTop: '40px', fontSize: '12px', color: '#475569' }}>FISCERTA Materialidad Fiscal B2B - Advanced Compliance Architecture</div>
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
            className="notranslate border-b border-white/5 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between px-8"
            // @ts-ignore
            translate="no"
            style={{ height: '70px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }} className="group">
                  <div className="flex items-center justify-center">
                    <img src="/escudo.png" alt="Escudo de Seguridad" className="drop-shadow-[0_0_15px_rgba(251,191,36,0.9)] animate-pulse object-contain" style={{ width: '80px', height: '80px', animationDuration: '3s' }} />
                  </div>
                  <div className="flex flex-col cursor-default">
                      <span className="text-xs md:text-sm font-black text-slate-500 tracking-[0.65em] md:tracking-[0.65em] uppercase -mb-1" style={{ transition: 'color 0.5s', zIndex: 10 }}>
                          FISCERTA B2B
                      </span>
                  <div className="text-3xl md:text-4xl flex items-center gap-1.5 tracking-tighter drop-shadow-[0_0_8px_rgba(255,255,255,0.1)] group-hover:drop-shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all mt-0">
                      <span className="font-black text-slate-100"><TextGlitch text="Materialidad" /></span>
                      <span style={{ color: 'var(--primary-base)' }} className="font-mono font-normal"><TextGlitch text="Fiscal" /></span>
                  </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <SignedIn>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {!impersonatedUser && selectedOrg && (
                    <div style={{ width: '86px', height: '86px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {selectedOrg?.logo_url ? (
                          <img src={selectedOrg.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'contrast(1.2) invert(1) hue-rotate(180deg) brightness(1.5)', mixBlendMode: 'screen' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '20px', color: 'var(--primary-color)' }}>B2B</div>
                        )}
                    </div>
                  )}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>
                      <CurrentUserDetails />
                    </div>
                    <div style={{ color: impersonatedUser ? '#ef4444' : '#64748b', fontSize: '12px', fontWeight: impersonatedUser ? 'bold' : 'normal' }}>
                      {impersonatedUser ? `Suplantando a: ${impersonatedUser.full_name}` : (selectedOrg?.name || 'Administrador')}
                    </div>
                  </div>
                </div>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: {
                        width: '44px',
                        height: '44px',
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
              className="notranslate w-[260px] border-r border-white/5 p-6 flex flex-col gap-1 bg-slate-950/50 backdrop-blur-md"
              // @ts-ignore
              translate="no"
            >
              {filteredNavItems.map(item => {
                const isActive = location.pathname === item.path || (item.isParent && isOnMaterialityChild);
                const linkStyle = {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: isActive ? 'white' : '#94a3b8',
                  backgroundColor: isActive ? 'var(--primary-glow)' : 'transparent',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  textDecoration: 'none' as const,
                  transition: 'all 0.2s ease',
                  fontWeight: isActive ? '600' : '400',
                  border: isActive ? '1px solid var(--primary-glow)' : '1px solid transparent',
                  minHeight: '44px'
                };

                if (item.isParent) {
                  return (
                    <div key={item.path}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Link to={item.path} style={{ ...linkStyle, flex: 1 }}>
                          <item.icon size={18} color={isActive ? 'var(--primary-base)' : '#94a3b8'} style={{ transition: 'color 0.5s' }} />
                          <span>{item.label}</span>
                        </Link>
                        <button
                          onClick={() => setMaterialityOpen(!materialityOpen)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                        >
                          <ChevronDown size={16} style={{ transform: materialityOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s ease' }} />
                        </button>
                      </div>
                      {materialityOpen && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                          {filteredMaterialityChildren.map(child => {
                            const childActive = location.pathname.startsWith(child.path);
                            return (
                              <Link
                                key={child.path}
                                to={child.path}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  color: childActive ? 'white' : '#64748b',
                                  backgroundColor: childActive ? 'rgba(var(--primary-rgb, 6,182,212), 0.1)' : 'transparent',
                                  padding: '10px 16px 10px 44px',
                                  borderRadius: '8px',
                                  textDecoration: 'none',
                                  transition: 'all 0.2s ease',
                                  fontWeight: childActive ? '600' : '400',
                                  fontSize: '13px',
                                  minHeight: '36px',
                                  borderLeft: childActive ? '2px solid var(--primary-base)' : '2px solid transparent'
                                }}
                              >
                                <child.icon size={15} color={childActive ? 'var(--primary-base)' : '#64748b'} style={{ transition: 'color 0.5s' }} />
                                <span>{child.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <Link key={item.path} to={item.path} style={linkStyle}>
                    <item.icon size={18} color={location.pathname === item.path ? 'var(--primary-base)' : '#94a3b8'} style={{ transition: 'color 0.5s' }} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

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

            <main className="flex-1 overflow-y-auto p-10 relative bg-slate-950">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
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
                <Route path="/materialidad" element={<MaterialityBoard selectedOrg={selectedOrg} userProfile={userProfile} />} />
                <Route path="/materialidad/:id" element={<MaterialityBoard selectedOrg={selectedOrg} userProfile={userProfile} />} />
                <Route path="/cotizaciones" element={<QuotationRequests selectedOrg={selectedOrg} />} />
                <Route path="/cotizaciones/:id" element={<QuotationRequests selectedOrg={selectedOrg} />} />
                <Route path="/importacion" element={<FileImport currentUser={userProfile} selectedOrg={selectedOrg} />} />
                <Route path="/ordenes-compra" element={<PurchaseOrderRequests selectedOrg={selectedOrg} />} />
                <Route path="/proformas/:id" element={<ProformaManager selectedOrg={selectedOrg} />} />
                <Route path="/proformas/nueva" element={<ProformaManager selectedOrg={selectedOrg} />} />
                <Route path="/facturas" element={<Invoices userProfile={userProfile} selectedOrg={selectedOrg} />} />
                <Route path="/facturas/:id" element={<Invoices userProfile={userProfile} selectedOrg={selectedOrg} />} />
                <Route path="/pagos" element={<Pagos selectedOrg={selectedOrg} />} />
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
              --primary-base: #06b6d4;
              --primary-light: rgba(6, 182, 212, 0.1);
              --primary-glow: rgba(6, 182, 212, 0.15);
              --accent-color: #22d3ee;
              --neutro-oscuro: #f8fafc;
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
                background: rgba(10, 15, 29, 0.4);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 16px;
                padding: 24px;
                transition: transform 0.2s ease, border-color 0.2s ease;
            }
            .glass-card:hover { border-color: rgba(6, 182, 212, 0.3); }
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
                border: 1px solid rgba(255, 255, 255, 0.1);
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
