import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Printer, ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function MonthlyStatement() {
    const { clientId, month } = useParams(); // month format YYYY-MM
    const navigate = useNavigate();
    const { clients, jobs, payments, practices, businessInfo, getIvaRateForClient } = useData();

    const [client, setClient] = useState(null);

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

    // Filter Data
    const monthStart = `${month}-01`;
    // Simple string comparison works for ISO dates YYYY-MM-DD
    const previousJobs = jobs.filter(j => j.clientId === clientId && j.date < monthStart);
    const previousPayments = payments.filter(p => p.clientId === clientId && p.date < monthStart);

    const currentJobs = jobs.filter(j => j.clientId === clientId && j.date.startsWith(month));
    const currentPayments = payments.filter(p => p.clientId === clientId && p.date.startsWith(month));

    // Calculations
    const prevJobTotal = previousJobs.reduce((acc, j) => acc + (Number(j.total) * (1 + ivaRate)), 0);
    const prevPayTotal = previousPayments.reduce((acc, p) => acc + Number(p.amount), 0);
    const previousBalance = prevJobTotal - prevPayTotal;

    const currentJobTotal = currentJobs.reduce((acc, j) => acc + (Number(j.total) * (1 + ivaRate)), 0);
    const currentPayTotal = currentPayments.reduce((acc, p) => acc + Number(p.amount), 0);

    const finalBalance = previousBalance + currentJobTotal - currentPayTotal;
    const totalKilos = currentJobs.reduce((sum, j) => {
        if (j.convertToKilos && Number(businessInfo?.inmag) > 0) {
            return sum + (Number(j.total) / Number(businessInfo.inmag));
        }
        return sum;
    }, 0);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="container" style={{ maxWidth: '800px', background: 'white', minHeight: '100vh', padding: '2rem' }}>

            {/* No-Print Controls */}
            <div className="no-print" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <button onClick={() => navigate(-1)} className="btn btn-secondary"><ArrowLeft size={16} /> Volver</button>
                <button onClick={handlePrint} className="btn btn-primary"><Printer size={16} /> Imprimir</button>
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
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.875rem', color: '#666' }}>Periodo</div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{month}</div>
                        {client.ivaCondition === 'Exento' && (
                            <div style={{ marginTop: '0.5rem', fontWeight: 'bold', color: '#b91c1c' }}>EXENTO</div>
                        )}
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
                            <th style={{ padding: '0.5rem 1rem', background: '#f9f9f9', textAlign: 'right' }}>Saldo Anterior:</th>
                            <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>${previousBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Details */}
            <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Movimientos del Mes</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #000' }}>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Fecha</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Descripción</th>
                            <th style={{ textAlign: 'center', padding: '0.5rem' }}>Cant.</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem' }}>Precio U.</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem' }}>Neto</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem' }}>IVA {ivaRate === 0 ? '(EXENTO)' : '(21%)'}</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem' }}>Total</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem' }}>Kilos</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem' }}>Crédito</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentJobs.map(j => (
                            <tr key={j.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '0.5rem' }}>{j.date.split('-').reverse().join('/')}</td>
                                <td style={{ padding: '0.5rem' }}>
                                    <div>{j.practiceName}</div>
                                    {practices.find(p => p.id === j.practiceId)?.leyenda && (
                                        <div className="text-muted text-sm" style={{ marginTop: '2px' }}>
                                            {practices.find(p => p.id === j.practiceId)?.leyenda}
                                        </div>
                                    )}
                                    {j.notes && (
                                        <div className="text-muted text-sm" style={{ marginTop: '2px' }}>
                                            {j.notes}
                                        </div>
                                    )}
                                    {(j.convertToKilos && Number(businessInfo?.inmag) > 0) && (
                                        <div className="text-muted text-sm" style={{ marginTop: '2px' }}>
                                            ≈ {(Number(j.total) / Number(businessInfo.inmag)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg novillo (INMAG ${Number(businessInfo.inmag).toLocaleString('es-AR')})
                                        </div>
                                    )}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{j.quantity}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>${Number(j.unitPrice).toLocaleString('es-AR')}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: '#666' }}>${Number(j.total).toLocaleString('es-AR')}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: '#666' }}>${(Number(j.total) * ivaRate).toLocaleString('es-AR')}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>${(Number(j.total) * (1 + ivaRate)).toLocaleString('es-AR')}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                    {(j.convertToKilos && Number(businessInfo?.inmag) > 0)
                                        ? (Number(j.total) / Number(businessInfo.inmag)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                        : '-'}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>-</td>
                            </tr>
                        ))}
                        {currentPayments.map(p => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '0.5rem' }}>{p.date.split('-').reverse().join('/')}</td>
                                <td style={{ padding: '0.5rem' }}>
                                    PAGO ({p.method})
                                    {p.method === 'CHEQUE' && <span style={{ fontSize: '0.8em', color: '#666', marginLeft: '4px' }}>#{p.chequeNumber}</span>}
                                    {p.method === 'TRANSFER' && <span style={{ fontSize: '0.8em', color: '#666', marginLeft: '4px' }}>#{p.transferNumber}</span>}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>-</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>-</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>-</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>-</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>-</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>-</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>${Number(p.amount).toLocaleString('es-AR')}</td>
                            </tr>
                        ))}

                        {/* Monthly Totals Row */}
                        <tr style={{ borderTop: '2px solid #000', fontWeight: 'bold', background: '#f9f9f9', fontSize: '0.9rem' }}>
                            <td colSpan="4" style={{ padding: '0.75rem', textAlign: 'right' }}>Totales del Mes:</td>
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

            {/* Payment Breakdown */}
            {(currentPayTotal > 0) && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    <div style={{ background: '#f5f5f5', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #eee' }}>
                        <span style={{ marginRight: '1rem', fontWeight: 600 }}>Detalle de Pagos:</span>
                        {currentPayments.filter(p => p.method === 'CASH').reduce((sum, p) => sum + Number(p.amount), 0) > 0 && (
                            <span style={{ marginRight: '1rem' }}>
                                Efectivo: <strong>${currentPayments.filter(p => p.method === 'CASH').reduce((sum, p) => sum + Number(p.amount), 0).toLocaleString('es-AR')}</strong>
                            </span>
                        )}
                        {currentPayments.filter(p => p.method === 'CHEQUE').reduce((sum, p) => sum + Number(p.amount), 0) > 0 && (
                            <span style={{ marginRight: '1rem' }}>
                                Cheques: <strong>${currentPayments.filter(p => p.method === 'CHEQUE').reduce((sum, p) => sum + Number(p.amount), 0).toLocaleString('es-AR')}</strong>
                            </span>
                        )}
                        {currentPayments.filter(p => p.method === 'TRANSFER').reduce((sum, p) => sum + Number(p.amount), 0) > 0 && (
                            <span>
                                Transf: <strong>${currentPayments.filter(p => p.method === 'TRANSFER').reduce((sum, p) => sum + Number(p.amount), 0).toLocaleString('es-AR')}</strong>
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Final Balance */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <div style={{ background: '#000', color: '#fff', padding: '1rem 2rem', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>Saldo Final a la Fecha</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${finalBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                    {(Number(businessInfo?.inmag) > 0) && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.95rem', opacity: 0.9 }}>
                            ≈ {(finalBalance / Number(businessInfo.inmag)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg novillo (INMAG ${Number(businessInfo.inmag).toLocaleString('es-AR')})
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
