import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { GlowCard } from '../components/ui/GlowCard';
import { TextGlitch } from '../components/ui/TextGlitch';
import {
    Plus, Search, Eye, Trash2, CheckCircle2, XCircle,
    Upload, FileText, Loader2, Sparkles, Printer
} from 'lucide-react';
import * as XLSX from 'xlsx';

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
    <span className={'material-symbols-outlined ' + className} style={{ fontSize: 'inherit' }}>{name}</span>
);

interface WorkEstimationsProps {
    selectedOrg: any;
    userProfile?: any;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const fmt = (n: number | null | undefined) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0);

const fmtPct = (n: number | null | undefined) =>
    `${(n ?? 0).toFixed(1)}%`;

const statusBadge = (status: string | null) => {
    const s = (status ?? 'borrador').toLowerCase();
    const map: Record<string, string> = {
        borrador: 'bg-slate-500/20 border-slate-500/40 text-slate-400',
        aprobado: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400',
        en_ejecucion: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
        completado: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
        pagada: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
        rechazada: 'bg-red-500/20 border-red-500/40 text-red-400',
        validada: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
        enviada: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400',
    };
    return map[s] || map.borrador;
};

const statusLabel = (status: string | null) => {
    const s = (status ?? 'borrador').toLowerCase();
    const map: Record<string, string> = {
        borrador: 'Borrador',
        aprobado: 'Aprobado',
        en_ejecucion: 'En Ejecucion',
        completado: 'Completado',
        pagada: 'Pagada',
        rechazada: 'Rechazada',
        validada: 'Validada',
        enviada: 'Enviada',
    };
    return map[s] || s;
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

const WorkEstimations: React.FC<WorkEstimationsProps> = ({ selectedOrg, userProfile }) => {
    /* ---------- state ---------- */
    const [budgets, setBudgets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Budget detail modal
    const [selectedBudget, setSelectedBudget] = useState<any | null>(null);
    const [budgetItems, setBudgetItems] = useState<any[]>([]);
    const [estimations, setEstimations] = useState<any[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // New estimation modal
    const [showNewEstimation, setShowNewEstimation] = useState(false);
    const [editingEstimation, setEditingEstimation] = useState<any>(null);
    const [estPeriodFrom, setEstPeriodFrom] = useState('');
    const [estPeriodTo, setEstPeriodTo] = useState('');
    const [estNotes, setEstNotes] = useState('');
    const [estItems, setEstItems] = useState<any[]>([]);
    const [savingEstimation, setSavingEstimation] = useState(false);

    // New budget modal
    const [showNewBudget, setShowNewBudget] = useState(false);
    const [newBudgetNumber, setNewBudgetNumber] = useState('');
    const [newBudgetDate, setNewBudgetDate] = useState(new Date().toISOString().split('T')[0]);
    const [newBudgetDescription, setNewBudgetDescription] = useState('');
    const [newBudgetAnticipo, setNewBudgetAnticipo] = useState('');
    const [newBudgetFile, setNewBudgetFile] = useState<File | null>(null);
    const [newBudgetClient, setNewBudgetClient] = useState('');
    const [clients, setClients] = useState<any[]>([]);
    const [parsingExcel, setParsingExcel] = useState(false);
    const [newBudgetPartidas, setNewBudgetPartidas] = useState<any[]>([
        { description: '', unit: '', quantity: '', unit_price: '' },
    ]);
    const [savingBudget, setSavingBudget] = useState(false);

    /* ---------- fetch budgets ---------- */
    const fetchBudgets = useCallback(async () => {
        if (!selectedOrg?.id) {
            setBudgets([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('work_budgets')
                .select('*, work_estimations(amount_total, status), client:organizations!client_org_id(name, rfc), anticipo_proforma:quotations!anticipo_quotation_id(id, proforma_number, created_at, amount_total, organizations(rfc))')
                .eq('organization_id', selectedOrg.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setBudgets(data || []);
        } catch (err) {
            console.error('Error cargando presupuestos:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedOrg?.id]);

    useEffect(() => {
        fetchBudgets();
    }, [fetchBudgets]);

    // Cargar clientes (organizaciones con is_client=true)
    useEffect(() => {
        const loadClients = async () => {
            const { data } = await supabase
                .from('organizations')
                .select('id, name, rfc')
                .eq('is_client', true)
                .order('name');
            setClients(data || []);
        };
        loadClients();
    }, []);

    // Parser de Excel: extrae partidas automáticamente al subir archivo
    const parseExcelFile = async (file: File) => {
        setParsingExcel(true);
        try {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array' });
            const sheetName = wb.SheetNames[0];
            const ws = wb.Sheets[sheetName];
            const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

            // Buscar fila de encabezado (que contenga "concepto" o "descripcion")
            let headerIdx = -1;
            for (let i = 0; i < Math.min(rows.length, 15); i++) {
                const row = (rows[i] || []).map((c: any) => String(c || '').toLowerCase());
                if (row.some((c: string) => c.includes('concepto') || c.includes('descripcion') || c.includes('descripción'))) {
                    headerIdx = i;
                    break;
                }
            }

            // Mapear columnas por nombre
            const header = headerIdx >= 0 ? rows[headerIdx].map((c: any) => String(c || '').toLowerCase().trim()) : [];
            const findCol = (keywords: string[]) => header.findIndex(h => keywords.some(k => h.includes(k)));

            const colDesc = findCol(['concepto', 'descripcion', 'descripción', 'trabajo']);
            const colUnit = findCol(['unidad', 'und', 'u.m.']);
            const colQty = findCol(['cantidad', 'cant', 'vol']);
            const colPU = findCol(['unitario', 'p.u.', 'pu', 'precio']);

            const partidas: any[] = [];
            const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows.slice(1);

            for (const row of dataRows) {
                if (!row || row.length < 3) continue;
                const desc = colDesc >= 0 ? String(row[colDesc] || '').trim() : '';
                const unit = colUnit >= 0 ? String(row[colUnit] || '').trim() : '';
                const qty = colQty >= 0 ? parseFloat(row[colQty]) || 0 : 0;
                const pu = colPU >= 0 ? parseFloat(row[colPU]) || 0 : 0;

                // Saltar filas vacías, totales, subtotales
                if (!desc || desc.toLowerCase().includes('subtotal') || desc.toLowerCase().includes('total') || desc.toLowerCase().includes('iva')) continue;
                if (qty === 0 && pu === 0) continue;

                partidas.push({
                    description: desc,
                    unit: unit || 'PZA',
                    quantity: String(qty || 1),
                    unit_price: String(pu || 0),
                });
            }

            if (partidas.length > 0) {
                setNewBudgetPartidas(partidas);
            } else {
                alert('No se encontraron partidas en el Excel. Verifica que tenga columnas: Concepto, Unidad, Cantidad, P.U.');
            }
        } catch (err) {
            console.error('Error parseando Excel:', err);
            alert('Error al leer el archivo Excel: ' + (err as any)?.message);
        } finally {
            setParsingExcel(false);
        }
    };

    // Handler del input file: parsea automáticamente
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setNewBudgetFile(file);
        if (file) parseExcelFile(file);
    };

    /* ---------- budget progress ---------- */
    // Avance de obra = solo estimaciones (trabajo ejecutado, sin anticipo)
    const budgetProgress = (b: any) => {
        const total = b.total_amount ?? 0;
        if (total === 0) return 0;
        const estimationsArr: any[] = b.work_estimations ?? [];
        const sumEstimated = estimationsArr.reduce((acc: number, e: any) => acc + (e.amount_total ?? 0), 0);
        return Math.min((sumEstimated / total) * 100, 100);
    };

    /* ---------- open budget detail ---------- */
    const openBudgetDetail = async (budget: any) => {
        setSelectedBudget(budget);
        setLoadingDetail(true);
        try {
            const [itemsRes, estRes] = await Promise.all([
                supabase
                    .from('work_budget_items')
                    .select('*')
                    .eq('work_budget_id', budget.id)
                    .order('item_number', { ascending: true }),
                supabase
                    .from('work_estimations')
                    .select('*, proforma:quotations!quotation_id(id, status, proforma_number, amount_total, created_at, organizations(rfc))')
                    .eq('work_budget_id', budget.id)
                    .order('estimation_number', { ascending: true }),
            ]);
            if (itemsRes.error) throw itemsRes.error;
            if (estRes.error) throw estRes.error;
            setBudgetItems(itemsRes.data || []);
            setEstimations(estRes.data || []);
        } catch (err) {
            console.error('Error cargando detalle del presupuesto:', err);
        } finally {
            setLoadingDetail(false);
        }
    };

    /* ---------- open new estimation ---------- */
    const openNewEstimation = async () => {
        if (!selectedBudget) return;
        setEstPeriodFrom('');
        setEstPeriodTo('');
        setEstNotes('');

        // Fetch latest accumulated volumes for each budget item
        const items = budgetItems.map((bi: any) => ({
            work_budget_item_id: bi.id,
            item_number: bi.item_number,
            description: bi.description,
            unit: bi.unit,
            quantity: bi.quantity,
            unit_price: bi.unit_price,
            volume_previous: 0,
            volume_this_estimation: 0,
        }));

        // For each item, find the accumulated volume from existing estimations
        if (estimations.length > 0) {
            const latestEstimation = estimations[estimations.length - 1];
            const { data: latestItems } = await supabase
                .from('work_estimation_items')
                .select('*')
                .eq('work_estimation_id', latestEstimation.id);

            if (latestItems) {
                for (const li of latestItems) {
                    const match = items.find((i: any) => i.work_budget_item_id === li.work_budget_item_id);
                    if (match) {
                        match.volume_previous = li.volume_accumulated ?? 0;
                    }
                }
            }
        }

        setEstItems(items);
        setEditingEstimation(null);
        setShowNewEstimation(true);
    };

    /* ---------- estimation calculations ---------- */
    const updateEstItemVolume = (idx: number, value: string) => {
        setEstItems((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], volume_this_estimation: parseFloat(value) || 0 };
            return next;
        });
    };

    const estItemCalc = (item: any) => {
        const volThis = item.volume_this_estimation ?? 0;
        const volPrev = item.volume_previous ?? 0;
        const up = item.unit_price ?? 0;
        const qty = item.quantity ?? 0;
        const amountThis = volThis * up;
        const volAccumulated = volPrev + volThis;
        const volRemaining = qty - volAccumulated;
        return { amountThis, volAccumulated, volRemaining };
    };

    const estTotals = () => {
        let subtotal = 0;
        for (const item of estItems) {
            const { amountThis } = estItemCalc(item);
            subtotal += amountThis;
        }
        const iva = subtotal * 0.16;
        const total = subtotal + iva;
        return { subtotal, iva, total };
    };

    /* ---------- edit existing draft estimation ---------- */
    const editEstimation = async (est: any) => {
        if (!selectedBudget) return;
        setEditingEstimation(est);
        setEstPeriodFrom(est.period_from || '');
        setEstPeriodTo(est.period_to || '');
        setEstNotes(est.notes || '');

        // Cargar items existentes de esta estimación
        const { data: existingItems } = await supabase
            .from('work_estimation_items')
            .select('*')
            .eq('work_estimation_id', est.id);

        // Cargar partidas del presupuesto
        const items = budgetItems.map((bi: any) => {
            const existing = existingItems?.find((ei: any) => ei.work_budget_item_id === bi.id);
            return {
                work_budget_item_id: bi.id,
                item_number: bi.item_number,
                description: bi.description,
                unit: bi.unit,
                quantity: bi.quantity,
                unit_price: bi.unit_price,
                volume_previous: existing ? (existing.volume_accumulated - existing.volume_this_estimation) : 0,
                volume_this_estimation: existing?.volume_this_estimation || 0,
            };
        });

        setEstItems(items);
        setShowNewEstimation(true);
    };

    /* ---------- save estimation ---------- */
    const saveEstimation = async (sendForValidation: boolean) => {
        if (!selectedBudget || !selectedOrg?.id) { alert('Selecciona un presupuesto'); return; }
        setSavingEstimation(true);
        try {
            const totals = estTotals();
            console.log('[EST] Guardando estimación:', { totals, items: estItems.filter((it: any) => it.volume_this_estimation > 0).length });
            const nextNumber = estimations.length + 1;

            // Calculate accumulated previous total
            const accPrevious = estimations.reduce((acc: number, e: any) => acc + (e.amount_total ?? 0), 0);

            // Calculate progress
            const budgetTotal = selectedBudget.total_amount ?? 0;
            const accTotal = accPrevious + totals.total;
            const remaining = budgetTotal - accTotal;
            const progressPct = budgetTotal > 0 ? (accTotal / budgetTotal) * 100 : 0;

            // Amortización de anticipo — fórmula obra civil:
            // % = anticipo / subtotal_presupuesto
            // amortización = subtotal_esta_est × %
            // IVA se aplica DESPUÉS de restar amortización
            const anticipoMonto = parseFloat(selectedBudget.anticipo_amount) || 0;
            const budgetSub = parseFloat(selectedBudget.amount_subtotal) || 1;
            const pctAmort = budgetSub > 0 ? anticipoMonto / budgetSub : 0;
            const amortEst = totals.subtotal * pctAmort;
            const amortPrevio = estimations.reduce((acc: number, e: any) => acc + (parseFloat(e.anticipo_amortizado_est) || 0), 0);
            const anticipoPendiente = Math.max(0, anticipoMonto - amortPrevio);
            const anticipoAmortizadoReal = Math.min(amortEst, anticipoPendiente);

            const estPayload = {
                work_budget_id: selectedBudget.id,
                organization_id: selectedOrg.id,
                estimation_number: editingEstimation ? editingEstimation.estimation_number : nextNumber,
                period_from: estPeriodFrom || null,
                period_to: estPeriodTo || null,
                amount_subtotal: totals.subtotal,
                amount_iva: totals.iva,
                amount_total: totals.total,
                accumulated_previous: accPrevious,
                accumulated_total: accTotal,
                remaining: remaining,
                anticipo_amortizado_est: anticipoAmortizadoReal,
                progress_percentage: Math.round(progressPct),
                status: sendForValidation ? 'enviada' : 'borrador',
                notes: estNotes || null,
            };

            let newEst: any;
            if (editingEstimation) {
                // UPDATE borrador existente
                const { data, error: estError } = await supabase
                    .from('work_estimations')
                    .update(estPayload)
                    .eq('id', editingEstimation.id)
                    .select()
                    .single();
                if (estError) throw estError;
                newEst = data;
                // Eliminar items anteriores para reinsertarlos
                await supabase.from('work_estimation_items').delete().eq('work_estimation_id', editingEstimation.id);
            } else {
                // INSERT nueva estimación
                const { data, error: estError } = await supabase
                    .from('work_estimations')
                    .insert(estPayload)
                    .select()
                    .single();
                if (estError) throw estError;
                newEst = data;
            }

            // Insertar trabajos adicionales al presupuesto primero
            const extraItems = estItems.filter((it: any) => it.is_extra && it.description?.trim() && it.volume_this_estimation > 0);
            for (const extra of extraItems) {
                const { data: newBudgetItem, error: biErr } = await supabase
                    .from('work_budget_items')
                    .insert({
                        work_budget_id: selectedBudget.id,
                        item_number: extra.item_number,
                        description: extra.description.trim(),
                        unit: extra.unit || 'PZA',
                        quantity: extra.quantity || extra.volume_this_estimation,
                        unit_price: extra.unit_price,
                        amount: (extra.quantity || extra.volume_this_estimation) * extra.unit_price,
                    })
                    .select()
                    .single();
                if (biErr) throw biErr;
                extra.work_budget_item_id = newBudgetItem.id;
            }

            // Insert estimation items (normales + extras)
            const itemsToInsert = estItems
                .filter((it: any) => it.volume_this_estimation > 0 && it.work_budget_item_id)
                .map((it: any) => {
                    const calc = estItemCalc(it);
                    return {
                        work_estimation_id: newEst.id,
                        work_budget_item_id: it.work_budget_item_id,
                        volume_previous: it.volume_previous,
                        volume_this_estimation: it.volume_this_estimation,
                        volume_accumulated: calc.volAccumulated,
                        volume_remaining: calc.volRemaining,
                        amount_this_estimation: calc.amountThis,
                        amount_accumulated: (it.volume_previous * it.unit_price) + calc.amountThis,
                    };
                });

            if (itemsToInsert.length > 0) {
                const { error: itemsError } = await supabase
                    .from('work_estimation_items')
                    .insert(itemsToInsert);
                if (itemsError) throw itemsError;
            }

            // Actualizar total del presupuesto si hay extras
            if (extraItems.length > 0) {
                const extraTotal = extraItems.reduce((acc: number, it: any) => acc + ((it.quantity || it.volume_this_estimation) * it.unit_price), 0);
                const newBudgetTotal = (parseFloat(selectedBudget.amount_subtotal) || 0) + extraTotal;
                await supabase.from('work_budgets').update({
                    amount_subtotal: newBudgetTotal,
                    amount_iva: newBudgetTotal * 0.16,
                    total_amount: newBudgetTotal * 1.16,
                }).eq('id', selectedBudget.id);
            }

            // Actualizar anticipo_amortizado acumulado en el presupuesto
            const totalAmortizadoAcumulado = amortPrevio + anticipoAmortizadoReal;
            await supabase
                .from('work_budgets')
                .update({
                    anticipo_amortizado: Math.min(totalAmortizadoAcumulado, anticipoMonto),
                    status: progressPct >= 100 ? 'completado' : 'en_ejecucion',
                })
                .eq('id', selectedBudget.id);

            { setShowNewEstimation(false); setEditingEstimation(null); };
            // Refresh detail
            await openBudgetDetail(selectedBudget);
            await fetchBudgets();
        } catch (err: any) {
            console.error('Error guardando estimacion:', err);
            alert('Error al guardar estimación: ' + (err?.message || JSON.stringify(err)));
        } finally {
            setSavingEstimation(false);
        }
    };

    /* ---------- delete estimation ---------- */
    const deleteEstimation = async (estimation: any) => {
        if (!confirm(`Eliminar Estimacion #${estimation.estimation_number}?`)) return;
        try {
            await supabase
                .from('work_estimation_items')
                .delete()
                .eq('work_estimation_id', estimation.id);
            await supabase
                .from('work_estimations')
                .delete()
                .eq('id', estimation.id);
            await openBudgetDetail(selectedBudget);
            await fetchBudgets();
        } catch (err) {
            console.error('Error eliminando estimacion:', err);
        }
    };

    /* ---------- save new budget ---------- */
    const saveNewBudget = async () => {
        if (!selectedOrg?.id) { alert('Selecciona una organización'); return; }
        if (!newBudgetNumber.trim()) { alert('Escribe el número de presupuesto'); return; }
        setSavingBudget(true);
        try {
            // Upload file if provided
            let sourceFileUrl: string | null = null;
            if (newBudgetFile) {
                const ext = newBudgetFile.name.split('.').pop();
                const fileName = `${selectedOrg.id}_budget_${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from('work-budgets')
                    .upload(fileName, newBudgetFile, {
                        cacheControl: '3600',
                        upsert: true,
                        contentType: newBudgetFile.type || 'application/octet-stream',
                    });
                if (uploadError) throw uploadError;
                const { data: urlData } = supabase.storage
                    .from('work-budgets')
                    .getPublicUrl(fileName);
                sourceFileUrl = urlData?.publicUrl || null;
            }

            // Calculate totals from partidas
            const validPartidas = newBudgetPartidas.filter(
                (p: any) => p.description.trim() && parseFloat(p.quantity) > 0 && parseFloat(p.unit_price) > 0
            );
            const subtotal = validPartidas.reduce(
                (acc: number, p: any) => acc + parseFloat(p.quantity) * parseFloat(p.unit_price),
                0
            );
            const iva = subtotal * 0.16;
            const total = subtotal + iva;

            const { data: newBudget, error: budgetError } = await supabase
                .from('work_budgets')
                .insert({
                    organization_id: selectedOrg.id,
                    client_org_id: newBudgetClient || null,
                    budget_number: newBudgetNumber.trim(),
                    budget_date: newBudgetDate || new Date().toISOString().split('T')[0],
                    description: newBudgetDescription.trim() || null,
                    total_amount: total,
                    amount_subtotal: subtotal,
                    amount_iva: iva,
                    anticipo_amount: parseFloat(newBudgetAnticipo) || 0,
                    anticipo_amortizado: 0,
                    source_file_url: sourceFileUrl,
                    status: 'borrador',
                })
                .select()
                .single();

            if (budgetError) throw budgetError;

            // Insert items
            if (validPartidas.length > 0) {
                const itemsToInsert = validPartidas.map((p: any, idx: number) => ({
                    work_budget_id: newBudget.id,
                    item_number: idx + 1,
                    description: p.description.trim(),
                    unit: p.unit.trim() || 'PZA',
                    quantity: parseFloat(p.quantity),
                    unit_price: parseFloat(p.unit_price),
                    amount: parseFloat(p.quantity) * parseFloat(p.unit_price),
                }));
                const { error: itemsError } = await supabase
                    .from('work_budget_items')
                    .insert(itemsToInsert);
                if (itemsError) throw itemsError;
            }

            setShowNewBudget(false);
            resetNewBudgetForm();
            await fetchBudgets();
        } catch (err) {
            console.error('Error creando presupuesto:', err);
            alert('Error al guardar: ' + ((err as any)?.message || JSON.stringify(err)));
        } finally {
            setSavingBudget(false);
        }
    };

    const resetNewBudgetForm = () => {
        setNewBudgetNumber('');
        setNewBudgetDate(new Date().toISOString().split('T')[0]);
        setNewBudgetDescription('');
        setNewBudgetAnticipo('');
        setNewBudgetFile(null);
        setNewBudgetClient('');
        setNewBudgetPartidas([{ description: '', unit: '', quantity: '', unit_price: '' }]);
    };

    /* ---------- partidas helpers ---------- */
    const addPartida = () => {
        setNewBudgetPartidas((prev) => [
            ...prev,
            { description: '', unit: '', quantity: '', unit_price: '' },
        ]);
    };

    const removePartida = (idx: number) => {
        setNewBudgetPartidas((prev) => prev.filter((_: any, i: number) => i !== idx));
    };

    const updatePartida = (idx: number, field: string, value: string) => {
        setNewBudgetPartidas((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    /* ---------- delete budget ---------- */
    const deleteBudget = async (budget: any) => {
        if (!confirm(`Eliminar presupuesto ${budget.budget_number}? Se eliminaran todas sus estimaciones y partidas.`)) return;
        try {
            // Delete estimation items for all estimations of this budget
            const { data: ests } = await supabase
                .from('work_estimations')
                .select('id')
                .eq('work_budget_id', budget.id);
            if (ests && ests.length > 0) {
                for (const est of ests) {
                    await supabase.from('work_estimation_items').delete().eq('work_estimation_id', est.id);
                }
                await supabase.from('work_estimations').delete().eq('work_budget_id', budget.id);
            }
            await supabase.from('work_budget_items').delete().eq('work_budget_id', budget.id);
            await supabase.from('work_budgets').delete().eq('id', budget.id);

            setSelectedBudget(null);
            await fetchBudgets();
        } catch (err) {
            console.error('Error eliminando presupuesto:', err);
        }
    };

    /* ---------- filter ---------- */
    const filtered = budgets.filter((b: any) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            (b.budget_number ?? '').toLowerCase().includes(q) ||
            (b.description ?? '').toLowerCase().includes(q)
        );
    });

    /* ================================================================ */
    /*  GENERACIÓN DE DOCUMENTOS HTML                                   */
    /* ================================================================ */

    // Construir folio real de proforma: SSI-150426-04
    const buildFolio = (proforma: any) => {
        if (!proforma) return '';
        const rfcPrefix = proforma.organizations?.rfc?.match(/^[A-Z&]{3,4}/)?.[0] || 'PF';
        const dateStr = proforma.created_at
            ? new Date(proforma.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '')
            : '';
        const num = (proforma.proforma_number || 1).toString().padStart(2, '0');
        return `${rfcPrefix}-${dateStr}-${num}`;
    };

    const fmtN = (n: number) => {
        const parts = (n || 0).toFixed(2).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return '$' + parts.join('.');
    };

    const fmtDate = (d: string) => {
        if (!d) return '';
        const p = d.split('-');
        return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : d;
    };

    const generateBudgetHTML = (budget: any, items: any[], org: any) => {
        const pc = org?.primary_color || '#1a3c5e';
        const ac = org?.theme_config?.accent_color || '#f59e0b';
        const sc = org?.theme_config?.secondary_color || '#64748b';
        const orgName = org?.brand_name || org?.name || '';
        const orgRfc = org?.rfc || '';
        const orgAddress = org?.tax_domicile || '';
        const orgPhone = org?.office_phone || org?.mobile_phone || '';
        const orgEmail = org?.contact_email || '';
        const logoImg = org?.logo_url
            ? `<img src="${org.logo_url}" style="max-height:80px; max-width:120px; object-fit:contain;" />`
            : `<div style="font-size:24px; font-weight:bold; color:${pc}">${(orgName || '').substring(0,3)}</div>`;
        const emisorBlock = `<div style="display:flex;align-items:center;gap:12px">
            <div style="flex-shrink:0">${logoImg}</div>
            <div>
                <div style="font-size:14px;font-weight:bold;color:${pc}">${orgName}</div>
                <div style="font-size:10px;color:#555">RFC: ${orgRfc}</div>
                ${orgAddress ? `<div style="font-size:9px;color:#777;max-width:220px">${orgAddress}</div>` : ''}
                ${orgPhone ? `<div style="font-size:9px;color:#777">Tel: ${orgPhone}</div>` : ''}
                ${orgEmail ? `<div style="font-size:9px;color:#777">${orgEmail}</div>` : ''}
            </div>
        </div>`;
        const clientName = budget.client?.name || '';
        const clientRfc = budget.client?.rfc || '';
        const subtotal = items.reduce((a: number, i: any) => a + (parseFloat(i.amount) || 0), 0);
        const iva = subtotal * 0.16;
        const total = subtotal + iva;

        return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Propuesta Economica - ${budget.budget_number}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#333}
.c{max-width:900px;margin:0 auto;padding:25px}
.hdr{display:flex;justify-content:space-between;align-items:center;padding-bottom:15px;border-bottom:3px solid ${pc};margin-bottom:20px}
.hdr h1{color:${pc};font-size:18px}
.hdr .folio{color:${ac};font-size:13px;font-weight:bold;margin-top:3px}
.hdr .fecha{color:#666;font-size:11px;margin-top:2px}
.info{display:flex;gap:20px;margin-bottom:15px}
.info .box{flex:1;background:#f5f7fa;border-radius:5px;padding:12px;border-left:3px solid ${sc}}
.info .box h3{color:${pc};font-size:10px;font-weight:bold;text-transform:uppercase;margin-bottom:5px}
.info .box p{font-size:11px;line-height:1.5}
table{width:100%;border-collapse:collapse;margin:15px 0}
th{background:${pc};color:#fff;padding:8px 6px;text-align:center;border:1px solid #ccc;font-size:10px}
td{padding:7px 6px;border:1px solid #ddd;font-size:11px}
tr:nth-child(even){background:#f9f9f9}
.r{text-align:right}.ctr{text-align:center}
.totals{width:250px;margin-left:auto}
.totals td{padding:6px 10px;font-size:12px}
.totals .grand{background:${pc};color:#fff;font-weight:bold;font-size:13px}
.cond{margin:15px 0;padding:12px;background:#f0f7ff;border-left:3px solid ${sc};border-radius:4px;font-size:11px;line-height:1.6}
.firmas{display:flex;gap:30px;margin-top:35px;padding-top:15px;border-top:1px solid #ddd}
.firma{flex:1;text-align:center}.firma .ln{border-top:1px solid #333;margin:35px 0 6px}.firma p{font-size:11px;color:#555}
.footer{margin-top:20px;padding-top:10px;border-top:2px solid ${pc};text-align:center;font-size:10px;color:#888}
@media print{.c{padding:10px}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}}
</style></head><body><div class="c">
<div class="hdr">
  <div>${emisorBlock}</div>
  <div style="text-align:right">
    <div style="display:inline-block;background:${ac};color:#fff;font-size:9px;font-weight:bold;padding:2px 8px;border-radius:3px;margin-bottom:8px">PROPUESTA ECONOMICA</div>
    <h1>PROPUESTA ECONOMICA</h1>
    <div class="folio">No. ${budget.budget_number}</div>
    <div class="fecha">Fecha: ${fmtDate(budget.budget_date || budget.created_at?.split('T')[0])}</div>
  </div>
</div>
<div class="info">
  <div class="box"><h3>Cliente</h3><p><strong>${clientName}</strong><br>RFC: ${clientRfc}</p></div>
</div>
${budget.description ? `<p style="margin-bottom:12px;font-size:12px"><strong>Descripcion:</strong> ${budget.description}</p>` : ''}
<table>
  <thead><tr><th style="width:30px">#</th><th>Concepto</th><th style="width:50px">Und</th><th style="width:70px">Cantidad</th><th style="width:90px">P.U.</th><th style="width:100px">Importe</th></tr></thead>
  <tbody>
    ${items.map((it: any) => `<tr><td class="ctr">${it.item_number}</td><td>${it.description}</td><td class="ctr">${it.unit}</td><td class="r">${parseFloat(it.quantity).toLocaleString('es-MX')}</td><td class="r">${fmtN(it.unit_price)}</td><td class="r"><strong>${fmtN(it.amount)}</strong></td></tr>`).join('')}
  </tbody>
</table>
<table class="totals">
  <tr><td class="r" style="color:#555">Subtotal:</td><td class="r"><strong>${fmtN(subtotal)}</strong></td></tr>
  <tr><td class="r" style="color:#555">I.V.A. 16%:</td><td class="r">${fmtN(iva)}</td></tr>
  <tr class="grand"><td class="r">TOTAL:</td><td class="r">${fmtN(total)}</td></tr>
  ${parseFloat(budget.anticipo_amount) > 0 ? `<tr><td class="r" style="color:${ac}">Anticipo:</td><td class="r" style="color:${ac};font-weight:bold">${fmtN(budget.anticipo_amount)}</td></tr>` : ''}
</table>
<div class="cond">
  <strong>Condiciones:</strong><br>
  ${parseFloat(budget.anticipo_amount) > 0 ? `• Anticipo del ${((parseFloat(budget.anticipo_amount) / subtotal) * 100).toFixed(1)}% al inicio de obra<br>` : ''}
  • Pagos mediante estimaciones de avance de obra<br>
  • Precios incluyen materiales, mano de obra, herramienta y equipo
</div>
<div class="firmas">
  <div class="firma"><div class="ln"></div><p><strong>Elaboro</strong></p><p>Area Tecnica</p></div>
  <div class="firma"><div class="ln"></div><p><strong>Autorizo</strong></p><p>Direccion</p></div>
</div>
<div class="footer"><p>${org?.theme_config?.slogan || org?.name || ''} | ${org?.rfc || ''}</p></div>
</div></body></html>`;
    };

    const generateEstimationHTML = (budget: any, estimation: any, estItemsData: any[], allBudgetItems: any[], org: any) => {
        const pc = org?.primary_color || '#1a3c5e';
        const ac = org?.theme_config?.accent_color || '#f59e0b';
        const sc = org?.theme_config?.secondary_color || '#64748b';
        const orgName = org?.brand_name || org?.name || '';
        const orgRfc = org?.rfc || '';
        const orgAddress = org?.tax_domicile || '';
        const orgPhone = org?.office_phone || org?.mobile_phone || '';
        const orgEmail = org?.contact_email || '';
        const logoImg2 = org?.logo_url
            ? `<img src="${org.logo_url}" style="max-height:80px; max-width:120px; object-fit:contain;" />`
            : `<div style="font-size:24px; font-weight:bold; color:${pc}">${(orgName || '').substring(0,3)}</div>`;
        const emisorBlock = `<div style="display:flex;align-items:center;gap:12px">
            <div style="flex-shrink:0">${logoImg2}</div>
            <div>
                <div style="font-size:12px;font-weight:bold;color:${pc}">${orgName}</div>
                <div style="font-size:9px;color:#555">RFC: ${orgRfc}</div>
                ${orgAddress ? `<div style="font-size:8px;color:#777;max-width:200px">${orgAddress}</div>` : ''}
                ${orgPhone ? `<div style="font-size:8px;color:#777">Tel: ${orgPhone}</div>` : ''}
                ${orgEmail ? `<div style="font-size:8px;color:#777">${orgEmail}</div>` : ''}
            </div>
        </div>`;
        const clientName = budget.client?.name || '';
        const budgetSubtotal = parseFloat(budget.amount_subtotal) || 0;
        const anticipoMonto = parseFloat(budget.anticipo_amount) || 0;
        const pctAmort = budgetSubtotal > 0 ? anticipoMonto / budgetSubtotal : 0;
        const sumaEst = parseFloat(estimation.amount_subtotal) || 0;
        const amortizacion = sumaEst * pctAmort;
        const amortPrevio = parseFloat(budget.anticipo_amortizado) || 0;
        const amortReal = Math.min(amortizacion, Math.max(0, anticipoMonto - amortPrevio + amortizacion));
        const subtotalNeto = sumaEst - amortReal;
        const ivaNeto = subtotalNeto * 0.16;
        const netoAPagar = subtotalNeto + ivaNeto;

        // Merge estimation items with budget items
        const rows = allBudgetItems.map((bi: any) => {
            const ei = estItemsData.find((e: any) => e.work_budget_item_id === bi.id);
            return { ...bi, vol_prev: ei?.volume_previous || 0, vol_this: ei?.volume_this_estimation || 0, vol_acc: ei?.volume_accumulated || 0, vol_rem: ei?.volume_remaining || 0, amt_this: ei?.amount_this_estimation || 0, amt_acc: ei?.amount_accumulated || 0 };
        });

        return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Estimacion ${estimation.estimation_number} - ${budget.budget_number}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#333}
.c{max-width:1000px;margin:0 auto;padding:20px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:3px solid ${pc};margin-bottom:15px}
.hdr h1{color:${pc};font-size:16px}
.hdr .folio{color:${ac};font-size:12px;font-weight:bold;margin-top:2px}
.hdr .fecha{color:#666;font-size:10px;margin-top:2px}
.ig{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;font-size:11px}
.ig .row{display:flex;justify-content:space-between;padding:4px 8px;background:#f5f7fa;border-radius:3px}
.ig .row span:first-child{color:#555}.ig .row span:last-child{font-weight:bold}
.ig .row.hl{background:${pc}10;border-left:3px solid ${pc}}
table{width:100%;border-collapse:collapse;margin:10px 0}
th{background:${pc};color:#fff;padding:6px 4px;text-align:center;border:1px solid #ccc;font-size:9px;white-space:nowrap}
td{padding:5px 4px;border:1px solid #ddd;font-size:10px}
tr:nth-child(even){background:#f9f9f9}
.r{text-align:right}.ctr{text-align:center}
.resumen{width:320px;margin-left:auto;margin-top:8px}
.resumen td{padding:5px 8px;font-size:11px}
.resumen .grand{background:${pc};color:#fff;font-weight:bold;font-size:12px}
.resumen .amort{color:${ac};font-weight:bold}
.firmas{display:flex;gap:25px;margin-top:25px;padding-top:12px;border-top:1px solid #ddd}
.firma{flex:1;text-align:center}.firma .ln{border-top:1px solid #333;margin:30px 0 5px}.firma p{font-size:10px;color:#555}
.footer{margin-top:15px;padding-top:8px;border-top:2px solid ${pc};text-align:center;font-size:9px;color:#888}
@media print{.c{padding:8px}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}th{font-size:8px}td{font-size:9px}}
</style></head><body><div class="c">
<div class="hdr">
  <div>${emisorBlock}</div>
  <div style="text-align:right">
    <div style="display:inline-block;background:${ac};color:#fff;font-size:9px;font-weight:bold;padding:2px 8px;border-radius:3px;margin-bottom:5px">ESTIMACION DE OBRA</div>
    <h1>ESTIMACION No. ${estimation.estimation_number}</h1>
    <div class="folio">Presupuesto: ${budget.budget_number}</div>
    <div class="fecha">Periodo: ${fmtDate(estimation.period_from)} al ${fmtDate(estimation.period_to)}</div>
  </div>
</div>
<div class="ig">
  <div class="row hl"><span>Importe total del contrato</span><span>${fmtN(budgetSubtotal)}</span></div>
  <div class="row"><span>Estimado a la fecha</span><span>${fmtN(estimation.accumulated_total)}</span></div>
  <div class="row"><span>Por estimar</span><span>${fmtN(estimation.remaining)}</span></div>
  <div class="row"><span>Cliente</span><span>${clientName}</span></div>
  <div class="row"><span>Anticipo</span><span>${fmtN(anticipoMonto)} (${(pctAmort * 100).toFixed(2)}%)</span></div>
  <div class="row"><span>Anticipo amortizado</span><span>${fmtN(amortReal)}</span></div>
  <div class="row"><span>Anticipo por amortizar</span><span>${fmtN(Math.max(0, anticipoMonto - (amortPrevio)))}</span></div>
  <div class="row"><span>Avance</span><span>${estimation.progress_percentage || 0}%</span></div>
</div>
<table>
  <thead>
    <tr>
      <th rowspan="2" style="width:25px">#</th>
      <th rowspan="2">Concepto</th>
      <th rowspan="2" style="width:35px">Und</th>
      <th colspan="3" style="background:${sc}">Presupuesto</th>
      <th colspan="2" style="background:#666">Acum. Anterior</th>
      <th colspan="2" style="background:${ac}">Esta Estimacion</th>
      <th colspan="2" style="background:#28a745">Acumulado</th>
      <th colspan="2">Por Estimar</th>
    </tr>
    <tr>
      <th style="width:50px;background:${sc}">Cant</th><th style="width:60px;background:${sc}">P.U.</th><th style="width:70px;background:${sc}">Importe</th>
      <th style="width:50px;background:#666">Vol</th><th style="width:70px;background:#666">Importe</th>
      <th style="width:50px;background:${ac}">Vol</th><th style="width:70px;background:${ac}">Importe</th>
      <th style="width:50px;background:#28a745">Vol</th><th style="width:70px;background:#28a745">Importe</th>
      <th style="width:50px">Vol</th><th style="width:70px">Importe</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((r: any) => {
        const impPres = parseFloat(r.amount) || 0;
        const impPrev = r.vol_prev * parseFloat(r.unit_price);
        const impRem = impPres - r.amt_acc;
        return `<tr>
          <td class="ctr">${r.item_number}</td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">${r.description}</td>
          <td class="ctr">${r.unit}</td>
          <td class="r">${parseFloat(r.quantity).toLocaleString('es-MX')}</td>
          <td class="r">${fmtN(r.unit_price)}</td>
          <td class="r">${fmtN(impPres)}</td>
          <td class="r">${r.vol_prev || ''}</td>
          <td class="r">${r.vol_prev > 0 ? fmtN(impPrev) : ''}</td>
          <td class="r" style="font-weight:bold;color:${ac}">${r.vol_this || ''}</td>
          <td class="r" style="font-weight:bold">${r.amt_this > 0 ? fmtN(r.amt_this) : ''}</td>
          <td class="r">${r.vol_acc || ''}</td>
          <td class="r">${r.amt_acc > 0 ? fmtN(r.amt_acc) : ''}</td>
          <td class="r">${(parseFloat(r.quantity) - r.vol_acc).toLocaleString('es-MX')}</td>
          <td class="r">${fmtN(impRem > 0 ? impRem : 0)}</td>
        </tr>`;
    }).join('')}
  </tbody>
  <tfoot>
    <tr style="font-weight:bold;background:${pc}15">
      <td colspan="3"></td>
      <td class="ctr" colspan="2">SUMA</td>
      <td class="r">${fmtN(budgetSubtotal)}</td>
      <td></td><td class="r">${fmtN(estimation.accumulated_previous)}</td>
      <td></td><td class="r" style="color:${ac}">${fmtN(sumaEst)}</td>
      <td></td><td class="r">${fmtN(estimation.accumulated_total)}</td>
      <td></td><td class="r">${fmtN(estimation.remaining)}</td>
    </tr>
  </tfoot>
</table>
<table class="resumen">
  <tr><td class="r" style="color:#555">Suma esta estimacion:</td><td class="r"><strong>${fmtN(sumaEst)}</strong></td></tr>
  ${anticipoMonto > 0 ? `<tr class="amort"><td class="r">(-) Amortizacion anticipo:</td><td class="r">-${fmtN(amortReal)}</td></tr>` : ''}
  <tr><td class="r" style="color:#555">Subtotal:</td><td class="r">${fmtN(subtotalNeto)}</td></tr>
  <tr><td class="r" style="color:#555">I.V.A. 16%:</td><td class="r">${fmtN(ivaNeto)}</td></tr>
  <tr class="grand"><td class="r">NETO A PAGAR:</td><td class="r">${fmtN(netoAPagar)}</td></tr>
</table>
${estimation.notes ? `<p style="margin-top:10px;font-size:11px"><strong>Observaciones:</strong> ${estimation.notes}</p>` : ''}
<div class="firmas">
  <div class="firma"><div class="ln"></div><p><strong>Formulo - Residente</strong></p></div>
  <div class="firma"><div class="ln"></div><p><strong>Autorizo - Superintendente</strong></p></div>
</div>
<div class="footer"><p>${org?.theme_config?.slogan || org?.name || ''} | ${org?.rfc || ''}</p></div>
</div></body></html>`;
    };

    // Generar y guardar documento HTML
    const generateDocument = async (type: 'budget' | 'estimation', budget: any, estimation?: any) => {
        try {
            // Obtener org emisora
            const { data: org } = await supabase.from('organizations').select('name, rfc, logo_url, primary_color, theme_config, brand_name, tax_domicile, contact_name, contact_email, office_phone, mobile_phone').eq('id', budget.organization_id).single();

            let html = '';
            let fileName = '';

            if (type === 'budget') {
                const { data: items } = await supabase.from('work_budget_items').select('*').eq('work_budget_id', budget.id).order('item_number');
                html = generateBudgetHTML(budget, items || [], org);
                fileName = `propuesta_${budget.budget_number}_${Date.now()}.html`;

                // Guardar URL en presupuesto
                const blob = new Blob([new TextEncoder().encode(html)], { type: 'text/html; charset=utf-8' });
                await supabase.storage.from('work-budgets').upload(fileName, blob, { upsert: true, contentType: 'text/html; charset=utf-8' });
                await supabase.from('work_budgets').update({ source_file_url: fileName }).eq('id', budget.id);
            } else if (estimation) {
                const { data: eItems } = await supabase.from('work_estimation_items').select('*').eq('work_estimation_id', estimation.id);
                const { data: bItems } = await supabase.from('work_budget_items').select('*').eq('work_budget_id', budget.id).order('item_number');
                html = generateEstimationHTML(budget, estimation, eItems || [], bItems || [], org);
                fileName = `estimacion_${estimation.estimation_number}_${budget.budget_number}_${Date.now()}.html`;

                const blob = new Blob([new TextEncoder().encode(html)], { type: 'text/html; charset=utf-8' });
                await supabase.storage.from('work-budgets').upload(fileName, blob, { upsert: true, contentType: 'text/html; charset=utf-8' });
                await supabase.from('work_estimations').update({ evidence_url: fileName }).eq('id', estimation.id);
            }

            // Descargar
            const blob = new Blob([new TextEncoder().encode(html)], { type: 'text/html; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');

            await fetchBudgets();
            if (selectedBudget) {
                const updated = { ...selectedBudget };
                if (type === 'budget') updated.source_file_url = fileName;
                setSelectedBudget(updated);
                await openBudgetDetail(updated);
            }
        } catch (err: any) {
            alert('Error generando documento: ' + err.message);
        }
    };

    // Abrir como Word
    const openAsWord = async (filePath: string, bucket: string = 'work-budgets') => {
        try {
            const { data } = await supabase.storage.from(bucket).download(filePath);
            if (!data) return;
            const text = await data.text();
            const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->${text.match(/<style[\s\S]*?<\/style>/)?.[0] || ''}</head><body>${text.match(/<body[\s\S]*?>([\s\S]*)<\/body>/)?.[1] || text}</body></html>`;
            const blob = new Blob([new TextEncoder().encode(wordHtml)], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filePath.replace('.html', '.doc');
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    const viewDocument = async (filePath: string, bucket: string = 'work-budgets') => {
        try {
            const { data } = await supabase.storage.from(bucket).download(filePath);
            if (!data) return;
            const url = URL.createObjectURL(new Blob([data], { type: 'text/html; charset=utf-8' }));
            window.open(url, '_blank');
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    const printDocument = async (filePath: string, bucket: string = 'work-budgets') => {
        try {
            const { data } = await supabase.storage.from(bucket).download(filePath);
            if (!data) return;
            const html = await data.text();
            const win = window.open('', '_blank');
            if (win) {
                win.document.write(html);
                win.document.close();
                win.onload = () => { win.print(); };
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    /* ================================================================ */
    /*  GENERAR PROFORMA DESDE PRESUPUESTO/ESTIMACIÓN                   */
    /* ================================================================ */

    const generateProforma = async (type: 'anticipo' | 'estimacion', budget: any, estimation?: any) => {
        if (!selectedOrg?.id) { alert('Selecciona una organización'); return; }
        if (!confirm(type === 'anticipo'
            ? `¿Crear proforma de anticipo por ${fmtN(budget.anticipo_amount)}?`
            : `¿Crear proforma de Estimación #${estimation?.estimation_number}?`
        )) return;

        try {
            // Obtener datos del cliente (del join o por query)
            let clientName = budget.client?.name || '';
            let clientRfc = budget.client?.rfc || '';
            let clientAddress = '';
            if (budget.client_org_id) {
                const { data: clientOrg } = await supabase.from('organizations')
                    .select('name, rfc, tax_domicile')
                    .eq('id', budget.client_org_id).single();
                if (clientOrg) {
                    clientName = clientOrg.name || clientName;
                    clientRfc = clientOrg.rfc || clientRfc;
                    clientAddress = clientOrg.tax_domicile || '';
                }
            }

            let description = '';
            let subtotalProf = 0;
            let itemsData: any[] = [];

            if (type === 'anticipo') {
                const anticipo = parseFloat(budget.anticipo_amount) || 0;
                const pct = parseFloat(budget.amount_subtotal) > 0 ? (anticipo / parseFloat(budget.amount_subtotal) * 100).toFixed(1) : '0';
                subtotalProf = anticipo;
                description = `Anticipo ${pct}% - ${budget.description || budget.budget_number}`;
                itemsData = [{
                    sat_product_key: '84111506',
                    item_code: `ANT-${budget.budget_number}`,
                    quantity: 1,
                    unit_id: 'E48',
                    description: `Anticipo de obra (${pct}%) - ${budget.description || budget.budget_number}`,
                    unit_price: anticipo,
                    has_iva: true,
                    has_ieps: false,
                }];
            } else if (estimation) {
                const sumaEst = parseFloat(estimation.amount_subtotal) || 0;
                const anticipoMonto = parseFloat(budget.anticipo_amount) || 0;
                const budgetSub = parseFloat(budget.amount_subtotal) || 1;
                const pctAmort = budgetSub > 0 ? anticipoMonto / budgetSub : 0;
                const amortizacion = sumaEst * pctAmort;
                subtotalProf = sumaEst - amortizacion;
                description = `Estimación #${estimation.estimation_number} - ${budget.description || budget.budget_number}`;

                // Cargar items de la estimación
                const { data: eItems } = await supabase.from('work_estimation_items')
                    .select('*, budget_item:work_budget_items(*)')
                    .eq('work_estimation_id', estimation.id);

                itemsData = (eItems || []).filter((ei: any) => ei.amount_this_estimation > 0).map((ei: any) => ({
                    sat_product_key: '84111506',
                    item_code: `EST${estimation.estimation_number}-${ei.budget_item?.item_number || ''}`,
                    quantity: ei.volume_this_estimation,
                    unit_id: ei.budget_item?.unit || 'E48',
                    description: ei.budget_item?.description || 'Concepto de obra',
                    unit_price: parseFloat(ei.budget_item?.unit_price) || 0,
                    has_iva: true,
                    has_ieps: false,
                }));

                // Agregar línea de deducción por amortización si aplica
                if (amortizacion > 0) {
                    itemsData.push({
                        sat_product_key: '84111506',
                        item_code: `AMORT-EST${estimation.estimation_number}`,
                        quantity: 1,
                        unit_id: 'E48',
                        description: `(-) Amortización de anticipo (${(pctAmort * 100).toFixed(2)}%)`,
                        unit_price: -amortizacion,
                        has_iva: true,
                        has_ieps: false,
                    });
                }
            }

            const ivaProf = subtotalProf * 0.16;
            const totalProf = subtotalProf + ivaProf;

            // Crear proforma (quotation)
            const { data: newQuotation, error: qErr } = await supabase.from('quotations').insert({
                organization_id: selectedOrg.id,
                amount_subtotal: subtotalProf,
                amount_iva: ivaProf,
                amount_total: totalProf,
                currency: 'MXN',
                status: 'PENDIENTE',
                type: 'SERVICIO',
                description: description,
                client_rfc: clientRfc,
                client_name: clientName,
                client_address: clientAddress,
                payment_method: 'PPD',
                payment_form: '03',
                usage_cfdi_code: 'G03',
                req_estimaciones: true,
                estimacion_status: type === 'anticipo' ? 'anticipo' : `est_${estimation?.estimation_number}`,
                request_direct_invoice: true,
                invoice_status: 'SOLICITUD',
            }).select().single();

            if (qErr) throw qErr;

            // Insertar items
            if (itemsData.length > 0) {
                const itemsInsert = itemsData.map((it: any) => ({
                    quotation_id: newQuotation.id,
                    sat_product_key: it.sat_product_key,
                    item_code: it.item_code,
                    quantity: it.quantity,
                    unit_id: it.unit_id,
                    description: it.description,
                    unit_price: it.unit_price,
                    has_iva: it.has_iva,
                    has_ieps: it.has_ieps,
                    subtotal: it.quantity * it.unit_price,
                }));
                const { error: iErr } = await supabase.from('quotation_items').insert(itemsInsert);
                if (iErr) throw iErr;
            }

            // Vincular proforma con presupuesto/estimación
            if (type === 'anticipo') {
                await supabase.from('work_budgets').update({ anticipo_quotation_id: newQuotation.id }).eq('id', budget.id);
            } else if (estimation) {
                await supabase.from('work_estimations').update({ quotation_id: newQuotation.id }).eq('id', estimation.id);
            }

            // Refrescar datos
            await fetchBudgets();
            if (selectedBudget) await openBudgetDetail(selectedBudget);

            alert(`Proforma creada: ${description}\nTotal: ${fmtN(totalProf)}`);
            window.open(`/proformas/${newQuotation.id}`, '_blank');
        } catch (err: any) {
            alert('Error creando proforma: ' + err.message);
        }
    };

    /* ================================================================ */
    /*  RENDER                                                          */
    /* ================================================================ */

    return (
        <div className="space-y-6">
            {/* ---- Header ---- */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 text-2xl">
                        <Icon name="engineering" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            <TextGlitch text="Estimaciones de Obra" />
                        </h1>
                        <p className="text-sm text-slate-400">Presupuestos y estimaciones de obra civil</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        resetNewBudgetForm();
                        const nextNum = (budgets.length + 1).toString().padStart(3, '0');
                        const prefix = selectedOrg?.rfc?.match(/^[A-Z&]{3,4}/)?.[0] || 'PPTO';
                        setNewBudgetNumber(`${prefix}-${nextNum}`);
                        setNewBudgetDate(new Date().toISOString().split('T')[0]);
                        setShowNewBudget(true);
                    }}
                    className="px-4 py-2.5 font-bold rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 flex items-center gap-2 text-sm transition-colors"
                >
                    <Plus size={16} /> Nuevo Presupuesto
                </button>
            </div>

            {/* ---- Search ---- */}
            <div className="relative max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar presupuesto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
            </div>

            {/* ---- Budget list ---- */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
                    <Loader2 size={20} className="animate-spin" /> Cargando presupuestos...
                </div>
            ) : !selectedOrg?.id ? (
                <GlowCard>
                    <div className="text-center py-12 text-slate-400">
                        <Icon name="domain" className="text-4xl" />
                        <p className="mt-2">Selecciona una organizacion para ver presupuestos</p>
                    </div>
                </GlowCard>
            ) : filtered.length === 0 ? (
                <GlowCard>
                    <div className="text-center py-12 text-slate-400">
                        <FileText size={40} className="mx-auto mb-3 opacity-50" />
                        <p>No hay presupuestos registrados</p>
                        <p className="text-xs mt-1">Crea uno con el boton "+ Nuevo Presupuesto"</p>
                    </div>
                </GlowCard>
            ) : (
                <div className="grid gap-4">
                    {filtered.map((b: any) => {
                        const pct = budgetProgress(b);
                        const anticipo = parseFloat(b.anticipo_amount) || 0;
                        const estimado = (b.work_estimations || []).reduce((acc: number, e: any) => acc + (parseFloat(e.amount_total) || 0), 0);
                        const cobrado = anticipo + estimado;
                        const saldo = (parseFloat(b.total_amount) || 0) - cobrado;
                        const clientName = b.client?.name || '';
                        return (
                            <GlowCard key={b.id}>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-sm text-cyan-400 font-bold">
                                                {b.budget_number}
                                            </span>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusBadge(b.status)}`}>
                                                {statusLabel(b.status)}
                                            </span>
                                        </div>
                                        {clientName && (
                                            <p className="text-xs text-amber-400 font-bold mt-1 uppercase">{clientName}</p>
                                        )}
                                        <p className="text-sm text-slate-300 mt-0.5 truncate">
                                            {b.description || 'Sin descripcion'}
                                        </p>
                                    </div>

                                    {/* Montos */}
                                    <div className="flex gap-4 text-center">
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Total</p>
                                            <p className="text-sm font-bold text-white">{fmt(b.total_amount)}</p>
                                        </div>
                                        {anticipo > 0 && (
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase font-bold">Anticipo</p>
                                                <p className="text-sm font-bold text-cyan-400">{fmt(anticipo)}</p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Estimado</p>
                                            <p className="text-sm font-bold text-emerald-400">{fmt(estimado)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Saldo</p>
                                            <p className={`text-sm font-bold ${saldo > 0 ? 'text-amber-400' : saldo < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {fmt(saldo)} {saldo < 0 && <span className="text-[9px]">(excedido)</span>}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Barras de progreso */}
                                    <div className="sm:w-48 space-y-2">
                                        {/* Barra de pagos (anticipo + estimaciones) */}
                                        {(() => {
                                            const pagosPct = parseFloat(b.total_amount) > 0 ? (cobrado / parseFloat(b.total_amount)) * 100 : 0;
                                            const excedido = pagosPct > 100;
                                            return (
                                                <div className="space-y-0.5">
                                                    <div className="flex justify-between text-[10px] text-slate-400">
                                                        <span className="font-bold uppercase">Pagos</span>
                                                        <span className={`font-bold ${excedido ? 'text-red-400' : 'text-emerald-400'}`}>{fmtPct(pagosPct)}</span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${excedido ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-emerald-600 to-emerald-400'}`}
                                                            style={{ width: `${Math.min(pagosPct, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        {/* Barra de avance de obra (estimaciones sin anticipo) */}
                                        <div className="space-y-0.5">
                                            <div className="flex justify-between text-[10px] text-slate-400">
                                                <span className="font-bold uppercase">Obra</span>
                                                <span className="text-cyan-400 font-bold">{fmtPct(pct)}</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-500"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openBudgetDetail(b)}
                                            className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:text-cyan-400 hover:bg-slate-700 transition-colors"
                                            title="Ver detalle"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            onClick={() => deleteBudget(b)}
                                            className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:text-red-400 hover:bg-slate-700 transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </GlowCard>
                        );
                    })}
                </div>
            )}

            {/* ================================================================ */}
            {/*  MODAL: Detalle de Presupuesto                                   */}
            {/* ================================================================ */}
            {selectedBudget && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-5xl shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Icon name="engineering" className="text-cyan-400" />
                                    Presupuesto {selectedBudget.budget_number}
                                </h2>
                                <p className="text-sm text-slate-400 mt-1">{selectedBudget.description || 'Sin descripcion'}</p>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    {parseFloat(selectedBudget.anticipo_amount) > 0 && !selectedBudget.anticipo_quotation_id && (
                                        <button onClick={() => generateProforma('anticipo', selectedBudget)}
                                            className="px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-bold flex items-center gap-1">
                                            <Plus size={12} /> Proforma Anticipo
                                        </button>
                                    )}
                                    {selectedBudget.anticipo_quotation_id && (
                                        <a href={`/proformas/${selectedBudget.anticipo_quotation_id}`} target="_blank" rel="noreferrer"
                                            className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold flex items-center gap-1">
                                            <Eye size={12} /> Anticipo: {buildFolio(selectedBudget.anticipo_proforma)} • {fmtN(selectedBudget.anticipo_proforma?.amount_total)}
                                        </a>
                                    )}
                                    <button onClick={() => generateDocument('budget', selectedBudget)}
                                        className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 text-xs font-bold flex items-center gap-1">
                                        <FileText size={12} /> Generar Propuesta
                                    </button>
                                    {selectedBudget.source_file_url?.endsWith('.html') && (
                                        <>
                                            <button onClick={() => viewDocument(selectedBudget.source_file_url)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-700 transition-colors" title="Ver documento">
                                                <Eye size={14} />
                                            </button>
                                            <button onClick={() => printDocument(selectedBudget.source_file_url)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition-colors" title="Imprimir">
                                                <Printer size={14} />
                                            </button>
                                            <button onClick={() => openAsWord(selectedBudget.source_file_url)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-colors" title="Abrir en Word">
                                                <FileText size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedBudget(null)}
                                className="text-slate-400 hover:text-white transition-colors text-xl"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {loadingDetail ? (
                                <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                                    <Loader2 size={20} className="animate-spin" /> Cargando...
                                </div>
                            ) : (
                                <>
                                    {/* Budget summary */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                                            <p className="text-xs text-slate-400 uppercase tracking-wide">Total</p>
                                            <p className="text-lg font-bold text-white mt-1">{fmt(selectedBudget.total_amount)}</p>
                                        </div>
                                        <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                                            <p className="text-xs text-slate-400 uppercase tracking-wide">Anticipo</p>
                                            <p className="text-lg font-bold text-white mt-1">{fmt(selectedBudget.anticipo_amount)}</p>
                                        </div>
                                        <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                                            <p className="text-xs text-slate-400 uppercase tracking-wide">Estimaciones</p>
                                            <p className="text-lg font-bold text-white mt-1">{estimations.length}</p>
                                        </div>
                                        <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                                            <p className="text-xs text-slate-400 uppercase tracking-wide">Status</p>
                                            <span className={`inline-block text-xs uppercase font-bold px-2 py-1 rounded-full border mt-1 ${statusBadge(selectedBudget.status)}`}>
                                                {statusLabel(selectedBudget.status)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Budget items table */}
                                    <div>
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-3">
                                            Partidas del Presupuesto
                                        </h3>
                                        {budgetItems.length === 0 ? (
                                            <p className="text-sm text-slate-500 py-4 text-center">Sin partidas registradas</p>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="text-xs text-slate-400 uppercase border-b border-white/5">
                                                            <th className="text-left py-2 px-2 w-12">#</th>
                                                            <th className="text-left py-2 px-2">Concepto</th>
                                                            <th className="text-left py-2 px-2 w-20">Unidad</th>
                                                            <th className="text-right py-2 px-2 w-24">Cantidad</th>
                                                            <th className="text-right py-2 px-2 w-28">P.U.</th>
                                                            <th className="text-right py-2 px-2 w-32">Importe</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {budgetItems.map((bi: any) => (
                                                            <tr key={bi.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                                                <td className="py-2 px-2 text-slate-400 font-mono">{bi.item_number}</td>
                                                                <td className="py-2 px-2 text-slate-200">{bi.description}</td>
                                                                <td className="py-2 px-2 text-slate-400">{bi.unit}</td>
                                                                <td className="py-2 px-2 text-right text-slate-300">{bi.quantity?.toLocaleString('es-MX')}</td>
                                                                <td className="py-2 px-2 text-right text-slate-300">{fmt(bi.unit_price)}</td>
                                                                <td className="py-2 px-2 text-right text-white font-medium">{fmt(bi.amount)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Estimations list */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                                                Estimaciones
                                            </h3>
                                            <button
                                                onClick={openNewEstimation}
                                                className="px-4 py-2.5 font-bold rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 flex items-center gap-2 text-sm transition-colors"
                                            >
                                                <Plus size={14} /> Nueva Estimacion
                                            </button>
                                        </div>

                                        {estimations.length === 0 ? (
                                            <p className="text-sm text-slate-500 py-4 text-center">Sin estimaciones</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {estimations.map((est: any) => (
                                                    <div
                                                        key={est.id}
                                                        className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-800/50 rounded-xl p-4 border border-white/5"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-mono text-sm font-bold text-cyan-400">
                                                                    EST #{est.estimation_number}
                                                                </span>
                                                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusBadge(est.status)}`}>
                                                                    {statusLabel(est.status)}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-400 mt-1">
                                                                Periodo: {est.period_from || '—'} al {est.period_to || '—'}
                                                            </p>
                                                            {est.proforma?.id && (
                                                                <a href={`/proformas/${est.proforma.id}`} target="_blank" rel="noreferrer"
                                                                    className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 hover:bg-amber-500/20 transition-colors">
                                                                    <Eye size={10} /> {buildFolio(est.proforma)} • {fmtN(est.proforma.amount_total)}
                                                                </a>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-6 text-sm">
                                                            <div className="text-right">
                                                                <p className="text-xs text-slate-400">Esta Est.</p>
                                                                <p className="font-bold text-white">{fmt(est.amount_total)}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs text-slate-400">Acumulado</p>
                                                                <p className="font-bold text-slate-300">{fmt(est.accumulated_total)}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs text-slate-400">Avance</p>
                                                                <p className="font-bold text-emerald-400">{fmtPct(est.progress_percentage)}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => generateProforma('estimacion', selectedBudget, est)}
                                                                className="p-2 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                                                                title="Crear proforma de esta estimacion"
                                                            >
                                                                <Sparkles size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => generateDocument('estimation', selectedBudget, est)}
                                                                className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition-colors"
                                                                title="Generar documento"
                                                            >
                                                                <Plus size={14} />
                                                            </button>
                                                            {est.evidence_url?.endsWith('.html') && (
                                                                <>
                                                                    <button onClick={() => viewDocument(est.evidence_url)}
                                                                        className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-700 transition-colors" title="Ver documento">
                                                                        <Eye size={14} />
                                                                    </button>
                                                                    <button onClick={() => printDocument(est.evidence_url)}
                                                                        className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition-colors" title="Imprimir">
                                                                        <Printer size={14} />
                                                                    </button>
                                                                    <button onClick={() => openAsWord(est.evidence_url)}
                                                                        className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-colors" title="Abrir en Word">
                                                                        <FileText size={14} />
                                                                    </button>
                                                                </>
                                                            )}
                                                            {est.status === 'borrador' && (
                                                                <button
                                                                    onClick={() => editEstimation(est)}
                                                                    className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-700 transition-colors"
                                                                    title="Editar estimacion"
                                                                >
                                                                    <FileText size={14} />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => deleteEstimation(est)}
                                                                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
                                                                title="Eliminar estimacion"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/*  MODAL: Nueva Estimacion                                         */}
            {/* ================================================================ */}
            {showNewEstimation && (
                <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-6xl shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Plus size={20} className="text-cyan-400" />
                                    {editingEstimation ? `Editar EST #${editingEstimation.estimation_number}` : 'Nueva Estimacion'} - {selectedBudget?.budget_number}
                                </h2>
                                <p className="text-sm text-slate-400 mt-1">Estimacion #{estimations.length + 1}</p>
                            </div>
                            <button
                                onClick={() => { setShowNewEstimation(false); setEditingEstimation(null); }}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Period + Notes */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Periodo Desde</label>
                                    <input
                                        type="date"
                                        value={estPeriodFrom}
                                        onChange={(e) => setEstPeriodFrom(e.target.value)}
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Periodo Hasta</label>
                                    <input
                                        type="date"
                                        value={estPeriodTo}
                                        onChange={(e) => setEstPeriodTo(e.target.value)}
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Notas</label>
                                    <input
                                        type="text"
                                        value={estNotes}
                                        onChange={(e) => setEstNotes(e.target.value)}
                                        placeholder="Notas opcionales..."
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>
                            </div>

                            {/* Estimation items table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs text-slate-400 uppercase border-b border-white/5">
                                            <th className="text-left py-2 px-2 w-10">#</th>
                                            <th className="text-left py-2 px-2">Concepto</th>
                                            <th className="text-left py-2 px-2 w-16">Unidad</th>
                                            <th className="text-right py-2 px-2 w-20">Cant. Total</th>
                                            <th className="text-right py-2 px-2 w-24">P.U.</th>
                                            <th className="text-right py-2 px-2 w-24">Acum. Ant.</th>
                                            <th className="text-center py-2 px-2 w-28">Esta Est.</th>
                                            <th className="text-right py-2 px-2 w-24">Acumulado</th>
                                            <th className="text-right py-2 px-2 w-24">Por Estimar</th>
                                            <th className="text-right py-2 px-2 w-28">Importe Est.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {estItems.map((item: any, idx: number) => {
                                            const calc = estItemCalc(item);
                                            const isExtra = item.is_extra === true;
                                            const updateExtra = (field: string, value: any) => {
                                                setEstItems(prev => {
                                                    const next = [...prev];
                                                    next[idx] = { ...next[idx], [field]: value };
                                                    return next;
                                                });
                                            };
                                            return (
                                                <tr key={idx} className={`border-b border-white/5 hover:bg-white/[0.02] ${isExtra ? 'bg-amber-500/5' : ''}`}>
                                                    <td className="py-2 px-2 text-slate-400 font-mono">
                                                        {isExtra ? <span className="text-amber-400 text-[10px] font-bold">EXT</span> : item.item_number}
                                                    </td>
                                                    <td className="py-2 px-2 max-w-[200px]">
                                                        {isExtra ? (
                                                            <input type="text" value={item.description} onChange={e => updateExtra('description', e.target.value)}
                                                                placeholder="Concepto trabajo adicional"
                                                                className="w-full bg-slate-800 border border-amber-500/20 rounded-lg px-2 py-1 text-amber-300 text-sm focus:outline-none focus:border-amber-500/50" />
                                                        ) : (
                                                            <span className="text-slate-200 truncate block" title={item.description}>{item.description}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-2">
                                                        {isExtra ? (
                                                            <input type="text" value={item.unit} onChange={e => updateExtra('unit', e.target.value)}
                                                                placeholder="m2"
                                                                className="w-full bg-slate-800 border border-amber-500/20 rounded-lg px-2 py-1 text-amber-300 text-sm text-center focus:outline-none focus:border-amber-500/50" />
                                                        ) : (
                                                            <span className="text-slate-400">{item.unit}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-2 text-right">
                                                        {isExtra ? (
                                                            <input type="number" min="0" step="0.01" value={item.quantity || ''} onChange={e => updateExtra('quantity', parseFloat(e.target.value) || 0)}
                                                                placeholder="0"
                                                                className="w-full bg-slate-800 border border-amber-500/20 rounded-lg px-2 py-1 text-amber-300 text-sm text-right focus:outline-none focus:border-amber-500/50" />
                                                        ) : (
                                                            <span className="text-slate-300">{item.quantity?.toLocaleString('es-MX')}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-2 text-right">
                                                        {isExtra ? (
                                                            <input type="number" min="0" step="0.01" value={item.unit_price || ''} onChange={e => updateExtra('unit_price', parseFloat(e.target.value) || 0)}
                                                                placeholder="0"
                                                                className="w-full bg-slate-800 border border-amber-500/20 rounded-lg px-2 py-1 text-amber-300 text-sm text-right focus:outline-none focus:border-amber-500/50" />
                                                        ) : (
                                                            <span className="text-slate-300">{fmt(item.unit_price)}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-2 text-right text-slate-400">{isExtra ? '-' : item.volume_previous?.toLocaleString('es-MX')}</td>
                                                    <td className="py-2 px-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.volume_this_estimation || ''}
                                                            onChange={(e) => updateEstItemVolume(idx, e.target.value)}
                                                            className="w-full bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm text-center focus:outline-none focus:border-cyan-500/50"
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="py-2 px-2 text-right text-slate-300">
                                                        {calc.volAccumulated.toLocaleString('es-MX')}
                                                    </td>
                                                    <td className={`py-2 px-2 text-right ${calc.volRemaining < 0 ? 'text-red-400' : 'text-slate-300'}`}>
                                                        {isExtra ? '-' : calc.volRemaining.toLocaleString('es-MX')}
                                                    </td>
                                                    <td className="py-2 px-2 text-right text-white font-medium">
                                                        {fmt(calc.amountThis)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Agregar trabajo adicional */}
                            <div className="flex justify-start pt-2">
                                <button
                                    onClick={() => {
                                        const nextNum = estItems.length + 1;
                                        setEstItems(prev => [...prev, {
                                            work_budget_item_id: null,
                                            item_number: nextNum,
                                            description: '',
                                            unit: '',
                                            quantity: 0,
                                            unit_price: 0,
                                            volume_previous: 0,
                                            volume_this_estimation: 0,
                                            is_extra: true,
                                        }]);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                    <Plus size={12} /> Trabajo Adicional
                                </button>
                            </div>

                            {/* Totals */}
                            {(() => {
                                const totals = estTotals();
                                // Anticipo es SIN IVA (monto directo del presupuesto)
                                const anticipoMonto = parseFloat(selectedBudget?.anticipo_amount) || 0;
                                const budgetSubtotal = parseFloat(selectedBudget?.amount_subtotal) || 1;
                                // % amortización = anticipo / subtotal presupuesto
                                const pctAmortizacion = budgetSubtotal > 0 ? anticipoMonto / budgetSubtotal : 0;
                                // Amortización = subtotal esta estimación × %
                                const amortizacionEst = totals.subtotal * pctAmortizacion;
                                const amortizadoPrevio = estimations.reduce((acc: number, e: any) => acc + (parseFloat(e.anticipo_amortizado_est) || 0), 0);
                                const anticipoPendiente = Math.max(0, anticipoMonto - amortizadoPrevio);
                                const amortizacionReal = Math.min(amortizacionEst, anticipoPendiente);
                                // Subtotal después de amortización
                                const subtotalNeto = totals.subtotal - amortizacionReal;
                                // IVA se calcula DESPUÉS de restar amortización
                                const ivaNeto = subtotalNeto * 0.16;
                                const netoAPagar = subtotalNeto + ivaNeto;
                                return (
                                    <div className="flex justify-end">
                                        <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 w-80 space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400">Suma esta estimación</span>
                                                <span className="text-white font-bold">{fmt(totals.subtotal)}</span>
                                            </div>
                                            {anticipoMonto > 0 && (
                                                <>
                                                    <div className="flex justify-between text-sm text-amber-400">
                                                        <span>(-) Amortización anticipo ({(pctAmortizacion * 100).toFixed(2)}%)</span>
                                                        <span>-{fmt(amortizacionReal)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm border-t border-white/10 pt-1">
                                                        <span className="text-slate-300">Subtotal</span>
                                                        <span className="text-white">{fmt(subtotalNeto)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-400">I.V.A. 16%</span>
                                                        <span className="text-white">{fmt(ivaNeto)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-slate-500 border-t border-white/5 pt-1">
                                                        <span>Anticipo por amortizar</span>
                                                        <span>{fmt(Math.max(0, anticipoPendiente - amortizacionReal))}</span>
                                                    </div>
                                                </>
                                            )}
                                            {anticipoMonto === 0 && (
                                                <>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-400">I.V.A. 16%</span>
                                                        <span className="text-white">{fmt(totals.iva)}</span>
                                                    </div>
                                                </>
                                            )}
                                            <div className="flex justify-between text-base font-bold border-t border-cyan-500/30 pt-2">
                                                <span className="text-cyan-400">NETO A PAGAR</span>
                                                <span className="text-cyan-400">{fmt(netoAPagar)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Action buttons */}
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => { setShowNewEstimation(false); setEditingEstimation(null); }}
                                    className="px-4 py-2.5 font-bold rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm transition-colors"
                                    disabled={savingEstimation}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => saveEstimation(false)}
                                    disabled={savingEstimation}
                                    className="px-4 py-2.5 font-bold rounded-xl bg-slate-600 text-white hover:bg-slate-500 flex items-center gap-2 text-sm transition-colors disabled:opacity-50"
                                >
                                    {savingEstimation ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                                    Guardar Borrador
                                </button>
                                <button
                                    onClick={() => saveEstimation(true)}
                                    disabled={savingEstimation}
                                    className="px-4 py-2.5 font-bold rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 flex items-center gap-2 text-sm transition-colors disabled:opacity-50"
                                >
                                    {savingEstimation ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                    Enviar para Validacion
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/*  MODAL: Nuevo Presupuesto                                        */}
            {/* ================================================================ */}
            {showNewBudget && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Plus size={20} className="text-cyan-400" />
                                Nuevo Presupuesto
                            </h2>
                            <button
                                onClick={() => setShowNewBudget(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* File upload */}
                            <div>
                                <label className="block text-xs text-slate-400 uppercase tracking-wide mb-2">
                                    Archivo Excel (opcional)
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer bg-slate-800/50 border border-dashed border-white/10 rounded-xl p-4 hover:border-cyan-500/30 transition-colors">
                                    <Upload size={20} className="text-slate-400" />
                                    <div className="flex-1">
                                        {newBudgetFile ? (
                                            <span className="text-sm text-cyan-400">{newBudgetFile.name}</span>
                                        ) : (
                                            <span className="text-sm text-slate-400">Subir archivo .xlsx</span>
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                    />
                                </label>
                                {parsingExcel && (
                                    <div className="flex items-center gap-2 mt-2 text-cyan-400 text-xs">
                                        <Loader2 size={14} className="animate-spin" /> Escaneando Excel...
                                    </div>
                                )}
                            </div>

                            {/* Cliente */}
                            <div>
                                <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
                                    Cliente *
                                </label>
                                <select
                                    value={newBudgetClient}
                                    onChange={(e) => setNewBudgetClient(e.target.value)}
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                                >
                                    <option value="">Seleccionar cliente...</option>
                                    {clients.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.rfc})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
                                        No. Presupuesto
                                    </label>
                                    <input
                                        type="text"
                                        value={newBudgetNumber}
                                        readOnly
                                        className="w-full bg-slate-800/50 border border-white/5 rounded-lg px-3 py-2 text-cyan-400 text-sm font-mono cursor-default"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
                                        Fecha
                                    </label>
                                    <input
                                        type="date"
                                        value={newBudgetDate}
                                        onChange={(e) => setNewBudgetDate(e.target.value)}
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
                                        Descripcion
                                    </label>
                                    <input
                                        type="text"
                                        value={newBudgetDescription}
                                        onChange={(e) => setNewBudgetDescription(e.target.value)}
                                        placeholder="Obra civil planta norte..."
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-amber-400 uppercase tracking-wide mb-1 font-bold">
                                        Anticipo ($)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={newBudgetAnticipo}
                                        onChange={(e) => setNewBudgetAnticipo(e.target.value)}
                                        placeholder="50000.00"
                                        className="w-full bg-slate-800 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-400 text-sm font-bold placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                                    />
                                </div>
                            </div>

                            {/* Partidas table */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Partidas</h3>
                                    <button
                                        onClick={addPartida}
                                        className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:text-cyan-400 hover:bg-slate-600 text-xs font-bold flex items-center gap-1 transition-colors"
                                    >
                                        <Plus size={12} /> Agregar Partida
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-xs text-slate-400 uppercase border-b border-white/5">
                                                <th className="text-left py-2 px-2 w-10">#</th>
                                                <th className="text-left py-2 px-2">Concepto</th>
                                                <th className="text-left py-2 px-2 w-24">Unidad</th>
                                                <th className="text-right py-2 px-2 w-28">Cantidad</th>
                                                <th className="text-right py-2 px-2 w-28">P.U.</th>
                                                <th className="text-right py-2 px-2 w-32">Importe</th>
                                                <th className="w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {newBudgetPartidas.map((p: any, idx: number) => {
                                                const importe = (parseFloat(p.quantity) || 0) * (parseFloat(p.unit_price) || 0);
                                                return (
                                                    <tr key={idx} className="border-b border-white/5">
                                                        <td className="py-2 px-2 text-slate-400 font-mono">{idx + 1}</td>
                                                        <td className="py-2 px-2">
                                                            <input
                                                                type="text"
                                                                value={p.description}
                                                                onChange={(e) => updatePartida(idx, 'description', e.target.value)}
                                                                placeholder="Descripcion del concepto"
                                                                className="w-full bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            <input
                                                                type="text"
                                                                value={p.unit}
                                                                onChange={(e) => updatePartida(idx, 'unit', e.target.value)}
                                                                placeholder="PZA"
                                                                className="w-full bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm text-center placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={p.quantity}
                                                                onChange={(e) => updatePartida(idx, 'quantity', e.target.value)}
                                                                placeholder="0"
                                                                className="w-full bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm text-right placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={p.unit_price}
                                                                onChange={(e) => updatePartida(idx, 'unit_price', e.target.value)}
                                                                placeholder="0.00"
                                                                className="w-full bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm text-right placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-2 text-right text-white font-medium">
                                                            {fmt(importe)}
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            {newBudgetPartidas.length > 1 && (
                                                                <button
                                                                    onClick={() => removePartida(idx)}
                                                                    className="p-1 rounded text-slate-400 hover:text-red-400 transition-colors"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Budget totals preview */}
                                {(() => {
                                    const subtotal = newBudgetPartidas.reduce(
                                        (acc: number, p: any) => acc + (parseFloat(p.quantity) || 0) * (parseFloat(p.unit_price) || 0),
                                        0
                                    );
                                    const iva = subtotal * 0.16;
                                    const total = subtotal + iva;
                                    return (
                                        <div className="flex justify-end mt-4">
                                            <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 w-64 space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-400">Subtotal</span>
                                                    <span className="text-white">{fmt(subtotal)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-400">IVA 16%</span>
                                                    <span className="text-white">{fmt(iva)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm font-bold border-t border-white/10 pt-2">
                                                    <span className="text-white">Total</span>
                                                    <span className="text-cyan-400">{fmt(total)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Action buttons */}
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setShowNewBudget(false)}
                                    className="px-4 py-2.5 font-bold rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm transition-colors"
                                    disabled={savingBudget}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={saveNewBudget}
                                    disabled={savingBudget}
                                    className="px-4 py-2.5 font-bold rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 flex items-center gap-2 text-sm transition-colors disabled:opacity-50"
                                >
                                    {savingBudget ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                    Guardar Presupuesto
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkEstimations;
