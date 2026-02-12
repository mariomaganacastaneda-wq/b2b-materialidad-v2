import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard,
  FileText,
  FileCheck,
  Image as ImageIcon,
  BarChart3,
  Settings,
  LogOut,
  CheckCircle2,
  Building2,
  Palette,
  Upload
} from 'lucide-react';

import SATCatalogsPage from './pages/SATCatalogs';
import { LayoutGrid } from 'lucide-react';

// Supabase Connection
const SUPABASE_URL = 'https://ywovtkubsanalddsdedi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4TZm-phlmGg4Hu-IA_Weqg_IkhwANh1';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- THEME ENGINE ---
/**
 * Custom hook to apply organization-specific branding colors and logo as CSS variables.
 * Supports primary, secondary, and accent colors.
 */
const useTheme = (org: any) => {
  useEffect(() => {
    if (org) {
      const primaryBase = org.primary_color || '#6366f1';
      const primaryLight = org.theme_config?.primary_light || `${primaryBase}1a`;
      const accent = org.theme_config?.accent_color || '#818cf8';
      const neutroOscuro = org.theme_config?.neutro_oscuro || '#ffffff';
      const neutroClaro = org.theme_config?.neutro_claro || '#020617';

      const success = org.theme_config?.color_success || '#10b981';
      const error = org.theme_config?.color_error || '#ef4444';
      const warning = org.theme_config?.color_warning || '#f59e0b';

      document.documentElement.style.setProperty('--primary-base', primaryBase);
      document.documentElement.style.setProperty('--primary-light', primaryLight);
      document.documentElement.style.setProperty('--primary-glow', `${primaryBase}4d`);
      document.documentElement.style.setProperty('--accent-color', accent);
      document.documentElement.style.setProperty('--neutro-oscuro', neutroOscuro);
      document.documentElement.style.setProperty('--neutro-claro', neutroClaro);
      document.documentElement.style.setProperty('--color-success', success);
      document.documentElement.style.setProperty('--color-error', error);
      document.documentElement.style.setProperty('--color-warning', warning);

      // Retrocompatibilidad
      document.documentElement.style.setProperty('--primary-color', primaryBase);

      if (org.logo_url) {
        document.documentElement.style.setProperty('--logo-url', `url(${org.logo_url})`);
      } else {
        document.documentElement.style.setProperty('--logo-url', 'none');
      }
    }
  }, [org]);
};

// Diagnostic Header
const DiagnosticBar = () => {
  const [conn, setConn] = useState('Probando...');
  const [stats, setStats] = useState({ q: 0, i: 0 });

  useEffect(() => {
    const check = async () => {
      const { error } = await supabase.from('organizations').select('*', { count: 'exact', head: true });
      if (error) setConn('Error: ' + error.message);
      else {
        setConn(`Conectado a Supabase Cloud`);
        const { count: q } = await supabase.from('quotations').select('*', { count: 'exact', head: true });
        const { count: i } = await supabase.from('invoices').select('*', { count: 'exact', head: true });
        setStats({ q: q || 0, i: i || 0 });
      }
    };
    check();
  }, []);

  return (
    <div style={{ backgroundColor: '#1e1b4b', color: '#818cf8', padding: '6px 20px', fontSize: '11px', textAlign: 'center', borderBottom: '1px solid #312e81', display: 'flex', justifyContent: 'center', gap: '20px' }}>
      <span>● {conn}</span>
      <span style={{ color: '#4ade80' }}>● {stats.q} Cotizaciones</span>
      <span style={{ color: '#60a5fa' }}>● {stats.i} Facturas</span>
    </div>
  );
};

// Helper for date formatting DD-MM-AA
const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
};

// --- PAGES ---

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
                {compliance.filter(c => c.status_compliance !== 'VALID').length > 0 ? (
                  compliance.filter(c => c.status_compliance !== 'VALID').map(c => (
                    <div key={c.id} style={{ fontSize: '12px', color: getComplianceColor(c.status_compliance), fontWeight: '600' }}>
                      ⚠ {c.name}: {c.status_compliance === 'EXPIRED' ? 'Expirada' : 'Pronta a vencer'}
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
            {data?.map((q: any) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const QuotationsPage = () => {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('quotations').select('*').then(({ data }) => setList(data || []));
  }, []);

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>Cotizaciones</h1>
        <button className="primary-button">+ Nueva Cotización</button>
      </div>
      <div className="glass-card" style={{ padding: 0 }}>
        {list.length === 0 ? <p style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No se encontraron registros activos.</p> :
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '15px' }}>ID</th>
                <th style={{ padding: '15px' }}>Concepto</th>
                <th style={{ padding: '15px', textAlign: 'right' }}>Total</th>
                <th style={{ padding: '15px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map((q: any) => (
                <tr key={q.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '15px', color: '#818cf8' }}>#{q.consecutive_id}</td>
                  <td style={{ padding: '15px' }}>{q.description || 'Suministro de Materiales'}</td>
                  <td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold' }}>${q.amount_total?.toLocaleString()}</td>
                  <td style={{ padding: '15px' }}><button style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '4px 8px', borderRadius: '4px' }}>Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>}
      </div>
    </div>
  );
};

const InvoicesPage = () => {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('invoices').select('*').then(({ data }) => setList(data || []));
  }, []);

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '24px' }}>Facturación</h1>
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
    </div>
  );
};

// --- SETTINGS PAGE COMPONENT ---
const SettingsPage = ({ orgs, setOrgs, selectedOrg, setSelectedOrg }: any) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [regimes, setRegimes] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [csfHistory, setCsfHistory] = useState<any[]>([]);
  const [activityProducts, setActivityProducts] = useState<{ [key: string]: any[] }>({});
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('empresa');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Local state for color inputs
  const [colorValue, setColorValue] = useState('#6366f1');
  const [secondaryColor, setSecondaryColor] = useState('#94a3b8');
  const [accentColor, setAccentColor] = useState('#818cf8');

  useEffect(() => {
    if (selectedOrg) {
      setColorValue(selectedOrg.primary_color || '#6366f1');
      setSecondaryColor(selectedOrg.theme_config?.secondary_color || '#94a3b8');
      setAccentColor(selectedOrg.theme_config?.accent_color || '#818cf8');
    }
  }, [selectedOrg]);

  /**
   * Universal color handler supporting the tricolor hierarchy.
   */
  const handleColorChange = async (type: 'primary' | 'secondary' | 'accent', color: string) => {
    if (!selectedOrg) return;

    let updates: any = {};
    let newOrg = { ...selectedOrg };

    if (type === 'primary') {
      setColorValue(color);
      updates.primary_color = color;
      newOrg.primary_color = color;
    } else {
      const newConfig = {
        ...(selectedOrg.theme_config || {}),
        [type === 'secondary' ? 'secondary_color' : 'accent_color']: color
      };
      updates.theme_config = newConfig;
      newOrg.theme_config = newConfig;
      if (type === 'secondary') setSecondaryColor(color);
      else setAccentColor(color);
    }

    const { error } = await supabase.from('organizations').update(updates).eq('id', selectedOrg.id);
    if (error) console.error('Error updating color:', error);
    else {
      setSelectedOrg(newOrg);
      setOrgs(orgs.map((o: any) => o.id === newOrg.id ? newOrg : o));
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedOrg) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${selectedOrg.rfc}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const logoUrl = `https://ywovtkubsanalddsdedi.supabase.co/storage/v1/object/public/logos/${filePath}`;

      const { error: updateError } = await supabase
        .from('organizations')
        .update({ logo_url: logoUrl })
        .eq('id', selectedOrg.id);

      if (updateError) throw updateError;

      const updated = { ...selectedOrg, logo_url: logoUrl };
      setSelectedOrg(updated);
      setOrgs(orgs.map((o: any) => o.id === updated.id ? updated : o));
      alert('Logo actualizado correctamente');
    } catch (err: any) {
      alert('Error subiendo logo: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const loadSupplementalData = async (orgId: string) => {
    const { data: act } = await supabase.from('organization_activities').select('*').eq('organization_id', orgId).order('activity_order');
    const { data: reg } = await supabase.from('organization_regimes').select('*').eq('organization_id', orgId);
    const { data: obl } = await supabase.from('organization_obligations').select('*').eq('organization_id', orgId);
    const { data: hist } = await supabase.from('organization_csf_history').select('*').eq('organization_id', orgId).order('emission_date', { ascending: false });

    setActivities(act || []);
    setRegimes(reg || []);
    setObligations(obl || []);
    setCsfHistory(hist || []);
    setActivityProducts({}); // Reset products mapping
  };

  const toggleActivityExpansion = async (activityCode: string) => {
    if (expandedActivity === activityCode) {
      setExpandedActivity(null);
      return;
    }

    setExpandedActivity(activityCode);

    // If products for this activity aren't loaded, fetch them
    if (!activityProducts[activityCode]) {
      const { data } = await supabase
        .from('rel_activity_product')
        .select('product_code, cat_cfdi_productos_servicios(name)')
        .eq('activity_code', activityCode)
        .eq('verification_status', 'suggested')
        .limit(15);

      if (data) {
        setActivityProducts(prev => ({
          ...prev,
          [activityCode]: data.map((item: any) => ({
            code: item.product_code,
            name: item.cat_cfdi_productos_servicios?.name
          }))
        }));
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedOrg && !isCreatingNew) {
      alert('⚠️ ERROR: Seleccione una empresa o pulse "+ Registrar Empresa" antes de subir.');
      if (event.target) event.target.value = '';
      return;
    }

    try {
      setUploading(true);
      if (file.type !== 'application/pdf') throw new Error('Solo se permiten archivos PDF.');
      const filename = file.name.toUpperCase();
      const extractedRFC = filename.match(/[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/)?.[0];

      const monthsMap: { [key: string]: string } = {
        'ENE': '01', 'FEB': '02', 'MAR': '03', 'ABR': '04', 'MAY': '05', 'JUN': '06',
        'JUL': '07', 'AGO': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DIC': '12'
      };

      let extractedDate = new Date().toISOString().split('T')[0];
      const dateMatch = filename.match(/(\d{1,2})\s*([A-Z]{3})\s*(\d{4})/);
      if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        const month = monthsMap[dateMatch[2]];
        const year = dateMatch[3];
        if (month) extractedDate = `${year}-${month}-${day}`;
      }

      let tempOrgIdForDuplicate: string | null = null;
      if (isCreatingNew) {
        if (extractedRFC) {
          const duplicate = orgs.find((o: any) => o.rfc === extractedRFC);
          if (duplicate) {
            console.log(`RFC ${extractedRFC} detectado. Cambiando a modo actualización automática.`);
            tempOrgIdForDuplicate = duplicate.id;
          }
        }
      }

      const currentRFC = isCreatingNew ? (extractedRFC || 'CSF_NUEVO') : (selectedOrg?.rfc || 'CSF_UPDATE');
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentRFC}_${extractedDate.replace(/-/g, '')}.${fileExt}`;
      const filePath = `${fileName}`;

      await supabase.storage.from('csf').upload(filePath, file, { upsert: true });

      console.log('Invocando Edge Function process-csf...');
      const { data: extractionRes, error: invokeError } = await supabase.functions.invoke('process-csf', {
        body: { filePath, organizationId: selectedOrg?.id, isCreatingNew }
      });

      if (invokeError) {
        console.error('Error de invocación:', invokeError);
        throw new Error(`Fallo en la comunicación con el servidor: ${invokeError.message}`);
      }

      if (extractionRes?.success === false) {
        throw new Error(extractionRes.error || 'Error desconocido en el procesamiento del CSF.');
      }

      console.log('Respuesta de extracción:', extractionRes);

      let targetOrgId = selectedOrg?.id || tempOrgIdForDuplicate;

      if (isCreatingNew && !tempOrgIdForDuplicate) {
        if (!extractionRes?.success) {
          const { data: newOrg, error: createError } = await supabase.from('organizations').insert({
            name: prompt(`Confirme nombre para:`, extractedRFC) || extractedRFC,
            rfc: extractedRFC,
            csf_file_url: `${SUPABASE_URL}/storage/v1/object/public/csf/${filePath}`,
            csf_emission_date: extractedDate,
            primary_color: '#6366f1'
          }).select().single();
          if (createError) throw createError;
          targetOrgId = newOrg.id;
        } else {
          targetOrgId = extractionRes.data.orgId;
        }
      }

      // Refresh organizations and the selected one
      const { data: refreshedOrgs } = await supabase.from('organizations').select('*').order('name');
      if (refreshedOrgs) {
        setOrgs(refreshedOrgs);
        const updated = refreshedOrgs.find((o: any) => o.id === targetOrgId);
        if (updated) setSelectedOrg(updated);
      }

      setIsCreatingNew(false);

      if (targetOrgId) await loadSupplementalData(targetOrgId);
      alert('✅ CSF Procesado con éxito. Los datos fiscales han sido actualizados.');
      if (event.target) event.target.value = '';
    } catch (error: any) {
      alert('❌ ERROR: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const loadInitData = async () => {
      setLoading(true);
      const { data: userData } = await supabase.from('profiles').select('*');
      setUsers(userData || []);
      if (selectedOrg) await loadSupplementalData(selectedOrg.id);
      setLoading(false);
    };
    loadInitData();
  }, [selectedOrg]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando configuraciones...</div>;

  const csfStatus = selectedOrg ? (() => {
    if (!selectedOrg.csf_emission_date) return { label: 'Sin Datos', color: '#94a3b8' };
    const emission = new Date(selectedOrg.csf_emission_date);
    const now = new Date();
    const expiration = new Date(emission);
    expiration.setMonth(expiration.getMonth() + 1);
    if (now > expiration) return { label: 'EXPIRADO', color: '#ef4444' };
    const warningDate = new Date(expiration);
    warningDate.setDate(warningDate.getDate() - 7);
    if (now > warningDate) return { label: 'Expira Pronto', color: '#f59e0b' };
    return { label: 'Vigente', color: '#10b981' };
  })() : null;

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '24px' }}>Configuración del Sistema</h1>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '32px' }}>
        <button onClick={() => { setActiveTab('empresa'); setIsCreatingNew(false); }} className={`tab-button ${activeTab === 'empresa' ? 'active' : ''}`}>Empresas</button>
        <button onClick={() => setActiveTab('usuarios')} className={`tab-button ${activeTab === 'usuarios' ? 'active' : ''}`}>Usuarios</button>
      </div>

      {activeTab === 'empresa' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '32px' }}>
          <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--primary-color)' }}>Organizaciones</h3>
              <button onClick={() => { setIsCreatingNew(true); setSelectedOrg(null); }} className="secondary-button" style={{ fontSize: '11px', padding: '6px 12px' }}>+ Registrar Empresa</button>
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {orgs.map((org: any) => (
                <div key={org.id} onClick={() => setSelectedOrg(org)} style={{ padding: '16px 20px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.02)', backgroundColor: selectedOrg?.id === org.id ? 'var(--primary-glow)' : 'transparent', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: org.primary_color || '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {org.logo_url ? <img src={org.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : org.rfc?.substring(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: selectedOrg?.id === org.id ? 'white' : '#cbd5e1' }}>{org.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{org.rfc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {selectedOrg || isCreatingNew ? (
              <div className="glass-card fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>{isCreatingNew ? 'Registrar Empresa (Suba CSF)' : selectedOrg?.name}</h3>
                    {selectedOrg?.taxpayer_type && (
                      <span style={{ fontSize: '10px', backgroundColor: selectedOrg.taxpayer_type === 'persona_fisica' ? '#0ea5e91a' : '#10b9811a', color: selectedOrg.taxpayer_type === 'persona_fisica' ? '#0ea5e9' : '#10b981', padding: '2px 8px', borderRadius: '4px', border: '1px solid currentColor', textTransform: 'uppercase', fontWeight: 'bold' }}>
                        {selectedOrg.taxpayer_type === 'persona_fisica' ? 'Persona Física' : 'Persona Moral'}
                      </span>
                    )}
                  </div>
                  {csfStatus && (
                    <span style={{ fontSize: '11px', color: csfStatus.color, fontWeight: 'bold', padding: '4px 8px', backgroundColor: `${csfStatus.color}1a`, borderRadius: '4px' }}>
                      ● {csfStatus.label}
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div className="input-group">
                    <label>RFC</label>
                    <input type="text" value={selectedOrg?.rfc || ''} readOnly placeholder="Automático vía CSF" />
                  </div>
                  <div className="input-group">
                    <label>Emisión CSF</label>
                    <input type="text" value={formatDate(selectedOrg?.csf_emission_date)} readOnly />
                  </div>
                </div>

                <div style={{ marginTop: '24px', padding: '20px', border: '1px dashed #334155', borderRadius: '12px', textAlign: 'center' }}>
                  <input type="file" id="csf-upload" accept="application/pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
                  <label htmlFor="csf-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <Upload size={32} color="var(--primary-color)" />
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{uploading ? 'Procesando CSF...' : isCreatingNew ? 'Subir CSF para crear Empresa' : 'Actualizar CSF'}</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Se extraerán actividades, regímenes y domicilio automáticamente.</span>
                  </label>
                </div>

                {selectedOrg?.csf_file_url && (
                  <div style={{ marginTop: '12px', textAlign: 'center' }}>
                    <a href={selectedOrg.csf_file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--primary-color)', fontWeight: '600', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <FileText size={14} /> Ver Constancia Actual (PDF)
                    </a>
                  </div>
                )}

                {selectedOrg && (
                  <div style={{ marginTop: '32px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
                    <h4 style={{ fontSize: '14px', color: '#818cf8', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Palette size={16} /> Identidad Visual
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '32px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>Logo</label>
                        <div style={{ width: '100px', height: '100px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                          {selectedOrg.logo_url ? <img src={selectedOrg.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <ImageIcon size={32} color="#1e293b" />}
                          <input type="file" id="logo-setting" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                          <label htmlFor="logo-setting" style={{ position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '10px', padding: '4px', textAlign: 'center', cursor: 'pointer' }}>Cambiar</label>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: '#94a3b8' }}>Primario</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="color" value={colorValue} onChange={(e) => handleColorChange('primary', e.target.value)} style={{ width: '32px', height: '32px', border: 'none', borderRadius: '4px', padding: '0', backgroundColor: 'transparent', cursor: 'pointer' }} />
                            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{colorValue}</span>
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#94a3b8' }}>Secundario</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="color" value={secondaryColor} onChange={(e) => handleColorChange('secondary', e.target.value)} style={{ width: '32px', height: '32px', border: 'none', borderRadius: '4px', padding: '0', backgroundColor: 'transparent', cursor: 'pointer' }} />
                            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{secondaryColor}</span>
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#94a3b8' }}>Acento</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="color" value={accentColor} onChange={(e) => handleColorChange('accent', e.target.value)} style={{ width: '32px', height: '32px', border: 'none', borderRadius: '4px', padding: '0', backgroundColor: 'transparent', cursor: 'pointer' }} />
                            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{accentColor}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-card" style={{ padding: '80px', textAlign: 'center', opacity: 0.3 }}>
                <Building2 size={48} style={{ margin: '0 auto 16px' }} />
                <p>Seleccione una organización para administrar</p>
              </div>
            )}

            {selectedOrg && activeTab === 'empresa' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div className="glass-card fade-in">
                    <h4 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Identificación del Contribuyente</span>
                      <span style={{ color: selectedOrg.tax_status?.includes('ACTIVO') ? '#10b981' : '#f59e0b', fontSize: '12px', fontWeight: 'bold' }}>
                        {selectedOrg.tax_status || 'ESTATUS NO IDENTIFICADO'}
                      </span>
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      {/* Persona Física vs Moral - Header Area */}
                      <div style={{ gridColumn: '1 / -1', marginBottom: '4px' }}>
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>
                          {selectedOrg.taxpayer_type === 'PERSONA FÍSICA' ? 'Nombre Completo' : 'Denominación / Razón Social'}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary-base)' }}>
                          {selectedOrg.name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px', fontWeight: '600' }}>
                          {selectedOrg.taxpayer_type}
                        </div>
                      </div>

                      <div className="detail-item">
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>RFC</div>
                        <div style={{ fontSize: '13px', fontWeight: '700' }}>{selectedOrg.rfc}</div>
                      </div>

                      <div className="detail-item">
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>CURP</div>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{selectedOrg.curp || 'N/A'}</div>
                      </div>

                      {selectedOrg.taxpayer_type === 'PERSONA FÍSICA' ? (
                        <>
                          <div className="detail-item">
                            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Nombre (s)</div>
                            <div style={{ fontSize: '12px', fontWeight: '600' }}>{selectedOrg.first_name || '-'}</div>
                          </div>
                          <div className="detail-item">
                            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Primer Apellido</div>
                            <div style={{ fontSize: '12px', fontWeight: '600' }}>{selectedOrg.last_name_1 || '-'}</div>
                          </div>
                          <div className="detail-item">
                            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Segundo Apellido</div>
                            <div style={{ fontSize: '12px', fontWeight: '600' }}>{selectedOrg.last_name_2 || '-'}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="detail-item">
                            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Régimen Capital</div>
                            <div style={{ fontSize: '12px', fontWeight: '600' }}>{selectedOrg.capital_regime || 'No aplica'}</div>
                          </div>
                          <div className="detail-item">
                            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>idCIF (Cédula)</div>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#6366f1' }}>{selectedOrg.cif_id || 'No disponible'}</div>
                          </div>
                          <div className="detail-item">
                            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Nombre Comercial</div>
                            <div style={{ fontSize: '12px', fontWeight: '600', fontStyle: 'italic' }}>{selectedOrg.commercial_name || 'No proporcionado'}</div>
                          </div>
                        </>
                      )}

                      <div className="detail-item">
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Inicio Operaciones</div>
                        <div style={{ fontSize: '12px', fontWeight: '600' }}>{formatDate(selectedOrg.operations_start_date)}</div>
                      </div>
                      <div className="detail-item">
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Último Cambio Estado</div>
                        <div style={{ fontSize: '12px', fontWeight: '600' }}>{formatDate(selectedOrg.last_status_change_date)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card fade-in">
                    <h4 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>Domicilio Fiscal Detallado</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Calle y Números</div>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>
                          {selectedOrg.vialidad_type} {selectedOrg.vialidad_name} #{selectedOrg.exterior_number} {selectedOrg.interior_number && `Int. ${selectedOrg.interior_number}`}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Colonia</div>
                        <div style={{ fontSize: '12px', fontWeight: '600' }}>{selectedOrg.colony}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Código Postal</div>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary-base)' }}>{selectedOrg.tax_domicile?.replace('CP: ', '')}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Municipio / Demarcación</div>
                        <div style={{ fontSize: '12px', fontWeight: '600' }}>{selectedOrg.municipality}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Entidad Federativa</div>
                        <div style={{ fontSize: '12px', fontWeight: '600' }}>{selectedOrg.state}</div>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Entre Calles</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                          {selectedOrg.between_street_1} y {selectedOrg.between_street_2}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-card fade-in" style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '12px', color: '#818cf8', marginBottom: '12px' }}>Actividades Económicas ({activities.length})</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {activities.map((a: any) => (
                      <div key={a.id} style={{ fontSize: '11px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', borderLeft: '3px solid var(--primary-color)', cursor: 'pointer' }} onClick={() => toggleActivityExpansion(a.activity_code)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontWeight: '600' }}>[{a.activity_code}] {a.description}</div>
                          <div style={{ fontSize: '10px', color: '#94a3b8' }}>{expandedActivity === a.activity_code ? '▲' : '▼'}</div>
                        </div>
                        <div style={{ color: '#94a3b8', marginTop: '2px' }}>Participación: {a.percentage}%</div>

                        {expandedActivity === a.activity_code && (
                          <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', gridColumn: '1 / -1' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ fontSize: '10px', color: 'var(--primary-base)', marginBottom: '8px', fontWeight: 'bold' }}>PRODUCTOS / SERVICIOS SUGERIDOS</div>
                            {activityProducts[a.activity_code] ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {activityProducts[a.activity_code].length > 0 ? activityProducts[a.activity_code].map((p: any) => (
                                  <div key={p.code} style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '4px' }}>
                                    <span style={{ color: 'var(--color-success)', fontFamily: 'monospace', fontSize: '10px' }}>{p.code}</span>
                                    <span style={{ color: '#cbd5e1', fontSize: '10px' }}>{p.name}</span>
                                  </div>
                                )) : <div style={{ color: '#64748b', fontSize: '10px', fontStyle: 'italic' }}>Sin mapeo técnico disponible</div>}
                              </div>
                            ) : (
                              <div style={{ fontSize: '10px', color: '#64748b' }}>Cargando recomendaciones...</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card fade-in" style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '12px', color: '#10b981', marginBottom: '12px' }}>Regímenes Fiscales ({regimes.length})</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {regimes.map((r: any) => (
                      <div key={r.id} style={{ fontSize: '11px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', borderLeft: '3px solid #10b981' }}>
                        <div style={{ fontWeight: '600' }}>{r.regime_name}</div>
                        <div style={{ color: '#94a3b8', marginTop: '2px', display: 'flex', gap: '10px' }}>
                          <span>Desde: {formatDate(r.start_date)}</span>
                          {r.end_date && <span style={{ color: '#f43f5e' }}>Hasta: {formatDate(r.end_date)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card fade-in" style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '12px', color: '#818cf8', marginBottom: '12px' }}>Obligaciones Fiscales ({obligations.length})</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {obligations.map((o: any) => (
                      <div key={o.id} style={{ fontSize: '10px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', borderLeft: '3px solid #818cf8' }}>
                        <div style={{ fontWeight: '600', marginBottom: '2px' }}>{o.description}</div>
                        <div style={{ color: '#64748b', fontSize: '9px', marginBottom: '4px' }}>{o.due_date_description}</div>
                        <div style={{ color: '#94a3b8', fontSize: '9px', display: 'flex', gap: '8px' }}>
                          <span>Inicio: {formatDate(o.start_date)}</span>
                          {o.end_date && <span style={{ color: '#f43f5e' }}>Fin: {formatDate(o.end_date)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card fade-in">
                  <h4 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>Historial de Documentos CSF</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #334155' }}>
                        <th style={{ padding: '8px' }}>Fecha Emisión</th>
                        <th style={{ padding: '8px' }}>Fecha Registro</th>
                        <th style={{ padding: '8px' }}>Enlace</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csfHistory.map((h: any) => (
                        <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '8px', fontWeight: 'bold' }}>{formatDate(h.emission_date)}</td>
                          <td style={{ padding: '8px' }}>{formatDate(h.created_at)}</td>
                          <td style={{ padding: '8px' }}>
                            <a href={h.file_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-base)', textDecoration: 'none' }}>Ver PDF</a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'usuarios' && (
        <div className="glass-card fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--primary-color)' }}>Directorio de Colaboradores</h3>
            <button className="secondary-button" disabled>+ Invitar Usuario</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <th style={{ padding: '12px' }}>Nombre</th>
                <th style={{ padding: '12px' }}>Correo</th>
                <th style={{ padding: '12px' }}>Rol</th>
                <th style={{ padding: '12px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '12px' }}>{u.full_name}</td>
                  <td style={{ padding: '12px', color: '#94a3b8' }}>{u.email}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ fontSize: '10px', background: u.role === 'ADMIN' ? '#4c1d95' : '#1e293b', color: u.role === 'ADMIN' ? '#c084fc' : '#94a3b8', padding: '2px 8px', borderRadius: '4px' }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px' }}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const PlaceholderPage = ({ title }: { title: string }) => (
  <div style={{ padding: '100px', textAlign: 'center', opacity: 0.5 }}>
    <ImageIcon size={64} style={{ marginBottom: '20px', margin: '0 auto' }} />
    <h1 style={{ fontSize: '24px' }}>{title}</h1>
    <p>Módulo en desarrollo para SEIDCO V1.2</p>
  </div>
);

// --- MAIN LAYOUT ---

export function App() {
  const location = useLocation();
  const [orgs, setOrgs] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);

  // Apply organization branding dynamically
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
    { label: 'Cotizaciones', path: '/cotizaciones', icon: FileText },
    { label: 'Facturación', path: '/facturas', icon: FileCheck },
    { label: 'Catálogos SAT', path: '/catalogos-sat', icon: LayoutGrid },
    { label: 'Evidencia', path: '/evidencia', icon: ImageIcon },
    { label: 'Reportes', path: '/reportes', icon: BarChart3 },
    { label: 'Configuración', path: '/settings', icon: Settings },
  ];

  return (
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
            <div style={{ fontWeight: '600', fontSize: '14px' }}>Mario Magaña</div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>{selectedOrg?.name || 'Administrador'}</div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#1e293b', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--primary-base)', transition: 'color 0.5s' }}>M</div>
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

        <main style={{ flex: 1, overflowY: 'auto', padding: '40px', background: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.05), transparent)' }}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/cotizaciones" element={<QuotationsPage />} />
            <Route path="/facturas" element={<InvoicesPage />} />
            <Route path="/catalogos-sat" element={<SATCatalogsPage />} />
            <Route path="/evidencia" element={<PlaceholderPage title="Evidencia Fotográfica" />} />
            <Route path="/reportes" element={<PlaceholderPage title="Generador de Reportes" />} />
            <Route path="/settings" element={<SettingsPage orgs={orgs} setOrgs={setOrgs} selectedOrg={selectedOrg} setSelectedOrg={setSelectedOrg} />} />
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
              /* Keep for compat */
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
  );
}

export default function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  );
}
