import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { generateProformaPDF } from '../../lib/pdf';

// Material Symbols mapping to keep code clean
const Icon = ({ name, className = "" }: { name: string, className?: string }) => (
    <span className={`material-symbols-outlined ${className}`} style={{ fontSize: 'inherit' }}>{name}</span>
);

const ProductSelector: React.FC<{ value: string, activityDescription?: string, activityCode?: string, onSelect: (prod: any) => void }> = ({ value, activityDescription, activityCode, onSelect }) => {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchResults = async () => {
            let queryText = search;
            let keywords: string[] = [];

            if (!search && activityDescription && isOpen) {
                const stopWords = ['comercio', 'por', 'menor', 'mayor', 'servicios', 'articulos', 'para', 'uso', 'clase', 'actividades', 'oficina', 'elaboracion', 'fabricacion', 'venta', 'mantenimiento', 'reparacion', 'alquilada', 'propia', 'excepto', 'otros', 'otras', 'asociados', 'relacionados', 'incluye', 'incluidos', 'industriales'];
                const normalized = activityDescription.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.,]/g, ' ');
                keywords = normalized.split(/\s+/).filter((w: string) => w.length > 3 && !stopWords.includes(w));
                queryText = keywords.length > 1 ? `${keywords[0]} ${keywords[1]}` : (keywords[0] || normalized.substring(0, 15));
            }

            if (!queryText && !activityCode && isOpen) return;
            if (!isOpen && !search) return;

            setLoading(true);
            try {
                let finalData: any[] = [];

                // 1. Si no hay búsqueda, sugerir por Actividad Económica (SCIAN-CPS v3)
                if (!search && activityCode) {
                    const { data: congruenceData } = await supabase
                        .from('rel_activity_cps_congruence')
                        .select('cps_family_code, score, reason')
                        .eq('activity_code', activityCode)
                        .order('score', { ascending: false })
                        .limit(5);

                    if (congruenceData && congruenceData.length > 0) {
                        const productCodes8Digits = congruenceData.map(c => `${c.cps_family_code}00`);
                        const { data: products } = await supabase
                            .from('cat_cfdi_productos_servicios')
                            .select('code, name')
                            .in('code', productCodes8Digits);

                        if (products) {
                            finalData = products.map(p => {
                                const rel = congruenceData.find(c => p.code === `${c.cps_family_code}00`);
                                return {
                                    code: p.code,
                                    name: p.name,
                                    reason: rel?.reason || 'Mapeo Sugerido',
                                    score: rel?.score || 0,
                                    source: rel?.score && rel.score >= 1.0 ? 'Actividad Principal' : 'Actividad Relacionada'
                                };
                            }).sort((a, b) => b.score - a.score);
                        }
                    }
                }

                // 2. Si hay búsqueda o no se encontraron resultados por actividad, buscar globalmente
                if (search || (finalData.length === 0 && (search.length >= 3 || keywords.length > 0))) {
                    let query = supabase.from('cat_cfdi_productos_servicios').select('code, name');

                    if (search) {
                        if (/^\d+$/.test(search)) {
                            query = query.ilike('code', `${search}%`);
                        } else {
                            query = query.ilike('name', `%${search}%`);
                        }
                    } else if (keywords.length > 0) {
                        query = query.or(keywords.slice(0, 2).map(kw => `name.ilike.%${kw}%`).join(','));
                    }

                    const { data: globalData } = await query.limit(20);
                    if (globalData) {
                        const mapped = globalData.filter(p => !finalData.find(f => f.code === p.code)).map(p => ({
                            code: p.code,
                            name: p.name,
                            source: search ? 'Catálogo SAT' : 'Búsqueda Semántica'
                        }));
                        finalData = search ? mapped : [...finalData, ...mapped];
                    }
                }
                setResults(finalData);
            } catch (err) {
                console.error('Error fetching proforma suggestions:', err);
            } finally {
                setLoading(false);
            }
        };
        const timer = setTimeout(fetchResults, 300);
        return () => clearTimeout(timer);
    }, [search, activityDescription, activityCode, isOpen]);

    return (
        <div className="relative w-full group/ps product-selector-container">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer border ${isOpen ? 'bg-white border-blue-400 ring-2 ring-blue-50 shadow-sm' : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/50'}`}>
                <Icon name="search" className={`text-sm shrink-0 ${isOpen ? 'text-blue-500' : 'text-slate-400'}`} />
                <input
                    type="text"
                    className="flex-1 border-none bg-transparent p-0 text-[10px] font-mono focus:ring-0 text-slate-700 focus:outline-none placeholder:italic placeholder:text-slate-400"
                    placeholder="BUSCAR CLAVE SAT..."
                    value={isOpen ? search : value}
                    onChange={e => { setSearch(e.target.value); if (!isOpen) setIsOpen(true); }}
                    onFocus={() => { setIsOpen(true); }}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                />
                <Icon name={isOpen ? 'expand_less' : 'expand_more'} className={`text-xs shrink-0 transition-transform ${isOpen ? 'text-blue-500' : 'text-slate-300'}`} />
            </div>
            {isOpen && (search.length > 0 || results.length > 0 || loading) && (
                <div className="absolute left-0 top-full mt-1 w-[450px] bg-white border border-slate-200 rounded-lg shadow-2xl z-[100] max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
                    <div className="sticky top-0 bg-slate-50 px-3 py-1.5 border-b border-slate-100 flex justify-between items-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sugerencias SAT - v3</span>
                        {loading && <div className="text-[9px] text-blue-500 font-bold animate-pulse">Buscando...</div>}
                    </div>
                    {results.length === 0 && !loading && (
                        <div className="px-4 py-3 text-[10px] text-slate-400 italic text-center">No se encontraron claves relacionadas.</div>
                    )}
                    {results.map(prod => (
                        <div key={`${prod.code}-${prod.source}`} className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-none transition-all flex items-center gap-3 group" onClick={() => { onSelect(prod); setIsOpen(false); setSearch(''); }}>
                            <div className="flex flex-col shrink-0">
                                <span className="text-[10px] font-bold text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{prod.code}</span>
                                <span className="text-[7px] text-slate-400 font-bold mt-0.5 text-center">{prod.source}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-slate-700 font-bold truncate uppercase">{prod.name}</p>
                                {prod.reason && <p className="text-[8px] text-slate-400 italic truncate group-hover:text-blue-500 transition-colors">{prod.reason}</p>}
                            </div>
                            {prod.score !== undefined && (
                                <div className={`text-[8px] font-black px-1.5 py-0.5 rounded ${prod.score >= 1.0 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                                    {prod.score >= 1.0 ? '100%' : `${(prod.score * 100).toFixed(0)}%`}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const UnitSelector: React.FC<{ value: string, onSelect: (unit: any) => void }> = ({ value, onSelect }) => {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchUnits = async () => {
            if (!isOpen) return;
            setLoading(true);
            try {
                let query = supabase.from('cat_cfdi_unidades').select('code, name, symbol');
                if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
                else query = query.in('code', ['H87', 'E48', 'ACT', 'KGM', 'LTR', 'TNE', 'P1', 'ZZ']);
                const { data } = await query.limit(10);
                if (data) setResults(data);
            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        const timer = setTimeout(fetchUnits, 300);
        return () => clearTimeout(timer);
    }, [search, isOpen]);

    return (
        <div className="relative w-full group/us">
            <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all cursor-pointer border ${isOpen ? 'bg-white border-blue-400 ring-2 ring-blue-50 shadow-sm' : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/50'}`}>
                <input
                    className="w-full border-none bg-transparent p-0 text-[10px] text-center focus:ring-0 font-bold text-slate-700 focus:outline-none uppercase placeholder:text-slate-400"
                    type="text"
                    value={isOpen ? search : value}
                    placeholder="UNIDAD..."
                    onChange={e => { setSearch(e.target.value); if (!isOpen) setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                />
                <Icon name="unfold_more" className={`text-[10px] shrink-0 transition-opacity ${isOpen ? 'text-blue-500' : 'text-slate-300 opacity-50 group-hover/us:opacity-100'}`} />
            </div>
            {isOpen && (
                <div className="absolute z-[100] left-1/2 -translate-x-1/2 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-1.5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Unidades SAT</span>
                        {loading && <div className="text-[9px] text-blue-500 font-bold animate-pulse">...</div>}
                    </div>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar">
                        {results.map((unit) => (
                            <div key={unit.code} className="p-2 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors flex items-center justify-between" onClick={() => { onSelect(unit); setIsOpen(false); setSearch(''); }}>
                                <div className="flex flex-col"><span className="text-[10px] font-bold text-blue-600 leading-tight">{unit.code}</span><span className="text-[9px] text-slate-500 truncate w-32 leading-tight">{unit.name}</span></div>
                                {unit.symbol && <span className="text-[8px] font-mono text-slate-400 bg-slate-100 px-1 rounded">{unit.symbol}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

interface ProformaManagerProps {
    selectedOrg: any;
}

const ProformaManager: React.FC<ProformaManagerProps> = ({ selectedOrg }) => {
    const [regimes, setRegimes] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [orgActivities, setOrgActivities] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    const [formData, setFormData] = useState({
        clientName: '',
        clientRFC: '',
        clientEmail: '',
        clientAddress: '',
        clientCP: '',
        clientRegime: '601',
        economicActivity: '',
        receiptType: 'INGRESO',
        currency: 'MXN',
        paymentMethod: 'PUE',
        paymentForm: '03',
        usage: 'G03',
        hasQuotation: true,
        hasContract: true,
        advancePayment: false,
        is_licitation: false,
        items: [
            { id: 1, code: '', quantity: 1, unit: 'E-48', description: '', unitPrice: 0 }
        ] as any[],
        isSaving: false,
        saveError: null as string | null,
        saveSuccess: false
    });

    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const loadUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        loadUser();
    }, []);

    const handlePreview = () => {
        if (!selectedOrg) return;

        generateProformaPDF({
            ...formData,
            subtotal,
            iva,
            total,
            orgName: selectedOrg.name,
            orgRFC: selectedOrg.rfc || '',
            orgLogoUrl: selectedOrg.logo_url || 'none',
            orgColor: selectedOrg.primary_color || '#1e40af'
        });
    };

    const handleSendEmail = async () => {
        if (!formData.clientEmail) {
            alert('Por favor ingrese un correo electrónico para el cliente');
            return;
        }

        setFormData(prev => ({ ...prev, isSaving: true }));
        try {
            // Simulando llamada a Edge Function
            console.log('Enviando proforma a:', formData.clientEmail);

            // Aquí iría el llamado real:
            // const { error } = await supabase.functions.invoke('send-proforma', {
            //     body: { proformaId: '...', email: formData.clientEmail }
            // });

            await new Promise(resolve => setTimeout(resolve, 2000));
            alert('Proforma enviada con éxito a ' + formData.clientEmail);
        } catch (error: any) {
            alert('Error al enviar: ' + error.message);
        } finally {
            setFormData(prev => ({ ...prev, isSaving: false }));
        }
    };

    const handleSave = async () => {
        if (!selectedOrg?.id || !formData.clientRFC) {
            alert('Por favor complete los datos del cliente y emisor');
            return;
        }

        setFormData(prev => ({ ...prev, isSaving: true, saveError: null, saveSuccess: false }));

        try {
            // 1. Insertar Cabecera (Quotation)
            const { data: quotation, error: qError } = await supabase
                .from('quotations')
                .insert({
                    organization_id: selectedOrg.id,
                    vendor_id: null, // Opcional por ahora, podría ser el ID del vendedor si existe tabla
                    amount_subtotal: subtotal,
                    amount_iva: iva,
                    amount_total: total,
                    currency: formData.currency,
                    status: 'PENDIENTE',
                    type: 'SERVICIO', // O según selección
                    description: `Proforma para ${formData.clientName}`,
                    created_by: user?.id || null,
                    is_licitation: formData.is_licitation || false,
                    is_contract_required: formData.hasContract,
                    request_direct_invoice: false
                })
                .select()
                .single();

            if (qError) throw qError;

            // 2. Insertar Items (Quotation Items)
            const itemsToInsert = formData.items.map(item => ({
                quotation_id: quotation.id,
                sat_product_key: item.code,
                quantity: item.quantity,
                unit_id: item.unit,
                description: item.description,
                unit_price: item.unitPrice,
                subtotal: item.quantity * item.unitPrice
            }));

            const { error: iError } = await supabase
                .from('quotation_items')
                .insert(itemsToInsert);

            if (iError) throw iError;

            setFormData(prev => ({ ...prev, isSaving: false, saveSuccess: true }));
            alert('Proforma guardada con éxito');

            // Opcional: Limpiar formulario tras guardado exitoso
            // setFormData(initialState); 

        } catch (error: any) {
            console.error('Error al guardar proforma:', error);
            setFormData(prev => ({ ...prev, isSaving: false, saveError: error.message }));
            alert(`Error al guardar: ${error.message}`);
        }
    };

    useEffect(() => {
        const loadCatalogs = async () => {
            const { data: reg } = await supabase.from('cat_cfdi_regimenes').select('*').order('code');
            if (reg) setRegimes(reg);

            // Cargar clientes registrados
            const { data: cli } = await supabase.from('organizations')
                .select('*')
                .eq('is_client', true)
                .order('name');
            if (cli) setClients(cli);
        };
        loadCatalogs();
    }, []);

    // Cargar actividades cuando cambia la organización emisora
    useEffect(() => {
        const loadActivities = async () => {
            if (selectedOrg?.id) {
                const { data } = await supabase
                    .from('organization_activities')
                    .select('*')
                    .eq('organization_id', selectedOrg.id)
                    .order('activity_order');
                if (data) {
                    setOrgActivities(data);
                    // Por defecto seleccionar la primera con mayor porcentaje si no hay una seleccionada
                    if (data.length > 0 && !formData.economicActivity) {
                        setFormData(prev => ({ ...prev, economicActivity: data[0].activity_code }));
                    }
                }
            }
        };
        loadActivities();
    }, [selectedOrg]);


    const handleSelectClient = (client: any) => {
        const address = [
            client.vialidad_name,
            client.exterior_number,
            client.interior_number ? `Int ${client.interior_number}` : '',
            client.colony,
            client.municipality,
            client.state
        ].filter(Boolean).join(', ');

        setFormData({
            ...formData,
            clientName: client.name,
            clientRFC: client.rfc || '',
            clientEmail: client.email || '',
            clientAddress: address || client.tax_domicile || '',
            clientCP: client.tax_domicile?.match(/\d{5}/)?.[0] || '',
            clientRegime: client.capital_regime || '601'
        });
        setSearchTerm(client.name);
        setShowDropdown(false);
    };

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.client-selector-container')) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.rfc && c.rfc.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setFormData({ ...formData, items: newItems });
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { id: Date.now(), code: '', quantity: 0, unit: '', description: '', unitPrice: 0 }]
        });
    };

    const removeItem = (index: number) => {
        if (formData.items.length > 1) {
            const newItems = formData.items.filter((_, i) => i !== index);
            setFormData({ ...formData, items: newItems });
        }
    };

    const subtotal = formData.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    return (
        <div className="flex flex-col min-h-screen text-slate-900 bg-[#f8fafc] font-['Inter',_sans-serif] overflow-hidden force-light">
            {/* STITCH HEADER */}
            <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Icon name="description" className="text-white text-lg" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-slate-800 leading-none">Generador de Proformas</h1>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Módulo Comercial</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100 mr-2">
                        <button
                            onClick={handleSave}
                            disabled={formData.isSaving}
                            className="px-4 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-700 hover:bg-white rounded-lg transition-all disabled:opacity-50"
                        >
                            {formData.isSaving ? 'Fijando...' : 'BORRADOR'}
                        </button>
                    </div>

                    <button
                        onClick={handlePreview}
                        className="px-4 py-2 text-[11px] font-bold text-blue-600 hover:bg-blue-600 hover:text-white border-2 border-blue-600 rounded-lg transition-all flex items-center gap-2 shadow-sm"
                    >
                        <Icon name="visibility" className="text-sm" />
                        VISTA PREVIA
                    </button>

                    <button
                        onClick={handleSendEmail}
                        disabled={formData.isSaving}
                        className="px-4 py-2 text-[11px] font-bold text-emerald-600 hover:bg-emerald-600 hover:text-white border-2 border-emerald-600 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm"
                    >
                        <Icon name={formData.isSaving ? 'sync' : 'mail'} className={`text-sm ${formData.isSaving ? 'animate-spin' : ''}`} />
                        ENVIAR POR EMAIL
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={formData.isSaving}
                        className="bg-[#1e40af] hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-xs font-bold shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <Icon name={formData.isSaving ? 'sync' : 'verified'} className={`text-sm font-bold ${formData.isSaving ? 'animate-spin' : ''}`} />
                        {formData.isSaving ? 'PROCESANDO...' : 'GENERAR PROFORMA'}
                    </button>
                </div>
            </header>

            {/* STITCH MAIN AREA */}
            <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-[1400px] mx-auto space-y-6">

                    <div className="grid grid-cols-12 gap-4">
                        {/* CLIENT DATA SECTION (COL-8) - Mas compacto */}
                        <section className="col-span-12 lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="p-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon name="person" className="text-[#1e40af] text-base" />
                                    <h2 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Receptor / Cliente</h2>
                                </div>
                                <span className="text-[9px] font-bold text-slate-300 mr-2">VALIDEZ FISCAL REQUERIDA</span>
                            </div>
                            <div className="p-4 grid grid-cols-3 gap-4">
                                <div className="col-span-2 space-y-3">
                                    <div className="relative client-selector-container">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase">Razón Social o Nombre</label>
                                            {formData.clientRFC && <span className="text-[9px] font-mono text-blue-500 font-bold">{formData.clientRFC}</span>}
                                        </div>
                                        <div className="relative">
                                            <input
                                                className="w-full border-slate-200 rounded-lg text-xs h-9 focus:ring-[#1e40af] focus:border-[#1e40af] transition-all pr-10 font-medium"
                                                placeholder="Seleccionar cliente..."
                                                type="text"
                                                value={searchTerm || formData.clientName}
                                                onChange={e => {
                                                    setSearchTerm(e.target.value);
                                                    setFormData({ ...formData, clientName: e.target.value });
                                                    setShowDropdown(true);
                                                }}
                                                onFocus={() => setShowDropdown(true)}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                                                <Icon name="expand_more" className="text-lg" />
                                            </div>
                                        </div>
                                        {/* Dropdown menu remains same logic but updated styles */}
                                        {showDropdown && (filteredClients.length > 0 || clients.length > 0) && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
                                                {(searchTerm ? filteredClients : clients).map(client => (
                                                    <div
                                                        key={client.id}
                                                        className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors group"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSelectClient(client);
                                                        }}
                                                    >
                                                        <div className="text-xs font-bold text-slate-700 group-hover:text-blue-600">{client.name}</div>
                                                        <div className="text-[9px] text-slate-400 font-mono tracking-tighter">{client.rfc} • {client.email || 'Sin email'}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Dirección Fiscal Corta</label>
                                            <input
                                                className="w-full border-slate-200 rounded-lg text-xs h-9 focus:ring-[#1e40af] focus:border-[#1e40af] transition-all"
                                                placeholder="Ej: Reforma 222, CDMX"
                                                type="text"
                                                value={formData.clientAddress}
                                                onChange={e => setFormData({ ...formData, clientAddress: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Correo Electrónico</label>
                                            <input
                                                className="w-full border-slate-200 rounded-lg text-xs h-9 focus:ring-[#1e40af] focus:border-[#1e40af] transition-all"
                                                placeholder="facturación@empresa.com"
                                                type="email"
                                                value={formData.clientEmail}
                                                onChange={e => setFormData({ ...formData, clientEmail: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">C.P.</label>
                                            <input
                                                className="w-full border-slate-200 rounded-lg text-xs h-9 focus:ring-[#1e40af] focus:border-[#1e40af] transition-all text-center font-mono"
                                                placeholder="54800"
                                                type="text"
                                                maxLength={5}
                                                value={formData.clientCP}
                                                onChange={e => setFormData({ ...formData, clientCP: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Régimen</label>
                                            <select
                                                className="w-full border-slate-200 rounded-lg text-[10px] h-9 focus:ring-[#1e40af] focus:border-[#1e40af] bg-slate-50"
                                                value={formData.clientRegime}
                                                onChange={e => setFormData({ ...formData, clientRegime: e.target.value })}
                                            >
                                                <option value="601">601 - Gral.</option>
                                                {regimes.slice(0, 10).map(r => (
                                                    <option key={r.code} value={r.code}>{r.code}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Uso de CFDI</label>
                                        <select
                                            className="w-full border-slate-200 rounded-lg text-[10px] h-9 focus:ring-[#1e40af] focus:border-[#1e40af]"
                                            value={formData.usage}
                                            onChange={e => setFormData({ ...formData, usage: e.target.value })}
                                        >
                                            <option value="G03">G03 - GASTOS EN GENERAL</option>
                                            <option value="S01">S01 - SIN EFECTOS FISCALES</option>
                                            <option value="CP01">CP01 - PAGOS</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* COMPACT EMISOR & VOUCHER (COL-4) */}
                        <section className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="p-2 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
                                <Icon name="settings_applications" className="text-[#1e40af] text-base" />
                                <h2 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Venta e Impuestos</h2>
                            </div>
                            <div className="p-4 space-y-3">
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Empresa Emisora</label>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/50 rounded-lg border border-blue-100">
                                        <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center shrink-0">
                                            <span className="text-[10px] text-white font-bold">{selectedOrg?.name?.substring(0, 1) || 'M'}</span>
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-700 truncate">{selectedOrg?.name || "MAGAÑA Y VIEIRA"}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Moneda</label>
                                        <select
                                            className="w-full border-slate-200 rounded-lg text-xs h-9 focus:ring-[#1e40af] focus:border-[#1e40af] font-bold text-blue-700"
                                            value={formData.currency}
                                            onChange={e => setFormData({ ...formData, currency: e.target.value })}
                                        >
                                            <option value="MXN">MXN ($)</option>
                                            <option value="USD">USD ($)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Método Pago</label>
                                        <select
                                            className="w-full border-slate-200 rounded-lg text-[10px] h-9 focus:ring-[#1e40af] focus:border-[#1e40af]"
                                            value={formData.paymentMethod}
                                            onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                                        >
                                            <option value="PUE">PUE - PAGO ÚNICO</option>
                                            <option value="PPD">PPD - PARCIALIDADES</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="pt-1 flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Solicitud Licitación</span>
                                        <span className="text-[10px] font-medium text-slate-500">¿Es para concurso obra?</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={formData.is_licitation} onChange={e => setFormData({ ...formData, is_licitation: e.target.checked })} />
                                        <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 shadow-sm" />
                                    </label>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* CONCEPTS TABLE AREA */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Icon name="receipt_long" className="text-[#1e40af] text-lg" />
                                    <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Conceptos del Servicio</h2>
                                </div>
                                <div className="h-6 w-px bg-slate-200 mx-2" />
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Actividad Económica:</label>
                                    <select
                                        className="border-slate-200 rounded-lg text-[11px] h-8 py-0 focus:ring-[#1e40af] focus:border-[#1e40af] bg-white min-w-[200px]"
                                        value={formData.economicActivity}
                                        onChange={e => setFormData({ ...formData, economicActivity: e.target.value })}
                                    >
                                        {orgActivities.length === 0 && <option value="">Sin actividades registradas</option>}
                                        {orgActivities.map(act => (
                                            <option key={act.id} value={act.activity_code}>
                                                {act.percentage}% - {act.description}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <button
                                onClick={addItem}
                                className="text-xs font-bold text-[#1e40af] flex items-center gap-1 hover:text-blue-700 transition-colors"
                            >
                                <Icon name="add_circle" className="text-sm" />
                                AGREGAR CONCEPTO
                            </button>
                        </div>
                        <div className="max-h-[600px] overflow-y-auto custom-scrollbar flex-1">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead className="sticky top-0 bg-white shadow-sm z-10">
                                    <tr className="bg-slate-50/80 text-slate-400 uppercase text-[9px] font-bold border-b border-slate-100">
                                        <th className="px-4 py-2 w-44 tracking-wider">Clave SAT</th>
                                        <th className="px-4 py-2 w-24 text-center tracking-wider">Cant.</th>
                                        <th className="px-4 py-2 w-28 text-center tracking-wider">Unidad</th>
                                        <th className="px-4 py-2 tracking-wider">Descripción del Servicio</th>
                                        <th className="px-4 py-2 w-40 text-right tracking-wider">P. Unitario</th>
                                        <th className="px-4 py-2 w-12 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {formData.items.map((item, idx) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-none">
                                            <td className="px-4 py-2 relative group align-middle">
                                                <ProductSelector
                                                    value={item.code}
                                                    activityCode={formData.economicActivity}
                                                    activityDescription={orgActivities.find(a => a.activity_code === formData.economicActivity)?.description}
                                                    onSelect={(prod) => {
                                                        const newItems = [...formData.items];
                                                        newItems[idx] = {
                                                            ...newItems[idx],
                                                            code: prod.code,
                                                            description: prod.name
                                                        };
                                                        setFormData({ ...formData, items: newItems });
                                                    }}
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-center align-middle">
                                                <input
                                                    className="w-full border-none bg-transparent p-0 text-[11px] text-center focus:ring-0 font-bold text-slate-700 focus:outline-none"
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-center align-middle">
                                                <UnitSelector
                                                    value={item.unit}
                                                    onSelect={(u) => updateItem(idx, 'unit', u.code)}
                                                />
                                            </td>
                                            <td className="px-4 py-2 align-middle">
                                                <textarea
                                                    className="w-full border-none bg-transparent p-0 text-[11px] resize-none focus:ring-0 leading-tight focus:outline-none transition-all text-slate-600"
                                                    rows={1}
                                                    style={{ minHeight: '1.5em' }}
                                                    value={item.description}
                                                    onChange={e => {
                                                        updateItem(idx, 'description', e.target.value);
                                                        // Auto-resize simple sin dependencias pesadas
                                                        e.target.style.height = 'auto';
                                                        e.target.style.height = e.target.scrollHeight + 'px';
                                                    }}
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-right align-middle">
                                                <input
                                                    className="w-full border-none bg-transparent p-0 text-[11px] text-right focus:ring-0 font-bold text-blue-700 focus:outline-none"
                                                    type="text"
                                                    value={item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value.replace(/,/g, '')) || 0)}
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-center align-middle">
                                                <button
                                                    onClick={() => removeItem(idx)}
                                                    className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50"
                                                >
                                                    <Icon name="delete" className="text-base" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center transition-all">
                            <button
                                onClick={addItem}
                                className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[#1e40af] text-[#1e40af] hover:bg-[#1e40af] hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                            >
                                <Icon name="add" className="text-sm" />
                                AÑADIR CONCEPTO
                            </button>
                            <div className="flex items-center gap-6">
                                <p className="text-[10px] text-slate-400 font-medium tracking-tight">Sugerencia: Use Tab para navegar entre celdas rápidamente.</p>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full border border-slate-200">Conceptos: {formData.items.length}</span>
                            </div>
                        </div>
                    </section>

                    {/* CONFIG AND TOTALS AREA */}
                    <div className="grid grid-cols-12 gap-6 pb-6">
                        {/* CONFIGURATION */}
                        <section className="col-span-12 lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                                <Icon name="settings" className="text-[#1e40af]" />
                                <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Configuración</h2>
                            </div>
                            <div className="p-5 flex flex-wrap items-center justify-between gap-8">
                                <ConfigToggle
                                    label="Tiene Cotización"
                                    sub="Vincular folio previo"
                                    checked={formData.hasQuotation}
                                    onChange={v => setFormData({ ...formData, hasQuotation: v })}
                                />
                                <ConfigToggle
                                    label="Requiere Contrato"
                                    sub="Anexo legal PDF"
                                    checked={formData.hasContract}
                                    onChange={v => setFormData({ ...formData, hasContract: v })}
                                />
                                <ConfigToggle
                                    label="Anticipo"
                                    sub="Pago adelantado"
                                    checked={formData.advancePayment}
                                    onChange={v => setFormData({ ...formData, advancePayment: v })}
                                />
                            </div>
                        </section>

                        {/* TOTALS PANEL */}
                        <section className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 flex flex-col justify-center">
                            <div className="flex justify-between text-xs text-slate-500">
                                <span className="font-medium">Subtotal</span>
                                <span className="font-bold text-slate-700">{subtotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500">
                                <span className="font-medium">IVA (16%)</span>
                                <span className="font-bold text-slate-700">{iva.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                            </div>
                            <div className="flex justify-between text-xl font-bold text-[#1e40af] pt-4 border-t border-slate-200">
                                <span className="uppercase text-sm mt-1 tracking-widest font-black">Total {formData.currency}</span>
                                <span className="tracking-tight text-2xl">{total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                            </div>
                        </section>
                    </div>
                </div>
            </main>

            {/* STITCH FOOTER */}
            <footer className="h-14 bg-white border-t border-slate-200 px-8 flex items-center justify-start shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-6">
                    <button className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-[#1e40af] transition-all uppercase tracking-widest">
                        <Icon name="visibility" className="text-base" />
                        Vista Previa PDF
                    </button>
                    <button className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-[#1e40af] transition-all uppercase tracking-widest">
                        <Icon name="mail" className="text-base" />
                        Enviar Copia a Socio
                    </button>
                </div>
            </footer>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                .force-light { color-scheme: light !important; }
            `}</style>
        </div>
    );
};

const ConfigToggle = ({ label, sub, checked, onChange }: { label: string, sub: string, checked: boolean, onChange: (v: boolean) => void }) => (
    <div className="flex items-center gap-4 group">
        <div>
            <p className="text-sm font-bold text-slate-700 leading-tight group-hover:text-[#1e40af] transition-colors">{label}</p>
            <p className="text-[10px] text-slate-400 font-medium">{sub}</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
            <input
                type="checkbox"
                className="sr-only peer"
                checked={checked}
                onChange={e => onChange(e.target.checked)}
            />
            <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-[#1e40af] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 transition-all shadow-inner" />
            <span className={`ml-2 text-[10px] font-black uppercase transition-all ${checked ? 'text-[#1e40af]' : 'text-slate-400'}`}>
                {checked ? 'ON' : 'OFF'}
            </span>
        </label>
    </div>
);

export default ProformaManager;
