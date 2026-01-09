import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Printer, ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function AgendaStatement() {
    const { clientId, fromDate, toDate } = useParams();
    const navigate = useNavigate();
    const { clients, agendaEvents } = useData();

    const [client, setClient] = useState(null);
    const [emailRecipient, setEmailRecipient] = useState('');
    const [whatsappRecipient, setWhatsappRecipient] = useState('');

    useEffect(() => {
        const c = clients.find(c => c.id === clientId);
        if (c) setClient(c);
    }, [clientId, clients]);

    if (!client) return <div className="container p-4">Cargando...</div>;

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

    const filteredEvents = agendaEvents
        .filter(e => e.clientId === clientId)
        .filter(e => {
            if (fromDate && e.date < fromDate) return false;
            if (toDate && e.date > toDate) return false;
            return true;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date) || (a.time || '').localeCompare(b.time || ''));

    const handlePrint = () => window.print();
    const composeAgendaText = () => {
        const lines = [];
        lines.push(`Agenda · ${client.name}`);
        lines.push(`Periodo: ${fromDate ? new Date(fromDate).toLocaleDateString() : '-'} al ${toDate ? new Date(toDate).toLocaleDateString() : '-'}`);
        const acta = client?.sanitary?.brucelosis?.actaDate || '';
        const proto = client?.sanitary?.tuberculosis?.protocoloDate || '';
        const expB = formatDMY(addMonths(acta, 12));
        const expT = formatDMY(addMonths(proto, 12));
        lines.push(`Brucelosis: Vence ${expB}`);
        lines.push(`Tuberculosis: Vence ${expT}`);
        lines.push('');
        if (filteredEvents.length === 0) {
            lines.push('Sin trabajos en el periodo seleccionado.');
        } else {
            filteredEvents.forEach(e => {
                const d = e.date.split('-').reverse().join('/');
                const h = e.time || '-';
                const t = e.title;
                const n = e.notes || '-';
                lines.push(`${d}  ${h}  ${t}  · ${n}`);
            });
        }
        return lines.join('\n');
    };
    const shareEmail = () => {
        const subject = `Agenda ${client.name} ${fromDate || ''} - ${toDate || ''}`;
        const body = composeAgendaText();
        const mailto = `mailto:${encodeURIComponent(emailRecipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailto, '_blank');
    };
    const shareWhatsApp = () => {
        const text = composeAgendaText();
        const wa = whatsappRecipient
            ? `https://wa.me/${encodeURIComponent(whatsappRecipient)}?text=${encodeURIComponent(text)}`
            : `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(wa, '_blank');
    };

    return (
        <div className="container" style={{ maxWidth: '800px', background: 'white', minHeight: '100vh', padding: '2rem' }}>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Volver</button>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button className="btn btn-primary" onClick={handlePrint}><Printer size={16} /> Imprimir</button>
                    <input className="form-input" placeholder="Email destino" value={emailRecipient} onChange={e => setEmailRecipient(e.target.value)} style={{ width: '220px' }} />
                    <button className="btn btn-secondary" onClick={shareEmail}>Enviar Email</button>
                    <input className="form-input" placeholder="WhatsApp destino (ej. 549XXXXXXXXXX)" value={whatsappRecipient} onChange={e => setWhatsappRecipient(e.target.value)} style={{ width: '230px' }} />
                    <button className="btn btn-secondary" onClick={shareWhatsApp}>Enviar WhatsApp</button>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ marginBottom: '0.5rem' }}>Agenda</h1>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{client.name}</h2>
                    <div className="text-secondary text-sm">CUIT: {client.cuit || '-'}</div>
                    <div className="text-secondary text-sm">IVA: {client.ivaCondition || '-'}</div>
                    <div className="text-secondary text-sm">RENSPA: {client.renspa || '-'}</div>
                    {(client.address || client.city) && (
                        <div className="text-secondary text-sm">
                            {client.address}
                            {client.address && client.city && ', '}
                            {client.city}
                            {client.province && `, ${client.province}`}
                        </div>
                    )}
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
                    <div className="text-secondary text-sm">Periodo</div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                        {fromDate ? new Date(fromDate).toLocaleDateString() : '-'} al {toDate ? new Date(toDate).toLocaleDateString() : '-'}
                    </div>
                </div>
            </div>

            <div style={{ borderBottom: '2px solid #ccc', paddingBottom: '0.5rem', marginBottom: '1rem' }}></div>

            <div style={{ marginBottom: '2rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #000' }}>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Fecha</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Hora</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Trabajo / Servicio</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Observaciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEvents.length === 0 ? (
                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }} className="text-muted">Sin trabajos en el periodo seleccionado.</td></tr>
                        ) : (
                            filteredEvents.map(e => (
                                <tr key={e.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '0.5rem' }}>{e.date.split('-').reverse().join('/')}</td>
                                    <td style={{ padding: '0.5rem' }}>{e.time || '-'}</td>
                                    <td style={{ padding: '0.5rem' }}>{e.title}</td>
                                    <td style={{ padding: '0.5rem' }}>{e.notes || '-'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
