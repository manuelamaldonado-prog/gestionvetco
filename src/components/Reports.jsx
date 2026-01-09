import { useState } from 'react';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { Printer, Pencil, X, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Reports() {
    const { jobs, payments, clients, practices, agendaEvents, getClientBalance, updatePayment, deletePayment, getIvaRateForClient } = useData();
    const [viewMode, setViewMode] = useState('monthly'); // 'monthly' | 'global' | 'annual' | 'agenda_client'
    const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleDateString('en-CA').slice(0, 7)); // YYYY-MM
    const [showDetail, setShowDetail] = useState(true);
    const [editingCheque, setEditingCheque] = useState(null);
    const [hoveredAnnualMonth, setHoveredAnnualMonth] = useState(null);
    const [agendaClientId, setAgendaClientId] = useState('');
    const [clientReportType, setClientReportType] = useState('resumen'); // 'resumen' | 'agenda'
    const [agendaFrom, setAgendaFrom] = useState('');
    const [agendaTo, setAgendaTo] = useState('');

    // --- Monthly Logic ---
    const filteredJobs = jobs.filter(j => j.date.startsWith(selectedMonth));
    const filteredPayments = payments.filter(p => p.date.startsWith(selectedMonth));

    const statsByClient = {};
    const ensureClient = (id) => {
        if (!statsByClient[id]) {
            const clientName = clients.find(c => c.id === id)?.name || 'Desconocido';
            statsByClient[id] = {
                clientId: id,
                clientName,
                jobNet: 0,
                jobIVA: 0,
                jobTotal: 0,
                paymentTotal: 0,
                jobBreakdown: {}, // { 'PracticeName': { qty: 0, total: 0 } }
                paymentBreakdown: {} // { 'METHOD': { qty: 0, total: 0 } }
            };
        }
    };

    filteredJobs.forEach(job => {
        ensureClient(job.clientId);
        const ivaRate = getIvaRateForClient(job.clientId);
        statsByClient[job.clientId].jobNet += Number(job.total);
        statsByClient[job.clientId].jobIVA += (Number(job.total) * ivaRate);
        statsByClient[job.clientId].jobTotal += (Number(job.total) * (1 + ivaRate));

        // Aggregate by Practice
        const pid = job.practiceId;
        const pr = practices.find(p => p.id === pid);
        if (!statsByClient[job.clientId].jobBreakdown[pid]) {
            statsByClient[job.clientId].jobBreakdown[pid] = { name: job.practiceName, leyenda: pr?.leyenda || '', qty: 0, total: 0 };
        }
        statsByClient[job.clientId].jobBreakdown[pid].qty += Number(job.quantity);
        statsByClient[job.clientId].jobBreakdown[pid].total += (Number(job.total) * (1 + ivaRate));
    });

    filteredPayments.forEach(pay => {
        ensureClient(pay.clientId);
        statsByClient[pay.clientId].paymentTotal += Number(pay.amount);

        // Aggregate by Method
        const method = pay.method;
        if (!statsByClient[pay.clientId].paymentBreakdown[method]) {
            statsByClient[pay.clientId].paymentBreakdown[method] = { qty: 0, total: 0 };
        }
        statsByClient[pay.clientId].paymentBreakdown[method].qty += 1;
        statsByClient[pay.clientId].paymentBreakdown[method].total += Number(pay.amount);
    });

    const reportData = Object.values(statsByClient).map(item => ({
        ...item,
        currentBalance: getClientBalance(item.clientId)
    }));

    const totalMonthBilled = filteredJobs.reduce((sum, j) => {
        const ivaRate = getIvaRateForClient(j.clientId);
        return sum + (Number(j.total) * (1 + ivaRate));
    }, 0);
    const totalMonthNet = filteredJobs.reduce((sum, j) => sum + Number(j.total), 0);
    const totalMonthIVA = filteredJobs.reduce((sum, j) => {
        const ivaRate = getIvaRateForClient(j.clientId);
        return sum + (Number(j.total) * ivaRate);
    }, 0);
    const totalMonthPaid = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const METHOD_LABELS = { 'CASH': 'Efectivo', 'CHEQUE': 'Cheque', 'TRANSFER': 'Transferencia' };

    // --- Global Balances Logic ---
    const globalBalances = clients.map(c => ({
        ...c,
        balance: getClientBalance(c.id)
    })).sort((a, b) => b.balance.total - a.balance.total); // Highest debt first

    const totalGlobalDebt = globalBalances.reduce((sum, c) => sum + c.balance.total, 0);
    const totalGlobalNetDebt = globalBalances.reduce((sum, c) => sum + c.balance.net, 0);

    // --- Cheques Report Logic ---
    const chequesData = payments
        .filter(p => p.method === 'CHEQUE')
        .flatMap(p => {
            if (p.cheques && p.cheques.length > 0) {
                // Expand multiple cheques
                return p.cheques.map((c, idx) => ({
                    ...p,
                    amount: c.amount,
                    chequeNumber: c.number,
                    chequeBank: c.bank,
                    chequeDate: c.date,
                    destination: c.destination || p.destination,
                    id: `${p.id}_${idx}`, // Unique ID for list
                    originalPaymentId: p.id,
                    chequeIndex: idx,
                    isNested: true
                }));
            }
            return [{ ...p, isNested: false }]; // Legacy single cheque
        })
        .map(p => ({
            ...p,
            clientName: clients.find(c => c.id === p.clientId)?.name || 'Desconocido'
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Group Cheques by Client
    const chequesByClient = {};
    chequesData.forEach(cheque => {
        if (!chequesByClient[cheque.clientId]) {
            chequesByClient[cheque.clientId] = {
                id: cheque.clientId,
                name: cheque.clientName,
                items: [],
                total: 0
            };
        }
        chequesByClient[cheque.clientId].items.push(cheque);
        chequesByClient[cheque.clientId].total += Number(cheque.amount);
    });
    const chequesGroupedList = Object.values(chequesByClient).sort((a, b) => a.name.localeCompare(b.name));

    // --- Transfers Report Logic ---
    const transfersData = payments
        .filter(p => p.method === 'TRANSFER')
        .map(p => ({
            ...p,
            clientName: clients.find(c => c.id === p.clientId)?.name || 'Desconocido'
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Group Transfers by Client
    const transfersByClient = {};
    transfersData.forEach(t => {
        if (!transfersByClient[t.clientId]) {
            transfersByClient[t.clientId] = {
                id: t.clientId,
                name: t.clientName,
                items: [],
                total: 0
            };
        }
        transfersByClient[t.clientId].items.push(t);
        transfersByClient[t.clientId].total += Number(t.amount);
    });
    const transfersGroupedList = Object.values(transfersByClient).sort((a, b) => a.name.localeCompare(b.name));

    // --- Annual History Logic ---
    const last12Months = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        last12Months.push(d.toLocaleDateString('en-CA').slice(0, 7)); // YYYY-MM
    }
    // Sort chronological (oldest to newest) for columns
    last12Months.reverse();

    const annualTotals = {};
    const monthlyClientBreakdown = {}; // { 'YYYY-MM': [ { name, total } ] }
    const monthlyIvaTotals = {};

    last12Months.forEach(m => {
        annualTotals[m] = 0;
        monthlyClientBreakdown[m] = [];
        monthlyIvaTotals[m] = 0;
    });

    // Helper to group by client within a month
    const tempMonthlyClientMap = {}; // { 'YYYY-MM': { clientId: total } }

    jobs.forEach(j => {
        const m = j.date.slice(0, 7);
        if (annualTotals[m] !== undefined) {
            const ivaRate = getIvaRateForClient(j.clientId);
            annualTotals[m] += (Number(j.total) * (1 + ivaRate));
            monthlyIvaTotals[m] += (Number(j.total) * ivaRate);

            if (!tempMonthlyClientMap[m]) tempMonthlyClientMap[m] = {};
            if (!tempMonthlyClientMap[m][j.clientId]) tempMonthlyClientMap[m][j.clientId] = 0;
            tempMonthlyClientMap[m][j.clientId] += (Number(j.total) * (1 + ivaRate));
        }
    });

    // Convert temp map to sorted array for display
    Object.keys(tempMonthlyClientMap).forEach(m => {
        const clientIds = Object.keys(tempMonthlyClientMap[m]);
        const breakdown = clientIds.map(clientId => {
            const client = clients.find(c => c.id === clientId);
            return {
                name: client ? client.name : 'Desconocido',
                total: tempMonthlyClientMap[m][clientId]
            };
        });
        breakdown.sort((a, b) => b.total - a.total); // Sort highest first
        monthlyClientBreakdown[m] = breakdown;
    });

    // Transform for Recharts: array of objects { name: 'YYYY-MM', total: 1234.56 }
    const chartData = last12Months.map(m => ({
        name: m,
        total: annualTotals[m] || 0
    }));

    const totalCheques = chequesData.reduce((sum, c) => sum + Number(c.amount), 0);
    const totalCash = payments.filter(p => p.method === 'CASH').reduce((sum, p) => sum + Number(p.amount), 0);
    const totalTransfer = payments.filter(p => p.method === 'TRANSFER').reduce((sum, p) => sum + Number(p.amount), 0);
    const totalAnnualIVA = Object.values(monthlyIvaTotals).reduce((sum, v) => sum + v, 0);

    const handleEditCheque = (cheque) => {
        setEditingCheque({ ...cheque });
    };

    const submitEditCheque = (e) => {
        e.preventDefault();
        if (!editingCheque) return;
        if (editingCheque.isNested) {
            const parent = payments.find(p => p.id === editingCheque.originalPaymentId);
            if (!parent || !Array.isArray(parent.cheques)) {
                setEditingCheque(null);
                return;
            }
            const updatedCheques = parent.cheques.map((c, i) => {
                if (i !== editingCheque.chequeIndex) return c;
                return {
                    ...c,
                    bank: editingCheque.chequeBank || '',
                    number: editingCheque.chequeNumber || '',
                    date: editingCheque.chequeDate || '',
                    amount: Number(editingCheque.amount || 0),
                    destination: editingCheque.destination || c.destination || ''
                };
            });
            const newTotalAmount = updatedCheques.reduce((sum, c) => sum + Number(c.amount || 0), 0);
            updatePayment(parent.id, {
                cheques: updatedCheques,
                amount: newTotalAmount,
                date: editingCheque.date,
                notes: editingCheque.notes
            });
        } else {
            updatePayment(editingCheque.id, {
                chequeNumber: editingCheque.chequeNumber,
                chequeBank: editingCheque.chequeBank,
                chequeDate: editingCheque.chequeDate,
                destination: editingCheque.destination,
                amount: Number(editingCheque.amount || 0),
                date: editingCheque.date,
                notes: editingCheque.notes
            });
        }
        setEditingCheque(null);
    };

    const deleteChequeItem = (item) => {
        if (item.isNested) {
            const parent = payments.find(p => p.id === item.originalPaymentId);
            if (!parent || !Array.isArray(parent.cheques)) return;
            const updatedCheques = parent.cheques.filter((_, i) => i !== item.chequeIndex);
            const newTotalAmount = updatedCheques.reduce((sum, c) => sum + Number(c.amount || 0), 0);
            updatePayment(parent.id, { cheques: updatedCheques, amount: newTotalAmount });
        } else {
            deletePayment(item.id);
        }
    };

    const addMonths = (iso, m) => {
        if (!iso) return '';
        const d = new Date(iso);
        return new Date(d.getFullYear(), d.getMonth() + m, d.getDate()).toLocaleDateString('en-CA');
    };
    const formatDMY = (iso) => {
        if (!iso) return '-';
        const [y, mm, dd] = iso.split('-');
        return `${dd}/${mm}/${y}`;
    };
    const statusFor = (expIso) => {
        if (!expIso) return { label: '-', color: '#64748b', bg: '#f1f5f9' };
        const t = new Date(new Date().toLocaleDateString('en-CA'));
        const e = new Date(expIso);
        const diffDays = Math.ceil((e - t) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { label: 'Vencido', color: 'var(--danger)', bg: 'var(--danger-soft)' };
        if (diffDays <= 30) return { label: 'Por vencer', color: 'var(--warning)', bg: 'var(--warning-soft)' };
        return { label: 'Vigente', color: 'var(--success)', bg: 'var(--success-soft)' };
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--surface-hover)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
                <button
                    className={`btn ${viewMode === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('monthly')}
                >
                    Mensual
                </button>
                <button
                    className={`btn ${viewMode === 'annual' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('annual')}
                >
                    Anual
                </button>
                <button
                    className={`btn ${viewMode === 'global' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('global')}
                >
                    Saldos
                </button>
                <button
                    className={`btn ${viewMode === 'cheques' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('cheques')}
                >
                    Cheques
                </button>
                <button
                    className={`btn ${viewMode === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('cash')}
                >
                    Efectivo
                </button>
                <button
                    className={`btn ${viewMode === 'transfer' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('transfer')}
                >
                    Transferencias
                </button>
                <button
                    className={`btn ${viewMode === 'iva' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('iva')}
                >
                    IVA
                </button>
                <button
                    className={`btn ${viewMode === 'agenda_client' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('agenda_client')}
                >
                    Agenda por Cliente
                </button>
            </div>
            {viewMode === 'iva' && (
                <>
                    <div className="card" style={{ background: 'var(--primary)', color: 'white', marginBottom: '1rem' }}>
                        <div style={{ opacity: 0.8, fontSize: '0.875rem' }}>IVA del Mes</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${totalMonthIVA.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="card" style={{ background: 'var(--primary)', color: 'white', marginBottom: '1rem' }}>
                        <div style={{ opacity: 0.8, fontSize: '0.875rem' }}>IVA Anual (12 meses)</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${totalAnnualIVA.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                    </div>
                    
                </>
            )}

            {viewMode === 'monthly' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3>Movimientos de {selectedMonth}</h3>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <label className="text-sm cursor-pointer no-print" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input type="checkbox" checked={showDetail} onChange={e => setShowDetail(e.target.checked)} />
                                Ver Detalle
                            </label>
                            <input
                                type="month"
                                className="form-input"
                                style={{ width: 'auto' }}
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(e.target.value)}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                        <div className="card" style={{ marginBottom: '0', padding: '1.25rem', border: '1px solid var(--surface-hover)' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Neto (Mes)</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif' }}>${totalMonthNet.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="card" style={{ marginBottom: '0', padding: '1.25rem', border: '1px solid var(--surface-hover)' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>IVA 21% (Mes)</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif' }}>${totalMonthIVA.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="card" style={{ marginBottom: '0', padding: '1.25rem', background: 'var(--primary-soft)', border: '1px solid hsla(var(--primary-h), var(--primary-s), var(--primary-l), 0.2)' }}>
                            <div style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Facturado</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif', color: 'var(--primary)' }}>${totalMonthBilled.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="card" style={{ marginBottom: '0', padding: '1.25rem', background: 'var(--success-soft)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <div style={{ color: 'var(--success)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Cobrado (Mes)</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif', color: 'var(--success)' }}>${totalMonthPaid.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Cliente</th>
                                        <th style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>Neto</th>
                                        <th style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>IVA</th>
                                        <th style={{ textAlign: 'right', color: 'var(--text-main)' }}>Total</th>
                                        <th style={{ textAlign: 'right', color: 'var(--success)' }}>Pagos</th>
                                        <th style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>Saldo Neto</th>
                                        <th style={{ textAlign: 'right', color: 'var(--primary)' }}>Saldo Total</th>
                                        <th style={{ width: '40px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.length === 0 ? (
                                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }} className="text-muted">No hay movimientos en este periodo.</td></tr>
                                    ) : (
                                        reportData.map(item => (
                                            <tr key={item.clientId}>
                                            <td style={{ verticalAlign: 'top' }}>
                                                <div style={{ fontWeight: 500 }}>
                                                    {item.clientName}
                                                    {getIvaRateForClient(item.clientId) === 0 && (
                                                        <span className="badge" style={{ marginLeft: '0.5rem', background: 'var(--danger-soft)', color: 'var(--danger)' }}>EXENTO</span>
                                                    )}
                                                </div>
                                                {showDetail && (
                                                    <>
                                                        {Object.keys(item.jobBreakdown).length > 0 && (
                                                            <ul style={{ margin: '0.5rem 0 0.5rem 0', paddingLeft: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                                {Object.entries(item.jobBreakdown).map(([pid, data]) => {
                                                                    const avgPrice = data.total / data.qty;
                                                                    return (
                                                                        <li key={pid}>
                                                                            <div>
                                                                                <span style={{ fontWeight: 600 }}>{data.name}</span>
                                                                                {data.leyenda && (
                                                                                    <div className="text-muted text-sm" style={{ marginTop: '2px' }}>{data.leyenda}</div>
                                                                                )}
                                                                            </div>
                                                                            <div>
                                                                                <span style={{ fontWeight: 600 }}>{data.qty}</span> x ${avgPrice.toLocaleString('es-AR')} = <span style={{ fontWeight: 600 }}>${data.total.toLocaleString('es-AR')}</span>
                                                                            </div>
                                                                        </li>
                                                                    );
                                                                })}
                                                                </ul>
                                                            )}
                                                            {Object.keys(item.paymentBreakdown).length > 0 && (
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.25rem' }}>
                                                                    <strong>Pagos:</strong>
                                                                    <ul style={{ margin: '0 0 0 0', paddingLeft: '1rem' }}>
                                                                        {Object.entries(item.paymentBreakdown).map(([method, data]) => (
                                                                            <li key={method}>
                                                                                {METHOD_LABELS[method] || method}: {data.qty} (${data.total.toLocaleString('es-AR')})
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right', verticalAlign: 'top', color: 'var(--text-secondary)' }}>
                                                    {item.jobNet > 0 ? `$${item.jobNet.toLocaleString('es-AR')}` : '-'}
                                                </td>
                                                <td style={{ textAlign: 'right', verticalAlign: 'top', color: 'var(--text-secondary)' }}>
                                                    {item.jobIVA > 0 ? `$${item.jobIVA.toLocaleString('es-AR')}` : '-'}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 500, verticalAlign: 'top' }}>
                                                    {item.jobTotal > 0 ? `$${item.jobTotal.toLocaleString('es-AR')}` : '-'}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--success)', verticalAlign: 'top' }}>
                                                    {item.paymentTotal > 0 ? `$${item.paymentTotal.toLocaleString('es-AR')}` : '-'}
                                                </td>
                                                <td style={{ textAlign: 'right', color: 'var(--text-secondary)', verticalAlign: 'top' }}>
                                                    ${item.currentBalance.net.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold', color: item.currentBalance.total > 0 ? 'var(--danger)' : 'var(--text-main)', verticalAlign: 'top' }}>
                                                    ${item.currentBalance.total.toLocaleString('es-AR')}
                                                </td>
                                                <td style={{ verticalAlign: 'top' }}>
                                                    <Link
                                                        to={`/reports/statement/${item.clientId}/${selectedMonth}`}
                                                        className="btn-icon"
                                                        title="Ver Resumen Mensual"
                                                        style={{ color: 'var(--text-secondary)', display: 'inline-flex' }}
                                                    >
                                                        <Printer size={18} />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {reportData.length > 0 && (
                                    <tfoot style={{ background: 'var(--surface-hover)', fontWeight: 'bold' }}>
                                        <tr>
                                            <td style={{ padding: '1rem 0.5rem' }}>TOTALES:</td>
                                            <td style={{ textAlign: 'right', padding: '1rem 0.5rem' }}>
                                                ${totalMonthNet.toLocaleString('es-AR')}
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '1rem 0.5rem' }}>
                                                ${totalMonthIVA.toLocaleString('es-AR')}
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '1rem 0.5rem' }}>
                                                ${totalMonthBilled.toLocaleString('es-AR')}
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '1rem 0.5rem', color: 'var(--success)' }}>
                                                ${totalMonthPaid.toLocaleString('es-AR')}
                                            </td>
                                            <td colSpan="3"></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Reuse Editing Modal for generic payment editing if structure matches, or just keep for Cheques for now as per specific previous task, 
                BUT user might want to edit these too. The modal is hardcoded for Cheque fields. 
                For now, I will NOT show edit buttons on Cash/Transfer to avoid complexity, unless the user asks for it. 
                Wait, the previous task was "enable editing of payment/cheque details".
                The current modal has specific fields. I'll stick to just REPORTS for Cash/Transfer today as requested.
            */}
            {viewMode === 'cheques' && (
                <>
                    <div className="card" style={{ background: 'var(--primary)', color: 'white', marginBottom: '1.5rem' }}>
                        <div style={{ opacity: 0.8, fontSize: '0.875rem' }}>Total en Cheques</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${totalCheques.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                    </div>

                    {chequesGroupedList.map(group => (
                        <div key={group.id} className="card" style={{ marginBottom: '1.5rem', padding: 0, overflow: 'hidden' }}>
                            <div style={{ padding: '1rem', background: 'var(--surface-hover)', borderBottom: '1px solid var(--surface-hover)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{group.name}</h3>
                                <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                    Total: ${group.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="table-wrapper">
                                <table style={{ fontSize: '0.875rem' }}>
                                    <thead>
                                        <tr>
                                            <th>Fecha de entrega</th>
                                            <th>Descripción</th>
                                            <th>Banco</th>
                                            <th>Nº Cheque</th>
                                            <th>Fecha de cobro</th>
                                            <th>Destino</th>
                                            <th style={{ textAlign: 'right' }}>Monto</th>
                                            <th style={{ width: '80px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.items.map(item => (
                                            <tr key={item.id}>
                                                <td>{item.date.split('-').reverse().join('/')}</td>
                                                <td>{item.notes || '-'}</td>
                                                <td>{item.chequeBank || '-'}</td>
                                                <td>{item.chequeNumber || '-'}</td>
                                                <td>{item.chequeDate ? item.chequeDate.split('-').reverse().join('/') : '-'}</td>
                                                <td>{item.destination || '-'}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 500 }}>
                                                    ${Number(item.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button className="icon-btn" title="Editar" onClick={() => handleEditCheque(item)}><Pencil size={16} /></button>
                                                    <button className="icon-btn" title="Eliminar" onClick={() => deleteChequeItem(item)} style={{ marginLeft: '6px', color: 'var(--danger)' }}><Trash2 size={16} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                    
                    {editingCheque && (
                        <div className="modal-backdrop">
                            <div className="modal card" style={{ maxWidth: '520px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0 }}>Editar Cheque</h3>
                                    <button className="icon-btn" onClick={() => setEditingCheque(null)}><X size={18} /></button>
                                </div>
                                <form onSubmit={submitEditCheque}>
                                    <div className="form-group">
                                        <label className="form-label">Fecha de entrega</label>
                                        <input type="date" className="form-input" value={editingCheque.date || ''} onChange={e => setEditingCheque({ ...editingCheque, date: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Descripción</label>
                                        <input className="form-input" value={editingCheque.notes || ''} onChange={e => setEditingCheque({ ...editingCheque, notes: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Banco</label>
                                        <input className="form-input" value={editingCheque.chequeBank || ''} onChange={e => setEditingCheque({ ...editingCheque, chequeBank: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Número de cheque</label>
                                        <input className="form-input" value={editingCheque.chequeNumber || ''} onChange={e => setEditingCheque({ ...editingCheque, chequeNumber: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Fecha de cobro</label>
                                        <input type="date" className="form-input" value={editingCheque.chequeDate || ''} onChange={e => setEditingCheque({ ...editingCheque, chequeDate: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Destino</label>
                                        <input className="form-input" value={editingCheque.destination || ''} onChange={e => setEditingCheque({ ...editingCheque, destination: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Monto</label>
                                        <input type="number" step="0.01" className="form-input" value={editingCheque.amount || ''} onChange={e => setEditingCheque({ ...editingCheque, amount: e.target.value })} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                        <button type="button" className="btn btn-secondary" onClick={() => setEditingCheque(null)}>Cancelar</button>
                                        <button type="submit" className="btn btn-primary">Guardar</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </>
            )}

            {viewMode === 'cash' && (
                <>
                    <div className="card" style={{ background: 'var(--success)', color: 'white', marginBottom: '1.5rem' }}>
                        <div style={{ opacity: 0.8, fontSize: '0.875rem' }}>Total en Efectivo</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${totalCash.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="table-wrapper">
                            <table style={{ fontSize: '0.875rem' }}>
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Cliente</th>
                                        <th>Concepto</th>
                                        <th style={{ textAlign: 'right' }}>Neto imputado</th>
                                        <th style={{ textAlign: 'right' }}>IVA imputado</th>
                                        <th>Observaciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.filter(p => p.method === 'CASH' && p.date.startsWith(selectedMonth)).length === 0 ? (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }} className="text-muted">Sin movimientos en efectivo</td></tr>
                                    ) : (
                                        payments
                                            .filter(p => p.method === 'CASH' && p.date.startsWith(selectedMonth))
                                            .map(p => (
                                                <tr key={p.id}>
                                                    <td>{p.date.split('-').reverse().join('/')}</td>
                                                    <td>{clients.find(c => c.id === p.clientId)?.name || '-'}</td>
                                                    <td>Efectivo</td>
                                                    <td style={{ textAlign: 'right' }}>${Number(p.netImputed || 0).toLocaleString('es-AR')}</td>
                                                    <td style={{ textAlign: 'right' }}>${Number(p.ivaImputed || 0).toLocaleString('es-AR')}</td>
                                                    <td>{p.notes || '-'}</td>
                                                </tr>
                                            ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {viewMode === 'transfer' && (
                <>
                    <div className="card" style={{ background: 'var(--primary)', color: 'white', marginBottom: '1.5rem' }}>
                        <div style={{ opacity: 0.8, fontSize: '0.875rem' }}>Total Transferencias</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${totalTransfer.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                    </div>

                    {transfersGroupedList.map(group => (
                        <div key={group.id} className="card" style={{ marginBottom: '1.5rem', padding: 0, overflow: 'hidden' }}>
                            <div style={{ padding: '1rem', background: 'var(--surface-hover)', borderBottom: '1px solid var(--surface-hover)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{group.name}</h3>
                                <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                    Total: ${group.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="table-wrapper">
                                <table style={{ fontSize: '0.875rem' }}>
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Descripción</th>
                                            <th>Banco / Plataforma</th>
                                            <th>Referencia</th>
                                            <th>Destino</th>
                                            <th style={{ textAlign: 'right' }}>Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.items.map(item => (
                                            <tr key={item.id}>
                                                <td>{item.date.split('-').reverse().join('/')}</td>
                                                <td>{item.notes || '-'}</td>
                                                <td>{item.transferBank || '-'}</td>
                                                <td>{item.transferNumber || '-'}</td>
                                                <td>{item.destination || '-'}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 500 }}>
                                                    ${Number(item.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </>
            )}

            {viewMode === 'annual' && (
                <>
                    <div className="card" style={{ marginBottom: '2rem', height: '300px', padding: '1rem' }}>
                        <h3 style={{ marginBottom: '1rem' }}>Evolución Anual</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} tickFormatter={(val) => `$${val}`} />
                                <Tooltip 
                                    formatter={(value) => [`$${value.toLocaleString('es-AR')}`, 'Total']}
                                    labelStyle={{ color: 'var(--text-main)' }}
                                />
                                <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="table-wrapper">
                            <table style={{ fontSize: '0.875rem' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left' }}>Mes</th>
                                        <th style={{ textAlign: 'right', fontWeight: 'bold' }}>Facturación Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {last12Months.map(m => (
                                        <tr 
                                            key={m} 
                                            onMouseEnter={() => setHoveredAnnualMonth(m)}
                                            onMouseLeave={() => setHoveredAnnualMonth(null)}
                                            style={{ position: 'relative', cursor: 'pointer' }}
                                        >
                                            <td style={{ fontWeight: 500 }}>
                                                {m}
                                                {hoveredAnnualMonth === m && monthlyClientBreakdown[m] && monthlyClientBreakdown[m].length > 0 && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '100%',
                                                        left: '20px',
                                                        zIndex: 100,
                                                        background: 'white',
                                                        border: '1px solid var(--surface-hover)',
                                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                                        borderRadius: '0.5rem',
                                                        padding: '1rem',
                                                        minWidth: '250px',
                                                        maxHeight: '300px',
                                                        overflowY: 'auto'
                                                    }}>
                                                        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', borderBottom: '1px solid #eee', paddingBottom: '0.25rem' }}>Detalle {m}</div>
                                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                            {monthlyClientBreakdown[m].map((item, idx) => (
                                                                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                                                    <span>{item.name}</span>
                                                                    <span style={{ fontWeight: 600 }}>${item.total.toLocaleString('es-AR')}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                                                ${annualTotals[m].toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot style={{ background: 'var(--surface-hover)', fontWeight: 'bold' }}>
                                    <tr>
                                        <td style={{ padding: '1rem 0.5rem' }}>TOTAL ANUAL</td>
                                        <td style={{ textAlign: 'right', padding: '1rem 0.5rem' }}>
                                            ${Object.values(annualTotals).reduce((a, b) => a + b, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {viewMode === 'global' && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div className="card" style={{ background: 'var(--text-secondary)', color: 'white', marginBottom: '0' }}>
                            <div style={{ opacity: 0.8, fontSize: '0.875rem' }}>Total Neto a Cobrar</div>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${totalGlobalNetDebt.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="card" style={{ background: 'var(--danger)', color: 'white', marginBottom: '0' }}>
                            <div style={{ opacity: 0.8, fontSize: '0.875rem' }}>Total a Cobrar (Deuda General)</div>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${totalGlobalDebt.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Cliente</th>
                                        <th>Teléfono</th>
                                        <th style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>Saldo Neto</th>
                                        <th style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>Saldo IVA</th>
                                        <th style={{ textAlign: 'right' }}>Saldo Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {globalBalances.map(c => {
                                        return (
                                            <tr key={c.id}>
                                                <td style={{ fontWeight: 500 }}>{c.name}</td>
                                                <td className="text-muted text-sm">{c.phone || '-'}</td>
                                                <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                                    ${c.balance.net.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                                    ${c.balance.iva.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem', color: c.balance.total > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                                    ${c.balance.total.toLocaleString('es-AR')}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
            {viewMode === 'agenda_client' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3>Reporte por Cliente</h3>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <select
                                className="form-input"
                                value={agendaClientId}
                                onChange={e => setAgendaClientId(e.target.value)}
                                style={{ minWidth: '240px' }}
                            >
                                <option value="">Seleccionar Cliente...</option>
                                {clients.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <div className="no-print" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input type="radio" name="repotype" checked={clientReportType === 'resumen'} onChange={() => setClientReportType('resumen')} />
                                    Resumen de cuenta
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input type="radio" name="repotype" checked={clientReportType === 'agenda'} onChange={() => setClientReportType('agenda')} />
                                    Agenda
                                </label>
                            </div>
                            <button className="btn btn-primary" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
                        </div>
                    </div>
                    {!agendaClientId ? (
                        <div className="card text-muted">Seleccione un cliente para ver su agenda.</div>
                    ) : (
                        <>
                            <div className="card" style={{ marginBottom: '1rem', paddingBottom: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                    <div>
                                        <h3 style={{ margin: 0 }}>{clients.find(c => c.id === agendaClientId)?.name || '-'}</h3>
                                        <div className="text-secondary text-sm">
                                            IVA: {clients.find(c => c.id === agendaClientId)?.ivaCondition || '-'}
                                        </div>
                                        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            {(() => {
                                                const acta = clients.find(c => c.id === agendaClientId)?.sanitary?.brucelosis?.actaDate || '';
                                                const exp = addMonths(acta, 12);
                                                const s = statusFor(exp);
                                                return <span className="badge" style={{ background: s.bg, color: s.color }}>Brucelosis: {formatDMY(exp)} · {s.label}</span>;
                                            })()}
                                            {(() => {
                                                const proto = clients.find(c => c.id === agendaClientId)?.sanitary?.tuberculosis?.protocoloDate || '';
                                                const exp = addMonths(proto, 12);
                                                const s = statusFor(exp);
                                                return <span className="badge" style={{ background: s.bg, color: s.color }}>Tuberculosis: {formatDMY(exp)} · {s.label}</span>;
                                            })()}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        {clientReportType === 'resumen' && (() => {
                                            const bal = getClientBalance(agendaClientId);
                                            return (
                                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                                    <div style={{ background: '#f5f5f5', color: 'var(--text-main)', padding: '0.75rem 1rem', borderRadius: '4px', border: '1px solid #ddd' }}>
                                                        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Saldo Neto</div>
                                                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>${bal.net.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                                                    </div>
                                                    <div style={{ background: '#000', color: '#fff', padding: '0.75rem 1rem', borderRadius: '4px' }}>
                                                        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Saldo Total</div>
                                                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>${bal.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        {clientReportType === 'agenda' && (
                                            <div className="no-print" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Desde</label>
                                                    <input type="date" className="form-input" value={agendaFrom} onChange={e => setAgendaFrom(e.target.value)} />
                                                </div>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Hasta</label>
                                                    <input type="date" className="form-input" value={agendaTo} onChange={e => setAgendaTo(e.target.value)} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {clientReportType === 'agenda' && (
                                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                    <div className="table-wrapper">
                                        <table style={{ fontSize: '0.875rem' }}>
                                            <thead>
                                                <tr>
                                                    <th>Fecha</th>
                                                    <th>Hora</th>
                                                    <th>Trabajo / Servicio</th>
                                                    <th>Observaciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {agendaEvents
                                                    .filter(e => e.clientId === agendaClientId)
                                                    .filter(e => {
                                                        if (agendaFrom && e.date < agendaFrom) return false;
                                                        if (agendaTo && e.date > agendaTo) return false;
                                                        return true;
                                                    })
                                                    .sort((a, b) => new Date(a.date) - new Date(b.date) || (a.time || '').localeCompare(b.time || ''))
                                                    .map(e => (
                                                        <tr key={e.id}>
                                                            <td>{e.date.split('-').reverse().join('/')}</td>
                                                            <td>{e.time || '-'}</td>
                                                            <td>{e.title}</td>
                                                            <td>{e.notes || '-'}</td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
