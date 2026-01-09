import { useState } from 'react';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { Plus, User, Phone, Search, ChevronRight } from 'lucide-react';

export default function ClientList() {
    const { clients, addClient, getClientBalance } = useData();
    const [showForm, setShowForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        name: '', cuit: '', renspa: '', phone: '', email: '', address: '', city: '', province: '', ivaCondition: '',
        convertToKilos: false, showSanitary: true
    });
    const addMonths = (iso, m) => {
        if (!iso) return '';
        const d = new Date(iso);
        const year = d.getFullYear();
        const month = d.getMonth();
        const day = d.getDate();
        const nd = new Date(year, month + m, day);
        return nd.toLocaleDateString('en-CA');
    };
    const formatDMY = (iso) => {
        if (!iso) return '-';
        const parts = iso.split('-');
        if (parts.length !== 3) return '-';
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };
    const statusFor = (expIso) => {
        if (!expIso) return { label: '-', color: 'var(--text-secondary)', bg: 'var(--surface-hover)' };
        const today = new Date().toLocaleDateString('en-CA');
        const t = new Date(today);
        const e = new Date(expIso);
        const diffMs = e - t;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { label: 'Vencido', color: 'var(--danger)', bg: 'var(--danger-soft)' };
        if (diffDays <= 30) return { label: 'Por vencer', color: 'var(--warning)', bg: 'var(--warning-soft)' };
        return { label: 'Vigente', color: 'var(--success)', bg: 'var(--success-soft)' };
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name) return;
        if (!formData.ivaCondition) {
            alert('Debe seleccionar la Condición de IVA del cliente');
            return;
        }
        addClient(formData);
        setFormData({ name: '', cuit: '', renspa: '', phone: '', email: '', address: '', city: '', province: '', ivaCondition: '' });
        setShowForm(false);
    };

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cuit.includes(searchTerm)
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2>Clientes</h2>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    <Plus size={20} /> Nuevo
                </button>
            </div>

            {showForm && (
                <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Nombre / Razón Social *</label>
                            <input
                                className="form-input"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                                autoFocus
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">CUIT</label>
                                <input
                                    className="form-input"
                                    value={formData.cuit}
                                    onChange={e => setFormData({ ...formData, cuit: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">RENSPA</label>
                                <input
                                    className="form-input"
                                    value={formData.renspa}
                                    onChange={e => setFormData({ ...formData, renspa: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Teléfono</label>
                            <input
                                className="form-input"
                                type="tel"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Dirección</label>
                            <input
                                className="form-input"
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Ciudad</label>
                                <input
                                    className="form-input"
                                    value={formData.city}
                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Provincia</label>
                                <input
                                    className="form-input"
                                    value={formData.province}
                                    onChange={e => setFormData({ ...formData, province: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Condición de IVA *</label>
                            <select
                                className="form-input"
                                value={formData.ivaCondition}
                                onChange={e => setFormData({ ...formData, ivaCondition: e.target.value })}
                                required
                            >
                                <option value="">Seleccionar...</option>
                                <option value="Responsable Inscripto">Responsable Inscripto</option>
                                <option value="Monotributista">Monotributista</option>
                                <option value="Exento">Exento</option>
                                <option value="Consumidor Final">Consumidor Final</option>
                            </select>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    id="convertToKilos"
                                    checked={formData.convertToKilos}
                                    onChange={e => setFormData({ ...formData, convertToKilos: e.target.checked })}
                                    style={{ width: '1.2rem', height: '1.2rem' }}
                                />
                                <label htmlFor="convertToKilos" style={{ cursor: 'pointer' }}>Convertir a Kilos Novillo</label>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    id="showSanitary"
                                    checked={formData.showSanitary}
                                    onChange={e => setFormData({ ...formData, showSanitary: e.target.checked })}
                                    style={{ width: '1.2rem', height: '1.2rem' }}
                                />
                                <label htmlFor="showSanitary" style={{ cursor: 'pointer' }}>Mostrar Información Sanitaria</label>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                            <button type="submit" className="btn btn-primary">Guardar</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="form-group">
                <div style={{ position: 'relative' }}>
                    <Search size={20} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                    <input
                        className="form-input"
                        style={{ paddingLeft: '40px' }}
                        placeholder="Buscar por nombre o CUIT..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredClients.length === 0 ? (
                    <p className="text-muted" style={{ textAlign: 'center', margin: '2rem 0' }}>No se encontraron clientes.</p>
                ) : (
                    filteredClients.map(client => {
                        const balance = getClientBalance(client.id);
                        // balance is { net, iva, total }
                        return (
                            <Link
                                to={`/clients/${client.id}`}
                                key={client.id}
                                className="card"
                                style={{
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '1.25rem',
                                    margin: 0,
                                    cursor: 'pointer'
                                }}
                            >
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', marginBottom: '0.25rem' }}>{client.name}</h3>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                        {client.ivaCondition && (
                                            <span className="badge" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
                                                IVA: {client.ivaCondition}
                                            </span>
                                        )}
                                        {(() => {
                                            const acta = client?.sanitary?.brucelosis?.actaDate || '';
                                            const exp = addMonths(acta, 12);
                                            const s = statusFor(exp);
                                            return (
                                                <span className="badge" style={{ background: s.bg, color: s.color }}>
                                                    Venc. Brucelosis: {formatDMY(exp)}
                                                </span>
                                            );
                                        })()}
                                        {(() => {
                                            const proto = client?.sanitary?.tuberculosis?.protocoloDate || '';
                                            const exp = addMonths(proto, 12);
                                            const s = statusFor(exp);
                                            return (
                                                <span className="badge" style={{ background: s.bg, color: s.color }}>
                                                    Venc. Tuberculosis: {formatDMY(exp)}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                                        {client.cuit && <span>CUIT: {client.cuit}</span>}
                                        {client.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={14} /> {client.phone}</span>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--primary)' }}>
                                            ${balance.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            Neto: ${balance.net.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                        </div>
                                    </div>
                                    <ChevronRight color="var(--text-secondary)" />
                                </div>
                            </Link>
                        );
                    })
                )}
            </div>
        </div>
    );
}
