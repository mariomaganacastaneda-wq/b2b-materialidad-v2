import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  FileCheck,
  LayoutGrid,
  Settings,
  LogOut,
  ImageIcon,
  BarChart3,
  FileEdit,
  CheckCircle2
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
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
import { SettingsPage } from './components/settings/SettingsPage';
import SATCatalogsPage from './pages/SATCatalogs';

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
const DiagnosticBar = () => {
  const [conn, setConn] = useState('Probando...');
  const [stats, setStats] = useState({ q: 0, i: 0 });

  useEffect(() => {
    const check = async () => {
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

const InvoicesPage = () => {
  const { id } = useParams();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      setLoading(true);
      let query = supabase.from('invoices').select('*');
      if (id) {
        query = query.eq('quotation_id', id);
      }
      const { data } = await query;
      setList(data || []);
      setLoading(false);
    };
    fetchInvoices();
  }, [id]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando facturas...</div>;

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '24px' }}>
        {id ? 'Facturas de la Cotización' : 'Facturación General'}
      </h1>
      {list.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px', opacity: 0.7 }}>
          <p>No se encontraron facturas {id ? 'para esta cotización' : ''}.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {list.map((i: any) => (
            <div key={i.id} className="glass-card">
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Folio SAT: {i.sat_uuid || 'PENDIENTE'}</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>{i.internal_number}</div>
              <div style={{ fontSize: '24px', color: '#10b981', fontWeight: 'bold', marginBottom: '16px' }}>${i.amount_total?.toLocaleString()}</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ fontSize: '10px', background: '#064e3b', color: '#34d399', padding: '2px 8px', borderRadius: '4px' }}>{i.status}</span>
                <span style={{ fontSize: '10px', background: '#1e293b', color: '#94a3b8', padding: '2px 8px', borderRadius: '4px' }}>CFDI 4.0</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DashboardPage = () => {
  const [data, setData] = useState<any>(null);
  const [compliance, setCompliance] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('quotations').select('*').limit(5).then(({ data }) => setData(data));
    supabase.from('v_organizations_csf_status').select('*').limit(10).then(({ data }) => setCompliance(data || []));
  }, []);

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
  const { getToken } = useAuth();

  useEffect(() => {
    const syncToken = async () => {
      try {
        const token = await getToken({ template: 'supabase' });
        if (token) {
          // @ts-ignore
          supabase.realtime.setAuth(token);
          supabase.auth.setSession({ access_token: token, refresh_token: '' });
        }
      } catch (e) {
        console.error('Clerk-Supabase Auth Sync Error:', e);
      }
    };
    syncToken();
  }, [getToken]);

  // Hook de sincronización de perfil
  const { user: clerkUser, isLoaded } = useUser();
  useEffect(() => {
    const syncProfile = async () => {
      if (!isLoaded || !clerkUser) return;

      try {
        const email = clerkUser.primaryEmailAddress?.emailAddress;
        if (!email) return;

        // Verificar si existe el perfil
        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', clerkUser.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error verificando perfil:', fetchError);
          return;
        }

        if (!profile) {
          console.log('Sincronizando nuevo usuario Clerk -> Supabase:', email);

          // Obtener una organización por defecto si es necesario
          const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
          const defaultOrgId = orgs?.[0]?.id;

          const { error: insertError } = await supabase.from('profiles').insert({
            id: clerkUser.id,
            email: email,
            full_name: clerkUser.fullName || 'Usuario Nuevo',
            role: 'VENDEDOR', // Rol por defecto
            organization_id: defaultOrgId,
            notification_prefered_channels: ['EMAIL']
          });

          if (insertError) {
            console.error('Error creando perfil:', insertError);
          }
        }
      } catch (err) {
        console.error('Profil Sync Exception:', err);
      }
    };

    syncProfile();
  }, [clerkUser, isLoaded]);

  useTheme(selectedOrg);

  useEffect(() => {
    const loadInit = async () => {
      const { data } = await supabase.from('organizations').select('*').order('name');
      if (data && data.length > 0) {
        setOrgs(data);
        setSelectedOrg(data[0]);
      }
    };
    loadInit();
  }, []);

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Materialidad', path: '/materialidad', icon: LayoutDashboard },
    { label: 'Cotizaciones', path: '/cotizaciones', icon: FileText },
    { label: 'Proformas', path: '/proformas', icon: FileEdit },
    { label: 'Facturación', path: '/facturas', icon: FileCheck },
    { label: 'Catálogos SAT', path: '/catalogos-sat', icon: LayoutGrid },
    { label: 'Evidencia', path: '/evidencia', icon: ImageIcon },
    { label: 'Reportes', path: '/reportes', icon: BarChart3 },
    { label: 'Configuración', path: '/settings', icon: Settings },
  ];

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
          <DiagnosticBar />

          <header style={{ height: '70px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between', backgroundColor: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 100 }}>
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
                  <div style={{ color: '#64748b', fontSize: '12px' }}>{selectedOrg?.name || 'Administrador'}</div>
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
            <aside style={{ width: '260px', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'var(--neutro-claro)' }}>
              {navItems.map(item => (
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
                <button style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', background: 'none', border: 'none', color: '#f87171', padding: '12px 16px', cursor: 'pointer', textAlign: 'left', fontSize: '14px' }}>
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
                <Route path="/" element={<DashboardPage />} />
                <Route path="/materialidad" element={<MaterialityBoard selectedOrg={selectedOrg} />} />
                <Route path="/cotizaciones" element={<PlaceholderPage title="Gestor de Cotizaciones" />} />
                <Route path="/cotizaciones/:id" element={<ProformaManager selectedOrg={selectedOrg} />} />
                <Route path="/proformas" element={<ProformaManager selectedOrg={selectedOrg} />} />
                <Route path="/proformas/:id" element={<ProformaManager selectedOrg={selectedOrg} />} />
                <Route path="/cotizaciones/nueva" element={<ProformaManager selectedOrg={selectedOrg} />} />
                <Route path="/facturas" element={<InvoicesPage />} />
                <Route path="/facturas/:id" element={<InvoicesPage />} />
                <Route path="/catalogos-sat" element={<SATCatalogsPage />} />
                <Route path="/evidencia" element={<PlaceholderPage title="Evidencia Fotográfica" />} />
                <Route path="/evidencia/:id" element={<PlaceholderPage title="Evidencia Fotográfica" />} />
                <Route path="/reportes" element={<PlaceholderPage title="Generador de Reportes" />} />
                <Route path="/settings" element={<SettingsPage orgs={orgs} setOrgs={setOrgs} selectedOrg={selectedOrg} setSelectedOrg={setSelectedOrg} supabase={supabase} />} />
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
      </SignedIn>
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
/ /   T r i g g e r   V e r c e l   B u i l d  
 