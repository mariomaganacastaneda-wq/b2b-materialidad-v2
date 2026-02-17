import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { generateProformaPDF } from '../../lib/pdf';

// Material Symbols mapping to keep code clean
const Icon = ({ name, className = "" }: { name: string, className?: string }) => (
    <span className={`material-symbols-outlined ${className}`} style={{ fontSize: 'inherit' }}>{name}</span>
);

// Utility for positioning portals
const DropdownPortal = ({ children, anchor, width }: { children: React.ReactNode, anchor: DOMRect | null, width?: number }) => {
    if (!anchor) return null;
    return createPortal(
        <div
            className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
            style={{
                top: Math.min(anchor.bottom + 4, window.innerHeight - 300),
                left: Math.min(anchor.left, window.innerWidth - (width || 250)),
                width: width || anchor.width,
                maxHeight: '300px'
            }}
        >
            {children}
        </div>,
        document.body
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

const ProductSelector: React.FC<{ value: string, activityDescription?: string, activityCode?: string, onSelect: (prod: any) => void }> = ({ value, activityDescription, activityCode, onSelect }) => {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [anchor, setAnchor] = useState<DOMRect | null>(null);
    const [activeCategory, setActiveCategory] = useState('TODOS');
    const [activeTag, setActiveTag] = useState<string | null>(null);
    const [smartTags, setSmartTags] = useState<string[]>([]);
    const [userTags, setUserTags] = useState<string[]>([]);
    const [savedTags, setSavedTags] = useState<string[]>([]);
    const inputRef = React.useRef<HTMLDivElement>(null);

    // Cargar tags guardados al inicio
    useEffect(() => {
        const storedKey = `user_tags_${activityCode}`;
        const stored = localStorage.getItem(storedKey);
        let parsed = stored ? JSON.parse(stored) : [];

        // Demo para Albañilería (238130)
        if (activityCode === '238130' && parsed.length === 0) {
            parsed = ['MUROS DE BLOCK', 'ACABADO FINO'];
            localStorage.setItem(storedKey, JSON.stringify(parsed));
        }

        setSavedTags(parsed);
    }, [activityCode]);

    // Reset filter when search changes
    useEffect(() => {
        if (search) {
            setActiveCategory('TODOS');
            if (search.length > 3) setActiveTag(null); // Desactivar tag si el usuario escribe algo específico
        }
    }, [search]);

    // Extraer Smart Tags de los resultados de congruencia para máxima precisión
    useEffect(() => {
        const generateSmartTags = async () => {
            if (!activityCode) {
                setSmartTags([]);
                return;
            }

            setLoading(true);
            try {
                // 1. Obtener ejemplos reales (tokens) de la actividad
                const { data: tokens } = await supabase
                    .from('cat_activity_search_tokens')
                    .select('keyword')
                    .eq('activity_code', activityCode)
                    .limit(10);

                const tokenTags = (tokens || []).map((t: any) => t.keyword.toUpperCase());

                // 2. Obtener los productos sugeridos para esta actividad para extraer palabras clave adicionales
                const { data: congruence } = await supabase
                    .from('rel_activity_cps_congruence')
                    .select('cps_family_code')
                    .eq('activity_code', activityCode)
                    .limit(20);

                let extractedTags: string[] = [];
                if (congruence) {
                    const codes = congruence.map((c: any) => `${c.cps_family_code}00`);
                    const { data: products } = await supabase
                        .from('cat_cfdi_productos_servicios')
                        .select('name')
                        .in('code', codes);

                    if (products) {
                        const stopWords = ['comercio', 'por', 'menor', 'mayor', 'servicios', 'articulos', 'para', 'uso', 'clase', 'actividades', 'oficina', 'elaboracion', 'fabricacion', 'venta', 'mantenimiento', 'reparacion', 'alquilada', 'propia', 'excepto', 'otros', 'otras', 'asociados', 'relacionados', 'incluye', 'incluidos', 'industriales', 'trabajos', 'obras', 'diversos', 'especializados', 'general', 'integral', 'servicio'];

                        const allWords = products.flatMap((p: any) =>
                            p.name.toLowerCase()
                                .normalize("NFD")
                                .replace(/[\u0300-\u036f]/g, "")
                                .replace(/[.,()/]/g, ' ')
                                .split(/\s+/)
                        ).filter((w: any) => w.length > 3 && !stopWords.includes(w));

                        const freq: { [key: string]: number } = {};
                        allWords.forEach((w: any) => freq[w] = (freq[w] || 0) + 1);

                        extractedTags = Object.entries(freq)
                            .sort((a, b) => b[1] - a[1])
                            .map(([w]) => w.toUpperCase());
                    }
                }

                // Combinar priorizando tokens
                const finalTags = Array.from(new Set([...tokenTags, ...extractedTags]));
                setSmartTags(finalTags.slice(0, 15));
            } catch (err) {
                console.error('Error generating tags:', err);
            } finally {
                setLoading(false);
            }
        };
        generateSmartTags();
    }, [activityCode]);

    useEffect(() => {
        const fetchResults = async () => {
            // El motor de búsqueda prioritiza: 1. Tag Activo, 2. Búsqueda Manual, 3. Actividad Base
            let queryTag = activeTag || search;

            if (!queryTag && !activityCode && isOpen) return;
            if (!isOpen && !search && !activeTag) return;

            setLoading(true);
            try {
                let finalData: any[] = [];

                // Capa de Traducción de Conceptos: Búsqueda Inversa por Tokens
                let inverseActivityCodes: string[] = [];
                let inverseResults: any[] = [];
                const searchCriteria = activeTag || search;

                if (searchCriteria && searchCriteria.length > 2) {
                    const { data: tokenData } = await supabase
                        .from('cat_activity_search_tokens')
                        .select('activity_code, keyword')
                        .ilike('keyword', `%${searchCriteria}%`)
                        .limit(5);

                    if (tokenData && tokenData.length > 0) {
                        inverseActivityCodes = tokenData.map((t: any) => t.activity_code);

                        // Obtener misiones/clases sugeridas para estas actividades detectadas
                        const { data: inverseCongruence } = await supabase
                            .from('rel_activity_cps_congruence')
                            .select('cps_family_code, score, reason, cat_economic_activities(name)')
                            .in('activity_code', inverseActivityCodes)
                            .order('score', { ascending: false })
                            .limit(20);

                        if (inverseCongruence && inverseCongruence.length > 0) {
                            const familyCodes = inverseCongruence.map((c: any) => `${c.cps_family_code}00`);
                            const { data: inverseProducts } = await supabase
                                .from('cat_cfdi_productos_servicios')
                                .select('code, name')
                                .in('code', familyCodes);

                            if (inverseProducts) {
                                inverseResults = inverseProducts.map((p: any) => {
                                    const rel = inverseCongruence.find((c: any) => p.code === `${c.cps_family_code}00`);
                                    return {
                                        code: p.code,
                                        name: p.name,
                                        reason: rel?.reason || 'Ejemplo de Actividad',
                                        score: (rel?.score || 0) * 0.9, // Ligeramente menor prioridad que la actividad actual
                                        source: 'Sugerencia por Ejemplo',
                                        activityContext: (rel as any).cat_economic_activities?.name
                                    };
                                });
                            }
                        }
                    }
                }

                // 1. Obtener Congruencia Base (actividad actual)
                if (activityCode && !search) {
                    const { data: congruenceData } = await supabase
                        .from('rel_activity_cps_congruence')
                        .select('cps_family_code, score, reason')
                        .eq('activity_code', activityCode)
                        .order('score', { ascending: false })
                        .limit(50);

                    if (congruenceData && congruenceData.length > 0) {
                        const productCodes8Digits = congruenceData.map((c: any) => `${c.cps_family_code}00`);
                        const { data: products } = await supabase
                            .from('cat_cfdi_productos_servicios')
                            .select('code, name')
                            .in('code', productCodes8Digits);

                        if (products) {
                            finalData = products.map((p: any) => {
                                const rel = congruenceData.find((c: any) => p.code === `${c.cps_family_code}00`);
                                return {
                                    code: p.code,
                                    name: p.name,
                                    reason: rel?.reason || 'Mapeo Sugerido',
                                    score: rel?.score || 0,
                                    source: rel?.score && rel.score >= 1.0 ? 'Actividad Principal' : 'Actividad Relacionada'
                                };
                            });
                        }
                    }
                }

                // Combinar con búsqueda inversa (evitando duplicados)
                inverseResults.forEach(ir => {
                    if (!finalData.find((f: any) => f.code === ir.code)) {
                        finalData.push(ir);
                    }
                });

                finalData.sort((a, b) => (b.score || 0) - (a.score || 0));

                // 2. Mega-Búsqueda Global (Si hay Tag o Búsqueda Manual)
                const effectiveSearch = activeTag || search;
                if (effectiveSearch || (finalData.length === 0 && isOpen)) {
                    let query = supabase.from('cat_cfdi_productos_servicios').select('code, name');

                    if (/^\d+$/.test(effectiveSearch)) {
                        query = query.ilike('code', `${effectiveSearch}%`);
                    } else if (effectiveSearch) {
                        // Si hay tag activo, buscamos por esa palabra clave de forma amplia
                        query = query.ilike('name', `%${effectiveSearch}%`);
                    } else if (activityDescription) {
                        // Si no hay búsqueda pero sí actividad, usamos los primeros keywords para llenar el vacío
                        const keywords = smartTags.slice(0, 2).join(' ');
                        if (keywords) query = query.ilike('name', `%${keywords}%`);
                    }

                    const { data: globalData } = await query.limit(100); // Límite masivo para potencia
                    if (globalData) {
                        const mapped = globalData
                            .filter((p: any) => !finalData.find((f: any) => f.code === p.code))
                            .map((p: any) => ({
                                code: p.code,
                                name: p.name,
                                source: activeTag ? `Concepto: ${activeTag}` : (search ? 'Catálogo SAT' : 'Búsqueda Semántica')
                            }));
                        finalData = [...finalData, ...mapped];
                    }
                }
                // 3. Mapeo inverso de actividades para contexto (Solo para Global o Conceptos)
                const globalIndices = finalData.map((d: any, i: number) => d.source.includes('Global') || d.source.includes('Concepto') || d.source === 'Catálogo SAT' || d.source === 'Búsqueda Semántica' ? i : -1).filter((i: number) => i !== -1);

                if (globalIndices.length > 0) {
                    const familyCodes = Array.from(new Set(globalIndices.map((i: number) => finalData[i].code.substring(0, 6))));
                    const { data: activityContext } = await supabase
                        .from('rel_activity_cps_congruence')
                        .select('cps_family_code, cat_economic_activities(name)')
                        .in('cps_family_code', familyCodes)
                        .eq('score', 1.0)
                        .limit(50);

                    if (activityContext) {
                        const activityMap: Record<string, string> = {};
                        activityContext.forEach((ctx: any) => {
                            if (ctx.cat_economic_activities?.name) {
                                activityMap[ctx.cps_family_code] = ctx.cat_economic_activities.name;
                            }
                        });

                        globalIndices.forEach(i => {
                            const family = finalData[i].code.substring(0, 6);
                            if (activityMap[family]) {
                                finalData[i].activityContext = activityMap[family];
                            }
                        });
                    }
                }

                setResults(finalData);
            } catch (err) {
                console.error('Error suggestions:', err);
            } finally {
                setLoading(false);
            }
        };
        const timer = setTimeout(fetchResults, 300);
        return () => clearTimeout(timer);
    }, [search, activityCode, activeTag, isOpen, smartTags, userTags, savedTags]);

    const saveTagPersistence = (tag: string) => {
        if (!savedTags.includes(tag)) {
            const newSaved = [...savedTags, tag];
            setSavedTags(newSaved);
            localStorage.setItem(`user_tags_${activityCode}`, JSON.stringify(newSaved));
            // Eliminar de temporales una vez guardado
            setUserTags(prev => prev.filter(t => t !== tag));
        }
    };

    const deleteTagPersistence = (tag: string) => {
        const newSaved = savedTags.filter(t => t !== tag);
        setSavedTags(newSaved);
        localStorage.setItem(`user_tags_${activityCode}`, JSON.stringify(newSaved));
    };

    const handleOpen = () => {
        if (inputRef.current) {
            setAnchor(inputRef.current.getBoundingClientRect());
            setIsOpen(true);
        }
    };

    const handleEditTag = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeTag) {
            setSearch(activeTag);
            setActiveTag(null);
            if (inputRef.current) {
                const input = inputRef.current.querySelector('input');
                if (input) input.focus();
            }
        }
    };

    return (
        <div ref={inputRef} className="relative w-full">
            <div
                className={`flex items-center justify-between px-3 h-8 rounded-lg transition-all cursor-pointer border ${isOpen ? 'bg-white border-blue-500 ring-2 ring-blue-50 shadow-sm' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                onClick={handleOpen}
            >
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                    {activeTag ? (
                        <div
                            onMouseDown={handleEditTag}
                            className="flex items-center gap-1 bg-blue-600 text-white px-2 py-0.5 rounded-md text-[9px] font-black animate-in zoom-in-95 duration-200 cursor-edit group/tag shrink-0"
                            title="Clic para editar concepto"
                        >
                            <Icon name="edit" className="text-[8px] opacity-0 group-hover/tag:opacity-100 transition-opacity" />
                            <span className="uppercase tracking-tighter">{activeTag}</span>
                            <button
                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setActiveTag(null); }}
                                className="hover:bg-blue-700 rounded-full p-0.5 transition-colors ml-1"
                            >
                                <Icon name="close" className="text-[8px]" />
                            </button>
                        </div>
                    ) : (
                        <Icon name="inventory_2" className={`text-xs shrink-0 ${isOpen ? 'text-blue-500' : 'text-slate-400'}`} />
                    )}

                    <span className={`text-[10px] font-bold truncate ${value ? 'text-slate-700' : 'text-slate-400 uppercase tracking-tighter'}`}>
                        {value || 'Seleccionar concepto'}
                    </span>
                </div>

                <Icon name={isOpen ? 'close' : 'expand_more'} className={`text-[10px] shrink-0 ml-2 ${isOpen ? 'text-blue-500' : 'text-slate-300'}`} />
            </div>

            {isOpen && (
                <DropdownPortal anchor={anchor} width={500}>
                    <div className="flex flex-col h-full max-h-[400px] overflow-hidden">
                        <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-100 flex items-center gap-4 shrink-0">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Inteligencia SAT CFDI 4.0</span>
                            <div className="flex-1 flex items-center gap-2 bg-white border border-slate-200 rounded px-2 h-6 hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-50 transition-all group/inner-search">
                                <Icon name="search" className="text-[10px] text-slate-300 group-focus-within/inner-search:text-blue-500" />
                                <input
                                    type="text"
                                    autoFocus
                                    className="w-full bg-transparent border-none p-0 text-[10px] font-bold text-slate-600 focus:ring-0 placeholder:text-slate-300 placeholder:font-medium uppercase"
                                    placeholder="Búsqueda personalizada..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && search.length > 2) {
                                            const tag = search.toUpperCase();
                                            setActiveTag(tag);
                                            if (!userTags.includes(tag) && !smartTags.includes(tag) && !savedTags.includes(tag)) {
                                                setUserTags(prev => [tag, ...prev]);
                                            }
                                            setSearch('');
                                        }
                                    }}
                                />
                                {search && (
                                    <button onMouseDown={(e) => { e.preventDefault(); setSearch(''); }} className="text-slate-300 hover:text-slate-500">
                                        <Icon name="close" className="text-[10px]" />
                                    </button>
                                )}
                            </div>
                            {loading && <div className="text-[9px] text-blue-500 font-bold animate-pulse">...</div>}
                        </div>

                        {/* Nube de Conceptos (Sugerencias + Usuario) */}
                        {(smartTags.length > 0 || userTags.length > 0 || savedTags.length > 0) && (
                            <div className="bg-white border-b border-slate-50 p-3 shrink-0">
                                <div className="flex flex-col gap-3">
                                    {/* Tags Guardados (Persistentes) */}
                                    {savedTags.length > 0 && (
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2 px-1">
                                                <Icon name="verified" className="text-emerald-500 text-[10px]" />
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Favoritos Guardados:</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto no-scrollbar">
                                                {savedTags.map(tag => (
                                                    <div key={tag} className="relative group/stag">
                                                        <button
                                                            onMouseDown={(e) => { e.preventDefault(); setActiveTag(tag); }}
                                                            className={`px-2 py-0.5 rounded text-[8px] font-black transition-all border pr-4 ${activeTag === tag
                                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                                : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-300'
                                                                }`}
                                                        >
                                                            {tag}
                                                        </button>
                                                        <button
                                                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); deleteTagPersistence(tag); if (activeTag === tag) setActiveTag(null); }}
                                                            className="absolute right-1 top-1/2 -translate-y-1/2 text-emerald-400 hover:text-emerald-600 opacity-0 group-hover/stag:opacity-100 transition-opacity"
                                                        >
                                                            <Icon name="close" className="text-[7px]" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tags Temporales (Sesión actual) */}
                                    {userTags.length > 0 && (
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2 px-1">
                                                <Icon name="history" className="text-indigo-500 text-[10px]" />
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">En esta sesión:</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto no-scrollbar">
                                                {userTags.filter(ut => !savedTags.includes(ut)).map(tag => (
                                                    <div key={tag} className="relative group/utag">
                                                        <button
                                                            onMouseDown={(e) => { e.preventDefault(); setActiveTag(tag); }}
                                                            className={`px-2 py-0.5 rounded text-[8px] font-black transition-all border pr-4 ${activeTag === tag
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                                : 'bg-indigo-50/50 text-indigo-700 border-indigo-100 hover:border-indigo-300'
                                                                }`}
                                                        >
                                                            {tag}
                                                        </button>
                                                        <button
                                                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setUserTags(prev => prev.filter(t => t !== tag)); if (activeTag === tag) setActiveTag(null); }}
                                                            className="absolute right-1 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-600 opacity-0 group-hover/utag:opacity-100 transition-opacity"
                                                        >
                                                            <Icon name="close" className="text-[7px]" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {smartTags.length > 0 && (
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2 px-1">
                                                <Icon name="psychology" className="text-blue-500 text-[10px]" />
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Sugerencias IA:</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto no-scrollbar">
                                                {smartTags.filter(st => !userTags.includes(st) && !savedTags.includes(st)).map(tag => (
                                                    <button
                                                        key={tag}
                                                        onMouseDown={(e) => { e.preventDefault(); setActiveTag(tag); }}
                                                        className={`px-2 py-0.5 rounded text-[8px] font-black transition-all border ${activeTag === tag
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                            : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-blue-200 hover:text-blue-600'
                                                            }`}
                                                    >
                                                        {tag}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Filtros de Categoría */}
                        {results.length > 0 && (
                            <div className="flex bg-slate-50/50 p-2 gap-2 border-b border-slate-100 overflow-x-auto no-scrollbar shrink-0">
                                {['TODOS', 'PRINCIPAL', 'RELACIONADO', 'EJEMPLOS', 'ESTA BÚSQUEDA'].map(cat => (
                                    <button
                                        key={cat}
                                        onMouseDown={(e) => { e.preventDefault(); setActiveCategory(cat); }}
                                        className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider transition-all border whitespace-nowrap ${activeCategory === cat
                                            ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                                            : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600'
                                            }`}
                                    >
                                        {cat === 'ESTA BÚSQUEDA' ? (activeTag ? `CONCEPTO: ${activeTag}` : 'GLOBAL') : cat}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="overflow-y-auto custom-scrollbar flex-1 bg-white">
                            {results.length === 0 && !loading && (
                                <div className="px-4 py-8 flex flex-col items-center gap-3">
                                    <Icon name="search_off" className="text-3xl text-slate-200" />
                                    <div className="text-[10px] text-slate-400 italic text-center max-w-[200px]">
                                        No encontramos resultados para "{search || activeTag}". <br />
                                        <span className="font-bold text-blue-500">Prueba con un concepto más general o busca otro tag.</span>
                                    </div>
                                </div>
                            )}
                            {results.filter(prod => {
                                if (activeCategory === 'TODOS') return true;
                                if (activeCategory === 'PRINCIPAL') return prod.source === 'Actividad Principal';
                                if (activeCategory === 'RELACIONADO') return prod.source === 'Actividad Relacionada';
                                if (activeCategory === 'EJEMPLOS') return prod.source === 'Sugerencia por Ejemplo';
                                if (activeCategory === 'ESTA BÚSQUEDA') return prod.source.includes('Concepto:') || prod.source === 'Catálogo SAT' || prod.source === 'Búsqueda Semántica';
                                return true;
                            }).map(prod => (
                                <div
                                    key={`${prod.code}-${prod.source}`}
                                    className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-none transition-all flex items-center gap-3 group"
                                    onMouseDown={() => {
                                        if (activeTag && userTags.includes(activeTag)) {
                                            saveTagPersistence(activeTag);
                                        }
                                        onSelect(prod);
                                        setIsOpen(false);
                                        setSearch('');
                                        setActiveTag(null);
                                    }}
                                >
                                    <div className="flex flex-col shrink-0 items-center w-12 bg-slate-50 rounded p-1 group-hover:bg-blue-50 transition-colors">
                                        <span className="text-[9px] font-black text-blue-700 font-mono tracking-tighter">{prod.code}</span>
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                            <span className={`text-[6px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0 ${prod.source === 'Actividad Principal' ? 'bg-emerald-100 text-emerald-700' :
                                                prod.source === 'Actividad Relacionada' ? 'bg-amber-100 text-amber-700' :
                                                    prod.source === 'Sugerencia por Ejemplo' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-blue-100 text-blue-700'
                                                }`}>
                                                {prod.source}
                                            </span>
                                            {prod.activityContext && (
                                                <span className={`text-[6px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter flex items-center gap-1 shrink-0 ${prod.source === 'Sugerencia por Ejemplo' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-white'}`}>
                                                    <Icon name={prod.source === 'Sugerencia por Ejemplo' ? 'auto_awesome' : 'business_center'} className="text-[7px]" />
                                                    {prod.source === 'Sugerencia por Ejemplo' ? 'INTENCIÓN: ' : 'ACTIVIDAD: '}{prod.activityContext}
                                                </span>
                                            )}
                                            {prod.score !== undefined && (
                                                <span className="text-[7px] font-black text-slate-300 ml-auto shrink-0">{Math.round(prod.score * 100)}% Match</span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-700 font-bold truncate uppercase tracking-tight group-hover:text-blue-600 transition-colors">{prod.name}</p>
                                        {prod.reason && <p className="text-[8px] text-slate-400 truncate italic">{prod.reason}</p>}
                                    </div>
                                    <Icon name="add_circle" className="text-slate-200 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all text-sm" />
                                </div>
                            ))}
                        </div>
                        {results.length > 0 && !loading && (
                            <div className="bg-slate-50 px-3 py-1.5 border-t border-slate-100 shrink-0 flex justify-between">
                                <span className="text-[8px] text-slate-400 font-bold">Mostrando {results.length} resultados potenciales</span>
                                <span className="text-[8px] text-blue-500 font-black animate-pulse uppercase">Mega-Búsqueda Activa</span>
                            </div>
                        )}
                    </div>
                </DropdownPortal>
            )}
        </div>
    );
};

/**
 * Motor de Sugerencia de Unidades Inteligentes
     * Analiza el nombre y código SAT para predecir la unidad de medida más probable.
     */
const suggestUnit = (name: string, code: string): string => {
    const text = (name || '').toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // Quitar acentos para matching robusto

    // 1. Servicios: Códigos que empiezan con 7, 8 o 9 (Jerarquía SAT) o palabras clave
    if (code.startsWith('7') || code.startsWith('8') || code.startsWith('9') ||
        ['SERVICIO', 'ASESORIA', 'CONSULTORIA', 'MANTENIMIENTO', 'HONORARIOS', 'REPARACION', 'CAPACITACION'].some(k => text.includes(k))) {
        return 'E48'; // Unidad de servicio
    }

    // 2. Líquidos y Combustibles
    if (['LITRO', 'LTR', 'ACEITE', 'AGUA', 'PINTURA', 'SOLVENTE', 'COMBUSTIBLE', 'GASOLINA'].some(k => text.includes(k))) {
        return 'LTR'; // Litro
    }

    // 3. Peso y Alimentos a Granel
    if (['KILO', 'KGM', 'ARROZ', 'FRIJOL', 'CARNE', 'AZUCAR', 'POLLO', 'HARINA', 'PULPA'].some(k => text.includes(k))) {
        return 'KGM'; // Kilogramo
    }

    // 4. Construcción y Peso Pesado
    if (['TONELADA', 'TNE', 'CEMENTO', 'ARENA', 'GRAVA', 'VARILLA'].some(k => text.includes(k))) {
        return 'TNE'; // Tonelada
    }

    // 5. Longitud
    if (['METRO', 'MTR', 'CABLE', 'TUBO', 'VARILLA'].some(k => text.includes(k))) {
        return 'MTR'; // Metro
    }

    // Default: Pieza (H87) para la mayoría de los bienes de consumo e infraestructura
    return 'H87';
};

const UnitSelector: React.FC<{ value: string, suggestedUnit?: string, onSelect: (unit: any) => void }> = ({ value, suggestedUnit, onSelect }) => {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [anchor, setAnchor] = useState<DOMRect | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchUnits = async () => {
            if (!isOpen) return;
            setLoading(true);
            try {
                let query = supabase.from('cat_cfdi_unidades').select('code, name, symbol');
                if (search) {
                    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
                } else {
                    // Si hay una unidad sugerida por el producto, ponerla primero
                    const commonCodes = ['H87', 'E48', 'ACT', 'KGM', 'LTR', 'TNE', 'MTR', 'P1', 'ZZ'];
                    const priorityCodes = suggestedUnit && !commonCodes.includes(suggestedUnit)
                        ? [suggestedUnit, ...commonCodes]
                        : commonCodes;
                    query = query.in('code', priorityCodes);
                }
                const { data } = await query.limit(10);
                if (data) {
                    // Ordenar para que la sugerida salga primero si no hay búsqueda
                    if (!search && suggestedUnit) {
                        const sorted = [...data].sort((a, b) => a.code === suggestedUnit ? -1 : b.code === suggestedUnit ? 1 : 0);
                        setResults(sorted);
                    } else {
                        setResults(data);
                    }
                }
            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        const timer = setTimeout(fetchUnits, 300);
        return () => clearTimeout(timer);
    }, [search, isOpen, suggestedUnit]);

    const handleOpen = () => {
        if (containerRef.current) {
            setAnchor(containerRef.current.getBoundingClientRect());
            setIsOpen(true);
        }
    };

    return (
        <div ref={containerRef} className="relative w-full">
            <div
                className={`flex items-center gap-1.5 px-3 h-8 rounded-lg transition-all cursor-text border ${isOpen ? 'bg-white border-blue-500 shadow-sm focus-within:ring-2 focus-within:ring-blue-50' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                onClick={handleOpen}
            >
                <input
                    className="w-full border-none bg-transparent p-0 text-[10px] text-center focus:ring-0 font-black text-slate-700 focus:outline-none uppercase"
                    type="text"
                    value={isOpen ? search : value}
                    placeholder="UNIDAD"
                    autoComplete="off"
                    onChange={e => { setSearch(e.target.value); if (!isOpen) handleOpen(); }}
                    onFocus={handleOpen}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                />
                {suggestedUnit === value && (
                    <div className="absolute top-0 right-0 -mt-1 -mr-1">
                        <span className="flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                    </div>
                )}
                <Icon name="swap_vert" className={`text-xs shrink-0 ${isOpen ? 'text-blue-500' : 'text-slate-300'}`} />
            </div>
            {isOpen && (
                <DropdownPortal anchor={anchor} width={220}>
                    <div className="bg-slate-50 px-2 py-1.5 border-b border-slate-100 flex justify-between items-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unidad CFDI</span>
                        {loading && <div className="text-[9px] text-blue-500 font-bold animate-pulse">...</div>}
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar bg-white">
                        {results.map((unit) => (
                            <div
                                key={unit.code}
                                className={`px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors flex items-center justify-between group ${unit.code === suggestedUnit ? 'bg-blue-50 border-blue-100' : ''}`}
                                onMouseDown={() => { onSelect(unit); setIsOpen(false); setSearch(''); }}
                            >
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-blue-600 leading-tight">{unit.code}</span>
                                    <span className="text-[9px] text-slate-500 truncate w-32 font-medium">{unit.name}</span>
                                </div>
                                {unit.symbol && <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{unit.symbol}</span>}
                            </div>
                        ))}
                    </div>
                </DropdownPortal>
            )}
        </div>
    );
};

interface ProformaManagerProps {
    selectedOrg: any;
}

const ProformaManager: React.FC<ProformaManagerProps> = ({ selectedOrg }) => {
    const { id } = useParams();
    const navigate = useNavigate();
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
        execution_period: '',
        proforma_number: 1,
        total_proformas: 1,
        contract_reference: '',
        is_licitation: false,
        hasQuotation: false,
        hasContract: false,
        advancePayment: false,
        items: [{ id: Date.now(), code: '', quantity: 1, unit: 'E48', description: '', unitPrice: 0 }],
        isSaving: false,
        saveError: null as string | null,
        saveSuccess: false
    });

    const [user, setUser] = useState<any>(null);

    const subtotal = formData.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    useEffect(() => {
        const loadUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        loadUser();
    }, []);

    // Cargar datos si existe un ID en la URL
    useEffect(() => {
        if (id) {
            loadQuotationData(id);
        }
    }, [id]);

    const loadQuotationData = async (quotationId: string) => {
        try {
            // 1. Fetch quotation
            const { data: q, error: qError } = await supabase
                .from('quotations')
                .select(`
                    *,
                    organizations(*)
                `)
                .eq('id', quotationId)
                .single();

            if (qError) throw qError;

            // 2. Fetch items
            const { data: items, error: iError } = await supabase
                .from('quotation_items')
                .select('*')
                .eq('quotation_id', quotationId);

            if (iError) throw iError;

            // 3. Update form
            setFormData(prev => ({
                ...prev,
                clientName: q.organizations?.name || '',
                clientRFC: q.organizations?.rfc || '',
                clientAddress: q.organizations?.tax_domicile || '',
                clientCP: q.organizations?.state || '', // Usando state como fallback si no hay zip_code específico
                clientRegime: q.organizations?.capital_regime || '601',
                economicActivity: q.description || '',
                currency: q.currency || 'MXN',
                execution_period: q.execution_period || '',
                proforma_number: q.proforma_number || 1,
                total_proformas: q.total_proformas || 1,
                contract_reference: q.contract_reference || '',
                paymentMethod: q.payment_method || 'PUE',
                paymentForm: q.payment_form || '03',
                items: items && items.length > 0 ? items.map((item: any) => ({
                    id: item.id,
                    code: item.sat_product_key,
                    quantity: parseFloat(item.quantity),
                    unit: item.unit_id,
                    description: item.description,
                    unitPrice: parseFloat(item.unit_price)
                })) : prev.items
            }));
        } catch (err: any) {
            console.error('Error loading quotation:', err);
        }
    };
    const handlePreview = () => {
        if (!selectedOrg) {
            alert('No se ha seleccionado una organización emisora.');
            return;
        }

        try {
            console.log('Generando vista previa con:', { formData, subtotal, total });

            // Resolver descripción de actividad económica si es un código
            const activityDesc = orgActivities.find(a => a.activity_code === formData.economicActivity)?.description || formData.economicActivity;

            generateProformaPDF({
                ...formData,
                economicActivity: activityDesc,
                subtotal,
                iva,
                total,
                orgName: selectedOrg.name,
                orgRFC: selectedOrg.rfc || '',
                orgLogoUrl: selectedOrg.logo_url || 'none',
                orgColor: selectedOrg.primary_color || '#1e40af',
                orgSecondaryColor: selectedOrg.theme_config?.secondary_color,
                orgAccentColor: selectedOrg.theme_config?.accent_color,
                bankAccounts: selectedOrg.bank_accounts
            });
        } catch (err: any) {
            console.error('Error al iniciar vista previa:', err);
            alert('Error al iniciar vista previa: ' + err.message);
        }
    };


    const handleDuplicate = () => {
        // Resetear ID y aumentar secuencia
        const nextNum = (formData.proforma_number || 1) + 1;
        setFormData(prev => ({
            ...prev,
            proforma_number: nextNum,
            saveSuccess: false,
            saveError: null
        }));
        // Navegar a ruta de creación limpia (pero con estado actual)
        navigate('/cotizaciones/nueva');
        alert('Proforma clonada. Ajuste el periodo y conceptos antes de guardar el nuevo registro.');
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
            // 1. Insertar o Actualizar Cabecera (Quotation)
            let quotationId = id;

            const quotationPayload = {
                organization_id: selectedOrg.id,
                vendor_id: null,
                amount_subtotal: subtotal,
                amount_iva: iva,
                amount_total: total,
                currency: formData.currency,
                status: 'PENDIENTE',
                type: 'SERVICIO',
                description: `Proforma para ${formData.clientName}`,
                created_by: user?.id || null,
                is_licitation: formData.is_licitation || false,
                is_contract_required: formData.hasContract,
                request_direct_invoice: false,
                execution_period: formData.execution_period,
                proforma_number: formData.proforma_number,
                total_proformas: formData.total_proformas,
                contract_reference: formData.contract_reference,
                payment_method: formData.paymentMethod,
                payment_form: formData.paymentForm
            };

            if (id) {
                // UPDATE existente
                const { error: qError } = await supabase
                    .from('quotations')
                    .update(quotationPayload)
                    .eq('id', id);
                if (qError) throw qError;
            } else {
                // INSERT nuevo
                const { data: quotation, error: qError } = await supabase
                    .from('quotations')
                    .insert(quotationPayload)
                    .select()
                    .single();
                if (qError) throw qError;
                quotationId = quotation.id;
            }

            // 2. Sincronizar Items (Borrar y Re-insertar para simplicidad en edición)
            if (id) {
                const { error: dError } = await supabase
                    .from('quotation_items')
                    .delete()
                    .eq('quotation_id', quotationId);
                if (dError) throw dError;
            }

            const itemsToInsert = formData.items.map(item => ({
                quotation_id: quotationId,
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
            alert(id ? 'Proforma actualizada con éxito' : 'Proforma guardada con éxito');

            if (!id && quotationId) {
                navigate(`/cotizaciones/${quotationId}`);
            }

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
            clientRegime: '601' // Por defecto General de Ley, ya que capital_regime es el tipo de sociedad
        });
        setSearchTerm(''); // Limpiar búsqueda para que al volver a abrir se vea todo
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
            items: [...formData.items, { id: Date.now(), code: '', quantity: 1, unit: 'E48', description: '', unitPrice: 0 }]
        });
    };

    const removeItem = (index: number) => {
        if (formData.items.length > 1) {
            const newItems = formData.items.filter((_, i) => i !== index);
            setFormData({ ...formData, items: newItems });
        }
    };


    return (
        <div className="flex flex-col min-h-screen text-slate-900 bg-[#f8fafc] font-['Inter',_sans-serif] overflow-hidden force-light">
            {/* STITCH HEADER */}
            <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-9 h-9 bg-white border border-slate-100 rounded-lg flex items-center justify-center shadow-sm overflow-hidden shrink-0">
                        {selectedOrg?.logo_url ? (
                            <img src={selectedOrg.logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
                        ) : (
                            <Icon name="business" className="text-blue-600 text-xl" />
                        )}
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-slate-800 leading-none">{selectedOrg?.name || "Generador de Proformas"}</h1>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">
                            {selectedOrg ? `RFC: ${selectedOrg.rfc}` : "Módulo Comercial"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {id && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleDuplicate}
                                className="px-4 py-1.5 text-[11px] font-bold text-amber-600 hover:text-white hover:bg-amber-500 border border-amber-500 rounded-lg transition-all flex items-center gap-2"
                            >
                                <Icon name="content_copy" className="text-sm" />
                                DUPLICAR
                            </button>
                            <button
                                onClick={() => navigate('/cotizaciones')}
                                className="px-4 py-1.5 text-[11px] font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all flex items-center gap-2"
                            >
                                <Icon name="arrow_back" className="text-sm" />
                                VOLVER AL DASHBOARD
                            </button>
                        </div>
                    )}

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
                        <section className="col-span-12 lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
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
                                                className="w-full border-slate-200 rounded-lg text-xs h-9 focus:ring-[#1e40af] focus:border-[#1e40af] transition-all pr-10 font-bold text-slate-700 bg-slate-50/30"
                                                placeholder="Buscar o seleccionar cliente..."
                                                type="text"
                                                value={showDropdown ? searchTerm : formData.clientName}
                                                onChange={e => {
                                                    setSearchTerm(e.target.value);
                                                    setFormData({ ...formData, clientName: e.target.value });
                                                    setShowDropdown(true);
                                                }}
                                                onFocus={() => setShowDropdown(true)}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
                                                <Icon name={showDropdown ? 'search' : 'expand_more'} className="text-lg" />
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
                                                        <div className="text-xs font-bold text-slate-700 group-hover:text-blue-600 break-words line-clamp-2">{client.name}</div>
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
                        <section className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
                            <div className="p-2 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
                                <Icon name="settings_applications" className="text-[#1e40af] text-base" />
                                <h2 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Venta e Impuestos</h2>
                            </div>
                            <div className="p-4 space-y-3">
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Empresa Emisora</label>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/50 rounded-lg border border-blue-100">
                                        <div className="w-8 h-8 bg-white rounded border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                                            {selectedOrg?.logo_url ? (
                                                <img
                                                    src={selectedOrg.logo_url}
                                                    alt="Logo"
                                                    className="w-full h-full object-contain"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                        const parent = target.parentElement;
                                                        if (parent) {
                                                            parent.innerHTML = `<span class="text-[10px] text-blue-600 font-black">${selectedOrg?.name?.substring(0, 1) || 'M'}</span>`;
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <span className="text-[10px] text-blue-600 font-black">{selectedOrg?.name?.substring(0, 1) || 'M'}</span>
                                            )}
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-[11px] font-bold text-slate-700 leading-tight mb-1">{selectedOrg?.name || "MAGAÑA Y VIEIRA"}</span>
                                            <span className="text-[9px] font-mono text-slate-400 tracking-tighter">{selectedOrg?.rfc}</span>
                                        </div>
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
                                <div className="pt-2 border-t border-slate-100">
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Cuentas Bancarias (Emisor)</label>
                                    <div className="text-[10px] text-slate-600 font-medium bg-slate-50 p-2 rounded border border-slate-100">
                                        {selectedOrg?.bank_accounts ? (
                                            <div className="space-y-1">
                                                {selectedOrg.bank_accounts.map((acc: any, i: number) => (
                                                    <div key={i} className="flex justify-between border-b border-slate-100 last:border-0 pb-1 last:pb-0">
                                                        <span className="font-bold">{acc.bank}:</span>
                                                        <span className="font-mono">{acc.clabe || acc.number}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="italic text-slate-400">Sin cuentas registradas</span>
                                        )}
                                    </div>
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
                                        <th className="px-4 py-2 w-32 text-right tracking-wider">P. Unitario</th>
                                        <th className="px-4 py-2 w-32 text-right tracking-wider">Importe</th>
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
                                                    onSelect={async (prod) => {
                                                        const newItems = [...formData.items];
                                                        const suggested = suggestUnit(prod.name, prod.code);

                                                        // Memoria de Precios Inteligente: Consultar historial de la empresa
                                                        let historicalPrice = 0;
                                                        if (selectedOrg?.id) {
                                                            const { data } = await supabase
                                                                .from('quotation_items')
                                                                .select('unit_price, quotations!inner(organization_id)')
                                                                .eq('sat_product_key', prod.code)
                                                                .eq('quotations.organization_id', selectedOrg.id)
                                                                .order('created_at', { ascending: false })
                                                                .limit(1);

                                                            if (data?.[0]) historicalPrice = data[0].unit_price;
                                                        }

                                                        newItems[idx] = {
                                                            ...newItems[idx],
                                                            code: prod.code,
                                                            description: prod.name,
                                                            unit: suggested,
                                                            unitPrice: historicalPrice || newItems[idx].unitPrice
                                                        };
                                                        setFormData({ ...formData, items: newItems });
                                                    }}
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-center align-middle">
                                                <input
                                                    className="w-full border-none bg-transparent p-0 text-[11px] text-center focus:ring-0 font-bold text-slate-700 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    type="number"
                                                    step="any"
                                                    value={item.quantity}
                                                    placeholder="0"
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        if (val === '') {
                                                            updateItem(idx, 'quantity', 0);
                                                        } else {
                                                            updateItem(idx, 'quantity', parseFloat(val));
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-center align-middle">
                                                <UnitSelector
                                                    value={item.unit}
                                                    suggestedUnit={suggestUnit(item.description, item.code)}
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
                                                <div className="flex items-center justify-end gap-1">
                                                    <span className="text-[10px] text-slate-300 font-bold">$</span>
                                                    <div className="relative flex-1">
                                                        <input
                                                            className="w-24 border-none bg-transparent p-0 text-[11px] text-right focus:ring-0 font-bold text-blue-700 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            type="number"
                                                            step="any"
                                                            value={item.unitPrice}
                                                            placeholder="0.00"
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                if (val === '') {
                                                                    updateItem(idx, 'unitPrice', 0);
                                                                } else {
                                                                    updateItem(idx, 'unitPrice', parseFloat(val));
                                                                }
                                                            }}
                                                        />
                                                        {item.unitPrice > 0 && (
                                                            <div className="absolute -top-3 right-0">
                                                                <span className="text-[7px] font-black text-emerald-500 uppercase flex items-center gap-0.5 animate-in fade-in zoom-in-90 duration-500">
                                                                    <Icon name="history" className="text-[8px]" />
                                                                    HISTÓRICO
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-right align-middle bg-slate-50/30">
                                                <span className="text-[11px] font-black text-slate-700">
                                                    {(item.quantity * item.unitPrice).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                                </span>
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
                                <div className="h-10 w-px bg-slate-100 hidden lg:block" />
                                <div className="flex flex-1 gap-4">
                                    <div className="flex-1">
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Periodo de Ejecución</label>
                                        <input
                                            className="w-full border-slate-200 rounded-lg text-xs h-9 focus:ring-[#1e40af] focus:border-[#1e40af]"
                                            placeholder="Ej: MARZO 2024"
                                            type="text"
                                            value={formData.execution_period}
                                            onChange={e => setFormData({ ...formData, execution_period: e.target.value })}
                                        />
                                    </div>
                                    <div className="w-32">
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Secuencia</label>
                                        <div className="flex items-center gap-1">
                                            <input
                                                className="w-12 border-slate-200 rounded-lg text-xs h-9 text-center focus:ring-[#1e40af] focus:border-[#1e40af]"
                                                type="number"
                                                value={formData.proforma_number}
                                                onChange={e => setFormData({ ...formData, proforma_number: parseInt(e.target.value) || 1 })}
                                            />
                                            <span className="text-xs font-bold text-slate-300">/</span>
                                            <input
                                                className="w-12 border-slate-200 rounded-lg text-xs h-9 text-center focus:ring-[#1e40af] focus:border-[#1e40af]"
                                                type="number"
                                                value={formData.total_proformas}
                                                onChange={e => setFormData({ ...formData, total_proformas: parseInt(e.target.value) || 1 })}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Ref. Contrato</label>
                                        <input
                                            className="w-full border-slate-200 rounded-lg text-xs h-9 focus:ring-[#1e40af] focus:border-[#1e40af]"
                                            placeholder="Ej: AD-SM-001"
                                            type="text"
                                            value={formData.contract_reference}
                                            onChange={e => setFormData({ ...formData, contract_reference: e.target.value })}
                                        />
                                    </div>
                                </div>
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
                    <button
                        onClick={handlePreview}
                        className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-[#1e40af] transition-all uppercase tracking-widest"
                    >
                        <Icon name="visibility" className="text-base" />
                        Vista Previa PDF
                    </button>
                    <button
                        onClick={handleSendEmail}
                        disabled={formData.isSaving}
                        className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-[#1e40af] transition-all uppercase tracking-widest disabled:opacity-50"
                    >
                        <Icon name={formData.isSaving ? 'sync' : 'mail'} className={`text-base ${formData.isSaving ? 'animate-spin' : ''}`} />
                        Enviar por email
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


export default ProformaManager;
