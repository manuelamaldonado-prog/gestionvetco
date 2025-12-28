import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings, PlusCircle, CreditCard, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import React from 'react';

const NavItem = ({ to, icon: Icon, label, active }) => (
    <Link
        to={to}
        style={{
            color: active ? 'var(--primary)' : 'var(--text-secondary)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '12px',
            background: active ? 'var(--primary-soft)' : 'transparent',
            transition: 'all 0.2s ease',
            fontSize: '0.9rem',
            fontWeight: active ? '700' : '500'
        }}
    >
        <Icon size={18} strokeWidth={active ? 2.5 : 2} />
        <span>{label}</span>
    </Link>
);

export default function Layout({ children }) {
    const location = useLocation();
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallBtn, setShowInstallBtn] = useState(false);

    class ErrorBoundary extends React.Component {
        constructor(props) {
            super(props);
            this.state = { hasError: false, error: null };
        }
        static getDerivedStateFromError(error) {
            return { hasError: true, error };
        }
        componentDidCatch(error, info) {
            console.error('UI Error:', error, info);
        }
        render() {
            if (this.state.hasError) {
                return (
                    <div className="container" style={{ padding: '1rem' }}>
                        <div className="card" style={{ border: '1px solid #fee2e2', background: '#fef2f2', color: '#b91c1c' }}>
                            <h3 style={{ marginTop: 0 }}>Se produjo un error en la interfaz</h3>
                            <div className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>
                                Intente limpiar el caché y recargar.
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        try {
                                            localStorage.removeItem('CLIENT_JOB_MANAGER_DATA_V1');
                                            location.reload();
                                        } catch {}
                                    }}
                                >
                                    Limpiar datos locales
                                </button>
                                <button className="btn btn-primary" onClick={() => location.reload()}>
                                    Recargar
                                </button>
                            </div>
                            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
                                {String(this.state.error)}
                            </div>
                        </div>
                    </div>
                );
            }
            return this.props.children;
        }
    }

    useEffect(() => {
        if (import.meta.env.DEV && 'serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(regs => {
                regs.forEach(r => r.unregister());
            });
            if (window.caches && window.caches.keys) {
                window.caches.keys().then(keys => keys.forEach(k => window.caches.delete(k)));
            }
        }
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallBtn(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setShowInstallBtn(false);
        }
    };

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Inicio' },
        { to: '/clients', icon: Users, label: 'Clientes' },
        { to: '/reports', icon: FileText, label: 'Informes' },
        { to: '/catalog', icon: Settings, label: 'Config' },
    ];

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <header style={{
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                padding: '0.5rem 1.5rem',
                position: 'sticky',
                top: 0,
                zIndex: 1000,
                borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
                <div style={{
                    maxWidth: '1100px',
                    margin: '0 auto',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    height: '60px',
                    gap: '1rem'
                }}>
                    <h1 style={{
                        fontSize: '1.25rem',
                        fontWeight: '800',
                        color: 'var(--text-main)',
                        margin: 0,
                        fontFamily: 'Outfit, sans-serif',
                        flexShrink: 0
                    }}>
                        <span style={{ color: 'var(--primary)' }}>Mi</span>Gestión
                    </h1>

                    <nav style={{
                        display: 'flex',
                        gap: '4px',
                        overflowX: 'auto',
                        scrollbarWidth: 'none',
                        padding: '4px'
                    }}>
                        {navItems.map(item => (
                            <NavItem
                                key={item.to}
                                {...item}
                                active={location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))}
                            />
                        ))}
                    </nav>

                    {showInstallBtn && (
                        <button
                            onClick={handleInstall}
                            className="btn btn-primary"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}
                        >
                            <Download size={14} /> Instalar
                        </button>
                    )}
                </div>
            </header>

            <main className="container" style={{ flex: 1, width: '100%', animation: 'fadeIn 0.5s ease-out' }}>
                <style>{`
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    nav::-webkit-scrollbar { display: none; }
                `}</style>
                <ErrorBoundary>
                    {children}
                </ErrorBoundary>
            </main>
        </div>
    );
}
