import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Users, FileText, TrendingUp, Settings } from 'lucide-react';

export default function Dashboard() {
    const { clients, jobs } = useData();

    const currentMonth = new Date().toLocaleDateString('en-CA').slice(0, 7);
    const jobsThisMonth = jobs.filter(j => j.date.startsWith(currentMonth));
    const totalAmount = jobsThisMonth.reduce((acc, j) => acc + Number(j.total), 0);

    const stats = [
        { label: 'Clientes', value: clients.length, icon: Users, to: '/clients', color: 'var(--primary)', bg: 'var(--primary-soft)' },
        { label: 'Trabajos (Mes)', value: jobsThisMonth.length, icon: FileText, to: '/reports', color: 'var(--success)', bg: 'var(--success-soft)' },
        { label: 'Facturacion (Mes)', value: `$${totalAmount.toLocaleString('es-AR')}`, icon: TrendingUp, to: '/reports', color: 'var(--warning)', bg: 'var(--warning-soft)' },
    ];

    return (
        <div style={{ animation: 'fadeIn 0.6s ease-out' }}>
            <h2 style={{ marginBottom: '1.5rem', opacity: 0.9 }}>Bienvenido</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
                {stats.map((stat, i) => (
                    <Link to={stat.to} key={i} className="card" style={{
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        border: '1px solid rgba(0,0,0,0.02)'
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: stat.bg,
                            color: stat.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <stat.icon size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '4px' }}>
                                {stat.label}
                            </div>
                            <div style={{ fontSize: '1.75rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif' }}>
                                {stat.value}
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="card" style={{ padding: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>Acciones Rapidas</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
                    <Link to="/clients" className="btn btn-secondary" style={{
                        flexDirection: 'column',
                        gap: '0.75rem',
                        padding: '1.5rem',
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--surface)',
                        border: '1.5px solid #f1f5f9'
                    }}>
                        <div style={{ color: 'var(--primary)' }}><Users size={28} /></div>
                        Gestionar Clientes
                    </Link>
                    <Link to="/catalog" className="btn btn-secondary" style={{
                        flexDirection: 'column',
                        gap: '0.75rem',
                        padding: '1.5rem',
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--surface)',
                        border: '1.5px solid #f1f5f9'
                    }}>
                        <div style={{ color: 'var(--secondary)' }}><Settings size={28} /></div>
                        Configuracion
                    </Link>
                </div>
            </div>
        </div>
    );
}
