import React, { useState } from 'react';
import {
    Building2, ChevronUp, ChevronDown, History,
    LayoutGrid, Clock, Upload, Briefcase, FileText, Palette,
    Pipette, Eye, Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CompanyDetailsProps {
    org: any;
    isCreatingNew: boolean;
    onUpdateDetail: (fieldOrObject: string | Record<string, any>, value?: any) => void;
}

// --- COLOR UTILITIES ---
const HEX_TO_RGB = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
};

const RGB_TO_HEX = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

const RGB_TO_HSL = (r: number, g: number, b: number) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
            default: h = 0;
        }
        h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
};

const HSL_TO_RGB = (h: number, s: number, l: number) => {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

const GENERATE_FAMILY = (hex: string) => {
    const rgb = HEX_TO_RGB(hex);
    const hsl = RGB_TO_HSL(rgb.r, rgb.g, rgb.b);

    // Light variant (more luminance)
    const lightHSL = { ...hsl, l: Math.min(hsl.l + 30, 95), s: Math.max(hsl.s - 10, 10) };
    const lightRGB = HSL_TO_RGB(lightHSL.h, lightHSL.s, lightHSL.l);

    // Dark variant (less luminance)
    const darkHSL = { ...hsl, l: Math.max(hsl.l - 20, 10) };
    const darkRGB = HSL_TO_RGB(darkHSL.h, darkHSL.s, darkHSL.l);

    return {
        base: hex,
        light: RGB_TO_HEX(lightRGB.r, lightRGB.g, lightRGB.b),
        dark: RGB_TO_HEX(darkRGB.r, darkRGB.g, darkRGB.b),
        glow: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`
    };
};

const PRESET_COLORS = [
    { name: 'Indigo', primary: '#6366f1' },
    { name: 'Sky', primary: '#0ea5e9' },
    { name: 'Emerald', primary: '#10b981' },
    { name: 'Amber', primary: '#f59e0b' },
    { name: 'Rose', primary: '#f43f5e' },
    { name: 'Slate', primary: '#64748b' },
    { name: 'Violet', primary: '#8b5cf6' },
    { name: 'Orange', primary: '#f97316' },
];

const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
};

// Helper for validity status
const getValidityStatus = (lastUpdate: string) => {
    if (!lastUpdate) return { label: 'Sin Datos', color: '#94a3b8' };
    const now = new Date();
    const update = new Date(lastUpdate);
    const expiration = new Date(update);
    expiration.setMonth(expiration.getMonth() + 1);
    if (now > expiration) return { label: 'EXPIRADO', color: '#ef4444' };
    const warningDate = new Date(expiration);
    warningDate.setDate(warningDate.getDate() - 7);
    if (now > warningDate) return { label: 'Expira Pronto', color: '#f59e0b' };
    return { label: 'Vigente', color: '#10b981' };
};

export const CompanyDetails: React.FC<CompanyDetailsProps> = ({ org, isCreatingNew, onUpdateDetail }) => {
    const [basicInfoExpanded, setBasicInfoExpanded] = useState(true);
    const [visualMgmtExpanded, setVisualMgmtExpanded] = useState(false);
    const [activitiesExpanded, setActivitiesExpanded] = useState(false);
    const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
    const [obligationsExpanded, setObligationsExpanded] = useState(false);
    const [csfHistoryExpanded, setCsfHistoryExpanded] = useState(false);
    const [regimesExpanded, setRegimesExpanded] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const handleCSFUpload = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'register' | 'update') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        console.log(`[BulkCSF] Iniciando ${mode} para: ${file.name}`);

        try {
            const timestamp = Date.now();
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const filePath = `detail_${mode}_${timestamp}_${sanitizedName}`;

            // 1. Storage
            const { error: uploadError } = await supabase.storage
                .from('csf')
                .upload(filePath, file, {
                    upsert: true,
                    contentType: 'application/pdf'
                });

            if (uploadError) throw new Error(`Error de subida: ${uploadError.message}`);

            // 2. Function
            const { data: extractionRes, error: invokeError } = await supabase.functions.invoke('process-csf', {
                body: {
                    filePath,
                    organizationId: mode === 'update' ? org.id : null,
                    isCreatingNew: mode === 'register'
                }
            });

            if (invokeError || extractionRes?.success === false) {
                throw new Error(invokeError?.message || extractionRes?.error || 'Error en procesamiento');
            }

            // Success! Reload or alert
            alert(`✅ ${mode === 'register' ? 'Empresa registrada' : 'CSF actualizada'} con éxito: ${extractionRes.data?.name || ''}`);
            window.location.reload(); // Quickest way to refresh the whole state

        } catch (err: any) {
            console.error(`Error en ${mode}:`, err);
            alert(`❌ Error: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    // Derived data
    const activities = org?.economic_activities || [];
    const regimes = org?.tax_regimes || [];
    const obligations = org?.tax_obligations || [];
    const csfHistory = org?.csf_history || [];

    const toggleActivityExpansion = (code: string) => {
        if (expandedActivity === code) {
            setExpandedActivity(null);
        } else {
            setExpandedActivity(code);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        alert("Integración con Supabase Storage detectada. El archivo se procesará para actualizar el logotipo.");
    };

    const openEyeDropper = async (field: 'primary' | 'secondary' | 'accent') => {
        if (!(window as any).EyeDropper) {
            alert("Su navegador no soporta la herramienta de gotero (EyeDropper API). Se recomienda usar Chrome o Edge.");
            return;
        }

        const eyeDropper = new (window as any).EyeDropper();
        try {
            const result = await eyeDropper.open();
            if (result.sRGBHex) {
                handleBaseColorChange(field, result.sRGBHex);
            }
        } catch (e) {
            console.log("EyeDropper cancelado o fallido:", e);
        }
    };

    const handleBaseColorChange = (field: 'primary' | 'secondary' | 'accent', hex: string) => {
        if (field === 'primary') {
            const family = GENERATE_FAMILY(hex);
            onUpdateDetail({
                'primary_color': hex,
                'theme_config.primary_color': hex,
                'theme_config.primary_light': family.light,
                'theme_config.primary_dark': family.dark,
                'theme_config.primary_glow': family.glow
            });
        } else if (field === 'secondary') {
            onUpdateDetail('theme_config.secondary_color', hex);
        } else if (field === 'accent') {
            onUpdateDetail('theme_config.accent_color', hex);
        }
    };

    const handlePresetSelect = (hex: string) => {
        const family = GENERATE_FAMILY(hex);

        // Default secondary/accent from a complementary logic
        const complementaryHex = HEX_TO_RGB(hex);
        const compHSL = RGB_TO_HSL(complementaryHex.r, complementaryHex.g, complementaryHex.b);
        const accentHSL = { ...compHSL, h: (compHSL.h + 180) % 360 };
        const accentRGB = HSL_TO_RGB(accentHSL.h, accentHSL.s, accentHSL.l);
        const accentHex = RGB_TO_HEX(accentRGB.r, accentRGB.g, accentRGB.b);

        onUpdateDetail({
            'primary_color': hex,
            'theme_config.primary_color': hex,
            'theme_config.primary_light': family.light,
            'theme_config.primary_dark': family.dark,
            'theme_config.primary_glow': family.glow,
            'theme_config.accent_color': accentHex
        });
    };

    if (!org && !isCreatingNew) {
        return (
            <div className="glass-card" style={{ padding: '80px', textAlign: 'center', opacity: 0.3 }}>
                <Building2 size={48} style={{ margin: '0 auto 16px' }} />
                <p>Seleccione una organización para administrar</p>
            </div>
        )
    }

    if (org?._is_placeholder) {
        return (
            <div className="glass-card fade-in" style={{ padding: '60px', textAlign: 'center', border: '2px dashed var(--primary-color)' }}>
                <Building2 size={48} style={{ margin: '0 auto 20px', color: 'var(--primary-color)' }} />
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>Registro de Nueva Empresa</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '400px', margin: '0 auto 24px' }}>
                    Para registrar una nueva organización, suba su Constancia de Situación Fiscal (PDF).
                    El sistema extraerá automáticamente el RFC, nombre, domicilio y actividades.
                </p>

                <label className="primary-button" style={{ margin: '0 auto', gap: '8px', cursor: isUploading ? 'not-allowed' : 'pointer', opacity: isUploading ? 0.7 : 1 }}>
                    {isUploading ? <Loader2 className="spin" size={20} /> : <Upload size={20} />}
                    {isUploading ? 'Procesando...' : 'Cargar CSF para Registrar'}
                    <input type="file" onChange={(e) => handleCSFUpload(e, 'register')} style={{ display: 'none' }} accept="application/pdf" disabled={isUploading} />
                </label>
            </div>
        );
    }

    if (!org) return null;

    const validity = getValidityStatus(org.last_csf_update);

    return (
        <div className="glass-card fade-in">
            {/* Cabecera de Identidad y Acciones Rápidas */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
                padding: '24px',
                borderRadius: '16px',
                marginBottom: '24px',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '12px',
                            backgroundColor: org.primary_color || '#1e293b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '24px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: `0 0 20px ${org.primary_color}33`,
                            overflow: 'hidden',
                            transition: 'all 0.3s'
                        }}>
                            {org.logo_url ? (
                                <img src={org.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Logo" />
                            ) : (
                                (org.brand_name || org.name || '?').substring(0, 1).toUpperCase()
                            )}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                                {org.brand_name || org.name}
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace', backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>{org.rfc}</span>
                                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', backgroundColor: validity?.color + '20', color: validity?.color, border: `1px solid ${validity?.color}40` }}>
                                    CSF {validity?.label}
                                </span>
                            </div>
                        </div>
                    </div>
                    <label className="primary-button" style={{ gap: '8px', cursor: isUploading ? 'not-allowed' : 'pointer', opacity: isUploading ? 0.7 : 1 }}>
                        {isUploading ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
                        {isUploading ? 'Procesando...' : 'Actualizar CSF'}
                        <input type="file" onChange={(e) => handleCSFUpload(e, 'update')} style={{ display: 'none' }} accept="application/pdf" disabled={isUploading} />
                    </label>
                </div>

                {/* Roles */}
                <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', padding: '8px 12px', backgroundColor: org.is_customer ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)', borderRadius: '8px', border: org.is_customer ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s' }}>
                        <input type="checkbox" checked={!!org.is_customer} onChange={(e) => onUpdateDetail('is_customer', e.target.checked)} style={{ accentColor: '#10b981' }} />
                        <span>Cliente Activo</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', padding: '8px 12px', backgroundColor: org.is_issuer ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.02)', borderRadius: '8px', border: org.is_issuer ? '1px solid var(--primary-color)' : '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s' }}>
                        <input type="checkbox" checked={!!org.is_issuer} onChange={(e) => onUpdateDetail('is_issuer', e.target.checked)} style={{ accentColor: 'var(--primary-base)' }} />
                        <span>Emisora / Prestadora</span>
                    </label>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                {/* Identificación y Domicilio */}
                <div className="glass-card" style={{ padding: '0', overflow: 'hidden', border: basicInfoExpanded ? '1px solid var(--primary-color)' : '1px solid rgba(255,255,255,0.05)' }}>
                    <div
                        onClick={() => setBasicInfoExpanded(!basicInfoExpanded)}
                        style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ color: 'var(--primary-base)' }}><Building2 size={18} /></div>
                            <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Identificación y Domicilio Fiscal</h4>
                        </div>
                        {basicInfoExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>

                    {basicInfoExpanded && (
                        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                <div>
                                    <h5 style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Identificación Detallada</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div className="detail-item">
                                            <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>CURP</div>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{org.curp || 'N/A'}</div>
                                        </div>
                                        <div className="detail-item">
                                            <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>idCIF</div>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#6366f1' }}>{org.cif_id || 'N/A'}</div>
                                        </div>
                                        <div className="detail-item">
                                            <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>Inicio Op.</div>
                                            <div style={{ fontSize: '12px' }}>{formatDate(org.operations_start_date)}</div>
                                        </div>
                                        <div className="detail-item">
                                            <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>Cambio Status</div>
                                            <div style={{ fontSize: '12px' }}>{formatDate(org.last_status_change_date)}</div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '24px' }}>
                                    <h5 style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Domicilio Fiscal</h5>
                                    <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                                        <div style={{ fontWeight: 'bold', color: 'var(--primary-base)', marginBottom: '4px' }}>{org.vialidad_type} {org.vialidad_name} #{org.exterior_number} {org.interior_number && `Int. ${org.interior_number}`}</div>
                                        <div style={{ color: '#cbd5e1' }}>{org.colony}</div>
                                        <div style={{ color: '#cbd5e1' }}>{org.municipality}, {org.state}</div>
                                        <div style={{ color: 'var(--primary-base)', fontWeight: 'bold', marginTop: '4px' }}>CP: {org.tax_domicile?.replace('CP: ', '')}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Identidad Visual Avanzada (Regla 60-30-10) */}
                {org.is_issuer && (
                    <div className="glass-card" style={{ padding: '0', overflow: 'hidden', border: visualMgmtExpanded ? '1px solid var(--primary-color)' : '1px solid rgba(255,255,255,0.05)' }}>
                        <div
                            onClick={() => setVisualMgmtExpanded(!visualMgmtExpanded)}
                            style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ color: 'var(--primary-base)' }}><Palette size={18} /></div>
                                <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Identidad Visual y Generador 60-30-10</h4>
                            </div>
                            {visualMgmtExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>

                        {visualMgmtExpanded && (
                            <div style={{ padding: '24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '40px' }}>
                                    {/* Panel Izquierdo: Branding & Logo */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <div>
                                            <h5 style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase' }}>Identidad Gráfica</h5>
                                            <div style={{ width: '100%', aspectRatio: '1/1', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: `2px dashed ${org.primary_color || '#334155'}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', cursor: 'pointer', transition: 'all 0.3s', position: 'relative', overflow: 'hidden' }}>
                                                {org.logo_url ? (
                                                    <img src={org.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '24px' }} alt="Logo" />
                                                ) : (
                                                    <>
                                                        <Upload size={28} color={org.primary_color || "#64748b"} />
                                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Subir Identidad</span>
                                                    </>
                                                )}
                                                <input type="file" onChange={handleLogoUpload} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} accept="image/*" />
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div className="input-group">
                                                <label style={{ fontSize: '11px', color: '#64748b' }}>Nombre Comercial</label>
                                                <input
                                                    type="text"
                                                    value={org.brand_name || ''}
                                                    onChange={(e) => onUpdateDetail('brand_name', e.target.value)}
                                                    placeholder="Ej. Materialidad Fiscal Pro"
                                                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: 'white', fontSize: '13px' }}
                                                />
                                            </div>
                                            <div className="input-group">
                                                <label style={{ fontSize: '11px', color: '#64748b' }}>Eslogan</label>
                                                <input
                                                    type="text"
                                                    value={org.theme_config?.slogan || ''}
                                                    onChange={(e) => onUpdateDetail('theme_config.slogan', e.target.value)}
                                                    placeholder="Lema corporativo..."
                                                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: 'white', fontSize: '13px' }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Panel Derecho: Motor de Colorimetría */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        <div>
                                            <h5 style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '16px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Pipette size={14} /> Configuración de Colores Base
                                            </h5>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                                                {/* Color Primario */}
                                                <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Primario (30%)</label>
                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                            <button
                                                                onClick={() => openEyeDropper('primary')}
                                                                title="Seleccionar de la pantalla"
                                                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex', borderRadius: '4px', transition: 'all 0.2s' }}
                                                            >
                                                                <Pipette size={14} />
                                                            </button>
                                                            <input
                                                                type="color"
                                                                value={org.primary_color || '#6366f1'}
                                                                onChange={(e) => handleBaseColorChange('primary', e.target.value)}
                                                                style={{ width: '28px', height: '28px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: '#64748b', lineHeight: '1.4' }}>Dominante en la identidad. Define tonos claros y oscuros automáticamente.</div>
                                                </div>

                                                {/* Color Secundario */}
                                                <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Secundario (10%)</label>
                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                            <button
                                                                onClick={() => openEyeDropper('secondary')}
                                                                title="Seleccionar de la pantalla"
                                                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex', borderRadius: '4px', transition: 'all 0.2s' }}
                                                            >
                                                                <Pipette size={14} />
                                                            </button>
                                                            <input
                                                                type="color"
                                                                value={org.theme_config?.secondary_color || '#929292'}
                                                                onChange={(e) => handleBaseColorChange('secondary', e.target.value)}
                                                                style={{ width: '28px', height: '28px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: '#64748b', lineHeight: '1.4' }}>Apoyo al primario. Usado para componentes neutros y estados activos.</div>
                                                </div>

                                                {/* Color de Acento */}
                                                <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Acento (CTA)</label>
                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                            <button
                                                                onClick={() => openEyeDropper('accent')}
                                                                title="Seleccionar de la pantalla"
                                                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex', borderRadius: '4px', transition: 'all 0.2s' }}
                                                            >
                                                                <Pipette size={14} />
                                                            </button>
                                                            <input
                                                                type="color"
                                                                value={org.theme_config?.accent_color || '#FFC107'}
                                                                onChange={(e) => handleBaseColorChange('accent', e.target.value)}
                                                                style={{ width: '28px', height: '28px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: '#64748b', lineHeight: '1.4' }}>Llamadas a la acción y detalles críticos que deben resaltar.</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Familia Extendida / Previsualización */}
                                        <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <h5 style={{ fontSize: '10px', color: '#64748b', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Familia Progresiva Generada</h5>
                                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                {/* Muestra de la familia del Primario */}
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', backgroundColor: org.theme_config?.primary_light, border: '1px solid rgba(255,255,255,0.1)' }} />
                                                    <span style={{ fontSize: '9px', color: '#94a3b8' }}>Light</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '60px', height: '60px', borderRadius: '12px', backgroundColor: org.primary_color, border: '3px solid white', boxShadow: `0 0 15px ${org.primary_color}44` }} />
                                                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'white' }}>BASE</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', backgroundColor: org.theme_config?.primary_dark, border: '1px solid rgba(255,255,255,0.1)' }} />
                                                    <span style={{ fontSize: '9px', color: '#94a3b8' }}>Dark</span>
                                                </div>
                                                <div style={{ width: '2px', height: '40px', backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: '10px', marginRight: '10px', alignSelf: 'center' }} />
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', backgroundColor: org.theme_config?.accent_color, border: '1px solid rgba(255,255,255,0.1)', boxShadow: `0 0 10px ${org.theme_config?.accent_color}22` }} />
                                                    <span style={{ fontSize: '9px', color: '#94a3b8' }}>Accent</span>
                                                </div>
                                            </div>

                                            <div style={{ marginTop: '20px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Eye size={12} /> La armonía visual se calcula en tiempo real. Los estados `hover` y `active` de toda la app se ajustan a estos valores.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Presets Rápidos */}
                                        <div>
                                            <h5 style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>Puntos de Partida (Sugeridos)</h5>
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                {PRESET_COLORS.map(p => (
                                                    <button
                                                        key={p.name}
                                                        onClick={() => handlePresetSelect(p.primary)}
                                                        style={{
                                                            width: '24px', height: '24px', borderRadius: '50%', backgroundColor: p.primary, border: 'none', cursor: 'pointer', transition: 'transform 0.2s', transform: org.primary_color === p.primary ? 'scale(1.2)' : 'scale(1)', outline: org.primary_color === p.primary ? '2px solid white' : 'none', outlineOffset: '2px'
                                                        }}
                                                        title={p.name}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Actividades Económicas */}
                <div className="glass-card" style={{ padding: '0', overflow: 'hidden', border: activitiesExpanded ? '1px solid var(--primary-color)' : '1px solid rgba(255,255,255,0.05)' }}>
                    <div
                        onClick={() => setActivitiesExpanded(!activitiesExpanded)}
                        style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ color: 'var(--primary-base)' }}><LayoutGrid size={18} /></div>
                            <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Actividades Económicas ({activities.length})</h4>
                        </div>
                        {activitiesExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>

                    {activitiesExpanded && (
                        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                                {activities.map((a: any) => (
                                    <div key={a.id} style={{ fontSize: '11px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: '4px solid var(--primary-color)', cursor: 'pointer' }} onClick={() => toggleActivityExpansion(a.activity_code)}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '12px', color: 'white', flex: 1 }}>
                                                <span style={{ color: '#64748b', marginRight: '8px' }}>[{a.activity_code}]</span>
                                                {a.description}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--primary-base)', fontWeight: 'bold', marginLeft: '12px' }}>{a.percentage}%</div>
                                        </div>

                                        {expandedActivity === a.activity_code && (
                                            <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '10px', color: 'var(--primary-base)', fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase' }}>CLAVES SAT RELACIONADAS</div>
                                                        <p style={{ color: '#64748b', fontSize: '11px', margin: '4px 0 0' }}>Productos y servicios vinculados a esta actividad para facturación.</p>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                                                    {(org.related_products || []).filter((rp: any) => rp.activity_code === a.activity_code).length > 0 ? (
                                                        (org.related_products || []).filter((rp: any) => rp.activity_code === a.activity_code).map((rp: any) => (
                                                            <div key={rp.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--primary-base)', fontFamily: 'monospace', backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                                    {rp.product_code}
                                                                </div>
                                                                <div style={{ fontSize: '12px', color: '#cbd5e1', flex: 1 }}>
                                                                    {rp.cat_cfdi_productos_servicios?.name || 'Cargando nombre...'}
                                                                </div>
                                                                {rp.matching_score > 0.8 && (
                                                                    <div style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                                                        Alta Precisión
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                                                            No hay claves SAT específicas mapeadas aún para esta actividad.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Regímenes Fiscales */}
                <div className="glass-card" style={{ padding: '0', overflow: 'hidden', border: regimesExpanded ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.05)' }}>
                    <div
                        onClick={() => setRegimesExpanded(!regimesExpanded)}
                        style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ color: '#10b981' }}><Briefcase size={18} /></div>
                            <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Regímenes Fiscales ({regimes.length})</h4>
                        </div>
                        {regimesExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>

                    {regimesExpanded && (
                        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {regimes.map((r: any) => (
                                    <div key={r.id} style={{ fontSize: '12px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                                        <div style={{ fontWeight: 'bold', color: 'white' }}>{r.regime_name}</div>
                                        <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '4px' }}>Iniciado el: {formatDate(r.start_date)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Obligaciones Fiscales */}
                <div className="glass-card" style={{ padding: '0', overflow: 'hidden', border: obligationsExpanded ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.05)' }}>
                    <div
                        onClick={() => setObligationsExpanded(!obligationsExpanded)}
                        style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ color: '#818cf8' }}><Clock size={18} /></div>
                            <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Obligaciones Fiscales ({obligations.length})</h4>
                        </div>
                        {obligationsExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>

                    {obligationsExpanded && (
                        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {obligations.map((o: any) => (
                                    <div key={o.id} style={{ fontSize: '11px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: '4px solid #818cf8' }}>
                                        <div style={{ fontWeight: 'bold', color: 'white' }}>{o.description}</div>
                                        <div style={{ color: '#64748b', fontSize: '10px', marginTop: '4px' }}>{o.due_date_description}</div>
                                        <div style={{ color: '#94a3b8', fontSize: '10px' }}>Desde: {formatDate(o.start_date)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Historial CSF */}
                <div className="glass-card" style={{ padding: '0', overflow: 'hidden', border: csfHistoryExpanded ? '1px solid var(--primary-color)' : '1px solid rgba(255,255,255,0.05)' }}>
                    <div
                        onClick={() => setCsfHistoryExpanded(!csfHistoryExpanded)}
                        style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ color: 'var(--primary-base)' }}><History size={18} /></div>
                            <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Historial de Archivos ({csfHistory.length})</h4>
                        </div>
                        {csfHistoryExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>

                    {csfHistoryExpanded && (
                        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                <thead>
                                    <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        <th style={{ textAlign: 'left', padding: '8px' }}>Fecha Emisión</th>
                                        <th style={{ textAlign: 'left', padding: '8px' }}>Fecha Carga</th>
                                        <th style={{ textAlign: 'center', padding: '8px' }}>Ver</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {csfHistory.map((h: any) => (
                                        <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                            <td style={{ padding: '8px' }}>{formatDate(h.emission_date)}</td>
                                            <td style={{ padding: '8px' }}>{formatDate(h.created_at)}</td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                <a href={h.file_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-base)' }}><FileText size={14} /></a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
