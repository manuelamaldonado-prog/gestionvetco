import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Printer, ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function CustomStatement() {
    const { clientId, fromDate, toDate } = useParams();
    const navigate = useNavigate();
    const { clients, jobs, payments, adjustments, practices, businessInfo, getIvaRateForClient } = useData();

    const [client, setClient] = useState(null);
    const [emailRecipient, setEmailRecipient] = useState('');
    const [whatsappRecipient, setWhatsappRecipient] = useState('');

    useEffect(() => {
        const c = clients.find(c => c.id === clientId);
        if (c) setClient(c);
    }, [clientId, clients]);

    if (!client) return <div className="container p-4">Cargando...</div>;

    if (!client.ivaCondition) {
        return (
            <div className="container p-4">
                <h3>Bloqueado</h3>
                <p className="text-muted">El cliente no tiene Condición de IVA configurada. Complete esta información para emitir comprobantes.</p>
            </div>
        );
    }

    const ivaRate = getIvaRateForClient(client.id);
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

    // Filter Data
    const previousJobs = jobs.filter(j => j.clientId === clientId && j.date < fromDate);
    const previousPayments = payments.filter(p => p.clientId === clientId && p.date < fromDate);
    const previousAdjustments = adjustments.filter(a => a.clientId === clientId && a.date < fromDate);

    const currentJobs = jobs.filter(j => j.clientId === clientId && j.date >= fromDate && j.date <= toDate)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    const currentPayments = payments.filter(p => p.clientId === clientId && p.date >= fromDate && p.date <= toDate)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Combine and sort all movements for a chronologic view if needed, 
    // but we'll follow the MonthlyStatement pattern of Jobs then Payments grouped or mixed.
    // Let's mix them for a better "History" feel in a custom range.
    const movements = [
        ...currentJobs.map(j => ({ ...j, type: 'JOB', sortDate: new Date(j.date) })),
        ...currentPayments.map(p => ({ ...p, type: 'PAYMENT', sortDate: new Date(p.date) })),
        ...adjustments.filter(a => a.clientId === clientId && a.date >= fromDate && a.date <= toDate)
            .map(a => ({ ...a, type: 'ADJUSTMENT', sortDate: new Date(a.date) }))
    ].sort((a, b) => a.sortDate - b.sortDate);

    // Calculations
    const calculatePeriodBalance = (jobsList, paymentsList, adjustmentsList, rate) => {
        let net = 0;
        let iva = 0;
        jobsList.forEach(j => {
            const jNet = Number(j.total);
            net += jNet;
            iva += (jNet * rate);
        });
        paymentsList.forEach(p => {
            const netPart = Number(p.netImputed) || 0;
            const ivaPart = Number(p.ivaImputed) || 0;
            net -= netPart;
            iva -= ivaPart;
        });
        adjustmentsList.forEach(a => {
            if (a.operationType === 'IVA_COMP') {
                iva -= (Number(a.amount) || 0);
            } else if (a.operationType === 'DISCOUNT') {
                let pct = Number(a.percentage) || 0;
                if (pct > 1) pct = pct / 100;
                const dNet = net * pct;
                const dIva = iva * pct;
                net -= dNet;
                iva -= dIva;
            }
        });
        return { net, iva, total: net + iva };
    };

    const previousBalance = calculatePeriodBalance(previousJobs, previousPayments, previousAdjustments, ivaRate);

    const currentJobTotal = currentJobs.reduce((acc, j) => acc + (Number(j.total) * (1 + ivaRate)), 0);
    const currentPayTotal = currentPayments.reduce((acc, p) => acc + Number(p.amount), 0);

    const finalBalance = calculatePeriodBalance([...previousJobs, ...currentJobs], [...previousPayments, ...currentPayments], previousAdjustments.concat(adjustments.filter(a => a.clientId === clientId && a.date >= fromDate && a.date <= toDate)), ivaRate);

    const totalKilos = currentJobs.reduce((sum, j) => {
        if (j.convertToKilos && Number(businessInfo?.inmag) > 0) {
            return sum + (Number(j.total) / Number(businessInfo.inmag));
        }
        return sum;
    }, 0);

    const handlePrint = () => {
        window.print();
    };
    const composeStatementText = () => {
        const lines = [];
        lines.push(`Resumen de Cuenta · ${client.name}`);
        lines.push(`Periodo: ${new Date(fromDate).toLocaleDateString()} al ${new Date(toDate).toLocaleDateString()}`);
        const acta = client?.sanitary?.brucelosis?.actaDate || '';
        const proto = client?.sanitary?.tuberculosis?.protocoloDate || '';
        lines.push(`Brucelosis: Vence ${formatDMY(addMonths(acta, 12))}`);
        lines.push(`Tuberculosis: Vence ${formatDMY(addMonths(proto, 12))}`);
        lines.push('');
        lines.push(`Saldo Anterior Total: $${previousBalance.total.toLocaleString('es-AR')}`);
        lines.push(`Facturado Neto: $${currentJobs.reduce((acc, j) => acc + Number(j.total), 0).toLocaleString('es-AR')}`);
        lines.push(`IVA del Periodo: $${currentJobs.reduce((acc, j) => acc + (Number(j.total) * ivaRate), 0).toLocaleString('es-AR')}`);
        lines.push(`Pagos del Periodo: $${currentPayments.reduce((sum, p) => sum + Number(p.amount), 0).toLocaleString('es-AR')}`);
        lines.push(`Saldo Final Total: $${finalBalance.total.toLocaleString('es-AR')}`);
        return lines.join('\n');
    };
    const shareEmail = () => {
        const subject = `Resumen ${client.name} ${fromDate} a ${toDate}`;
        const body = composeStatementText();
        const mailto = `mailto:${encodeURIComponent(emailRecipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailto, '_blank');
    };
    const shareWhatsApp = () => {
        const text = composeStatementText();
        const wa = whatsappRecipient
            ? `https://wa.me/${encodeURIComponent(whatsappRecipient)}?text=${encodeURIComponent(text)}`
            : `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(wa, '_blank');
    };

    return (
        <div className="container" style={{ maxWidth: '800px', background: 'white', minHeight: '100vh', padding: '2rem' }}>

            {/* No-Print Controls */}
            <div className="no-print" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
                <button onClick={() => navigate(-1)} className="btn btn-secondary"><ArrowLeft size={16} /> Volver</button>
                <button onClick={handlePrint} className="btn btn-primary"><Printer size={16} /> Imprimir</button>
                <input className="form-input" placeholder="Email destino" value={emailRecipient} onChange={e => setEmailRecipient(e.target.value)} style={{ width: '220px' }} />
                <button className="btn btn-secondary" onClick={shareEmail}>Enviar Email</button>
                <input className="form-input" placeholder="WhatsApp destino (ej. 549XXXXXXXXXX)" value={whatsappRecipient} onChange={e => setWhatsappRecipient(e.target.value)} style={{ width: '230px' }} />
                <button className="btn btn-secondary" onClick={shareWhatsApp}>Enviar WhatsApp</button>
            </div>

            {/* Header */}
            <div style={{ borderBottom: '2px solid #ccc', paddingBottom: '1rem', marginBottom: '2rem' }}>
                <h1 style={{ marginBottom: '0.5rem' }}>Resumen de Cuenta</h1>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{client.name}</h2>
                        <div className="text-secondary text-sm">CUIT: {client.cuit || '-'}</div>
                        <div className="text-secondary text-sm">
                            IVA: {client.ivaCondition || '-'}
                            {client.ivaCondition === 'Exento' && (
                                <span className="badge" style={{ marginLeft: '0.5rem', background: 'var(--danger-soft)', color: 'var(--danger)', fontWeight: 700 }}>EXENTO</span>
                            )}
                        </div>
                        <div className="text-secondary text-sm">RENSPA: {client.renspa || '-'}</div>
                        {(client.address || client.city) && (
                            <div className="text-secondary text-sm">
                                {client.address}
                                {client.address && client.city && ', '}
                                {client.city}
                                {client.province && `, ${client.province}`}
                            </div>
                        )}
                        <div className="text-secondary text-sm">{client.phone}</div>
                        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {(() => {
                                const acta = client?.sanitary?.brucelosis?.actaDate || '';
                                const exp = addMonths(acta, 12);
                                const s = statusFor(exp);
                                return <span className="badge" style={{ background: s.bg, color: s.color }}>Brucelosis: {formatDMY(exp)} · {s.label}</span>;
                            })()}
                            {(() => {
                                const proto = client?.sanitary?.tuberculosis?.protocoloDate || '';
                                const exp = addMonths(proto, 12);
                                const s = statusFor(exp);
                                return <span className="badge" style={{ background: s.bg, color: s.color }}>Tuberculosis: {formatDMY(exp)} · {s.label}</span>;
                            })()}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.875rem', color: '#666' }}>Periodo</div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                            {new Date(fromDate).toLocaleDateString()} al {new Date(toDate).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            </div>
            {client.ivaCondition === 'Exento' && (
                <div className="no-print" style={{ padding: '0.75rem 1rem', border: '1px solid #fee2e2', background: '#fef2f2', color: '#b91c1c', borderRadius: '6px', marginBottom: '1rem', fontWeight: 600 }}>
                    Cliente EXENTO – No se aplica IVA en este comprobante
                </div>
            )}

            {/* Summary Box */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
                <table style={{ width: 'auto', border: '1px solid #ddd' }}>
                    <tbody>
                        <tr>
                            <th style={{ padding: '0.5rem 1rem', background: '#f9f9f9', textAlign: 'right', color: 'var(--text-secondary)' }}>Saldo Anterior Neto:</th>
                            <td style={{ padding: '0.5rem 1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>${previousBalance.net.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                            <th style={{ padding: '0.5rem 1rem', background: '#f9f9f9', textAlign: 'right' }}>Saldo Anterior Total:</th>
                            <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>${previousBalance.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Details */}
            <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Movimientos</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #000' }}>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Fecha</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Descripción</th>
                            <th style={{ textAlign: 'center', padding: '0.5rem' }}>Cant.</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem' }}>Neto</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem' }}>IVA {ivaRate === 0 ? '(EXENTO)' : '(21%)'}</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem' }}>Total</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem' }}>Kilos</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem' }}>Crédito</th>
                        </tr>
                    </thead>
                    <tbody>
                        {movements.map(item => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '0.5rem' }}>{item.date.split('-').reverse().join('/')}</td>
                                <td style={{ padding: '0.5rem' }}>
                                    {item.type === 'JOB' ? (
                                        <>
                                            <div>{item.practiceName}</div>
                                            {practices.find(p => p.id === item.practiceId)?.leyenda && (
                                                <div className="text-muted text-sm" style={{ marginTop: '2px' }}>
                                                    {practices.find(p => p.id === item.practiceId)?.leyenda}
                                                </div>
                                            )}
                                            {item.notes && (
                                                <div className="text-muted text-sm" style={{ marginTop: '2px' }}>
                                                    {item.notes}
                                                </div>
                                            )}
                                            {(item.convertToKilos && Number(businessInfo?.inmag) > 0) && (
                                                <div className="text-muted text-sm" style={{ marginTop: '2px' }}>
                                                    ≈ {(Number(item.total) / Number(businessInfo.inmag)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg novillo (INMAG ${Number(businessInfo.inmag).toLocaleString('es-AR')})
                                                </div>
                                            )}
                                        </>
                                    ) : item.type === 'PAYMENT' ? (
                                        `PAGO ${item.paymentType === 'OTRO' ? '(NEGRO)' : '(BLANCO)'} - ${item.method}`
                                    ) : (
                                        item.operationType === 'IVA_COMP'
                                            ? `AJUSTE ADMINISTRATIVO: Compensación IVA`
                                            : `AJUSTE COMERCIAL: Descuento ${Number(item.percentage) > 1 ? Number(item.percentage) + '%' : (Number(item.percentage) * 100).toFixed(0) + '%'}`
                                    )}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                    {item.type === 'JOB' ? item.quantity : '-'}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: '#666' }}>
                                    {item.type === 'JOB' ? `$${Number(item.total).toLocaleString('es-AR')}` : '-'}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: '#666' }}>
                                    {item.type === 'JOB' ? `$${(Number(item.total) * ivaRate).toLocaleString('es-AR')}` : (item.type === 'ADJUSTMENT' && item.operationType === 'IVA_COMP') ? `-$${Number(item.amount).toLocaleString('es-AR')}` : '-'}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                    {item.type === 'JOB' ? `$${(Number(item.total) * (1 + ivaRate)).toLocaleString('es-AR')}` : '-'}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                    {(item.type === 'JOB' && item.convertToKilos && Number(businessInfo?.inmag) > 0)
                                        ? (Number(item.total) / Number(businessInfo.inmag)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                        : '-'}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                    {item.type === 'PAYMENT' ? `$${Number(item.amount).toLocaleString('es-AR')}` : '-'}
                                </td>
                            </tr>
                        ))}

                        {/* Totals Row */}
                        <tr style={{ borderTop: '2px solid #000', fontWeight: 'bold', background: '#f9f9f9', fontSize: '0.9rem' }}>
                            <td colSpan="3" style={{ padding: '0.75rem', textAlign: 'right' }}>Totales del Periodo:</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                ${currentJobs.reduce((acc, j) => acc + Number(j.total), 0).toLocaleString('es-AR')}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                ${currentJobs.reduce((acc, j) => acc + (Number(j.total) * ivaRate), 0).toLocaleString('es-AR')}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                ${currentJobTotal.toLocaleString('es-AR')}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                {totalKilos.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                ${currentPayTotal.toLocaleString('es-AR')}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Final Balance */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', gap: '1rem' }}>
                <div style={{ background: '#f5f5f5', color: 'var(--text-main)', padding: '1rem 2rem', borderRadius: '4px', border: '1px solid #ddd' }}>
                    <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>Saldo Final Neto</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${finalBalance.net.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div style={{ background: '#000', color: '#fff', padding: '1rem 2rem', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>Saldo Final Total</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${finalBalance.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                    {(Number(businessInfo?.inmag) > 0) && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.95rem', opacity: 0.9 }}>
                            ≈ {(finalBalance.total / Number(businessInfo.inmag)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg novillo (INMAG ${Number(businessInfo.inmag).toLocaleString('es-AR')})
                        </div>
                    )}
                </div>
            </div>

            {/* Business Info Footer */}
            {(businessInfo.name || businessInfo.bank || businessInfo.paymentDetails) && (
                <div style={{ marginTop: '4rem', paddingTop: '1.5rem', borderTop: '2px solid #f1f5f9', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.75rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>Información de Pago:</div>

                    {/* Row 1: Titular y CUIT */}
                    <div style={{ marginBottom: '0.4rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {businessInfo.name && <span>Titular: <strong style={{ color: 'var(--text-main)' }}>{businessInfo.name}</strong></span>}
                        {businessInfo.cuit && <span>CUIT: <strong style={{ color: 'var(--text-main)' }}>{businessInfo.cuit}</strong></span>}
                    </div>

                    {/* Row 2: Banco, Cuenta, CBU y Alias */}
                    <div style={{ marginBottom: '0.4rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {businessInfo.bank && <span>Banco: <strong style={{ color: 'var(--text-main)' }}>{businessInfo.bank}</strong></span>}
                        {businessInfo.accountNumber && <span>Cuenta: <strong style={{ color: 'var(--text-main)' }}>{businessInfo.accountNumber}</strong></span>}
                        {businessInfo.cbu && <span>CBU: <strong style={{ color: 'var(--text-main)' }}>{businessInfo.cbu}</strong></span>}
                        {businessInfo.alias && <span>ALIAS: <strong style={{ color: 'var(--text-main)' }}>{businessInfo.alias}</strong></span>}
                    </div>

                    {/* Row 3: Contact Info */}
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                        {businessInfo.phone && <span>Teléfono: <strong style={{ color: 'var(--text-main)' }}>{businessInfo.phone}</strong></span>}
                        {businessInfo.email && <span>Email: <strong style={{ color: 'var(--text-main)' }}>{businessInfo.email}</strong></span>}
                    </div>

                    {businessInfo.extraDetails && <div style={{ whiteSpace: 'pre-wrap', marginTop: '0.4rem', fontStyle: 'italic' }}>{businessInfo.extraDetails}</div>}
                </div>
            )}
        </div>
    );
}
